// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EquisSessionDelegate} from "../src/EquisSessionDelegate.sol";
import {XLayer} from "../src/libraries/XLayer.sol";
import {XLayerForkTest} from "./utils/XLayerForkTest.sol";

contract EquisSessionDelegateTest is XLayerForkTest {
    IERC20 internal usdt = IERC20(XLayer.USDT0);
    EquisSessionDelegate internal implementation;

    address internal user;
    uint256 internal userKey;
    address internal agent = makeAddr("agent");
    address internal recipient = makeAddr("recipient");

    function setUp() public override {
        super.setUp();
        (user, userKey) = makeAddrAndKey("user");
        deal(address(usdt), user, 1_000e6);

        implementation = new EquisSessionDelegate();
        vm.signAndAttachDelegation(address(implementation), userKey);
    }

    function test_DelegationDesignatorInstalled() public view {
        assertEq(user.code, abi.encodePacked(hex"ef0100", address(implementation)));
    }

    function test_OwnerCanBatchExecute() public {
        EquisSessionDelegate.Call[] memory calls = new EquisSessionDelegate.Call[](2);
        calls[0] = _transferCall(100e6);
        calls[1] = _transferCall(50e6);

        vm.prank(user);
        _account().execute(calls);

        assertEq(usdt.balanceOf(recipient), 150e6);
    }

    function test_SessionCanSpendWithinLimit() public {
        _grantAgentTransfer(250e6, uint48(block.timestamp + 1 hours));

        vm.prank(agent);
        _account().executeAsSession(_single(_transferCall(200e6)));

        assertEq(usdt.balanceOf(recipient), 200e6);
        assertEq(_account().remainingLimits(agent)[0].amount, 50e6);
    }

    function test_SessionSpendLimitIsCumulative() public {
        _grantAgentTransfer(250e6, uint48(block.timestamp + 1 hours));

        vm.prank(agent);
        _account().executeAsSession(_single(_transferCall(200e6)));

        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(EquisSessionDelegate.SpendLimitExceeded.selector, address(usdt), 100e6, 50e6)
        );
        _account().executeAsSession(_single(_transferCall(100e6)));
    }

    function test_SessionRejectsCallsOutsideAllowlist() public {
        _grantAgentTransfer(250e6, uint48(block.timestamp + 1 hours));

        EquisSessionDelegate.Call memory approveCall =
            EquisSessionDelegate.Call(address(usdt), 0, abi.encodeCall(IERC20.approve, (agent, type(uint256).max)));

        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(EquisSessionDelegate.CallNotAllowed.selector, address(usdt), IERC20.approve.selector)
        );
        _account().executeAsSession(_single(approveCall));
    }

    function test_SessionCannotSendNativeValue() public {
        _grantAgentTransfer(250e6, uint48(block.timestamp + 1 hours));
        EquisSessionDelegate.Call memory call = _transferCall(1e6);
        call.value = 1;

        vm.prank(agent);
        vm.expectRevert(EquisSessionDelegate.NativeValueNotAllowed.selector);
        _account().executeAsSession(_single(call));
    }

    function test_SessionExpires() public {
        _grantAgentTransfer(250e6, uint48(block.timestamp + 1 hours));
        skip(1 hours);

        vm.prank(agent);
        vm.expectRevert(EquisSessionDelegate.SessionExpired.selector);
        _account().executeAsSession(_single(_transferCall(1e6)));
    }

    function test_RevokedSessionIsRejected() public {
        _grantAgentTransfer(250e6, uint48(block.timestamp + 1 hours));
        vm.prank(user);
        _account().revokeSession(agent);

        vm.prank(agent);
        vm.expectRevert(EquisSessionDelegate.InvalidSession.selector);
        _account().executeAsSession(_single(_transferCall(1e6)));
    }

    function test_OnlyAccountCanGrantSessions() public {
        vm.prank(agent);
        vm.expectRevert(EquisSessionDelegate.OnlySelf.selector);
        _account()
            .grantSession(
                agent,
                uint48(block.timestamp + 1 hours),
                new EquisSessionDelegate.Permission[](0),
                new EquisSessionDelegate.SpendLimit[](0)
            );
    }

    function test_CannotAllowlistCallsIntoAccount() public {
        EquisSessionDelegate.Permission[] memory permissions = new EquisSessionDelegate.Permission[](1);
        permissions[0] = EquisSessionDelegate.Permission(user, EquisSessionDelegate.grantSession.selector);

        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                EquisSessionDelegate.CallNotAllowed.selector, user, EquisSessionDelegate.grantSession.selector
            )
        );
        _account()
            .grantSession(
                agent, uint48(block.timestamp + 1 hours), permissions, new EquisSessionDelegate.SpendLimit[](0)
            );
    }

    function test_DelegatedAccountStillReceivesOKB() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = user.call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(user.balance, 1 ether);
    }

    // ---------------------------------------------------------------------------------------------

    function _account() internal view returns (EquisSessionDelegate) {
        return EquisSessionDelegate(payable(user));
    }

    function _grantAgentTransfer(uint256 limit, uint48 expiry) internal {
        EquisSessionDelegate.Permission[] memory permissions = new EquisSessionDelegate.Permission[](1);
        permissions[0] = EquisSessionDelegate.Permission(address(usdt), IERC20.transfer.selector);
        EquisSessionDelegate.SpendLimit[] memory limits = new EquisSessionDelegate.SpendLimit[](1);
        limits[0] = EquisSessionDelegate.SpendLimit(address(usdt), limit);

        vm.prank(user);
        _account().grantSession(agent, expiry, permissions, limits);
    }

    function _transferCall(uint256 amount) internal view returns (EquisSessionDelegate.Call memory) {
        return EquisSessionDelegate.Call(address(usdt), 0, abi.encodeCall(IERC20.transfer, (recipient, amount)));
    }

    function _single(EquisSessionDelegate.Call memory call)
        internal
        pure
        returns (EquisSessionDelegate.Call[] memory calls)
    {
        calls = new EquisSessionDelegate.Call[](1);
        calls[0] = call;
    }
}
