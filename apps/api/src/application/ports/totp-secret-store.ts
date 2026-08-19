/** Secret TOTP par wallet (16-32 octets). Ne quitte JAMAIS le serveur. */
export interface TotpSecretStore { secretFor(walletId: string): Promise<Uint8Array | null>; }
