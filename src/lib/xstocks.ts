/**
 * xStocks collateral on X Layer mainnet. Wrapper addresses were verified onchain (symbol, 18 decimals,
 * convertToAssets = token multiplier); stream IDs come from Chainlink's official feed directory (schema v10).
 */
export const XSTOCKS = [
  {
    symbol: "wNVDAx",
    name: "NVIDIA",
    wrapper: "0xa8ddb5Cd96b5222AFe198316E9A57CAA642850D5",
    streamId: "0x000a37a55df2ef907d8fa06af6632bc16da58a62b68be2e1994efaa037a0918a",
  },
  {
    symbol: "wAAPLx",
    name: "Apple",
    wrapper: "0x943BF64D566c32A2Bcd41AC92FB63C111cC9De8f",
    streamId: "0x000a7a12270b5a30236bf410679df0c6bb1bba2b40e5d86847748ff1c8f8452b",
  },
  {
    symbol: "wTSLAx",
    name: "Tesla",
    wrapper: "0xc3FdBe3A68EE5dE461D30415a8165cf9Aefe1171",
    streamId: "0x000a80c655069b61d168b887d5e7f4231fe288c6ccb84b1854c9ccead20f3398",
  },
  {
    symbol: "wSPYx",
    name: "S&P 500",
    wrapper: "0xE7E553Cd128F0011777323A0b44a7b96EA1CB540",
    streamId: "0x000ac6ba1b453a15c1fe9dcd82265ca47bcd04e7b3667de1623617c45cef2a77",
  },
  {
    symbol: "wQQQx",
    name: "Nasdaq 100",
    wrapper: "0x4C1AE29c159838fC1b224636E28E086EB69101f7",
    streamId: "0x000a1db22e3e1aa657d910dc90e1f0dbe693d345b7b0b04fd9efc8eb17aef267",
  },
] as const;
