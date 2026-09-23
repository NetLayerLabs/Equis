// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

interface IPriceOracle {
    /// @notice Verifies signed price reports and stores the prices for use later in the same transaction.
    function updatePrices(bytes[] calldata reports) external;

    /// @notice USD price of one whole unit of `asset`. Reverts if the price is missing or stale.
    /// @return price USD price, 1e18 = $1.
    /// @return marketOpen False while the asset's underlying market is closed (weekends, holidays, halts).
    function getPrice(address asset) external view returns (uint256 price, bool marketOpen);
}
