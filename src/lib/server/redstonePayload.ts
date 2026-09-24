import { RedstonePayload, SignedDataPackage } from "@redstone-finance/protocol";
import { encodeAbiParameters, parseAbiParameters, type Address, type Hex } from "viem";
import { REDSTONE_DATA_SERVICE_ID, REDSTONE_UNIQUE_SIGNERS } from "../redstone.ts";
import { XSTOCKS } from "../xstocks.ts";

const GATEWAY = `https://oracle-gateway-1.a.redstone.finance/data-packages/latest/${REDSTONE_DATA_SERVICE_ID}`;

/**
 * A signed RedStone payload for the listed collateral, and the report the vault expects around it.
 * The gateway is public, so this needs no credentials; the signatures are checked onchain either way.
 */
export async function buildRedStoneReport(): Promise<{
  assets: Address[];
  payload: Hex;
  report: Hex;
  observedAt: number;
}> {
  const response = await fetch(GATEWAY);
  if (!response.ok) throw new Error(`RedStone gateway ${response.status}`);
  const packages = (await response.json()) as Record<string, unknown[]>;

  const listed = XSTOCKS.filter((stock) => stock.redstoneFeed);
  const signed = [];
  let observedAt = 0;

  for (const stock of listed) {
    const entries = (packages[stock.redstoneFeed as string] ?? []).slice(0, REDSTONE_UNIQUE_SIGNERS);
    if (entries.length < REDSTONE_UNIQUE_SIGNERS) {
      throw new Error(`${stock.redstoneFeed}: ${entries.length} packages, need ${REDSTONE_UNIQUE_SIGNERS}`);
    }
    for (const entry of entries) {
      signed.push(SignedDataPackage.fromObj(entry as never));
      const stamp = Math.floor((entry as { timestampMilliseconds: number }).timestampMilliseconds / 1000);
      observedAt = observedAt === 0 ? stamp : Math.min(observedAt, stamp);
    }
  }

  const raw = RedstonePayload.prepare(signed, "equis");
  const payload = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  const assets = listed.map((stock) => stock.wrapper as Address);

  return {
    assets,
    payload,
    // What RedStonePriceOracle.updatePrices unpacks, and what the vault relays.
    report: encodeAbiParameters(parseAbiParameters("address[], bytes"), [assets, payload]),
    observedAt,
  };
}
