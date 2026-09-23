// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {XLayer} from "../../src/libraries/XLayer.sol";

/// @notice Base for tests that run against live X Layer mainnet state — real tokens, no mocks.
///         Set XLAYER_FORK_BLOCK to pin a block for reproducible, cached runs.
abstract contract XLayerForkTest is Test {
    function setUp() public virtual {
        uint256 forkBlock = vm.envOr("XLAYER_FORK_BLOCK", uint256(0));
        if (forkBlock == 0) vm.createSelectFork("xlayer");
        else vm.createSelectFork("xlayer", forkBlock);

        assertEq(block.chainid, XLayer.CHAIN_ID, "not forking X Layer mainnet");
        vm.label(XLayer.USDT0, "USDT0");
    }
}
