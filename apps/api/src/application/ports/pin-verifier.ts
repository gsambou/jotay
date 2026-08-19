/** Vérification du PIN côté serveur, avec verrouillage après N échecs (chap. 18.5). */
export interface PinVerifier {
  /** true si le PIN est correct. Gère lui-même le comptage/verrouillage des tentatives. */
  verify(walletId: string, pin: string): Promise<boolean>;
}
