import { CHAINLINK_OKB_USD, CHAINLINK_SEQUENCER_UPTIME, CHAINLINK_USDT0_USD, USDT0 } from "@/lib/contracts";
import { XSTOCKS } from "@/lib/xstocks";

/** The addresses Equis depends on, each read on X Layer mainnet before being written down. */
export const VERIFIED_ADDRESSES: ReadonlyArray<{ label: string; role: string; address: string }> = [
  { label: "USD₮0", role: "The USDT borrowers draw and lenders supply", address: USDT0 },
  ...XSTOCKS.map((stock) => ({
    label: stock.symbol,
    role: `${stock.name} - xStocks wrapper accepted as collateral`,
    address: stock.wrapper as string,
  })),
  { label: "USD₮0 / USD", role: "Chainlink push feed pricing the debt", address: CHAINLINK_USDT0_USD },
  { label: "OKB / USD", role: "Chainlink push feed for gas pricing", address: CHAINLINK_OKB_USD },
  { label: "Sequencer uptime", role: "Chainlink feed gating every price read", address: CHAINLINK_SEQUENCER_UPTIME },
];

export const CHAINLINK_STREAMS_VERIFIER_NOTE =
  "X Layer runs the Prague hardfork, so EIP-7702 delegation is live - we confirmed a type-4 transaction is accepted on mainnet. Stock prices arrive as Chainlink Data Streams reports verified through the onchain VerifierProxy.";
