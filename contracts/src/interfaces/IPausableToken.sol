// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

/// @notice Pause flag exposed by xStocks (Backed) tokens and wrappers. Paused tokens can't be transferred.
interface IPausableToken {
    function isPaused() external view returns (bool);
}
