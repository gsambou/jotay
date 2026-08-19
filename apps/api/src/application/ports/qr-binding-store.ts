/** Lie un identifiant opaque (public, imprimé sur le QR) à un wallet interne. Append-only. */
export interface QrBindingStore {
  bind(opaqueId: string, walletId: string, atIso: string): Promise<void>;
}
