import { CHAINLINK_OKB_USD, CHAINLINK_SEQUENCER_UPTIME, CHAINLINK_USDT0_USD, USDT0, deployment } from "@/lib/contracts";
import { XSTOCKS } from "@/lib/xstocks";

export type VerifiedAddress = { label: string; role: string; address: string };

/** Equis itself, live on X Layer mainnet. Source is verified, so the code behind each address is readable. */
export const EQUIS_ADDRESSES: ReadonlyArray<VerifiedAddress> = [
  { label: "EquisMarginVault", role: "Holds collateral, enforces LTV, runs liquidations", address: deployment.vault },
  { label: "EquisLendingPool", role: "ERC-4626 pool of USD₮0 that lenders supply", address: deployment.pool },
  { label: "RedStonePriceOracle", role: "Verifies 3-of-5 signed prices onchain", address: deployment.oracle },
  { label: "EquisSessionDelegate", role: "EIP-7702 delegate for scoped agent keys", address: deployment.sessionDelegate },
];

/** The addresses Equis depends on, each read on X Layer mainnet before being written down. */
export const VERIFIED_ADDRESSES: ReadonlyArray<VerifiedAddress> = [
  { label: "USD₮0", role: "The USDT borrowers draw and lenders supply", address: USDT0 },
  ...XSTOCKS.map((stock) => ({
    label: stock.symbol,
    role: stock.redstoneFeed
      ? `${stock.name} - listed as collateral`
      : `${stock.name} - not listed, no public price feed`,
    address: stock.wrapper as string,
  })),
  { label: "USD₮0 / USD", role: "Chainlink push feed pricing the debt", address: CHAINLINK_USDT0_USD },
  { label: "OKB / USD", role: "Chainlink push feed for gas pricing", address: CHAINLINK_OKB_USD },
  { label: "Sequencer uptime", role: "Chainlink feed gating every price read", address: CHAINLINK_SEQUENCER_UPTIME },
];

export const ORACLE_NOTE =
  "X Layer runs the Prague hardfork, so EIP-7702 delegation is live - we confirmed a type-4 transaction is accepted on mainnet. Stock prices arrive as RedStone data packages, signed by three of five known signers and verified inside the borrow transaction itself.";
