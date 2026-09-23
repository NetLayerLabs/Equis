import type { Address } from "viem";

export const X_LAYER_CHAIN_ID = 196;
export const X_LAYER_RPC_URL = "https://rpc.xlayer.tech";
export const OKLINK_ADDRESS_URL = "https://www.oklink.com/x-layer/address/";

/** Verified onchain X Layer mainnet addresses (see contracts/src/libraries/XLayer.sol). */
export const USDT0: Address = "0x779Ded0c9e1022225f8E0630b35a9b54bE713736";
export const CHAINLINK_USDT0_USD: Address = "0x673b428Fd1df93a6F77fA7ea1F8eeD8A4Ff36b9f";
export const CHAINLINK_OKB_USD: Address = "0x4Ff345b18a2bF894F8627F41501FBf30d5C5e7BE";
export const CHAINLINK_SEQUENCER_UPTIME: Address = "0x45c2b8C204568A03Dc7A2E32B71D67Fe97F908A9";

/**
 * Deployed Equis contracts, set after `forge script script/DeployEquis.s.sol --broadcast`.
 * Until these exist the UI shows the protocol as not yet deployed rather than inventing numbers.
 */
export const deployment = {
  vault: process.env.NEXT_PUBLIC_EQUIS_VAULT as Address | undefined,
  pool: process.env.NEXT_PUBLIC_EQUIS_POOL as Address | undefined,
  oracle: process.env.NEXT_PUBLIC_EQUIS_ORACLE as Address | undefined,
  sessionDelegate: process.env.NEXT_PUBLIC_EQUIS_SESSION_DELEGATE as Address | undefined,
} as const;

export const isDeployed = Boolean(deployment.vault && deployment.pool);
