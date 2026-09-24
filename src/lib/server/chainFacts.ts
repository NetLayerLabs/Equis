import { createPublicClient, http } from "viem";
import { xLayer } from "viem/chains";
import { aggregatorV3Abi, erc20Abi, erc4626Abi } from "@/lib/abis";
import {
  CHAINLINK_OKB_USD,
  CHAINLINK_SEQUENCER_UPTIME,
  CHAINLINK_USDT0_USD,
  X_LAYER_RPC_URL,
} from "@/lib/contracts";
import { XSTOCKS } from "@/lib/xstocks";

/*
 * Facts the landing page states are read from X Layer mainnet at request time - the page never
 * quotes a number it hasn't just fetched. Values are serialised for the server/client boundary.
 */
export type WrapperFact = {
  symbol: string;
  name: string;
  wrapper: string;
  /** Underlying shares per wrapper unit, 1e18. */
  multiplier: string;
  totalSupply: string;
};

export type ChainFacts = {
  usdt0Usd: number;
  okbUsd: number;
  sequencerUp: boolean;
  blockNumber: number;
  wrappers: WrapperFact[];
};

export async function readChainFacts(): Promise<ChainFacts | null> {
  const client = createPublicClient({ chain: xLayer, transport: http(process.env.X_LAYER_RPC_URL ?? X_LAYER_RPC_URL) });

  try {
    const [usdt0Round, okbRound, sequencerRound, blockNumber, wrappers] = await Promise.all([
      client.readContract({ address: CHAINLINK_USDT0_USD, abi: aggregatorV3Abi, functionName: "latestRoundData" }),
      client.readContract({ address: CHAINLINK_OKB_USD, abi: aggregatorV3Abi, functionName: "latestRoundData" }),
      client.readContract({
        address: CHAINLINK_SEQUENCER_UPTIME,
        abi: aggregatorV3Abi,
        functionName: "latestRoundData",
      }),
      client.getBlockNumber(),
      Promise.all(
        XSTOCKS.map(async ({ symbol, name, wrapper }) => {
          const [multiplier, totalSupply] = await Promise.all([
            client.readContract({
              address: wrapper,
              abi: erc4626Abi,
              functionName: "convertToAssets",
              args: [10n ** 18n],
            }),
            client.readContract({ address: wrapper, abi: erc20Abi, functionName: "totalSupply" }),
          ]);
          return { symbol, name, wrapper, multiplier: multiplier.toString(), totalSupply: totalSupply.toString() };
        }),
      ),
    ]);

    return {
      usdt0Usd: Number(usdt0Round[1]) / 1e8,
      okbUsd: Number(okbRound[1]) / 1e8,
      sequencerUp: Number(sequencerRound[1]) === 0,
      blockNumber: Number(blockNumber),
      wrappers,
    };
  } catch {
    // The page renders without live figures rather than failing the request.
    return null;
  }
}
