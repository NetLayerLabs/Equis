/**
 * RedStone primary-prod parameters. These signers and the 3-of-5 threshold are exactly what
 * PrimaryProdDataServiceConsumerBase enforces onchain, so a payload accepted here is accepted there.
 */
export const REDSTONE_DATA_SERVICE_ID = "redstone-primary-prod";

export const REDSTONE_UNIQUE_SIGNERS = 3;

export const REDSTONE_AUTHORIZED_SIGNERS = [
  "0x8BB8F32Df04c8b654987DAaeD53D6B6091e3B774",
  "0xdEB22f54738d54976C4c0fe5ce6d408E40d88499",
  "0x51Ce04Be4b3E32572C4Ec9135221d0691Ba7d202",
  "0xDD682daEC5A90dD295d14DA4b0bec9281017b5bE",
  "0x9c5AE89C4Af6aA32cE58588DBaF90d18a855B6de",
] as const;

/** The payload is rejected onchain once it is older than three minutes (RedstoneDefaultsLib). */
export const REDSTONE_MAX_PAYLOAD_AGE_SECONDS = 180;
