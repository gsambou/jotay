/**
 * Génération et vérification du code OTP (stockage haché, expiration, limitation des
 * tentatives). issue() renvoie le code EN CLAIR une seule fois, pour l'envoi immédiat
 * par OtpChannel ; il n'est jamais relu ensuite (seul le haché est conservé).
 */
export interface OtpChallengeStore {
  issue(walletId: string, msisdn: string): Promise<string>;
  /** true si (msisdn, code) valide et non expiré ; consomme le challenge. Compte les échecs. */
  verifyAndConsume(walletId: string, msisdn: string, code: string): Promise<boolean>;
}
