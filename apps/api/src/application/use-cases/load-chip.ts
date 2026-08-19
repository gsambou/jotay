/**
 * Transfert SERVER → CHIP (réservation serveur). L'écriture puce est le terminal.
 * Rollback = re-crédit SERVER si le tap échoue. SPEC-poches. CRITICAL-PATH.
 */
import { err, ok, type Result } from '@jotay/shared';
import { xof } from '@jotay/ledger-core';
import type { WalletDirectory } from '../ports/wallet-directory.js';
import type { WalletBalanceRepository } from '../ports/wallet-balance-repository.js';
import type { AuditLog } from '../ports/audit-log.js';
import type { Clock } from '../ports/clock.js';

export interface LoadChipInput { opaqueId: string; amountXof: number; loadId: string; }
export type LoadChipError =
  | { kind: 'WALLET_UNKNOWN' } | { kind: 'INSUFFICIENT' } | { kind: 'FROZEN' } | { kind: 'AMOUNT_INVALID' };
export interface LoadChipOutput { loadId: string; serverBalanceAfterXof: number; }

export class LoadChip {
  constructor(
    private readonly directory: WalletDirectory,
    private readonly wallets: WalletBalanceRepository,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(input: LoadChipInput): Promise<Result<LoadChipOutput, LoadChipError>> {
    if (!Number.isSafeInteger(input.amountXof) || input.amountXof < 25) return err({ kind: 'AMOUNT_INVALID' });
    const resolved = await this.directory.resolveOpaqueId(input.opaqueId);
    if (!resolved) return err({ kind: 'WALLET_UNKNOWN' });
    const state = await this.wallets.loadState(resolved.walletId);
    if (!state) return err({ kind: 'WALLET_UNKNOWN' });
    if (state.frozen) return err({ kind: 'FROZEN' });
    if (input.amountXof > state.serverBalanceXof) return err({ kind: 'INSUFFICIENT' });
    const amount = xof(input.amountXof);
    const now = this.clock.nowIso();
    await this.wallets.applyDebit(resolved.walletId, input.loadId, amount, now);
    await this.audit.append({
      actor: 'terminal', action: 'LOAD_CHIP', target: resolved.walletId, atIso: now,
      details: { loadId: input.loadId, amountXof: input.amountXof },
    });
    return ok({ loadId: input.loadId, serverBalanceAfterXof: state.serverBalanceXof - input.amountXof });
  }

  async rollback(input: LoadChipInput): Promise<Result<{ loadId: string }, LoadChipError>> {
    const resolved = await this.directory.resolveOpaqueId(input.opaqueId);
    if (!resolved) return err({ kind: 'WALLET_UNKNOWN' });
    const now = this.clock.nowIso();
    await this.wallets.applyCredit(resolved.walletId, `rollback:${input.loadId}`, xof(input.amountXof), now);
    await this.audit.append({
      actor: 'terminal', action: 'LOAD_CHIP_ROLLED_BACK', target: resolved.walletId, atIso: now,
      details: { loadId: input.loadId, amountXof: input.amountXof },
    });
    return ok({ loadId: input.loadId });
  }
}
