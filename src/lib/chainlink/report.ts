import { decodeAbiParameters, parseAbiParameters, type Hex } from "viem";

/**
 * Chainlink Data Streams v10 (tokenized assets). A `fullReport` wraps the signed blob; the blob decodes to
 * the fields below. The same layout is decoded onchain in ChainlinkPriceOracle.sol.
 */
export type ReportV10 = {
  feedId: Hex;
  validFromTimestamp: number;
  observationsTimestamp: number;
  expiresAt: number;
  /** Underlying share price, 1e18. */
  price: bigint;
  /** 0 unknown, 1 closed, 2 open. */
  marketStatus: number;
  currentMultiplier: bigint;
  newMultiplier: bigint;
  activationDateTime: number;
  /** Centralised-exchange price of the token itself; keeps updating at weekends on thin liquidity. */
  tokenizedPrice: bigint;
};

const FULL_REPORT = parseAbiParameters("bytes32[3] reportContext, bytes reportBlob, bytes32[] rs, bytes32[] ss, bytes32 rawVs");

const REPORT_V10 = parseAbiParameters(
  "bytes32 feedId, uint32 validFromTimestamp, uint32 observationsTimestamp, uint192 nativeFee, uint192 linkFee, uint32 expiresAt, uint64 lastUpdateTimestamp, int192 price, uint32 marketStatus, int192 currentMultiplier, int192 newMultiplier, uint32 activationDateTime, int192 tokenizedPrice",
);

export function decodeReportV10(fullReport: Hex): ReportV10 {
  const [, reportBlob] = decodeAbiParameters(FULL_REPORT, fullReport);
  const [
    feedId,
    validFromTimestamp,
    observationsTimestamp,
    ,
    ,
    expiresAt,
    ,
    price,
    marketStatus,
    currentMultiplier,
    newMultiplier,
    activationDateTime,
    tokenizedPrice,
  ] = decodeAbiParameters(REPORT_V10, reportBlob);

  return {
    feedId,
    validFromTimestamp,
    observationsTimestamp,
    expiresAt,
    price,
    marketStatus,
    currentMultiplier,
    newMultiplier,
    activationDateTime,
    tokenizedPrice,
  };
}

/** What one wrapper unit is worth: Chainlink's theoretical price, share price × multiplier. */
export function wrapperPrice(report: ReportV10): bigint {
  return (report.price * report.currentMultiplier) / 10n ** 18n;
}

export const MARKET_STATUS_OPEN = 2;
