/** Registre des clés publiques Ed25519 des terminaux, avec rotation à période de grâce.
 *  Un lot offline signé avec l'ancienne clé reste vérifiable tant que celle-ci est en grâce.
 *  Liste vide = terminal inconnu ou entièrement révoqué -> signatures refusées (CRITICAL-PATH). */
export interface TerminalKeyRegistry {
  /** Clés publiques brutes (32 octets) valides pour ce terminal à l'instant `atIso`. */
  validKeys(terminalId: string, atIso: string): Promise<Uint8Array[]>;
}
