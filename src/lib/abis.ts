import { parseAbi } from "viem";

export const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export const erc4626Abi = parseAbi([
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function asset() view returns (address)",
]);

export const aggregatorV3Abi = parseAbi([
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

export const lendingPoolAbi = parseAbi([
  "function totalAssets() view returns (uint256)",
  "function totalDebt() view returns (uint256)",
  "function debtOf(address account) view returns (uint256)",
  "function cash() view returns (uint256)",
  "function supplyCap() view returns (uint256)",
  "function reserveFactor() view returns (uint256)",
  "function borrowRatePerSecond() view returns (uint256)",
  "function maxWithdraw(address owner) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function deposit(uint256 assets, address receiver) returns (uint256)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
]);

export const marginVaultAbi = parseAbi([
  "struct AccountData { uint256 collateralValue; uint256 borrowPower; uint256 liquidationValue; uint256 debt; uint256 debtValue; bool marketsOpen; }",
  "function accountData(address account) view returns (AccountData)",
  "function healthFactor(address account) view returns (uint256)",
  "function collateralAssets() view returns (address[])",
  "function collateralOf(address account, address asset) view returns (uint256)",
  "function collateralConfig(address asset) view returns (bool listed, bool depositsEnabled, uint8 decimals, uint16 ltvBps, uint16 liquidationThresholdBps, uint16 liquidationBonusBps, uint256 supplyCap, uint256 totalDeposits)",
  "function depositCollateral(address asset, uint256 amount)",
  "function withdrawCollateral(address asset, uint256 amount, bytes[] priceReports)",
  "function borrow(uint256 amount, bytes[] priceReports)",
  "function repay(address account, uint256 amount) returns (uint256)",
]);

export const sessionDelegateAbi = parseAbi([
  "struct Call { address target; uint256 value; bytes data; }",
  "struct Permission { address target; bytes4 selector; }",
  "struct SpendLimit { address token; uint256 amount; }",
  "function execute(Call[] calls) payable",
  "function grantSession(address key, uint48 expiry, Permission[] permissions, SpendLimit[] limits) returns (uint256)",
  "function revokeSession(address key)",
  "function sessionOf(address key) view returns (uint256 sessionId, uint48 expiry)",
  "function remainingLimits(address key) view returns (SpendLimit[])",
]);
