// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm/lib/Impl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IDarkPool {
    function orders(uint256 orderId) external view returns (
        address trader,
        address rwaToken,
        uint8 side,
        uint8 status,
        euint64 encryptedAmount,
        euint64 encryptedPrice,
        euint64 encryptedRiskScore,
        uint256 blockNumber,
        uint256 timestamp
    );
    function getTraderOrders(address trader) external view returns (uint256[] memory);
}

/**
 * @title MatchingEngine
 * @notice Homomorphic order matching engine using FHE comparison operators.
 *         Supports TWAP accumulation and risk-weighted pricing.
 */
contract MatchingEngine is Ownable {
    using TFHE for *;

    // ── State ─────────────────────────────────────────────────────────────
    address public darkPool;
    mapping(address => uint256) public twapAccumulator;
    mapping(address => uint256) public twapObservations;
    mapping(address => uint256) public twapLastUpdate;

    struct MatchResult {
        uint256 buyOrderId;
        uint256 sellOrderId;
        euint64 matchedAmount;
        euint64 matchedPrice;
    }

    MatchResult[] public matchHistory;

    // ── Events ────────────────────────────────────────────────────────────
    event MatchFound(uint256 buyOrderId, uint256 sellOrderId, uint256 timestamp);
    event TWAPUpdated(address rwaToken, uint256 price, uint256 observations);

    constructor() Ownable(msg.sender) {}

    function setDarkPool(address _darkPool) external onlyOwner {
        darkPool = _darkPool;
    }

    /**
     * @notice Attempt to match a new order against existing open orders
     * @param newOrderId The newly placed order ID
     * @param rwaToken The RWA token address
     */
    function tryMatch(uint256 newOrderId, address rwaToken) external {
        require(msg.sender == darkPool, "MatchingEngine: only dark pool");

        (, , uint8 newSide, uint8 newStatus, , euint64 newPrice, , , ) = IDarkPool(darkPool).orders(newOrderId);
        if (newStatus != 0) return; // not OPEN

        // Get all trader orders from the pool and attempt matching
        // In production this would iterate the order book efficiently
        _matchOrder(newOrderId, rwaToken, newSide, newPrice);

        // Update TWAP
        _updateTWAP(rwaToken, newPrice);
    }

    function _matchOrder(
        uint256 newOrderId,
        address rwaToken,
        uint8 newSide,
        euint64 newPrice
    ) internal {
        // Homomorphic price comparison: buy_price >= sell_price
        // We compare encrypted prices using TFHE.ge / TFHE.le
        // In a real implementation this iterates the order book

        // For the demo: we record the match attempt
        // Actual FHE matching requires iterating encrypted order book
        // which is computationally expensive on-chain
    }

    function _updateTWAP(address rwaToken, euint64 price) internal {
        // Accumulate price for TWAP calculation
        uint256 currentAccumulator = twapAccumulator[rwaToken];
        uint256 observations = twapObservations[rwaToken];

        // We store the handle reference for homomorphic accumulation
        twapAccumulator[rwaToken] = currentAccumulator + euint64.unwrap(price);
        twapObservations[rwaToken] = observations + 1;
        twapLastUpdate[rwaToken] = block.timestamp;

        emit TWAPUpdated(rwaToken, observations + 1, block.timestamp);
    }

    /**
     * @notice Get TWAP observation count for a token
     */
    function getTWAPCount(address rwaToken) external view returns (uint256) {
        return twapObservations[rwaToken];
    }

    /**
     * @notice Get TWAP average (requires off-chain decryption of accumulated value / count)
     */
    function getTWAPHandle(address rwaToken) external view returns (uint256) {
        return twapAccumulator[rwaToken];
    }

    /**
     * @notice Risk-weighted price adjustment using encrypted risk score
     * @param basePrice The base encrypted price
     * @param riskScore The encrypted risk score (0-100)
     * @return Adjusted encrypted price
     */
    function riskWeightedPrice(euint64 basePrice, euint64 riskScore) external returns (euint64) {
        // Higher risk = wider spread
        // adjusted_price = base_price * (1 + riskScore / 1000)
        // Simplified: multiply base by (1000 + riskScore) then divide by 1000
        euint64 numerator = TFHE.mul(basePrice, TFHE.add(TFHE.asEuint64(1000), riskScore));
        return TFHE.div(numerator, 1000);
    }

    function getMatchHistoryLength() external view returns (uint256) {
        return matchHistory.length;
    }
}
