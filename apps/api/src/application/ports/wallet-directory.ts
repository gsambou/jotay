/** Résout l'identifiant OPAQUE du QR (public, photographiable) vers l'id interne du wallet. */
export interface WalletDirectory {
  resolveOpaqueId(opaqueId: string): Promise<{ walletId: string } | null>;
  /** MSISDN de payout vérifié associé au wallet, s'il existe (pour le remboursement). */
  verifiedPayoutMsisdn(walletId: string): Promise<string | null>;
}
