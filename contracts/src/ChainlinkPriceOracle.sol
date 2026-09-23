// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IVerifierProxy} from "./interfaces/chainlink/IVerifierProxy.sol";
import {AggregatorV3Interface} from "./interfaces/chainlink/AggregatorV3Interface.sol";

/// @title ChainlinkPriceOracle
/// @notice Prices for EquisMarginVault from Chainlink on X Layer.
///         - xStocks wrappers (wNVDAx, …): Data Streams v10 reports verified on-chain through the VerifierProxy.
///           A wrapper unit is one internal xStock share, so it's valued at Chainlink's theoretical price
///           `price × currentMultiplier`.
///         - Everything else (USD₮0): Chainlink push feeds.
///         Every read also checks the X Layer sequencer uptime feed.
/// @dev Report prices and multipliers are treated as 18-decimal fixed point (per Chainlink's SDK docs); confirm
///      against a live v10 report before mainnet use.
contract ChainlinkPriceOracle is IPriceOracle, Ownable2Step {
    uint256 internal constant WAD = 1e18;
    uint16 internal constant SCHEMA_V10 = 0x000a;
    uint32 internal constant MARKET_STATUS_OPEN = 2;
    uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
    /// @notice Max relative gap between the report's multiplier and the wrapper's live on-chain rate (0.1%).
    uint256 public constant MULTIPLIER_TOLERANCE = 1e15;

    /// @dev Data Streams report schema v10 (tokenized assets). Field order must match the DON encoding.
    struct ReportV10 {
        bytes32 feedId;
        uint32 validFromTimestamp;
        uint32 observationsTimestamp;
        uint192 nativeFee;
        uint192 linkFee;
        uint32 expiresAt;
        uint64 lastUpdateTimestamp;
        int192 price;
        uint32 marketStatus;
        int192 currentMultiplier;
        int192 newMultiplier;
        uint32 activationDateTime;
        int192 tokenizedPrice;
    }

    struct StreamConfig {
        bytes32 feedId;
        /// @dev A stored report older than this (by observation time) is stale.
        uint32 maxReportAge;
        /// @dev How long before a scheduled multiplier change the market is treated as closed.
        uint32 corporateActionWindow;
    }

    struct StreamPrice {
        /// @dev USD price of one wrapper unit, 1e18.
        uint256 price;
        uint256 multiplier;
        uint32 observedAt;
        uint32 marketStatus;
        uint32 activationDateTime;
    }

    struct FeedConfig {
        AggregatorV3Interface feed;
        uint8 decimals;
        uint32 maxAge;
    }

    IVerifierProxy public immutable verifierProxy;
    AggregatorV3Interface public immutable sequencerUptimeFeed;

    mapping(address asset => StreamConfig) public streamConfig;
    mapping(bytes32 feedId => address asset) public assetOfFeed;
    mapping(address asset => StreamPrice) public streamPrice;
    mapping(address asset => FeedConfig) public feedConfig;

    event StreamPriceUpdated(
        address indexed asset, bytes32 indexed feedId, uint256 price, uint32 observedAt, uint32 marketStatus
    );
    event StreamSet(address indexed asset, bytes32 indexed feedId, uint32 maxReportAge, uint32 corporateActionWindow);
    event FeedSet(address indexed asset, AggregatorV3Interface indexed feed, uint32 maxAge);

    error ZeroAddress();
    error UnsupportedSchema(bytes32 feedId);
    error FeedAlreadyAssigned(bytes32 feedId, address asset);
    error UnknownFeed(bytes32 feedId);
    error ReportNotYetValid(bytes32 feedId);
    error ReportExpired(bytes32 feedId);
    error InvalidReport(bytes32 feedId);
    error PriceUnavailable(address asset);
    error StalePrice(address asset);
    error MultiplierMismatch(address asset, uint256 reportMultiplier, uint256 onchainMultiplier);
    error SequencerDown();
    error SequencerGracePeriod();

    constructor(IVerifierProxy verifierProxy_, AggregatorV3Interface sequencerUptimeFeed_, address owner_)
        Ownable(owner_)
    {
        if (address(verifierProxy_) == address(0) || address(sequencerUptimeFeed_) == address(0)) revert ZeroAddress();
        verifierProxy = verifierProxy_;
        sequencerUptimeFeed = sequencerUptimeFeed_;
    }

    // ---------------------------------------------------------------------------------------------
    // Reports
    // ---------------------------------------------------------------------------------------------

    /// @notice Verifies Data Streams v10 reports and stores each asset's price. Anyone may submit; reports are
    ///         DON-signed, and a report is ignored unless it's newer than the stored one.
    function updatePrices(bytes[] calldata reports) external {
        for (uint256 i; i < reports.length; ++i) {
            bytes memory reportData = verifierProxy.verify(reports[i], "");
            ReportV10 memory report = abi.decode(reportData, (ReportV10));

            if (uint16(bytes2(report.feedId)) != SCHEMA_V10) revert UnsupportedSchema(report.feedId);
            address asset = assetOfFeed[report.feedId];
            if (asset == address(0)) revert UnknownFeed(report.feedId);
            if (block.timestamp < report.validFromTimestamp) revert ReportNotYetValid(report.feedId);
            if (block.timestamp > report.expiresAt) revert ReportExpired(report.feedId);
            if (report.price <= 0 || report.currentMultiplier <= 0) revert InvalidReport(report.feedId);

            StreamPrice storage stored = streamPrice[asset];
            if (report.observationsTimestamp <= stored.observedAt) continue;

            // Both values were just checked to be positive.
            // forge-lint: disable-next-line(unsafe-typecast)
            uint256 multiplier = uint256(int256(report.currentMultiplier));
            // forge-lint: disable-next-line(unsafe-typecast)
            uint256 price = uint256(int256(report.price)) * multiplier / WAD;

            stored.price = price;
            stored.multiplier = multiplier;
            stored.observedAt = report.observationsTimestamp;
            stored.marketStatus = report.marketStatus;
            stored.activationDateTime = report.activationDateTime;

            emit StreamPriceUpdated(asset, report.feedId, price, report.observationsTimestamp, report.marketStatus);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Prices
    // ---------------------------------------------------------------------------------------------

    function getPrice(address asset) external view returns (uint256 price, bool marketOpen) {
        _checkSequencer();

        StreamConfig memory stream = streamConfig[asset];
        if (stream.feedId != bytes32(0)) return _streamPrice(asset, stream);

        FeedConfig memory feed = feedConfig[asset];
        if (address(feed.feed) != address(0)) return (_feedPrice(asset, feed), true);

        revert PriceUnavailable(asset);
    }

    function _streamPrice(address asset, StreamConfig memory stream) internal view returns (uint256, bool) {
        StreamPrice memory stored = streamPrice[asset];
        if (stored.observedAt == 0 || block.timestamp > uint256(stored.observedAt) + stream.maxReportAge) {
            revert StalePrice(asset);
        }

        // The wrapper converts at its token's live multiplier. If the report disagrees, a corporate action is
        // mid-flight and Chainlink advises against using the theoretical price until it settles.
        uint256 onchainMultiplier = IERC4626(asset).convertToAssets(WAD);
        uint256 gap = onchainMultiplier > stored.multiplier
            ? onchainMultiplier - stored.multiplier
            : stored.multiplier - onchainMultiplier;
        if (gap * WAD > stored.multiplier * MULTIPLIER_TOLERANCE) {
            revert MultiplierMismatch(asset, stored.multiplier, onchainMultiplier);
        }

        bool actionPending = stored.activationDateTime != 0
            && block.timestamp + stream.corporateActionWindow >= stored.activationDateTime;
        return (stored.price, stored.marketStatus == MARKET_STATUS_OPEN && !actionPending);
    }

    function _feedPrice(address asset, FeedConfig memory cfg) internal view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = cfg.feed.latestRoundData();
        if (answer <= 0 || block.timestamp > updatedAt + cfg.maxAge) revert StalePrice(asset);
        // `answer` was just checked to be positive.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(answer) * 10 ** (18 - cfg.decimals);
    }

    function _checkSequencer() internal view {
        (, int256 answer, uint256 startedAt,,) = sequencerUptimeFeed.latestRoundData();
        if (answer != 0) revert SequencerDown();
        if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) revert SequencerGracePeriod();
    }

    // ---------------------------------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------------------------------

    /// @notice Prices an xStocks wrapper from a Data Streams v10 feed. Clears any stored price for the asset.
    function setStream(address asset, bytes32 feedId, uint32 maxReportAge, uint32 corporateActionWindow)
        external
        onlyOwner
    {
        if (asset == address(0)) revert ZeroAddress();
        // The first two bytes of a stream ID are its report schema version.
        // forge-lint: disable-next-line(unsafe-typecast)
        if (uint16(bytes2(feedId)) != SCHEMA_V10) revert UnsupportedSchema(feedId);
        address assigned = assetOfFeed[feedId];
        if (assigned != address(0) && assigned != asset) revert FeedAlreadyAssigned(feedId, assigned);

        bytes32 previous = streamConfig[asset].feedId;
        if (previous != bytes32(0)) delete assetOfFeed[previous];

        streamConfig[asset] = StreamConfig(feedId, maxReportAge, corporateActionWindow);
        assetOfFeed[feedId] = asset;
        delete streamPrice[asset];
        emit StreamSet(asset, feedId, maxReportAge, corporateActionWindow);
    }

    /// @notice Prices `asset` from a Chainlink push feed. `maxAge` should exceed the feed's heartbeat.
    function setFeed(address asset, AggregatorV3Interface feed, uint32 maxAge) external onlyOwner {
        if (asset == address(0) || address(feed) == address(0)) revert ZeroAddress();
        feedConfig[asset] = FeedConfig(feed, feed.decimals(), maxAge);
        emit FeedSet(asset, feed, maxAge);
    }
}
