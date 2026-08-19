/** Authentification marchande / superviseur — clé API, jamais le vendorId client. */
export type MerchantRole = 'merchant' | 'supervisor';

export interface MerchantSession {
  vendorId: string;
  eventId: string;
  role: MerchantRole;
}

export interface MerchantRegistry {
  authenticate(apiKey: string): Promise<MerchantSession | null>;
}
