// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {EquisLendingPool} from "./EquisLendingPool.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {IPausableToken} from "./interfaces/IPausableToken.sol";

/// @title EquisMarginVault
/// @notice Margin credit against tokenized stocks on X Layer. Users deposit xStocks wrappers (e.g. wNVDAx) as
///         collateral and borrow USD₮0 from the EquisLendingPool. When an account's debt exceeds its
///         liquidation value, anyone can repay part of the debt and take collateral at a bonus.
/// @dev Every user action applies to msg.sender and pays out to msg.sender — there are no receiver or
///      onBehalfOf parameters — so an EIP-7702 session key allowlisted for these selectors can't redirect funds.
///      Stock prices come from signed pull reports: pass them in `priceReports` and they're verified first.
///      While a collateral's market is closed, borrowing and withdrawing against it are blocked, but
///      liquidations still run at the latest verified price.
contract EquisMarginVault is Ownable2Step, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;
    using Math for uint256;

    uint256 internal constant WAD = 1e18;
    uint256 internal constant BPS = 10_000;
    uint256 public constant MAX_COLLATERAL_ASSETS = 16;
    uint256 public constant MAX_LIQUIDATION_BONUS_BPS = 2_000;
    /// @notice Below this health factor a position can be liquidated in full instead of by the close factor.
    uint256 public constant FULL_LIQUIDATION_HEALTH_FACTOR = 0.95e18;

    struct CollateralConfig {
        bool listed;
        bool depositsEnabled;
        uint8 decimals;
        uint16 ltvBps;
        uint16 liquidationThresholdBps;
        uint16 liquidationBonusBps;
        uint256 supplyCap;
        uint256 totalDeposits;
    }

    struct AccountData {
        /// @dev USD values are scaled by 1e18.
        uint256 collateralValue;
        /// @dev Σ value × LTV, excluding collateral whose token is paused (it couldn't be liquidated).
        uint256 borrowPower;
        /// @dev Σ value × liquidation threshold.
        uint256 liquidationValue;
        /// @dev Outstanding debt in USD₮0 units.
        uint256 debt;
        uint256 debtValue;
        /// @dev True when every collateral the account holds has an open market.
        bool marketsOpen;
    }

    EquisLendingPool public immutable pool;
    IERC20 public immutable debtAsset;
    uint8 internal immutable debtDecimals;

    IPriceOracle public oracle;
    address public guardian;
    bool public borrowingPaused;
    uint16 public closeFactorBps = 5_000;

    address[] internal _collateralAssets;
    mapping(address asset => CollateralConfig) public collateralConfig;
    mapping(address account => mapping(address asset => uint256)) public collateralOf;

    event CollateralDeposited(address indexed account, address indexed asset, uint256 amount);
    event CollateralWithdrawn(address indexed account, address indexed asset, uint256 amount);
    event Borrowed(address indexed account, uint256 amount);
    event Repaid(address indexed account, address indexed payer, uint256 amount);
    event Liquidated(
        address indexed liquidator, address indexed account, address indexed asset, uint256 repaid, uint256 seized
    );
    event CollateralListed(address indexed asset);
    event CollateralParamsSet(
        address indexed asset,
        uint16 ltvBps,
        uint16 liquidationThresholdBps,
        uint16 liquidationBonusBps,
        uint256 supplyCap,
        bool depositsEnabled
    );
    event OracleSet(IPriceOracle oracle);
    event GuardianSet(address guardian);
    event BorrowingPausedSet(bool paused);
    event CloseFactorSet(uint16 closeFactorBps);

    error ZeroAddress();
    error ZeroAmount();
    error Unauthorized();
    error NotListed(address asset);
    error AlreadyListed(address asset);
    error TooManyCollateralAssets();
    error InvalidRiskParams();
    error InvalidCloseFactor();
    error DepositsDisabled(address asset);
    error SupplyCapExceeded(address asset);
    error InsufficientCollateral();
    error BorrowingIsPaused();
    error MarketClosed();
    error InsufficientBorrowPower(uint256 debtValue, uint256 borrowPower);
    error AccountHealthy();

    constructor(EquisLendingPool pool_, IPriceOracle oracle_, address owner_, address guardian_) Ownable(owner_) {
        if (address(pool_) == address(0) || address(oracle_) == address(0)) revert ZeroAddress();
        pool = pool_;
        debtAsset = IERC20(pool_.asset());
        debtDecimals = IERC20Metadata(pool_.asset()).decimals();
        oracle = oracle_;
        guardian = guardian_;
    }

    // ---------------------------------------------------------------------------------------------
    // User actions
    // ---------------------------------------------------------------------------------------------

    function depositCollateral(address asset, uint256 amount) external nonReentrant {
        CollateralConfig storage cfg = _listed(asset);
        if (!cfg.depositsEnabled) revert DepositsDisabled(asset);
        if (amount == 0) revert ZeroAmount();
        if (cfg.totalDeposits + amount > cfg.supplyCap) revert SupplyCapExceeded(asset);

        cfg.totalDeposits += amount;
        collateralOf[msg.sender][asset] += amount;
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        emit CollateralDeposited(msg.sender, asset, amount);
    }

    function withdrawCollateral(address asset, uint256 amount, bytes[] calldata priceReports) external nonReentrant {
        CollateralConfig storage cfg = _listed(asset);
        if (amount == 0) revert ZeroAmount();
        uint256 balance = collateralOf[msg.sender][asset];
        if (amount > balance) revert InsufficientCollateral();

        _updatePrices(priceReports);
        collateralOf[msg.sender][asset] = balance - amount;
        cfg.totalDeposits -= amount;
        _requireBorrowPowerCoversDebt(msg.sender);

        IERC20(asset).safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, asset, amount);
    }

    function borrow(uint256 amount, bytes[] calldata priceReports) external nonReentrant {
        if (borrowingPaused) revert BorrowingIsPaused();
        if (amount == 0) revert ZeroAmount();

        _updatePrices(priceReports);
        pool.borrow(msg.sender, msg.sender, amount);
        _requireBorrowPowerCoversDebt(msg.sender);
        emit Borrowed(msg.sender, amount);
    }

    /// @notice Repays up to `amount` of `account`'s debt from msg.sender. The payer approves the pool, not the vault.
    function repay(address account, uint256 amount) external nonReentrant returns (uint256 repaid) {
        if (amount == 0) revert ZeroAmount();
        repaid = pool.repay(account, msg.sender, amount);
        emit Repaid(account, msg.sender, repaid);
    }

    /// @notice Repays debt of an unhealthy `account` and takes `collateralAsset` worth the repaid amount plus
    ///         the liquidation bonus. The liquidator approves the pool for USD₮0.
    function liquidate(address account, address collateralAsset, uint256 repayAmount, bytes[] calldata priceReports)
        external
        nonReentrant
        returns (uint256 repaid, uint256 seized)
    {
        CollateralConfig storage cfg = _listed(collateralAsset);
        if (repayAmount == 0) revert ZeroAmount();

        _updatePrices(priceReports);
        (repaid, seized) =
            _liquidationAmounts(account, collateralAsset, Math.min(repayAmount, _maxLiquidatableDebt(account)));

        collateralOf[account][collateralAsset] -= seized;
        cfg.totalDeposits -= seized;

        repaid = pool.repay(account, msg.sender, repaid);
        IERC20(collateralAsset).safeTransfer(msg.sender, seized);
        emit Liquidated(msg.sender, account, collateralAsset, repaid, seized);
    }

    // ---------------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------------

    /// @dev Reverts if any price the account needs is stale — simulate with fresh reports via `oracle.updatePrices`.
    function accountData(address account) public view returns (AccountData memory data) {
        data.marketsOpen = true;
        uint256 count = _collateralAssets.length;
        for (uint256 i; i < count; ++i) {
            address asset = _collateralAssets[i];
            uint256 amount = collateralOf[account][asset];
            if (amount == 0) continue;

            CollateralConfig storage cfg = collateralConfig[asset];
            (uint256 price, bool marketOpen) = oracle.getPrice(asset);
            uint256 value = amount.mulDiv(price, 10 ** cfg.decimals);

            data.collateralValue += value;
            data.liquidationValue += value.mulDiv(cfg.liquidationThresholdBps, BPS);
            if (!_isPaused(asset)) data.borrowPower += value.mulDiv(cfg.ltvBps, BPS);
            if (!marketOpen) data.marketsOpen = false;
        }

        data.debt = pool.debtOf(account);
        if (data.debt != 0) {
            (uint256 debtPrice,) = oracle.getPrice(address(debtAsset));
            data.debtValue = data.debt.mulDiv(debtPrice, 10 ** debtDecimals, Math.Rounding.Ceil);
        }
    }

    /// @return Liquidation value / debt value, 1e18 = 1.0. Below 1.0 the account can be liquidated.
    function healthFactor(address account) external view returns (uint256) {
        AccountData memory data = accountData(account);
        return data.debtValue == 0 ? type(uint256).max : data.liquidationValue.mulDiv(WAD, data.debtValue);
    }

    function collateralAssets() external view returns (address[] memory) {
        return _collateralAssets;
    }

    // ---------------------------------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------------------------------

    function listCollateral(
        address asset,
        uint16 ltvBps,
        uint16 liquidationThresholdBps,
        uint16 liquidationBonusBps,
        uint256 supplyCap
    ) external onlyOwner {
        if (asset == address(0) || asset == address(debtAsset)) revert ZeroAddress();
        if (collateralConfig[asset].listed) revert AlreadyListed(asset);
        if (_collateralAssets.length >= MAX_COLLATERAL_ASSETS) revert TooManyCollateralAssets();
        _validateRiskParams(ltvBps, liquidationThresholdBps, liquidationBonusBps);

        collateralConfig[asset] = CollateralConfig({
            listed: true,
            depositsEnabled: true,
            decimals: IERC20Metadata(asset).decimals(),
            ltvBps: ltvBps,
            liquidationThresholdBps: liquidationThresholdBps,
            liquidationBonusBps: liquidationBonusBps,
            supplyCap: supplyCap,
            totalDeposits: 0
        });
        _collateralAssets.push(asset);

        emit CollateralListed(asset);
        emit CollateralParamsSet(asset, ltvBps, liquidationThresholdBps, liquidationBonusBps, supplyCap, true);
    }

    /// @dev Lowering the liquidation threshold can make existing positions liquidatable immediately.
    function setCollateralParams(
        address asset,
        uint16 ltvBps,
        uint16 liquidationThresholdBps,
        uint16 liquidationBonusBps,
        uint256 supplyCap,
        bool depositsEnabled
    ) external onlyOwner {
        CollateralConfig storage cfg = _listed(asset);
        _validateRiskParams(ltvBps, liquidationThresholdBps, liquidationBonusBps);

        cfg.ltvBps = ltvBps;
        cfg.liquidationThresholdBps = liquidationThresholdBps;
        cfg.liquidationBonusBps = liquidationBonusBps;
        cfg.supplyCap = supplyCap;
        cfg.depositsEnabled = depositsEnabled;

        emit CollateralParamsSet(
            asset, ltvBps, liquidationThresholdBps, liquidationBonusBps, supplyCap, depositsEnabled
        );
    }

    function setOracle(IPriceOracle oracle_) external onlyOwner {
        if (address(oracle_) == address(0)) revert ZeroAddress();
        oracle = oracle_;
        emit OracleSet(oracle_);
    }

    function setGuardian(address guardian_) external onlyOwner {
        guardian = guardian_;
        emit GuardianSet(guardian_);
    }

    /// @notice The guardian can pause borrowing in an emergency; only the owner can resume it.
    function setBorrowingPaused(bool paused) external {
        if (msg.sender != owner() && !(paused && msg.sender == guardian)) revert Unauthorized();
        borrowingPaused = paused;
        emit BorrowingPausedSet(paused);
    }

    function setCloseFactor(uint16 closeFactorBps_) external onlyOwner {
        if (closeFactorBps_ < 1_000 || closeFactorBps_ > BPS) revert InvalidCloseFactor();
        closeFactorBps = closeFactorBps_;
        emit CloseFactorSet(closeFactorBps_);
    }

    // ---------------------------------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------------------------------

    function _updatePrices(bytes[] calldata priceReports) internal {
        if (priceReports.length != 0) oracle.updatePrices(priceReports);
    }

    function _requireBorrowPowerCoversDebt(address account) internal view {
        if (pool.debtOf(account) == 0) return;
        AccountData memory data = accountData(account);
        if (!data.marketsOpen) revert MarketClosed();
        if (data.debtValue > data.borrowPower) revert InsufficientBorrowPower(data.debtValue, data.borrowPower);
    }

    /// @dev Reverts if the account is healthy. Below FULL_LIQUIDATION_HEALTH_FACTOR the whole debt can be cleared.
    function _maxLiquidatableDebt(address account) internal view returns (uint256) {
        AccountData memory data = accountData(account);
        if (data.debtValue == 0 || data.liquidationValue >= data.debtValue) revert AccountHealthy();

        uint256 health = data.liquidationValue.mulDiv(WAD, data.debtValue);
        return health < FULL_LIQUIDATION_HEALTH_FACTOR ? data.debt : data.debt.mulDiv(closeFactorBps, BPS);
    }

    /// @return repaid Debt to clear — reduced if the account holds too little of this collateral.
    /// @return seized Collateral owed to the liquidator: the repaid value plus the liquidation bonus.
    function _liquidationAmounts(address account, address collateralAsset, uint256 repayAmount)
        internal
        view
        returns (uint256 repaid, uint256 seized)
    {
        CollateralConfig storage cfg = collateralConfig[collateralAsset];
        (uint256 debtPrice,) = oracle.getPrice(address(debtAsset));
        (uint256 collateralPrice,) = oracle.getPrice(collateralAsset);

        // Collateral base units paid per debt base unit, bonus included, scaled by 1e18.
        uint256 rate = (debtPrice * (BPS + cfg.liquidationBonusBps))
        .mulDiv(10 ** cfg.decimals * WAD, BPS * 10 ** debtDecimals * collateralPrice);

        repaid = repayAmount;
        seized = repaid.mulDiv(rate, WAD);

        uint256 available = collateralOf[account][collateralAsset];
        if (seized > available) {
            seized = available;
            repaid = available.mulDiv(WAD, rate);
        }
        if (seized == 0 || repaid == 0) revert ZeroAmount();
    }

    function _listed(address asset) internal view returns (CollateralConfig storage cfg) {
        cfg = collateralConfig[asset];
        if (!cfg.listed) revert NotListed(asset);
    }

    function _isPaused(address asset) internal view returns (bool) {
        try IPausableToken(asset).isPaused() returns (bool paused) {
            return paused;
        } catch {
            return false;
        }
    }

    /// @dev LTV sits below the liquidation threshold, and threshold × (1 + bonus) stays under 100% so a
    ///      liquidation never has to seize more collateral than the debt it clears is worth.
    function _validateRiskParams(uint16 ltvBps, uint16 liquidationThresholdBps, uint16 liquidationBonusBps)
        internal
        pure
    {
        if (
            ltvBps >= liquidationThresholdBps || liquidationBonusBps > MAX_LIQUIDATION_BONUS_BPS
                || uint256(liquidationThresholdBps) * (BPS + liquidationBonusBps) >= BPS * BPS
        ) revert InvalidRiskParams();
    }
}
