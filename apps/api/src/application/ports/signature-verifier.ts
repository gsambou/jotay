import type { PaymentRecord } from '@jotay/protocol';

/** Vérifie la signature Ed25519 du terminal sur la forme canonique du record.
 *  Le domaine ne fait jamais de crypto ; cette abstraction est implémentée en infra. */
export interface SignatureVerifier {
  verify(record: PaymentRecord): Promise<boolean>;
}
