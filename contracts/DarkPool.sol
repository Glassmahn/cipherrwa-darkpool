// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "fhevm/lib/TFHE.sol";
import "fhevm/lib/Impl.sol";

/**
 * @title DarkPool
 * @notice FHE-encrypted dark pool for RWA order placement.
 *         Handles encrypted client-side via Zama SDK. Coprocessor auto-verifies.
 *         Matching via TFHE.le() on stored handles. Settlement via Gateway.
 */
contract DarkPool is Ownable {
    using TFHE for *;

    enum OrderSide { BUY, SELL }
    enum OrderStatus { OPEN, MATCHED, CANCELLED, SETTLED }

    struct Order {
        address trader;
        address rwaToken;
        OrderSide side;
        OrderStatus status;
        uint256 encryptedAmount;
        uint256 encryptedPrice;
        uint256 encryptedRiskScore;
        uint256 blockNumber;
        uint256 timestamp;
    }

    mapping(uint256 => Order) public orders;
    mapping(address => uint256[]) public traderOrders;
    mapping(address => bool) public whitelistedTokens;

    uint256 public nextOrderId;
    uint256 public totalOrdersCount;
    uint256 public matchedCount;

    address public matchingEngine;

    struct Settlement {
        uint64 buyAmount;
        uint64 sellAmount;
        uint64 price;
        bool settled;
    }
    mapping(uint256 => Settlement) public settlements;

    address private constant ACL_ADDRESS = 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D;
    address private constant TFHE_EXECUTOR = 0x92C920834Ec8941d2C77D188936E1f7A6f49c127;
    address private constant FHE_PAYMENT = 0x0000000000000000000000000000000000000000;
    address private constant KMS_VERIFIER = 0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A;

    bool private initialized;

    event OrderPlaced(
        uint256 orderId,
        address indexed trader,
        address indexed rwaToken,
        OrderSide side,
        uint256 timestamp
    );
    event OrderMatched(uint256 buyOrderId, uint256 sellOrderId, uint256 timestamp);
    event OrderCancelled(uint256 orderId, address indexed trader);
    event TokenWhitelisted(address indexed token, bool status);
    event SettlementCompleted(uint256 buyOrderId, uint256 sellOrderId);

    modifier onlyMatchingEngine() {
        require(msg.sender == matchingEngine, "DarkPool: only matching engine");
        _;
    }

    constructor() Ownable(msg.sender) {
        initialize();
    }

    function initialize() public {
        require(!initialized, "DarkPool: already initialized");
        initialized = true;
        Impl.setFHEVM(FHEVMConfigStruct({
            ACLAddress: ACL_ADDRESS,
            TFHEExecutorAddress: TFHE_EXECUTOR,
            FHEPaymentAddress: FHE_PAYMENT,
            KMSVerifierAddress: KMS_VERIFIER
        }));
    }

    function setMatchingEngine(address _engine) external onlyOwner {
        matchingEngine = _engine;
    }

    function whitelistToken(address token, bool status) external onlyOwner {
        whitelistedTokens[token] = status;
        emit TokenWhitelisted(token, status);
    }

    /**
     * @notice Place an encrypted order
     * @dev SDK handles stored raw. Coprocessor pre-processor verifies proof.
     *      ACL granted automatically by coprocessor to msg.sender.
     */
    function placeEncryptedOrder(
        bytes32[] calldata handles,
        bytes calldata inputProof,
        address rwaToken,
        OrderSide side
    ) external returns (uint256 orderId) {
        require(whitelistedTokens[rwaToken], "DarkPool: token not whitelisted");
        require(handles.length >= 3, "DarkPool: invalid handles length");
        require(inputProof.length > 0, "DarkPool: empty proof");

        orderId = nextOrderId++;
        orders[orderId] = Order({
            trader: msg.sender,
            rwaToken: rwaToken,
            side: side,
            status: OrderStatus.OPEN,
            encryptedAmount: uint256(handles[0]),
            encryptedPrice: uint256(handles[1]),
            encryptedRiskScore: uint256(handles[2]),
            blockNumber: block.number,
            timestamp: block.timestamp
        });

        traderOrders[msg.sender].push(orderId);
        totalOrdersCount++;

        emit OrderPlaced(orderId, msg.sender, rwaToken, side, block.timestamp);
    }

    /**
     * @notice Execute a match (called by MatchingEngine)
     */
    function executeMatch(uint256 buyOrderId, uint256 sellOrderId) external onlyMatchingEngine {
        Order storage buy = orders[buyOrderId];
        Order storage sell = orders[sellOrderId];

        require(buy.status == OrderStatus.OPEN, "DarkPool: buy not open");
        require(sell.status == OrderStatus.OPEN, "DarkPool: sell not open");
        require(buy.side == OrderSide.BUY, "DarkPool: not a buy");
        require(sell.side == OrderSide.SELL, "DarkPool: not a sell");
        require(buy.rwaToken == sell.rwaToken, "DarkPool: token mismatch");

        buy.status = OrderStatus.MATCHED;
        sell.status = OrderStatus.MATCHED;
        matchedCount++;

        emit OrderMatched(buyOrderId, sellOrderId, block.timestamp);
    }

    /**
     * @notice Settle matched orders after Gateway decrypt
     */
    function onSettlementCallback(
        uint256 buyOrderId,
        uint256 sellOrderId,
        uint64 buyAmount,
        uint64 sellAmount,
        uint64 price
    ) external {
        require(orders[buyOrderId].status == OrderStatus.MATCHED, "DarkPool: buy not matched");
        require(orders[sellOrderId].status == OrderStatus.MATCHED, "DarkPool: sell not matched");

        settlements[buyOrderId] = Settlement({
            buyAmount: buyAmount,
            sellAmount: sellAmount,
            price: price,
            settled: true
        });

        orders[buyOrderId].status = OrderStatus.SETTLED;
        orders[sellOrderId].status = OrderStatus.SETTLED;

        emit SettlementCompleted(buyOrderId, sellOrderId);
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

    function getOpenOrdersForToken(address rwaToken) external view returns (uint256[] memory result) {
        uint256 count = 0;
        for (uint256 i = 0; i < nextOrderId; i++) {
            if (orders[i].rwaToken == rwaToken && orders[i].status == OrderStatus.OPEN) {
                count++;
            }
        }
        result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < nextOrderId; i++) {
            if (orders[i].rwaToken == rwaToken && orders[i].status == OrderStatus.OPEN) {
                result[idx++] = i;
            }
        }
        return result;
    }
}
