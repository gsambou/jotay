/** Génère l'identifiant opaque du QR : non devinable (>=128 bits), jamais dérivé du MSISDN
 *  ni du walletId. L'implémentation vit en infra (node:crypto). */
export interface OpaqueIdMinter { mint(): string; }
