// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {ChainlinkPriceOracle} from "../src/ChainlinkPriceOracle.sol";
import {IVerifierProxy} from "../src/interfaces/chainlink/IVerifierProxy.sol";
import {AggregatorV3Interface} from "../src/interfaces/chainlink/AggregatorV3Interface.sol";
import {XLayer} from "../src/libraries/XLayer.sol";
import {XLayerForkTest} from "./utils/XLayerForkTest.sol";

contract ChainlinkPriceOracleTest is XLayerForkTest {
    ChainlinkPriceOracle internal oracle;
    address internal owner = makeAddr("owner");

    function setUp() public override {
        super.setUp();
        oracle = new ChainlinkPriceOracle(
            IVerifierProxy(XLayer.CHAINLINK_STREAMS_VERIFIER),
            AggregatorV3Interface(XLayer.CHAINLINK_SEQUENCER_UPTIME),
            owner
        );
    }

    function test_Usdt0PriceFromLivePushFeed() public {
        vm.prank(owner);
        oracle.setFeed(XLayer.USDT0, AggregatorV3Interface(XLayer.CHAINLINK_USDT0_USD), 25 hours);

        (uint256 price, bool marketOpen) = oracle.getPrice(XLayer.USDT0);
        assertApproxEqRel(price, 1e18, 0.02e18);
        assertTrue(marketOpen);
    }

    function test_PushFeedOlderThanMaxAgeIsStale() public {
        vm.prank(owner);
        oracle.setFeed(XLayer.USDT0, AggregatorV3Interface(XLayer.CHAINLINK_USDT0_USD), 25 hours);
        skip(26 hours);

        vm.expectRevert(abi.encodeWithSelector(ChainlinkPriceOracle.StalePrice.selector, XLayer.USDT0));
        oracle.getPrice(XLayer.USDT0);
    }

    function test_UnconfiguredAssetHasNoPrice() public {
        vm.expectRevert(abi.encodeWithSelector(ChainlinkPriceOracle.PriceUnavailable.selector, XLayer.WNVDAX));
        oracle.getPrice(XLayer.WNVDAX);
    }

    function test_StreamWithoutVerifiedReportIsStale() public {
        vm.prank(owner);
        oracle.setStream(XLayer.WNVDAX, XLayer.STREAM_NVDAX, 2 minutes, 1 days);

        vm.expectRevert(abi.encodeWithSelector(ChainlinkPriceOracle.StalePrice.selector, XLayer.WNVDAX));
        oracle.getPrice(XLayer.WNVDAX);
    }

    function test_SetStreamRejectsNonV10Schema() public {
        // NVDA single-price stream (schema v8) from Chainlink's directory.
        bytes32 nvdaV8 = 0x0008adc184847ba8d17f0030c15e78f61b83eda2e190f30346c4ea3babed647d;

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(ChainlinkPriceOracle.UnsupportedSchema.selector, nvdaV8));
        oracle.setStream(XLayer.WNVDAX, nvdaV8, 2 minutes, 1 days);
    }

    function test_StreamFeedCannotBeSharedByTwoAssets() public {
        vm.startPrank(owner);
        oracle.setStream(XLayer.WNVDAX, XLayer.STREAM_NVDAX, 2 minutes, 1 days);
        vm.expectRevert(
            abi.encodeWithSelector(
                ChainlinkPriceOracle.FeedAlreadyAssigned.selector, XLayer.STREAM_NVDAX, XLayer.WNVDAX
            )
        );
        oracle.setStream(XLayer.WAAPLX, XLayer.STREAM_NVDAX, 2 minutes, 1 days);
        vm.stopPrank();
    }

    function test_LiveVerifierRejectsUnsignedReport() public {
        bytes32[3] memory reportContext = [keccak256("not a real config digest"), bytes32(0), bytes32(0)];
        bytes[] memory reports = new bytes[](1);
        reports[0] = abi.encode(reportContext, bytes(""), new bytes32[](0), new bytes32[](0), bytes32(0));

        vm.expectRevert();
        oracle.updatePrices(reports);
    }
}
