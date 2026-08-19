/**
 * Use case : vue portail du wallet (solde serveur + fraîcheur + historique) — SRP, lecture seule.
 * Échec honnête : on expose la DATE de la projection, jamais une estimation temps réel.
 */
import { err, ok, type Result } from '@jotay/shared';
import type { PortalSessionStore } from '../ports/portal-session-store.js';
import type { WalletBalanceRepository } from '../ports/wallet-balance-repository.js';
import type { WalletHistoryReader, WalletHistoryEntry } from '../ports/wallet-history-reader.js';
import type { Clock } from '../ports/clock.js';

export interface GetWalletViewInput { sessionToken: string; historyLimit?: number; }
export interface GetWalletViewOutput {
  serverBalanceXof: number;
  frozen: boolean;
  asOfIso: string;
  history: WalletHistoryEntry[];
}
export type GetWalletViewError = { kind: 'NO_SESSION' } | { kind: 'WALLET_UNKNOWN' };

export class GetWalletView {
  constructor(
    private readonly sessions: PortalSessionStore,
    private readonly balances: WalletBalanceRepository,
    private readonly history: WalletHistoryReader,
    private readonly clock: Clock,
  ) {}

  async execute(input: GetWalletViewInput): Promise<Result<GetWalletViewOutput, GetWalletViewError>> {
    const session = await this.sessions.resolve(input.sessionToken, this.clock.nowIso());
    if (!session) return err({ kind: 'NO_SESSION' });
    const state = await this.balances.loadState(session.walletId);
    if (!state) return err({ kind: 'WALLET_UNKNOWN' });
    const h = await this.history.recent(session.walletId, input.historyLimit ?? 20);
    return ok({
      serverBalanceXof: state.serverBalanceXof,
      frozen: state.frozen,
      asOfIso: h.asOfIso,
      history: h.entries,
    });
  }
}
