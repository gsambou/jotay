/** Défauts produit des plafonds QR (SPEC-QR). Paramétrables par événement ; pas des plafonds BCEAO. */
export const DEFAULT_QR_LIMITS = {
  microPinThresholdXof: 1000,
  velocityAmountCapXof: 50_000,
  velocityTxCap: 20,
  /** Verrouillage PIN : défaut produit (chap. 18.5 « N échecs »), pas une valeur réglementaire. */
  pinMaxFailures: 5,
} as const;
