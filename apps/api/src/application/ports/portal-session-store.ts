/** Sessions de consultation courtes, liées au wallet, révocables (cookie HttpOnly côté HTTP). */
export interface PortalSession {
  token: string;
  walletId: string;
  expiresAtIso: string;
}
export interface PortalSessionStore {
  create(walletId: string, msisdn: string, nowIso: string): Promise<PortalSession>;
  resolve(token: string, nowIso: string): Promise<PortalSession | null>;
  revoke(token: string): Promise<void>;
}
