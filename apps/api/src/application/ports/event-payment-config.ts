/** Plafonds QR d'un événement — SOURCE SERVEUR, jamais le body marchand (SPEC-QR). */
export interface QrEventLimits {
  microPinThresholdXof: number;
  velocityAmountCapXof: number;
  velocityTxCap: number;
  pinMaxFailures: number;
}

export interface EventPaymentConfig {
  qrLimits(eventId: string): Promise<QrEventLimits>;
}
