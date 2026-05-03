// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm/lib/Impl.sol";
import "fhevm/gateway/GatewayCaller.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DarkPool
 * @notice Fully homomorphic encrypted dark pool for RWA order placement.
 *         All order parameters (amount, price, risk score) are encrypted as euint64.
 *         Matching is performed homomorphically without decryption.
 */
contract DarkPool is Ownable, GatewayCaller {
    using TFHE for *;

    // ── Enums ─────────────────────────────────────────────────────────────
    enum OrderSide { BUY, SELL }
    enum OrderStatus { OPEN, MATCHED, CANCELLED, SETTLED }

    // ── Structs ───────────────────────────────────────────────────────────
    struct Order {
        address trader;
        address rwaToken;
        OrderSide side;
        OrderStatus status;
        euint64 encryptedAmount;
        euint64 encryptedPrice;
        euint64 encryptedRiskScore;
        uint256 blockNumber;
        uint256 timestamp;
    }

    // ── State ─────────────────────────────────────────────────────────────
    mapping(uint256 => Order) public orders;
    mapping(address => uint256[]) public traderOrders;
    mapping(address => bool) public authorizedTraders;
    mapping(address => bool) public whitelistedTokens;

    uint256 public nextOrderId;
    uint256 public totalOrdersCount;
    uint256 public matchedCount;

    address public matchingEngine;

    // ── Events ────────────────────────────────────────────────────────────
    event OrderPlaced(
        uint256 orderId,
        address indexed trader,
        address indexed rwaToken,
        OrderSide side,
        uint256 timestamp
    );
    event OrderMatched(uint256 orderId, uint256 matchedWith, uint256 timestamp);
    event OrderCancelled(uint256 orderId, address indexed trader);
    event TraderAuthorized(address indexed trader, bool status);
    event TokenWhitelisted(address indexed token, bool status);

    // ── Modifiers ─────────────────────────────────────────────────────────
    modifier onlyAuthorized() {
        require(authorizedTraders[msg.sender], "DarkPool: not authorized");
        _;
    }

    modifier onlyMatchingEngine() {
        require(msg.sender == matchingEngine, "DarkPool: only matching engine");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setMatchingEngine(address _engine) external onlyOwner {
        matchingEngine = _engine;
    }

    function authorizeTrader(address trader, bool status) external onlyOwner {
        authorizedTraders[trader] = status;
        emit TraderAuthorized(trader, status);
    }

    function whitelistToken(address token, bool status) external onlyOwner {
        whitelistedTokens[token] = status;
        emit TokenWhitelisted(token, status);
    }

    /**
     * @notice Place an encrypted order
     * @param handles Array of FHE handles [amount, price, riskScore]
     * @param inputProof ZK input proof
     * @param rwaToken RWA token address
     * @param side BUY (0) or SELL (1)
     */
    function placeEncryptedOrder(
        bytes32[] calldata handles,
        bytes calldata inputProof,
        address rwaToken,
        OrderSide side
    ) external onlyAuthorized returns (uint256 orderId) {
        require(whitelistedTokens[rwaToken], "DarkPool: token not whitelisted");
        require(handles.length >= 3, "DarkPool: invalid handles length");

        euint64 amount = TFHE.asEuint64(einput.wrap(handles[0]), inputProof);
        euint64 price = TFHE.asEuint64(einput.wrap(handles[1]), inputProof);
        euint64 riskScore = TFHE.asEuint64(einput.wrap(handles[2]), inputProof);

        orderId = nextOrderId++;
        orders[orderId] = Order({
            trader: msg.sender,
            rwaToken: rwaToken,
            side: side,
            status: OrderStatus.OPEN,
            encryptedAmount: amount,
            encryptedPrice: price,
            encryptedRiskScore: riskScore,
            blockNumber: block.number,
            timestamp: block.timestamp
        });

        // Grant ACL permissions
        TFHE.allow(amount, address(this));
        TFHE.allow(amount, msg.sender);
        TFHE.allow(price, address(this));
        TFHE.allow(price, msg.sender);
        TFHE.allow(riskScore, address(this));
        TFHE.allow(riskScore, msg.sender);
        if (matchingEngine != address(0)) {
            TFHE.allowTransient(amount, matchingEngine);
            TFHE.allowTransient(price, matchingEngine);
            TFHE.allowTransient(riskScore, matchingEngine);
        }

        traderOrders[msg.sender].push(orderId);
        totalOrdersCount++;

        emit OrderPlaced(orderId, msg.sender, rwaToken, side, block.timestamp);
    }

    function cancelOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(order.trader == msg.sender, "DarkPool: not your order");
        require(order.status == OrderStatus.OPEN, "DarkPool: order not open");
        order.status = OrderStatus.CANCELLED;
        emit OrderCancelled(orderId, msg.sender);
    }

    function getTraderOrders(address trader) external view returns (uint256[] memory) {
        return traderOrders[trader];
    }

    function getOrderMeta(uint256 orderId) external view returns (
        address trader,
        address rwaToken,
        OrderSide side,
        OrderStatus status,
        uint256 blockNumber,
        uint256 timestamp
    ) {
        Order storage o = orders[orderId];
        return (o.trader, o.rwaToken, o.side, o.status, o.blockNumber, o.timestamp);
    }

    function requestSettlement(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(order.trader == msg.sender, "DarkPool: not your order");
        require(order.status == OrderStatus.MATCHED, "DarkPool: order not matched");

        uint256[] memory handles = new uint256[](2);
        handles[0] = euint64.unwrap(order.encryptedAmount);
        handles[1] = euint64.unwrap(order.encryptedPrice);

        Gateway.requestDecryption(
            handles,
            this.settlementCallback.selector,
            0,
            block.timestamp + 300,
            false
        );

        order.status = OrderStatus.SETTLED;
        matchedCount++;
    }

    function settlementCallback(
        uint256 requestID,
        uint64 amount,
        uint64 price
    ) external onlyGateway {
        emit OrderSettled(requestID, amount, price);
    }

    event OrderSettled(uint256 orderId, uint64 amount, uint64 price);
}
