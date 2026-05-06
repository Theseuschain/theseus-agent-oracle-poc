// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @notice Constant Chainlink-shaped feed. Used for USDC ($1) in the demo
///         so we don't need to wire a second agent for the stablecoin.
contract FixedPriceFeed {
    int256 public immutable price;
    uint8 public immutable decimals;
    string public description;

    constructor(int256 price_, uint8 decimals_, string memory description_) {
        price = price_;
        decimals = decimals_;
        description = description_;
    }

    function latestAnswer() external view returns (int256) {
        return price;
    }

    function latestTimestamp() external view returns (uint256) {
        return block.timestamp;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (1, price, block.timestamp, block.timestamp, 1);
    }
}
