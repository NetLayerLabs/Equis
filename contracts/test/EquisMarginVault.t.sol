// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ChainlinkPriceOracle} from "../src/ChainlinkPriceOracle.sol";
import {EquisLendingPool} from "../src/EquisLendingPool.sol";
import {EquisMarginVault} from "../src/EquisMarginVault.sol";
import {EquisSessionDelegate} from "../src/EquisSessionDelegate.sol";
import {KinkedRateModel} from "../src/KinkedRateModel.sol";
import {IVerifierProxy} from "../src/interfaces/chainlink/IVerifierProxy.sol";
import {AggregatorV3Interface} from "../src/interfaces/chainlink/AggregatorV3Interface.sol";
import {XLayer} from "../src/libraries/XLayer.sol";
import {StreamReportsForkTest} from "./utils/StreamReportsForkTest.sol";

/// @notice End to end on X Layer mainnet state: real USD₮0, real xStocks wrappers, real Chainlink reports.
contract EquisMarginVaultTest is StreamReportsForkTest {
    uint16 internal constant LTV_BPS = 5_000;
    uint16 internal constant LIQUIDATION_THRESHOLD_BPS = 6_000;
    uint16 internal constant LIQUIDATION_BONUS_BPS = 500;
    uint256 internal constant COLLATERAL_CAP = 1_000e18;

    IERC20 internal usdt = IERC20(XLayer.USDT0);
    IERC20 internal wnvda = IERC20(XLayer.WNVDAX);

    ChainlinkPriceOracle internal oracle;
    EquisLendingPool internal pool;
    EquisMarginVault internal vault;

    address internal owner = makeAddr("owner");
    address internal lender = makeAddr("lender");
    address internal user = makeAddr("user");
    address internal liquidator = makeAddr("liquidator");

    function setUp() public override {
        super.setUp();

        oracle = new ChainlinkPriceOracle(
            IVerifierProxy(XLayer.CHAINLINK_STREAMS_VERIFIER),
            AggregatorV3Interface(XLayer.CHAINLINK_SEQUENCER_UPTIME),
            owner
        );
        pool = new EquisLendingPool(
            usdt, new KinkedRateModel(0, 0.04e18, 0.75e18, 0.8e18), owner, makeAddr("treasury"), 0.1e18, 10_000_000e6
        );
        vault = new EquisMarginVault(pool, oracle, owner, makeAddr("guardian"));

        vm.startPrank(owner);
        pool.setVault(address(vault));
        oracle.setFeed(XLayer.USDT0, AggregatorV3Interface(XLayer.CHAINLINK_USDT0_USD), 25 hours);
        for (uint256 i; i < REPORT_COUNT; ++i) {
            oracle.setStream(wrappers[i], streams[i], 10 minutes, 1 days);
            vault.listCollateral(wrappers[i], LTV_BPS, LIQUIDATION_THRESHOLD_BPS, LIQUIDATION_BONUS_BPS, COLLATERAL_CAP);
        }
        vm.stopPrank();

        deal(address(usdt), lender, 1_000_000e6);
        vm.startPrank(lender);
        usdt.approve(address(pool), type(uint256).max);
        pool.deposit(1_000_000e6, lender);
        vm.stopPrank();
    }

    function test_RealReportsPriceEveryWrapper() public {
        oracle.updatePrices(reports);

        for (uint256 i; i < REPORT_COUNT; ++i) {
            (uint256 price,) = oracle.getPrice(wrappers[i]);
            // Bounds catch a wrong fixed-point assumption, which would be off by orders of magnitude.
            assertGt(price, 1e18, "wrapper priced under $1");
            assertLt(price, 100_000e18, "wrapper priced over $100k");

            (, uint256 reportMultiplier,,,) = oracle.streamPrice(wrappers[i]);
            assertApproxEqRel(reportMultiplier, IERC4626(wrappers[i]).convertToAssets(1e18), 0.001e18);
            emit log_named_decimal_uint(IERC20Metadata(wrappers[i]).symbol(), price, 18);
        }
    }

    function test_BorrowAgainstRealPrice() public {
        (uint256 value, bool marketOpen) = _depositCollateral(user, 10e18);
        uint256 amount = _borrowable(value, LTV_BPS) * 90 / 100;

        vm.prank(user);
        if (!marketOpen) {
            vm.expectRevert(EquisMarginVault.MarketClosed.selector);
            vault.borrow(amount, new bytes[](0));
            return;
        }
        vault.borrow(amount, new bytes[](0));

        assertEq(usdt.balanceOf(user), amount);
        assertApproxEqAbs(pool.debtOf(user), amount, 1);
        assertGt(vault.healthFactor(user), 1e18);
    }

    function test_BorrowAboveLtvReverts() public {
        (uint256 value, bool marketOpen) = _depositCollateral(user, 10e18);
        _skipIfMarketClosed(marketOpen);
        uint256 amount = _borrowable(value, LTV_BPS) * 101 / 100;

        vm.prank(user);
        vm.expectPartialRevert(EquisMarginVault.InsufficientBorrowPower.selector);
        vault.borrow(amount, new bytes[](0));
    }

    function test_WithdrawBlockedUntilDebtRepaid() public {
        (uint256 value, bool marketOpen) = _depositCollateral(user, 10e18);
        _skipIfMarketClosed(marketOpen);
        uint256 amount = _borrowable(value, LTV_BPS) * 90 / 100;
        vm.prank(user);
        vault.borrow(amount, new bytes[](0));

        vm.prank(user);
        vm.expectPartialRevert(EquisMarginVault.InsufficientBorrowPower.selector);
        vault.withdrawCollateral(XLayer.WNVDAX, 5e18, new bytes[](0));

        uint256 debt = pool.debtOf(user);
        deal(address(usdt), user, debt);
        vm.startPrank(user);
        usdt.approve(address(pool), debt);
        vault.repay(user, type(uint256).max);
        // With no debt, withdrawing needs no prices at all.
        vault.withdrawCollateral(XLayer.WNVDAX, 10e18, new bytes[](0));
        vm.stopPrank();

        assertEq(pool.debtOf(user), 0);
        assertEq(wnvda.balanceOf(user), 10e18);
    }

    function test_LiquidationPaysCollateralPlusBonus() public {
        (uint256 value, bool marketOpen) = _depositCollateral(user, 10e18);
        _skipIfMarketClosed(marketOpen);
        uint256 amount = _borrowable(value, LTV_BPS) * 90 / 100;
        vm.prank(user);
        vault.borrow(amount, new bytes[](0));

        // Governance tightens NVDA's risk parameters; 45% of value borrowed is now far past a 30% threshold.
        vm.prank(owner);
        vault.setCollateralParams(XLayer.WNVDAX, 2_000, 3_000, LIQUIDATION_BONUS_BPS, COLLATERAL_CAP, true);
        assertLt(vault.healthFactor(user), vault.FULL_LIQUIDATION_HEALTH_FACTOR());

        uint256 debt = pool.debtOf(user);
        deal(address(usdt), liquidator, debt);
        vm.startPrank(liquidator);
        usdt.approve(address(pool), debt);
        (uint256 repaid, uint256 seized) = vault.liquidate(user, XLayer.WNVDAX, debt, new bytes[](0));
        vm.stopPrank();

        (uint256 usdtPrice,) = oracle.getPrice(XLayer.USDT0);
        (uint256 nvdaPrice,) = oracle.getPrice(XLayer.WNVDAX);
        uint256 expectedSeized = repaid * usdtPrice / 1e6 * (10_000 + LIQUIDATION_BONUS_BPS) / 10_000 * 1e18 / nvdaPrice;

        assertEq(repaid, debt, "health below 0.95 allows a full liquidation");
        assertApproxEqRel(seized, expectedSeized, 0.0001e18);
        assertEq(wnvda.balanceOf(liquidator), seized);
        assertEq(pool.debtOf(user), 0);
        assertEq(vault.collateralOf(user, XLayer.WNVDAX), 10e18 - seized);
    }

    function test_AgentSessionRepaysDebtWithinSpendLimit() public {
        (address account, uint256 accountKey) = makeAddrAndKey("7702-account");
        deal(XLayer.WNVDAX, account, 100e18);
        oracle.updatePrices(reports);
        (uint256 price, bool marketOpen) = oracle.getPrice(XLayer.WNVDAX);
        _skipIfMarketClosed(marketOpen);
        uint256 borrowAmount = _borrowable(100 * price, LTV_BPS) / 2;

        EquisSessionDelegate implementation = new EquisSessionDelegate();
        vm.signAndAttachDelegation(address(implementation), accountKey);
        EquisSessionDelegate wallet = EquisSessionDelegate(payable(account));

        // One transaction from the user's own EOA: approve, deposit, borrow, and approve future repayments.
        EquisSessionDelegate.Call[] memory batch = new EquisSessionDelegate.Call[](4);
        batch[0] = _call(XLayer.WNVDAX, abi.encodeCall(IERC20.approve, (address(vault), 100e18)));
        batch[1] = _call(address(vault), abi.encodeCall(EquisMarginVault.depositCollateral, (XLayer.WNVDAX, 100e18)));
        batch[2] = _call(address(vault), abi.encodeCall(EquisMarginVault.borrow, (borrowAmount, new bytes[](0))));
        batch[3] = _call(XLayer.USDT0, abi.encodeCall(IERC20.approve, (address(pool), type(uint256).max)));
        vm.prank(account);
        wallet.execute(batch);
        assertApproxEqAbs(pool.debtOf(account), borrowAmount, 1);

        // The user grants an agent key that may only repay through the vault, spending at most 500 USD₮0.
        address agent = makeAddr("agent");
        EquisSessionDelegate.Permission[] memory permissions = new EquisSessionDelegate.Permission[](1);
        permissions[0] = EquisSessionDelegate.Permission(address(vault), EquisMarginVault.repay.selector);
        EquisSessionDelegate.SpendLimit[] memory limits = new EquisSessionDelegate.SpendLimit[](1);
        limits[0] = EquisSessionDelegate.SpendLimit(XLayer.USDT0, 500e6);
        vm.prank(account);
        wallet.grantSession(agent, uint48(block.timestamp + 1 days), permissions, limits);

        uint256 debtBefore = pool.debtOf(account);
        vm.prank(agent);
        wallet.executeAsSession(_single(address(vault), abi.encodeCall(EquisMarginVault.repay, (account, 400e6))));
        assertApproxEqAbs(pool.debtOf(account), debtBefore - 400e6, 1);
        assertEq(wallet.remainingLimits(agent)[0].amount, 100e6);

        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(EquisSessionDelegate.SpendLimitExceeded.selector, XLayer.USDT0, 200e6, 100e6)
        );
        wallet.executeAsSession(_single(address(vault), abi.encodeCall(EquisMarginVault.repay, (account, 200e6))));

        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(
                EquisSessionDelegate.CallNotAllowed.selector,
                address(vault),
                EquisMarginVault.withdrawCollateral.selector
            )
        );
        wallet.executeAsSession(
            _single(
                address(vault),
                abi.encodeCall(EquisMarginVault.withdrawCollateral, (XLayer.WNVDAX, 1e18, new bytes[](0)))
            )
        );
    }

    // ---------------------------------------------------------------------------------------------

    /// @return value USD value of the deposit at the verified report price, 1e18.
    function _depositCollateral(address account, uint256 amount) internal returns (uint256 value, bool marketOpen) {
        deal(XLayer.WNVDAX, account, amount);
        vm.startPrank(account);
        wnvda.approve(address(vault), amount);
        vault.depositCollateral(XLayer.WNVDAX, amount);
        vm.stopPrank();

        oracle.updatePrices(reports);
        uint256 price;
        (price, marketOpen) = oracle.getPrice(XLayer.WNVDAX);
        value = amount * price / 1e18;
    }

    /// @return USD₮0 units borrowable against `value` (USD, 1e18) at `ltvBps`.
    function _borrowable(uint256 value, uint256 ltvBps) internal view returns (uint256) {
        (uint256 usdtPrice,) = oracle.getPrice(XLayer.USDT0);
        return value * ltvBps / 10_000 * 1e6 / usdtPrice;
    }

    function _skipIfMarketClosed(bool marketOpen) internal {
        if (!marketOpen) vm.skip(true);
    }

    function _call(address target, bytes memory data) internal pure returns (EquisSessionDelegate.Call memory) {
        return EquisSessionDelegate.Call(target, 0, data);
    }

    function _single(address target, bytes memory data)
        internal
        pure
        returns (EquisSessionDelegate.Call[] memory calls)
    {
        calls = new EquisSessionDelegate.Call[](1);
        calls[0] = _call(target, data);
    }
}
