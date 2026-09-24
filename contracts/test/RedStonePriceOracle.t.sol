// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {RedStonePriceOracle} from "../src/RedStonePriceOracle.sol";
import {AggregatorV3Interface} from "../src/interfaces/chainlink/AggregatorV3Interface.sol";
import {XLayer} from "../src/libraries/XLayer.sol";

/// @notice Runs a real, signed RedStone payload through the real consumer on forked X Layer mainnet.
///         Fetch one first: `node ../scripts/fetch-redstone-payload.ts`. Without it these tests skip.
contract RedStonePriceOracleTest is Test {
    string internal constant FIXTURE_PATH = "test/fixtures/redstone-payload.json";
    uint32 internal constant MAX_AGE = 3 days;
    uint32 internal constant OPEN_WINDOW = 15 minutes;

    RedStonePriceOracle internal oracle;
    address internal owner = makeAddr("owner");

    bytes internal payload;
    address[] internal assets;
    bytes32[] internal feedIds;
    uint256 internal observedAt;

    function setUp() public {
        if (!vm.exists(FIXTURE_PATH)) vm.skip(true);

        string memory json = vm.readFile(FIXTURE_PATH);
        payload = vm.parseJsonBytes(json, ".payload");
        assets = vm.parseJsonAddressArray(json, ".assets");
        observedAt = vm.parseJsonUint(json, ".timestampSeconds");
        string[] memory feeds = vm.parseJsonStringArray(json, ".feeds");
        for (uint256 i; i < feeds.length; ++i) {
            feedIds.push(_toBytes32(feeds[i]));
        }

        vm.createSelectFork("xlayer");
        // The payload is only valid for three minutes, so put the clock just after it was signed.
        vm.warp(observedAt + 30);

        oracle = new RedStonePriceOracle(AggregatorV3Interface(XLayer.CHAINLINK_SEQUENCER_UPTIME), owner);
        vm.startPrank(owner);
        for (uint256 i; i < assets.length; ++i) {
            oracle.listStock(assets[i], feedIds[i], MAX_AGE, OPEN_WINDOW);
        }
        oracle.setFeed(XLayer.USDT0, AggregatorV3Interface(XLayer.CHAINLINK_USDT0_USD), 25 hours);
        vm.stopPrank();
    }

    function test_RealPayloadPricesEveryStock() public {
        _pushPrices();

        for (uint256 i; i < assets.length; ++i) {
            (uint256 price, bool marketOpen) = oracle.getPrice(assets[i]);
            // Bounds catch a decimals mistake, which would be wrong by orders of magnitude.
            assertGt(price, 1e18, "priced under $1");
            assertLt(price, 100_000e18, "priced over $100k");
            assertTrue(marketOpen, "fresh price should count as open");

            // The wrapper is worth the share price times its live onchain multiplier.
            (, uint256 sharePrice,) = oracle.stockPrice(assets[i]);
            uint256 multiplier = IERC4626(assets[i]).convertToAssets(1e18);
            assertApproxEqRel(price, sharePrice * multiplier / 1e18, 1e12);
            emit log_named_decimal_uint("wrapper price", price, 18);
        }
    }

    function test_PriceGoesStaleAndMarketCloses() public {
        _pushPrices();

        // Past the open window the price still values collateral, but the market counts as closed.
        vm.warp(block.timestamp + OPEN_WINDOW + 1);
        (uint256 price, bool marketOpen) = oracle.getPrice(assets[0]);
        assertGt(price, 0);
        assertFalse(marketOpen, "stale beyond the open window is closed");

        // Past the hard staleness limit it cannot be used at all.
        vm.warp(block.timestamp + MAX_AGE);
        vm.expectRevert(abi.encodeWithSelector(RedStonePriceOracle.StalePrice.selector, assets[0]));
        oracle.getPrice(assets[0]);
    }

    function test_PayloadlessCallIsRejected() public {
        // No RedStone payload appended: the consumer must refuse rather than price anything.
        vm.expectRevert();
        oracle.updatePricesFor(assets);
    }

    function test_TamperedPayloadIsRejected() public {
        bytes memory tampered = payload;
        // Flip a byte inside the signed region; signatures must no longer recover to authorised signers.
        tampered[64] = bytes1(uint8(tampered[64]) ^ 0xff);

        (bool ok,) = address(oracle)
            .call(abi.encodePacked(abi.encodeCall(RedStonePriceOracle.updatePricesFor, (assets)), tampered));
        assertFalse(ok, "a tampered payload must not verify");
    }

    function test_VaultStyleReportsAreRejected() public {
        bytes[] memory reports = new bytes[](1);
        reports[0] = hex"1234";
        vm.expectRevert(RedStonePriceOracle.ReportsNotAccepted.selector);
        oracle.updatePrices(reports);
    }

    function test_Usdt0PricedByChainlinkPushFeed() public view {
        (uint256 price, bool marketOpen) = oracle.getPrice(XLayer.USDT0);
        assertApproxEqRel(price, 1e18, 0.02e18);
        assertTrue(marketOpen);
    }

    // ---------------------------------------------------------------------------------------------

    function _pushPrices() internal {
        (bool ok, bytes memory returned) = address(oracle)
            .call(abi.encodePacked(abi.encodeCall(RedStonePriceOracle.updatePricesFor, (assets)), payload));
        if (!ok) {
            assembly {
                revert(add(returned, 32), mload(returned))
            }
        }
    }

    function _toBytes32(string memory value) internal pure returns (bytes32 result) {
        bytes memory raw = bytes(value);
        require(raw.length <= 32, "feed id too long");
        assembly {
            result := mload(add(raw, 32))
        }
    }
}
