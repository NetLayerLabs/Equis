// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {IERC20, ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {EquisLendingPool} from "../src/EquisLendingPool.sol";
import {KinkedRateModel} from "../src/KinkedRateModel.sol";
import {XLayer} from "../src/libraries/XLayer.sol";
import {XLayerForkTest} from "./utils/XLayerForkTest.sol";

contract EquisLendingPoolTest is XLayerForkTest {
    uint256 internal constant RESERVE_FACTOR = 0.1e18;
    uint256 internal constant SUPPLY_CAP = 1_000_000e6;

    IERC20 internal usdt = IERC20(XLayer.USDT0);
    EquisLendingPool internal pool;
    KinkedRateModel internal rateModel;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    // Plain address holding the vault role; the pool only checks msg.sender for borrow/repay.
    address internal vault = makeAddr("vault");
    address internal lender = makeAddr("lender");
    address internal borrower = makeAddr("borrower");

    function setUp() public override {
        super.setUp();
        // 0% base, 4% APR at the 80% kink, +75% APR from kink to full utilization.
        rateModel = new KinkedRateModel(0, 0.04e18, 0.75e18, 0.8e18);
        pool = new EquisLendingPool(usdt, rateModel, owner, treasury, RESERVE_FACTOR, SUPPLY_CAP);
        vm.prank(owner);
        pool.setVault(vault);

        deal(address(usdt), lender, 500_000e6);
        vm.prank(lender);
        usdt.approve(address(pool), type(uint256).max);
    }

    function test_DepositAndRedeem() public {
        vm.prank(lender);
        uint256 shares = pool.deposit(100_000e6, lender);
        assertEq(pool.totalAssets(), 100_000e6);
        assertEq(pool.cash(), 100_000e6);

        vm.prank(lender);
        uint256 assets = pool.redeem(shares, lender, lender);
        assertApproxEqAbs(assets, 100_000e6, 1);
        assertApproxEqAbs(usdt.balanceOf(lender), 500_000e6, 1);
    }

    function test_BorrowInterestAccruesToLenders() public {
        vm.prank(lender);
        pool.deposit(100_000e6, lender);

        vm.prank(vault);
        pool.borrow(borrower, borrower, 50_000e6);
        assertEq(usdt.balanceOf(borrower), 50_000e6);

        skip(365 days);

        // 50% utilization under a 4%-at-80% kink → 2.5% APR on 50k.
        assertApproxEqRel(pool.debtOf(borrower), 51_250e6, 0.0001e18);
        // Lenders keep 90% of that interest; 10% goes to reserves.
        assertApproxEqRel(pool.totalAssets(), 101_125e6, 0.0001e18);
    }

    function test_RepayInFullClearsDebt() public {
        vm.prank(lender);
        pool.deposit(100_000e6, lender);
        vm.prank(vault);
        pool.borrow(borrower, borrower, 50_000e6);
        skip(30 days);

        uint256 debt = pool.debtOf(borrower);
        deal(address(usdt), borrower, debt);
        vm.prank(borrower);
        usdt.approve(address(pool), debt);

        vm.prank(vault);
        uint256 repaid = pool.repay(borrower, borrower, type(uint256).max);

        assertEq(repaid, debt);
        assertEq(pool.debtOf(borrower), 0);
        assertEq(pool.totalScaledDebt(), 0);
        assertEq(usdt.balanceOf(borrower), 0);
    }

    function test_TreasuryCollectsReserves() public {
        vm.prank(lender);
        pool.deposit(100_000e6, lender);
        vm.prank(vault);
        pool.borrow(borrower, borrower, 50_000e6);
        skip(365 days);

        uint256 debt = pool.debtOf(borrower);
        deal(address(usdt), borrower, debt);
        vm.prank(borrower);
        usdt.approve(address(pool), debt);
        vm.prank(vault);
        pool.repay(borrower, borrower, debt);

        uint256 reserves = pool.reserves();
        assertApproxEqRel(reserves, 125e6, 0.001e18);

        vm.prank(owner);
        pool.withdrawReserves(reserves);
        assertEq(usdt.balanceOf(treasury), reserves);
    }

    function test_WithdrawalsLimitedToAvailableCash() public {
        vm.prank(lender);
        pool.deposit(100_000e6, lender);
        vm.prank(vault);
        pool.borrow(borrower, borrower, 80_000e6);

        assertEq(pool.maxWithdraw(lender), 20_000e6);

        vm.prank(lender);
        vm.expectRevert(
            abi.encodeWithSelector(ERC4626.ERC4626ExceededMaxWithdraw.selector, lender, 20_000e6 + 1, 20_000e6)
        );
        pool.withdraw(20_000e6 + 1, lender, lender);
    }

    function test_BorrowBeyondCashReverts() public {
        vm.prank(lender);
        pool.deposit(10_000e6, lender);

        vm.prank(vault);
        vm.expectRevert(EquisLendingPool.InsufficientCash.selector);
        pool.borrow(borrower, borrower, 10_000e6 + 1);
    }

    function test_OnlyVaultCanBorrowOrRepay() public {
        vm.expectRevert(EquisLendingPool.OnlyVault.selector);
        pool.borrow(borrower, borrower, 1);

        vm.expectRevert(EquisLendingPool.OnlyVault.selector);
        pool.repay(borrower, borrower, 1);
    }

    function test_VaultCanOnlyBeSetOnce() public {
        vm.prank(owner);
        vm.expectRevert(EquisLendingPool.VaultAlreadySet.selector);
        pool.setVault(makeAddr("otherVault"));
    }

    function test_SupplyCapLimitsDeposits() public {
        assertEq(pool.maxDeposit(lender), SUPPLY_CAP);

        deal(address(usdt), lender, SUPPLY_CAP + 1);
        vm.prank(lender);
        vm.expectRevert(
            abi.encodeWithSelector(ERC4626.ERC4626ExceededMaxDeposit.selector, lender, SUPPLY_CAP + 1, SUPPLY_CAP)
        );
        pool.deposit(SUPPLY_CAP + 1, lender);
    }

    function test_DonationDoesNotMoveSharePrice() public {
        vm.prank(lender);
        pool.deposit(100_000e6, lender);
        uint256 assetsPerShareBefore = pool.convertToAssets(1e12);

        vm.prank(lender);
        assertTrue(usdt.transfer(address(pool), 50_000e6));

        assertEq(pool.totalAssets(), 100_000e6);
        assertEq(pool.convertToAssets(1e12), assetsPerShareBefore);
    }
}
