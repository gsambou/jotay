/**
 * Ajustement de solde par un superviseur (correction, geste commercial, arbitrage d'écart) — SRP.
 * TOUJOURS audité (acteur, motif, montant). Jamais une écriture de solde silencieuse.
 */
import { ok, type Result } from '@jotay/shared';
import { xof } from '@jotay/ledger-core';
import type { WalletBalanceRepository } from '../ports/wallet-balance-repository.js';
import type { AuditLog } from '../ports/audit-log.js';
import type { Clock } from '../ports/clock.js';

export interface AdjustmentInput {
  walletId: string; direction: 'CREDIT' | 'DEBIT'; amountXof: number;
  reason: string; actor: string; adjustmentId: string;
}
export interface AdjustmentOutput { adjustmentId: string; }

export class RecordAdjustment {
  constructor(
    private readonly wallets: WalletBalanceRepository,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(input: AdjustmentInput): Promise<Result<AdjustmentOutput, never>> {
    const now = this.clock.nowIso();
    // Idempotent par adjustmentId (via ref applyCredit/applyDebit-authId).
    if (input.direction === 'CREDIT') await this.wallets.applyCredit(input.walletId, input.adjustmentId, xof(input.amountXof), now);
    else await this.wallets.applyDebit(input.walletId, input.adjustmentId, xof(input.amountXof), now);
    // L'audit est la trace immuable de l'action humaine.
    await this.audit.append({
      actor: input.actor, action: `ADJUSTMENT_${input.direction}`, target: input.walletId,
      atIso: now, details: { amountXof: input.amountXof, reason: input.reason, adjustmentId: input.adjustmentId },
    });
    return ok({ adjustmentId: input.adjustmentId });
  }
}
