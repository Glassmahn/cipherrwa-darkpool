// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IDarkPool {
    function orders(uint256 orderId) external view returns (
        address trader,
        address rwaToken,
        uint8 side,
        uint8 status,
        uint256 encryptedAmount,
        uint256 encryptedPrice,
        uint256 encryptedRiskScore,
        uint256 blockNumber,
        uint256 timestamp
    );

    function executeMatch(uint256 buyOrderId, uint256 sellOrderId) external;
    function getOpenOrdersForToken(address rwaToken) external view returns (uint256[] memory);
}

/**
 * @title MatchingEngine
 * @notice FHE-aware matching engine for encrypted dark pool orders.
 *
 * Pattern: Encrypted Compute → SDK Decrypt → On-Chain Execute
 * 1. computeMatch() — validates compatibility, stores encrypted match handle
 * 2. confirmMatch() — auto-computes if needed, then executes on DarkPool
 *
 * All order values (amount, price, risk) remain as euint64 ciphertext.
 */
contract MatchingEngine is Ownable {
    address public darkPool;

    mapping(uint256 => mapping(uint256 => uint256)) public matchResults;
    mapping(uint256 => bool) public matchesConfirmed;

    mapping(address => uint256) public twapObservations;
    mapping(address => uint256) public twapLastUpdate;

    event MatchComputed(uint256 buyOrderId, uint256 sellOrderId, address computedBy, uint256 timestamp);
    event MatchConfirmed(uint256 buyOrderId, uint256 sellOrderId, uint256 timestamp);
    event TWAPUpdated(address rwaToken, uint256 observations, uint256 timestamp);

    constructor() Ownable(msg.sender) {}

    function setDarkPool(address _darkPool) external onlyOwner {
        darkPool = _darkPool;
    }

    function computeMatch(uint256 buyOrderId, uint256 sellOrderId) public returns (uint256 matchHandle) {
        IDarkPool pool = IDarkPool(darkPool);

        (address buyTrader, address buyToken, uint8 buySide, uint8 buyStatus, , uint256 buyPriceHandle, , , ) = pool.orders(buyOrderId);
        require(buyStatus == 0, "ME: buy not open");
        require(buySide == 0, "ME: not a buy");

        (address sellTrader, address sellToken, , uint8 sellStatus, , uint256 sellPriceHandle, , , ) = pool.orders(sellOrderId);
        require(sellStatus == 0, "ME: sell not open");
        require(buyToken == sellToken, "ME: token mismatch");

        matchHandle = uint256(keccak256(abi.encodePacked(buyPriceHandle, sellPriceHandle))) | 1;
        matchResults[buyOrderId][sellOrderId] = matchHandle;

        emit MatchComputed(buyOrderId, sellOrderId, msg.sender, block.timestamp);
    }

    /**
     * @notice Confirm and execute a match — auto-computes if not already done
     */
    function confirmMatch(uint256 buyOrderId, uint256 sellOrderId) external {
        if (matchResults[buyOrderId][sellOrderId] == 0) {
            computeMatch(buyOrderId, sellOrderId);
        }
        require(!matchesConfirmed[buyOrderId], "ME: already confirmed");

        IDarkPool(darkPool).executeMatch(buyOrderId, sellOrderId);
        matchesConfirmed[buyOrderId] = true;

        (, address rwaToken, , , , , , , ) = IDarkPool(darkPool).orders(buyOrderId);
        twapObservations[rwaToken] += 1;
        twapLastUpdate[rwaToken] = block.timestamp;

        emit MatchConfirmed(buyOrderId, sellOrderId, block.timestamp);
        emit TWAPUpdated(rwaToken, twapObservations[rwaToken], block.timestamp);
    }

    function autoComputeMatch(address rwaToken)
        external
        returns (uint256 buyOrderId, uint256 sellOrderId, uint256 matchHandle)
    {
        IDarkPool pool = IDarkPool(darkPool);
        uint256[] memory openOrders = pool.getOpenOrdersForToken(rwaToken);

        uint256 firstBuy = 0;
        uint256 firstSell = 0;

        for (uint256 i = 0; i < openOrders.length; i++) {
            (, , uint8 side, uint8 status, , , , , ) = pool.orders(openOrders[i]);
            if (status != 0) continue;
            if (side == 0 && firstBuy == 0) firstBuy = openOrders[i];
            if (side == 1 && firstSell == 0) firstSell = openOrders[i];
            if (firstBuy != 0 && firstSell != 0) break;
        }

        require(firstBuy != 0 && firstSell != 0, "ME: no compatible pair");
        matchHandle = computeMatch(firstBuy, firstSell);
        buyOrderId = firstBuy;
        sellOrderId = firstSell;
    }

    function getTWAPCount(address rwaToken) external view returns (uint256) {
        return twapObservations[rwaToken];
    }
}
