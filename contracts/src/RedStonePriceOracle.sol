// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {
    PrimaryProdDataServiceConsumerBase
} from "@redstone-finance/evm-connector/contracts/data-services/PrimaryProdDataServiceConsumerBase.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {AggregatorV3Interface} from "./interfaces/chainlink/AggregatorV3Interface.sol";

/// @title RedStonePriceOracle
/// @notice Prices Equis collateral on X Layer.
///         - xStocks wrappers: RedStone share prices, signed by its primary-prod signers and checked here.
///           Three of five signatures are required, and a package older than three minutes is rejected by the
///           consumer base. A wrapper is worth the share price times its onchain multiplier.
///         - Everything else (USD₮0): a Chainlink push feed.
///         Every read also checks the X Layer sequencer uptime feed.
/// @dev RedStone data rides at the END of the calldata of the call into this contract, so prices must be
///      refreshed by calling `updatePricesFor` directly with the payload appended — the vault cannot relay it.
///      Callers may also relay a payload through `updatePrices`, which re-enters this contract so the vault
///      can refresh prices inside a single borrow or liquidate transaction.
contract RedStonePriceOracle is IPriceOracle, PrimaryProdDataServiceConsumerBase, Ownable2Step {
    uint256 internal constant WAD = 1e18;
    /// @dev RedStone numeric values carry 8 decimals.
    uint256 internal constant REDSTONE_SCALE = 1e10;
    uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;

    struct StockConfig {
        bool listed;
        bytes32 dataFeedId;
        /// @dev Hard staleness: past this the price cannot be used at all.
        uint32 maxAge;
        /// @dev Within this window the underlying market counts as open, so borrowing is allowed.
        uint32 openWindow;
    }

    struct StockPrice {
        /// @dev USD price of one wrapper unit, 1e18.
        uint256 price;
        uint256 sharePrice;
        uint32 updatedAt;
    }

    struct FeedConfig {
        AggregatorV3Interface feed;
        uint8 decimals;
        uint32 maxAge;
    }

    AggregatorV3Interface public immutable sequencerUptimeFeed;

    mapping(address asset => StockConfig) public stockConfig;
    mapping(address asset => StockPrice) public stockPrice;
    mapping(address asset => FeedConfig) public feedConfig;

    event StockListed(address indexed asset, bytes32 dataFeedId, uint32 maxAge, uint32 openWindow);
    event FeedSet(address indexed asset, AggregatorV3Interface indexed feed, uint32 maxAge);
    event PriceUpdated(address indexed asset, uint256 price, uint256 sharePrice, uint256 multiplier);

    error ZeroAddress();
    error NotListed(address asset);
    error PriceUnavailable(address asset);
    error StalePrice(address asset);
    error InvalidPrice(address asset);
    error SequencerDown();
    error SequencerGracePeriod();

    constructor(AggregatorV3Interface sequencerUptimeFeed_, address owner_) Ownable(owner_) {
        if (address(sequencerUptimeFeed_) == address(0)) revert ZeroAddress();
        sequencerUptimeFeed = sequencerUptimeFeed_;
    }

    // ---------------------------------------------------------------------------------------------
    // Prices in
    // ---------------------------------------------------------------------------------------------

    /// @notice Verifies the RedStone payload appended to this call's calldata and caches a price per asset.
    /// @dev Anyone may call it: the payload carries DON signatures, so it cannot be forged. The payload must
    ///      contain every feed listed in `assets`, in this order.
    function updatePricesFor(address[] calldata assets) external {
        bytes32[] memory dataFeedIds = new bytes32[](assets.length);
        for (uint256 i; i < assets.length; ++i) {
            StockConfig memory config = stockConfig[assets[i]];
            if (!config.listed) revert NotListed(assets[i]);
            dataFeedIds[i] = config.dataFeedId;
        }

        uint256[] memory values = getOracleNumericValuesFromTxMsg(dataFeedIds);

        for (uint256 i; i < assets.length; ++i) {
            if (values[i] == 0) revert InvalidPrice(assets[i]);
            uint256 sharePrice = values[i] * REDSTONE_SCALE;
            // One wrapper unit is one internal xStock share, so it tracks the share price times the multiplier.
            uint256 multiplier = IERC4626(assets[i]).convertToAssets(WAD);
            uint256 price = sharePrice * multiplier / WAD;

            stockPrice[assets[i]] =
                StockPrice({price: price, sharePrice: sharePrice, updatedAt: uint32(block.timestamp)});
            emit PriceUpdated(assets[i], price, sharePrice, multiplier);
        }
    }

    /// @inheritdoc IPriceOracle
    /// @notice Refreshes prices from reports relayed by the vault, so borrowing stays a single transaction.
    /// @dev Each report is `abi.encode(address[] assets, bytes redstonePayload)`. RedStone reads its payload
    ///      from the calldata of the call *into this contract*, and the vault's nested call would drop it —
    ///      so the oracle re-enters itself with the payload appended, where the consumer can find it.
    function updatePrices(bytes[] calldata reports) external {
        for (uint256 i; i < reports.length; ++i) {
            (address[] memory assets, bytes memory payload) = abi.decode(reports[i], (address[], bytes));
            (bool ok, bytes memory returned) =
                address(this).call(abi.encodePacked(abi.encodeCall(this.updatePricesFor, (assets)), payload));
            if (!ok) {
                // Surface the consumer's own error (bad signature, stale timestamp) rather than masking it.
                assembly {
                    revert(add(returned, 32), mload(returned))
                }
            }
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Prices out
    // ---------------------------------------------------------------------------------------------

    function getPrice(address asset) external view returns (uint256 price, bool marketOpen) {
        _checkSequencer();

        StockConfig memory config = stockConfig[asset];
        if (config.listed) {
            StockPrice memory cached = stockPrice[asset];
            if (cached.updatedAt == 0 || block.timestamp > uint256(cached.updatedAt) + config.maxAge) {
                revert StalePrice(asset);
            }
            // Outside the open window the price still values collateral for liquidation, but borrowing and
            // withdrawing are blocked by the vault — the market it tracks has stopped.
            return (cached.price, block.timestamp <= uint256(cached.updatedAt) + config.openWindow);
        }

        FeedConfig memory feed = feedConfig[asset];
        if (address(feed.feed) != address(0)) return (_feedPrice(asset, feed), true);

        revert PriceUnavailable(asset);
    }

    function _feedPrice(address asset, FeedConfig memory config) internal view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = config.feed.latestRoundData();
        if (answer <= 0 || block.timestamp > updatedAt + config.maxAge) revert StalePrice(asset);
        // `answer` was just checked to be positive.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(answer) * 10 ** (18 - config.decimals);
    }

    function _checkSequencer() internal view {
        (, int256 answer, uint256 startedAt,,) = sequencerUptimeFeed.latestRoundData();
        if (answer != 0) revert SequencerDown();
        if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) revert SequencerGracePeriod();
    }

    // ---------------------------------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------------------------------

    /// @param dataFeedId RedStone feed id as bytes32, e.g. bytes32("NVDA---24_7") for the 24/5 stream.
    function listStock(address asset, bytes32 dataFeedId, uint32 maxAge, uint32 openWindow) external onlyOwner {
        if (asset == address(0) || dataFeedId == bytes32(0)) revert ZeroAddress();
        stockConfig[asset] = StockConfig({listed: true, dataFeedId: dataFeedId, maxAge: maxAge, openWindow: openWindow});
        delete stockPrice[asset];
        emit StockListed(asset, dataFeedId, maxAge, openWindow);
    }

    function setFeed(address asset, AggregatorV3Interface feed, uint32 maxAge) external onlyOwner {
        if (asset == address(0) || address(feed) == address(0)) revert ZeroAddress();
        feedConfig[asset] = FeedConfig(feed, feed.decimals(), maxAge);
        emit FeedSet(asset, feed, maxAge);
    }
}
