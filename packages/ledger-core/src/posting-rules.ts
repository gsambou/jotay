/** Traduction des records acceptés en écritures comptables — cf. SPEC chap. 6.7. */
import { err, ok, type Result } from '@jotay/shared';
import type { PaymentRecord } from '@jotay/protocol';
import { credit, debit, makeEntry, type JournalEntry, type LedgerError } from './entry.js';
import { xof } from './money.js';

export type PostingError = LedgerError | { kind: 'UNSUPPORTED_OP'; ref: string };

/** Ajustement superviseur en partie double — crédit OU débit (plus un seul sens). */
export function adjustmentToEntry(
  ref: string,
  amount: ReturnType<typeof xof>,
  direction: 'CREDIT' | 'DEBIT',
): Result<JournalEntry, PostingError> {
  return direction === 'CREDIT'
    ? makeEntry(ref, [debit('suspense:quarantine', amount), credit('liability:wallets', amount)])
    : makeEntry(ref, [debit('liability:wallets', amount), credit('suspense:quarantine', amount)]);
}

export function recordToEntry(r: PaymentRecord): Result<JournalEntry | null, PostingError> {
  const ref = `${r.cardUid}#${r.cardTxCounter}`;
  const amount = xof(r.amountXof);
  switch (r.opType) {
    case 'ACTIVATION':
    case 'BLOCK':
      return ok(null); // pas d'impact comptable
    case 'TOPUP': {
      const source =
        r.topupChannel === 'CASH'
          ? (`asset:cash_drawer:${r.cashierSessionId ?? 'UNKNOWN'}` as const)
          : ('asset:float_partner' as const);
      return makeEntry(ref, [debit(source, amount), credit('liability:wallets', amount)]);
    }
    case 'PAYMENT':
      return makeEntry(ref, [
        debit('liability:wallets', amount),
        credit(`liability:vendor_payable:${r.vendorId ?? 'UNKNOWN'}`, amount),
      ]);
    case 'REVERSAL':
      return makeEntry(ref, [
        debit(`liability:vendor_payable:${r.vendorId ?? 'UNKNOWN'}`, amount),
        credit('liability:wallets', amount),
      ]);
    case 'ADJUSTMENT':
      // Record CHIP historique = crédit (geste commercial). Les débits superviseur
      // passent par adjustmentToEntry('DEBIT') côté use case SERVER.
      return adjustmentToEntry(ref, amount, 'CREDIT');
    default:
      return err({ kind: 'UNSUPPORTED_OP', ref });
  }
}
