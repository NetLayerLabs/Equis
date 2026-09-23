/**
 * Chainlink Data Streams REST client. Server-side only: it needs the API secret, so never import it from a
 * client component.
 */
import { createHash, createHmac } from "node:crypto";

export const DATA_STREAMS_API_URL = "https://api.dataengine.chain.link";

export type StreamReport = {
  feedID: `0x${string}`;
  validFromTimestamp: number;
  observationsTimestamp: number;
  /** Signed report, passed unchanged to the onchain VerifierProxy. */
  fullReport: `0x${string}`;
};

export type DataStreamsCredentials = {
  apiKey: string;
  apiSecret: string;
};

/** HMAC-SHA256 over "METHOD path?query sha256(body) apiKey timestampMs", as the API requires. */
export function signRequest(
  method: string,
  pathWithQuery: string,
  body: string,
  { apiKey, apiSecret }: DataStreamsCredentials,
  timestampMs = Date.now(),
): Record<string, string> {
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const stringToSign = `${method} ${pathWithQuery} ${bodyHash} ${apiKey} ${timestampMs}`;
  return {
    Authorization: apiKey,
    "X-Authorization-Timestamp": String(timestampMs),
    "X-Authorization-Signature-SHA256": createHmac("sha256", apiSecret).update(stringToSign).digest("hex"),
  };
}

export async function fetchLatestReport(
  feedId: string,
  credentials: DataStreamsCredentials,
): Promise<StreamReport> {
  const path = `/api/v1/reports/latest?feedID=${feedId}`;
  const res = await fetch(`${DATA_STREAMS_API_URL}${path}`, {
    headers: signRequest("GET", path, "", credentials),
  });
  if (!res.ok) {
    throw new Error(`Data Streams API ${res.status} for ${feedId}: ${await res.text()}`);
  }
  const { report } = (await res.json()) as { report: StreamReport };
  return report;
}
