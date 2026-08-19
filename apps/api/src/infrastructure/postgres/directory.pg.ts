import type pg from 'pg';
import type { WalletDirectory } from '../../application/ports/wallet-directory.js';
import type { QrBindingStore } from '../../application/ports/qr-binding-store.js';

export class PgWalletDirectory implements WalletDirectory, QrBindingStore {
  constructor(private readonly pool: pg.Pool) {}

  async resolveOpaqueId(opaqueId: string) {
    const res = await this.pool.query<{ wallet_id: string }>(
      'SELECT wallet_id FROM qr_bindings WHERE opaque_id = $1', [opaqueId]);
    const id = res.rows[0]?.wallet_id;
    return id ? { walletId: id } : null;
  }

  async verifiedPayoutMsisdn(walletId: string) {
    const res = await this.pool.query<{ payout_msisdn: string | null }>(
      'SELECT payout_msisdn FROM wallets WHERE id = $1', [walletId]);
    return res.rows[0]?.payout_msisdn ?? null;
  }

  async bind(opaqueId: string, walletId: string, atIso: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO wallets (id, server_balance_xof) VALUES ($1, 0) ON CONFLICT (id) DO NOTHING',
      [walletId],
    );
    await this.pool.query(
      'INSERT INTO qr_bindings (opaque_id, wallet_id, bound_at) VALUES ($1, $2, $3) ON CONFLICT (opaque_id) DO NOTHING',
      [opaqueId, walletId, atIso],
    );
  }
}
