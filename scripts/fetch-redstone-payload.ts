/**
 * Builds a real, signed RedStone payload for the Equis collateral and saves it for the fork tests.
 *
 *   node scripts/fetch-redstone-payload.ts
 *
 * RedStone's own SDK now requires an API key for its gateways, but the public gateway still serves the
 * signed packages, and @redstone-finance/protocol assembles them into the same payload the onchain consumer
 * parses. The payload is valid for three minutes (RedstoneDefaultsLib), so the test warps to the recorded
 * timestamp rather than trusting the fork's clock. The output is data, not source, and stays gitignored.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RedstonePayload, SignedDataPackage } from "@redstone-finance/protocol";
import { REDSTONE_DATA_SERVICE_ID, REDSTONE_UNIQUE_SIGNERS } from "../src/lib/redstone.ts";
import { XSTOCKS } from "../src/lib/xstocks.ts";

const GATEWAY = `https://oracle-gateway-1.a.redstone.finance/data-packages/latest/${REDSTONE_DATA_SERVICE_ID}`;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stocks = XSTOCKS.filter((stock) => stock.redstoneFeed);

const response = await fetch(GATEWAY);
if (!response.ok) throw new Error(`RedStone gateway ${response.status}`);
const all = (await response.json()) as Record<string, unknown[]>;

const signed = [];
const timestamps = [];
for (const stock of stocks) {
  const entries = (all[stock.redstoneFeed as string] ?? []).slice(0, REDSTONE_UNIQUE_SIGNERS);
  if (entries.length < REDSTONE_UNIQUE_SIGNERS) {
    throw new Error(`${stock.redstoneFeed}: only ${entries.length} packages, need ${REDSTONE_UNIQUE_SIGNERS}`);
  }
  for (const entry of entries) {
    signed.push(SignedDataPackage.fromObj(entry as never));
    timestamps.push((entry as { timestampMilliseconds: number }).timestampMilliseconds);
  }
  console.log(`${stock.symbol.padEnd(8)} ${String(stock.redstoneFeed).padEnd(14)} ${entries.length} packages`);
}

const payload = RedstonePayload.prepare(signed, "equis");
const timestampSeconds = Math.floor(Math.min(...timestamps) / 1000);

const fixture = {
  timestampSeconds,
  feeds: stocks.map((stock) => stock.redstoneFeed),
  assets: stocks.map((stock) => stock.wrapper),
  symbols: stocks.map((stock) => stock.symbol),
  payload: payload.startsWith("0x") ? payload : `0x${payload}`,
};

const outPath = resolve(root, "contracts/test/fixtures/redstone-payload.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(
  `payload ${fixture.payload.length / 2 - 1} bytes, observed ${new Date(timestampSeconds * 1000).toISOString()}`,
);
console.log(`saved -> ${outPath}`);
