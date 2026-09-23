// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {XLayer} from "../../src/libraries/XLayer.sol";

/// @notice Forks X Layer mainnet at the block recorded with real Chainlink Data Streams reports fetched by
///         `node scripts/fetch-stream-reports.ts`. Tests skip when that gitignored fixture is absent.
abstract contract StreamReportsForkTest is Test {
    string internal constant FIXTURE_PATH = "test/fixtures/stream-reports.json";
    uint256 internal constant REPORT_COUNT = 5;

    /// @dev Same order as XSTOCKS in src/lib/xstocks.ts.
    address[REPORT_COUNT] internal wrappers = [XLayer.WNVDAX, XLayer.WAAPLX, XLayer.WTSLAX, XLayer.WSPYX, XLayer.WQQQX];
    bytes32[REPORT_COUNT] internal streams =
        [XLayer.STREAM_NVDAX, XLayer.STREAM_AAPLX, XLayer.STREAM_TSLAX, XLayer.STREAM_SPYX, XLayer.STREAM_QQQX];
    bytes[] internal reports;

    function setUp() public virtual {
        if (!vm.exists(FIXTURE_PATH)) vm.skip(true);

        string memory json = vm.readFile(FIXTURE_PATH);
        vm.createSelectFork("xlayer", vm.parseJsonUint(json, ".forkBlock"));
        assertEq(block.chainid, XLayer.CHAIN_ID, "not forking X Layer mainnet");

        for (uint256 i; i < REPORT_COUNT; ++i) {
            string memory key = string.concat(".reports[", vm.toString(i), "]");
            assertEq(vm.parseJsonAddress(json, string.concat(key, ".wrapper")), wrappers[i], "fixture order");
            reports.push(vm.parseJsonBytes(json, string.concat(key, ".fullReport")));
        }
    }
}
