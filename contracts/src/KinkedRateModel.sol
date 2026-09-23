// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {IInterestRateModel} from "./interfaces/IInterestRateModel.sol";

/// @title KinkedRateModel
/// @notice Borrow rate rises gently with utilization up to `kink`, then steeply above it so that
///         high utilization pulls in lenders and pushes out borrowers, keeping withdrawals liquid.
contract KinkedRateModel is IInterestRateModel {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    uint256 public immutable baseRatePerYear;
    uint256 public immutable slope1PerYear;
    uint256 public immutable slope2PerYear;
    uint256 public immutable kink;

    error InvalidKink();

    /// @param baseRatePerYear_ Rate at 0% utilization (1e18 = 100% APR).
    /// @param slope1PerYear_ Rate added between 0% and `kink_` utilization.
    /// @param slope2PerYear_ Rate added between `kink_` and 100% utilization.
    /// @param kink_ Target utilization, 1e18 = 100%.
    constructor(uint256 baseRatePerYear_, uint256 slope1PerYear_, uint256 slope2PerYear_, uint256 kink_) {
        if (kink_ == 0 || kink_ >= WAD) revert InvalidKink();
        baseRatePerYear = baseRatePerYear_;
        slope1PerYear = slope1PerYear_;
        slope2PerYear = slope2PerYear_;
        kink = kink_;
    }

    function utilization(uint256 cash, uint256 debt) public pure returns (uint256) {
        uint256 total = cash + debt;
        return total == 0 ? 0 : debt * WAD / total;
    }

    function borrowRatePerYear(uint256 cash, uint256 debt) public view returns (uint256) {
        uint256 u = utilization(cash, debt);
        if (u <= kink) return baseRatePerYear + slope1PerYear * u / kink;
        return baseRatePerYear + slope1PerYear + slope2PerYear * (u - kink) / (WAD - kink);
    }

    function borrowRatePerSecond(uint256 cash, uint256 debt) external view returns (uint256) {
        return borrowRatePerYear(cash, debt) / SECONDS_PER_YEAR;
    }
}
