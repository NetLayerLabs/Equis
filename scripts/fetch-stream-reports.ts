/**
 * Fetches the latest real Chainlink Data Streams v10 reports for Equis's xStocks collateral and saves them,
 * together with an X Layer block they're valid at, for the contracts' mainnet fork tests.
 *
 *   node scripts/fetch-stream-reports.ts
 *
 * Reads CHAINLINK_STREAMS_API_KEY and CHAINLINK_STREAMS_API_SECRET from contracts/.env.
 * The output is gitignored: the signed reports come from your Chainlink entitlement and aren't ours to publish.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchLatestReport } from "../src/lib/chainlink/dataStreams.ts";
import { XSTOCKS } from "../src/lib/xstocks.ts";

const XLAYER_RPC_URL = "https://rpc.xlayer.tech";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  process.loadEnvFile(resolve(root, "contracts/.env"));
} catch {
  // Fall through to the explicit check below.
}
const apiKey = process.env.CHAINLINK_STREAMS_API_KEY;
const apiSecret = process.env.CHAINLINK_STREAMS_API_SECRET;
if (!apiKey || !apiSecret) {
  console.error("Set CHAINLINK_STREAMS_API_KEY and CHAINLINK_STREAMS_API_SECRET in contracts/.env");
  process.exit(1);
}

async function latestBlock(): Promise<{ number: number; timestamp: number }> {
  const res = await fetch(XLAYER_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: ["latest", false] }),
  });
  const { result } = (await res.json()) as { result: { number: string; timestamp: string } };
  return { number: Number(result.number), timestamp: Number(result.timestamp) };
}

const reports = await Promise.all(
  XSTOCKS.map(async ({ symbol, wrapper, streamId }) => ({
    symbol,
    wrapper,
    ...(await fetchLatestReport(streamId, { apiKey, apiSecret })),
  })),
);

// The fork tests replay these reports at a block that is already inside every report's validity window.
const validFrom = Math.max(...reports.map((r) => r.validFromTimestamp));
let block = await latestBlock();
while (block.timestamp < validFrom) {
  await new Promise((r) => setTimeout(r, 1_000));
  block = await latestBlock();
}

const outPath = resolve(root, "contracts/test/fixtures/stream-reports.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify({ forkBlock: block.number, forkTimestamp: block.timestamp, reports }, null, 2)}\n`);

for (const r of reports) {
  console.log(`${r.symbol.padEnd(7)} observed ${new Date(r.observationsTimestamp * 1000).toISOString()}`);
}
console.log(`Saved ${reports.length} reports valid at X Layer block ${block.number} → ${outPath}`);
