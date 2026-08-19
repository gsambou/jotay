/** Dépôt idempotent d'une demande de remboursement (traitée en asynchrone par le partenaire). */
export interface RefundRequestSink {
  enqueue(walletId: string, payoutMsisdn: string, idempotencyKey: string, atIso: string): Promise<void>;
}
