// CRITICAL-PATH
import type pg from 'pg';
import { DEFAULT_QR_LIMITS } from '@jotay/ledger-core';
import type { PinVerifier } from '../../application/ports/pin-verifier.js';
import { verifyPinHash } from '../crypto/secrets.js';

export class PgPinVerifier implements PinVerifier {
  constructor(private readonly pool: pg.Pool, private readonly maxFailures = DEFAULT_QR_LIMITS.pinMaxFailures) {}

  async verify(walletId: string, pin: string): Promise<boolean> {
    const res = await this.pool.query<{ pin_hash: string; failure_count: number; locked: boolean }>(
      'SELECT pin_hash, failure_count, locked FROM pin_credentials WHERE wallet_id = $1',
      [walletId],
    );
    const row = res.rows[0];
    if (!row || row.locked || row.failure_count >= this.maxFailures) return false;
    const ok = await verifyPinHash(pin, row.pin_hash);
    if (ok) {
      await this.pool.query(
        'UPDATE pin_credentials SET failure_count = 0, locked = FALSE WHERE wallet_id = $1',
        [walletId],
      );
      return true;
    }
    const next = row.failure_count + 1;
    await this.pool.query(
      'UPDATE pin_credentials SET failure_count = $2, locked = $3 WHERE wallet_id = $1',
      [walletId, next, next >= this.maxFailures],
    );
    return false;
  }
}
