/**
 * Pont clôture -> payout : pour chaque solde restant > 0 avec un MSISDN de payout VÉRIFIÉ,
 * met en file un job de remboursement idempotent. Aucun payout sans numéro vérifié (pas de
 * perte silencieuse : les cas sans payout sont comptés et audités). SRP.
 */
import { ok, type Result } from '@jotay/shared';
import type { WalletDirectory } from '../ports/wallet-directory.js';
import type { JobQueue } from '../ports/job-queue.js';
import type { AuditLog } from '../ports/audit-log.js';
import type { Clock } from '../ports/clock.js';

export interface RemainingBalance { walletId: string; remainingXof: number; }
export interface PayoutInput { eventId: string; balances: readonly RemainingBalance[]; actor: string; }
export interface PayoutOutput { enqueued: number; skippedNoPayout: number; }

export class PayoutRemainingBalances {
  constructor(
    private readonly directory: WalletDirectory,
    private readonly jobs: JobQueue,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(input: PayoutInput): Promise<Result<PayoutOutput, never>> {
    let enqueued = 0, skippedNoPayout = 0;
    for (const b of input.balances) {
      if (b.remainingXof <= 0) continue;
      const msisdn = await this.directory.verifiedPayoutMsisdn(b.walletId);
      if (!msisdn) {
        skippedNoPayout++;
        await this.audit.append({ actor: input.actor, action: 'PAYOUT_SKIPPED_NO_VERIFIED_MSISDN',
          target: b.walletId, atIso: this.clock.nowIso(), details: { eventId: input.eventId, remainingXof: b.remainingXof } });
        continue;
      }
      // Idempotent : (event, wallet) ne génère qu'un payout même si la clôture est rejouée.
      await this.jobs.enqueue('PAYOUT', { walletId: b.walletId, msisdn, amountXof: b.remainingXof, eventId: input.eventId },
        `payout:${input.eventId}:${b.walletId}`);
      enqueued++;
    }
    await this.audit.append({ actor: input.actor, action: 'PAYOUT_BATCH_ISSUED', target: input.eventId,
      atIso: this.clock.nowIso(), details: { enqueued, skippedNoPayout } });
    return ok({ enqueued, skippedNoPayout });
  }
}
