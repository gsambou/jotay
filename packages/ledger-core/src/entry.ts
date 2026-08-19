import { err, ok, type Result } from '@jotay/shared';
import type { AccountId } from './accounts.js';
import { xof, type AmountXof } from './money.js';

export interface Posting {
  account: AccountId;
  debit: AmountXof;
  credit: AmountXof;
}

export interface JournalEntry {
  /** Référence de l'événement source : `${cardUid}#${cardTxCounter}` ou id d'ajustement. */
  ref: string;
  postings: readonly Posting[];
}

export type LedgerError =
  | { kind: 'UNBALANCED'; ref: string; debits: number; credits: number }
  | { kind: 'EMPTY_ENTRY'; ref: string }
  | { kind: 'BOTH_SIDES'; ref: string; account: string };

export const debit = (account: AccountId, amount: AmountXof): Posting =>
  ({ account, debit: amount, credit: xof(0) });
export const credit = (account: AccountId, amount: AmountXof): Posting =>
  ({ account, debit: xof(0), credit: amount });

/** Seule porte d'entrée pour créer une écriture : l'équilibre est garanti par construction. */
export function makeEntry(ref: string, postings: readonly Posting[]): Result<JournalEntry, LedgerError> {
  if (postings.length < 2) return err({ kind: 'EMPTY_ENTRY', ref });
  for (const p of postings) {
    if (p.debit > 0 && p.credit > 0) return err({ kind: 'BOTH_SIDES', ref, account: p.account });
  }
  const debits = postings.reduce((s, p) => s + p.debit, 0);
  const credits = postings.reduce((s, p) => s + p.credit, 0);
  if (debits !== credits) return err({ kind: 'UNBALANCED', ref, debits, credits });
  return ok({ ref, postings });
}

/** Solde d'un compte sur un ensemble d'écritures (convention : crédit - débit pour les passifs). */
export function accountNet(entries: readonly JournalEntry[], account: AccountId): number {
  let net = 0;
  for (const e of entries) for (const p of e.postings) {
    if (p.account === account) net += p.credit - p.debit;
  }
  return net;
}
