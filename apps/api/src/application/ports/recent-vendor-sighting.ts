/**
 * Dernier vendeur vu pour un wallet (fenêtre de vélocité).
 * Deux vendorId distincts dans la fenêtre → anomalie MULTI_VENDOR_WINDOW (pas de km inventés).
 */
export interface RecentVendorSighting {
  /** Enregistre le vendeur ; retourne le vendorId précédent s'il diffère et est encore dans la fenêtre. */
  remember(walletId: string, vendorId: string, atIso: string, windowMs: number): Promise<string | null>;
}
