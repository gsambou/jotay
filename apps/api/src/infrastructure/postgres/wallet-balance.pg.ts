import type pg from 'pg';
import { xof, type AmountXof, type ServerWalletState } from '@jotay/ledger-core';
import type { WalletBalanceRepository } from '../../application/ports/wallet-balance-repository.js';

/** Défaut produit de la fenêtre de vélocité (pas un plafond BCEAO). TODO(question) si le pilote impose autre chose. */
export const VELOCITY_WINDOW_MS = 24 * 60 * 60 * 1000;

export class PgWalletBalance implements WalletBalanceRepository {
  constructor(private readonly pool: pg.Pool) {}

  async loadState(walletId: string): Promise<ServerWalletState | null> {
    const res = await this.pool.query<{
      server_balance_xof: string; frozen: boolean;
      spent_in_window_xof: string; tx_count_in_window: number;
      velocity_window_start: Date | null;
    }>('SELECT server_balance_xof, frozen, spent_in_window_xof, tx_count_in_window, velocity_window_start FROM wallets WHERE id = $1', [walletId]);
    const row = res.rows[0];
    if (!row) return null;
    const start = row.velocity_window_start;
    const stale = !start || (Date.now() - start.getTime() > VELOCITY_WINDOW_MS);
    return {
      serverBalanceXof: xof(Number(row.server_balance_xof)),
      frozen: row.frozen,
      spentInWindowXof: xof(stale ? 0 : Number(row.spent_in_window_xof)),
      txCountInWindow: stale ? 0 : row.tx_count_in_window,
    };
  }

  async applyDebit(walletId: string, authId: string, amountXof: AmountXof, atIso: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const ins = await client.query(
        `INSERT INTO wallet_mutations (ref, wallet_id, direction, amount_xof, at)
         VALUES ($1, $2, 'DEBIT', $3, $4) ON CONFLICT (ref) DO NOTHING`,
        [authId, walletId, amountXof, atIso],
      );
      if ((ins.rowCount ?? 0) === 0) { await client.query('COMMIT'); return; }
      await client.query(
        `UPDATE wallets SET
           server_balance_xof = server_balance_xof - $2,
           spent_in_window_xof = CASE
             WHEN velocity_window_start IS NULL OR velocity_window_start < now() - interval '24 hours'
             THEN $2 ELSE spent_in_window_xof + $2 END,
           tx_count_in_window = CASE
             WHEN velocity_window_start IS NULL OR velocity_window_start < now() - interval '24 hours'
             THEN 1 ELSE tx_count_in_window + 1 END,
           velocity_window_start = CASE
             WHEN velocity_window_start IS NULL OR velocity_window_start < now() - interval '24 hours'
             THEN $3::timestamptz ELSE velocity_window_start END,
           updated_at = $3::timestamptz
         WHERE id = $1 AND server_balance_xof >= $2`,
        [walletId, amountXof, atIso],
      );
      await client.query(
        `INSERT INTO wallet_history (wallet_id, at, kind, amount_xof) VALUES ($1, $2, 'PAYMENT', $3)`,
        [walletId, atIso, amountXof],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async applyCredit(walletId: string, ref: string, amountXof: AmountXof, atIso: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO wallets (id, server_balance_xof) VALUES ($1, 0) ON CONFLICT (id) DO NOTHING`,
        [walletId],
      );
      const ins = await client.query(
        `INSERT INTO wallet_mutations (ref, wallet_id, direction, amount_xof, at)
         VALUES ($1, $2, 'CREDIT', $3, $4) ON CONFLICT (ref) DO NOTHING`,
        [ref, walletId, amountXof, atIso],
      );
      if ((ins.rowCount ?? 0) === 0) { await client.query('COMMIT'); return; }
      await client.query(
        `UPDATE wallets SET server_balance_xof = server_balance_xof + $2, updated_at = $3::timestamptz WHERE id = $1`,
        [walletId, amountXof, atIso],
      );
      await client.query(
        `INSERT INTO wallet_history (wallet_id, at, kind, amount_xof) VALUES ($1, $2, 'TOPUP', $3)`,
        [walletId, atIso, amountXof],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
