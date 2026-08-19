import type { Brand } from '@jotay/shared';

/** Montant en FCFA — entier positif ou nul, jamais un flottant. */
export type AmountXof = Brand<number, 'AmountXof'>;

/** Constructeur validant. Lève une TypeError : violer ceci est un bug, pas un cas métier. */
export function xof(n: number): AmountXof {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new TypeError(`AmountXof invalide: ${n} (entier >= 0 requis)`);
  }
  return n as AmountXof;
}

export const addXof = (a: AmountXof, b: AmountXof): AmountXof => xof(a + b);
/** Soustraction sûre : retourne null si le résultat serait négatif (échec honnête). */
export const subXof = (a: AmountXof, b: AmountXof): AmountXof | null =>
  a >= b ? xof(a - b) : null;
