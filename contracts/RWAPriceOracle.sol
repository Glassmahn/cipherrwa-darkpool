// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RWAPriceOracle
 * @notice Price oracle for RWA tokens. Placeholder for Chainlink/Pyth integration.
 *         Provides reference prices for cTBILL, cREAL, and cCARBON assets.
 */
contract RWAPriceOracle is Ownable {
    mapping(address => uint256) public prices;
    mapping(address => uint256) public lastUpdated;
    mapping(address => address) public priceFeed;

    struct PriceData {
        uint256 price;
        uint256 timestamp;
        address source;
    }

    mapping(address => PriceData[]) public priceHistory;

    event PriceUpdated(address rwaToken, uint256 price, uint256 timestamp);
    event FeedSet(address rwaToken, address feed);

    constructor() Ownable(msg.sender) {}

    function setPriceFeed(address rwaToken, address feed) external onlyOwner {
        priceFeed[rwaToken] = feed;
        emit FeedSet(rwaToken, feed);
    }

    function updatePrice(address rwaToken, uint256 price) external onlyOwner {
        require(price > 0, "Oracle: invalid price");
        prices[rwaToken] = price;
        lastUpdated[rwaToken] = block.timestamp;
        priceHistory[rwaToken].push(PriceData({
            price: price,
            timestamp: block.timestamp,
            source: msg.sender
        }));
        emit PriceUpdated(rwaToken, price, block.timestamp);
    }

    function getPrice(address rwaToken) external view returns (uint256, uint256) {
        return (prices[rwaToken], lastUpdated[rwaToken]);
    }

    function getPriceHistory(address rwaToken, uint256 start, uint256 end) external view returns (PriceData[] memory) {
        uint256 len = priceHistory[rwaToken].length;
        if (end > len) end = len;
        if (start >= end) return new PriceData[](0);

        uint256 count = end - start;
        PriceData[] memory result = new PriceData[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = priceHistory[rwaToken][start + i];
        }
        return result;
    }

    function getTWAP(address rwaToken, uint256 period) external view returns (uint256) {
        uint256 len = priceHistory[rwaToken].length;
        if (len == 0) return 0;

        uint256 sum = 0;
        uint256 count = 0;
        uint256 cutoff = block.timestamp - period;

        for (uint256 i = len; i > 0; i--) {
            if (priceHistory[rwaToken][i - 1].timestamp < cutoff) break;
            sum += priceHistory[rwaToken][i - 1].price;
            count++;
        }

        return count > 0 ? sum / count : 0;
    }
}
