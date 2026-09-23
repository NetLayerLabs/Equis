// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

/// @notice Chainlink push feed interface (price feeds and the L2 sequencer uptime feed).
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function description() external view returns (string memory);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
