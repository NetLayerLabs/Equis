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
 * Equis on X Layer mainnet. These are the live addresses, so a fresh clone talks to the real protocol;
 * set NEXT_PUBLIC_EQUIS_* to point the app at your own deployment instead.
 */
export const deployment = {
  vault: (process.env.NEXT_PUBLIC_EQUIS_VAULT ?? "0x6577BFc845B9Bf56DAF38b0ff0b2dD248Ad4885F") as Address,
  pool: (process.env.NEXT_PUBLIC_EQUIS_POOL ?? "0xC6e2EFc3f92B9eE88ae66000cB1c66ee20F1fF8e") as Address,
  oracle: (process.env.NEXT_PUBLIC_EQUIS_ORACLE ?? "0x478A62bDD88A26d10c854F4E382fDE0573d16b4d") as Address,
  sessionDelegate: (process.env.NEXT_PUBLIC_EQUIS_SESSION_DELEGATE ?? "0x946A509bC424367c7F6C3d0e534e037026c917eD") as Address,
} as const;

export const isDeployed = Boolean(deployment.vault && deployment.pool);
