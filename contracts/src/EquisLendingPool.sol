// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {ERC20, IERC20, ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IInterestRateModel} from "./interfaces/IInterestRateModel.sol";

/// @title EquisLendingPool
/// @notice ERC-4626 pool of USD₮0 on X Layer. Lenders deposit and earn the interest paid by margin
///         borrowers. Only the EquisMarginVault, which enforces collateral requirements, can open or
///         close debt against the pool.
/// @dev Debt is tracked as scaled balances against a borrow index (1e27). Cash is tracked internally
///      so direct token donations can't move the share price.
contract EquisLendingPool is ERC4626, Ownable2Step {
    using SafeERC20 for IERC20;
    using Math for uint256;

    uint256 internal constant WAD = 1e18;
    uint256 internal constant RAY = 1e27;
    uint256 public constant MAX_RESERVE_FACTOR = 0.5e18;

    IInterestRateModel public rateModel;
    address public vault;
    address public treasury;
    /// @notice Share of borrower interest kept as protocol reserves, 1e18 = 100%.
    uint256 public reserveFactor;
    /// @notice Maximum total assets the pool accepts from lenders.
    uint256 public supplyCap;

    uint256 public cash;
    uint256 public reserves;
    uint256 public borrowIndex = RAY;
    uint256 public totalScaledDebt;
    uint256 public lastAccrual;
    mapping(address account => uint256) public scaledDebtOf;

    event Accrued(uint256 borrowIndex, uint256 interest, uint256 reservesAdded);
    event Borrowed(address indexed account, address indexed receiver, uint256 amount);
    event Repaid(address indexed account, address indexed payer, uint256 amount);
    event VaultSet(address vault);
    event RateModelSet(IInterestRateModel rateModel);
    event ReserveFactorSet(uint256 reserveFactor);
    event SupplyCapSet(uint256 supplyCap);
    event TreasurySet(address treasury);
    event ReservesWithdrawn(address indexed treasury, uint256 amount);

    error OnlyVault();
    error VaultAlreadySet();
    error ZeroAddress();
    error ReserveFactorTooHigh();
    error InsufficientCash();
    error ExceedsReserves();

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    constructor(
        IERC20 asset_,
        IInterestRateModel rateModel_,
        address owner_,
        address treasury_,
        uint256 reserveFactor_,
        uint256 supplyCap_
    ) ERC20("Equis USDT0 Lending Pool", "eqUSDT0") ERC4626(asset_) Ownable(owner_) {
        if (address(rateModel_) == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (reserveFactor_ > MAX_RESERVE_FACTOR) revert ReserveFactorTooHigh();
        rateModel = rateModel_;
        treasury = treasury_;
        reserveFactor = reserveFactor_;
        supplyCap = supplyCap_;
        lastAccrual = block.timestamp;
    }

    // ---------------------------------------------------------------------------------------------
    // Interest
    // ---------------------------------------------------------------------------------------------

    function accrue() public {
        if (block.timestamp == lastAccrual) return;
        (uint256 newIndex, uint256 interest, uint256 reservesAdded) = _pendingAccrual();
        lastAccrual = block.timestamp;
        if (interest == 0) return;
        borrowIndex = newIndex;
        reserves += reservesAdded;
        emit Accrued(newIndex, interest, reservesAdded);
    }

    function totalDebt() public view returns (uint256) {
        (uint256 index,,) = _pendingAccrual();
        return totalScaledDebt.mulDiv(index, RAY, Math.Rounding.Ceil);
    }

    function debtOf(address account) public view returns (uint256) {
        (uint256 index,,) = _pendingAccrual();
        return scaledDebtOf[account].mulDiv(index, RAY, Math.Rounding.Ceil);
    }

    /// @notice Current borrow rate per second, 1e18 = 100%.
    function borrowRatePerSecond() external view returns (uint256) {
        return rateModel.borrowRatePerSecond(cash, totalDebt());
    }

    function _pendingAccrual() internal view returns (uint256 newIndex, uint256 interest, uint256 reservesAdded) {
        uint256 elapsed = block.timestamp - lastAccrual;
        uint256 debt = totalScaledDebt.mulDiv(borrowIndex, RAY, Math.Rounding.Ceil);
        if (elapsed == 0 || debt == 0) return (borrowIndex, 0, 0);

        uint256 growth = rateModel.borrowRatePerSecond(cash, debt) * elapsed;
        newIndex = borrowIndex + borrowIndex.mulDiv(growth, WAD);
        interest = debt.mulDiv(growth, WAD);
        reservesAdded = interest.mulDiv(reserveFactor, WAD);
    }

    function _availableCash() internal view returns (uint256) {
        return cash > reserves ? cash - reserves : 0;
    }

    // ---------------------------------------------------------------------------------------------
    // Vault: borrow / repay
    // ---------------------------------------------------------------------------------------------

    /// @notice Opens `amount` of debt for `account` and sends the USD₮0 to `receiver`.
    function borrow(address account, address receiver, uint256 amount) external onlyVault {
        accrue();
        if (amount > _availableCash()) revert InsufficientCash();

        uint256 scaled = amount.mulDiv(RAY, borrowIndex, Math.Rounding.Ceil);
        scaledDebtOf[account] += scaled;
        totalScaledDebt += scaled;
        cash -= amount;

        IERC20(asset()).safeTransfer(receiver, amount);
        emit Borrowed(account, receiver, amount);
    }

    /// @notice Repays up to `amount` of `account`'s debt, pulling USD₮0 from `payer`.
    /// @return repaid Amount actually repaid, capped at the outstanding debt.
    function repay(address account, address payer, uint256 amount) external onlyVault returns (uint256 repaid) {
        accrue();
        uint256 scaledBalance = scaledDebtOf[account];
        uint256 debt = scaledBalance.mulDiv(borrowIndex, RAY, Math.Rounding.Ceil);

        uint256 scaled;
        if (amount >= debt) {
            repaid = debt;
            scaled = scaledBalance;
        } else {
            repaid = amount;
            scaled = amount.mulDiv(RAY, borrowIndex, Math.Rounding.Floor);
        }

        scaledDebtOf[account] = scaledBalance - scaled;
        totalScaledDebt -= scaled;
        cash += repaid;

        IERC20(asset()).safeTransferFrom(payer, address(this), repaid);
        emit Repaid(account, payer, repaid);
    }

    // ---------------------------------------------------------------------------------------------
    // ERC-4626
    // ---------------------------------------------------------------------------------------------

    function totalAssets() public view override returns (uint256) {
        (uint256 index,, uint256 reservesAdded) = _pendingAccrual();
        uint256 gross = cash + totalScaledDebt.mulDiv(index, RAY, Math.Rounding.Ceil);
        uint256 owedToTreasury = reserves + reservesAdded;
        return gross > owedToTreasury ? gross - owedToTreasury : 0;
    }

    function maxDeposit(address) public view override returns (uint256) {
        uint256 assets = totalAssets();
        return assets >= supplyCap ? 0 : supplyCap - assets;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        uint256 assets = maxDeposit(receiver);
        return assets == type(uint256).max ? assets : _convertToShares(assets, Math.Rounding.Floor);
    }

    function maxWithdraw(address owner_) public view override returns (uint256) {
        return Math.min(super.maxWithdraw(owner_), _availableCash());
    }

    function maxRedeem(address owner_) public view override returns (uint256) {
        return Math.min(super.maxRedeem(owner_), _convertToShares(_availableCash(), Math.Rounding.Floor));
    }

    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        accrue();
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override returns (uint256) {
        accrue();
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner_) public override returns (uint256) {
        accrue();
        return super.withdraw(assets, receiver, owner_);
    }

    function redeem(uint256 shares, address receiver, address owner_) public override returns (uint256) {
        accrue();
        return super.redeem(shares, receiver, owner_);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        super._deposit(caller, receiver, assets, shares);
        cash += assets;
    }

    function _withdraw(address caller, address receiver, address owner_, uint256 assets, uint256 shares)
        internal
        override
    {
        cash -= assets;
        super._withdraw(caller, receiver, owner_, assets, shares);
    }

    /// @dev Virtual shares (1e6) make the first-depositor inflation attack uneconomical.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    // ---------------------------------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------------------------------

    /// @notice One-time link to the margin vault. Deploy order: pool → vault → setVault.
    function setVault(address vault_) external onlyOwner {
        if (vault != address(0)) revert VaultAlreadySet();
        if (vault_ == address(0)) revert ZeroAddress();
        vault = vault_;
        emit VaultSet(vault_);
    }

    function setRateModel(IInterestRateModel rateModel_) external onlyOwner {
        if (address(rateModel_) == address(0)) revert ZeroAddress();
        accrue();
        rateModel = rateModel_;
        emit RateModelSet(rateModel_);
    }

    function setReserveFactor(uint256 reserveFactor_) external onlyOwner {
        if (reserveFactor_ > MAX_RESERVE_FACTOR) revert ReserveFactorTooHigh();
        accrue();
        reserveFactor = reserveFactor_;
        emit ReserveFactorSet(reserveFactor_);
    }

    function setSupplyCap(uint256 supplyCap_) external onlyOwner {
        supplyCap = supplyCap_;
        emit SupplyCapSet(supplyCap_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function withdrawReserves(uint256 amount) external onlyOwner {
        accrue();
        if (amount > reserves) revert ExceedsReserves();
        if (amount > cash) revert InsufficientCash();
        reserves -= amount;
        cash -= amount;
        IERC20(asset()).safeTransfer(treasury, amount);
        emit ReservesWithdrawn(treasury, amount);
    }
}
