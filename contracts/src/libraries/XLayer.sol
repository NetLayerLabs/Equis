// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

/// @notice Verified X Layer mainnet addresses. Every entry was checked on-chain before being added.
library XLayer {
    uint256 internal constant CHAIN_ID = 196;

    /// @dev USD₮0 — the dominant USDT on X Layer (~103.8M supply on 2026-09-15), 6 decimals.
    address internal constant USDT0 = 0x779Ded0c9e1022225f8E0630b35a9b54bE713736;

    // Chainlink — push feeds are 8 decimals with a 24h heartbeat / 0.5% deviation.
    address internal constant CHAINLINK_USDT0_USD = 0x673b428Fd1df93a6F77fA7ea1F8eeD8A4Ff36b9f;
    address internal constant CHAINLINK_OKB_USD = 0x4Ff345b18a2bF894F8627F41501FBf30d5C5e7BE;
    /// @dev Answer 0 = sequencer up. Check before trusting any price.
    address internal constant CHAINLINK_SEQUENCER_UPTIME = 0x45c2b8C204568A03Dc7A2E32B71D67Fe97F908A9;
    /// @dev Data Streams VerifierProxy 2.0.0 (no fee manager, no access controller) — verifies signed pull reports.
    address internal constant CHAINLINK_STREAMS_VERIFIER = 0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7;

    // xStocks (Backed) non-rebasing ERC-4626 wrappers — 18 decimals; convertToAssets(1e18) = token multiplier.
    // These, not the rebasing tokens, hold the DEX liquidity on X Layer.
    address internal constant WNVDAX = 0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5;
    address internal constant WAAPLX = 0x943BF64D566c32A2Bcd41AC92FB63C111cC9De8f;
    address internal constant WTSLAX = 0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171;
    address internal constant WSPYX = 0xE7E553Cd128F0011777323A0b44a7b96EA1CB540;
    address internal constant WQQQX = 0x4C1AE29c159838fC1b224636E28E086EB69101f7;

    // Chainlink Data Streams v10 (tokenized asset) stream IDs, from Chainlink's official feed directory.
    // Entitlement-gated: not in the public catalog.
    bytes32 internal constant STREAM_NVDAX = 0x000a37a55df2ef907d8fa06af6632bc16da58a62b68be2e1994efaa037a0918a;
    bytes32 internal constant STREAM_AAPLX = 0x000a7a12270b5a30236bf410679df0c6bb1bba2b40e5d86847748ff1c8f8452b;
    bytes32 internal constant STREAM_TSLAX = 0x000a80c655069b61d168b887d5e7f4231fe288c6ccb84b1854c9ccead20f3398;
    bytes32 internal constant STREAM_SPYX = 0x000ac6ba1b453a15c1fe9dcd82265ca47bcd04e7b3667de1623617c45cef2a77;
    bytes32 internal constant STREAM_QQQX = 0x000a1db22e3e1aa657d910dc90e1f0dbe693d345b7b0b04fd9efc8eb17aef267;
}
