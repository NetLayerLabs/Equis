// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

interface IInterestRateModel {
    /// @return Borrow rate per second, scaled by 1e18.
    function borrowRatePerSecond(uint256 cash, uint256 debt) external view returns (uint256);
}
