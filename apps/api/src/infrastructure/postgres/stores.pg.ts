import { randomBytes, randomInt } from 'node:crypto';
import type pg from 'pg';
import type { Anomaly } from '@jotay/ledger-core';
import type { AnomalySink } from '../../application/ports/anomaly-sink.js';
import type { AuditEntry, AuditLog } from '../../application/ports/audit-log.js';
import type { BlocklistDelta, BlocklistRepository } from '../../application/ports/blocklist-repository.js';
import type { DynamicQrGuard } from '../../application/ports/dynamic-qr-guard.js';
import type { Job, JobQueue } from '../../application/ports/job-queue.js';
import type { OtpChallengeStore } from '../../application/ports/otp-challenge-store.js';
import type { PortalSession, PortalSessionStore } from '../../application/ports/portal-session-store.js';
import type { RecentVendorSighting } from '../../application/ports/recent-vendor-sighting.js';
import type { RefundRequestSink } from '../../application/ports/refund-request-sink.js';
import type { TerminalKeyRegistry } from '../../application/ports/terminal-key-registry.js';
import type { TotpSecretStore } from '../../application/ports/totp-secret-store.js';
import type { WalletHistoryEntry, WalletHistoryReader } from '../../application/ports/wallet-history-reader.js';
import { hashOtp } from '../crypto/secrets.js';

export class PgBlocklist implements BlocklistRepository {
  constructor(private readonly pool: pg.Pool) {}
  async add(cardUid: string, reason: string, atIso: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO blocklist (card_uid, reason, created_at) VALUES ($1, $2, $3) ON CONFLICT (card_uid) DO NOTHING',
      [cardUid, reason, atIso],
    );
  }
  async deltaSince(version: number): Promise<BlocklistDelta> {
    const res = await this.pool.query<{ card_uid: string; version: string }>(
      'SELECT card_uid, version FROM blocklist WHERE version > $1 ORDER BY version', [version]);
    const last = res.rows.at(-1);
    return { version: last ? Number(last.version) : version, addedCardUids: res.rows.map((r) => r.card_uid) };
  }
}

export class PgAnomalySink implements AnomalySink {
  constructor(private readonly pool: pg.Pool) {}
  async report(anomalies: readonly Anomaly[], batchId: string, atIso: string): Promise<void> {
    for (const a of anomalies) {
      await this.pool.query(
        'INSERT INTO anomalies (batch_id, payload, created_at) VALUES ($1, $2, $3)',
        [batchId, JSON.stringify(a), atIso],
      );
    }
  }
}

export class PgAuditLog implements AuditLog {
  constructor(private readonly pool: pg.Pool) {}
  async append(entry: AuditEntry): Promise<void> {
    await this.pool.query(
      'INSERT INTO audit_log (actor, action, target, details, at) VALUES ($1, $2, $3, $4, $5)',
      [entry.actor, entry.action, entry.target, entry.details ?? {}, entry.atIso],
    );
  }
}

export class PgPortalSessions implements PortalSessionStore {
  constructor(private readonly pool: pg.Pool) {}
  async create(walletId: string, _msisdn: string, nowIso: string): Promise<PortalSession> {
    const token = randomBytes(32).toString('base64url');
    const expiresAtIso = new Date(Date.parse(nowIso) + 15 * 60_000).toISOString();
    await this.pool.query(
      'INSERT INTO portal_sessions (token, wallet_id, expires_at, revoked) VALUES ($1, $2, $3, FALSE)',
      [token, walletId, expiresAtIso],
    );
    return { token, walletId, expiresAtIso };
  }
  async resolve(token: string, nowIso: string): Promise<PortalSession | null> {
    const res = await this.pool.query<{ wallet_id: string; expires_at: Date }>(
      'SELECT wallet_id, expires_at FROM portal_sessions WHERE token = $1 AND revoked = FALSE AND expires_at > $2::timestamptz',
      [token, nowIso],
    );
    const row = res.rows[0];
    if (!row) return null;
    return { token, walletId: row.wallet_id, expiresAtIso: row.expires_at.toISOString() };
  }
  async revoke(token: string): Promise<void> {
    await this.pool.query('UPDATE portal_sessions SET revoked = TRUE WHERE token = $1', [token]);
  }
}

export class PgOtpChallenges implements OtpChallengeStore {
  constructor(private readonly pool: pg.Pool, private readonly ttlMinutes = 15) {}
  async issue(walletId: string, msisdn: string): Promise<string> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expires = new Date(Date.now() + this.ttlMinutes * 60_000).toISOString();
    await this.pool.query(
      `INSERT INTO otp_challenges (wallet_id, msisdn, code_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (wallet_id, msisdn) DO UPDATE SET code_hash = $3, expires_at = $4`,
      [walletId, msisdn, hashOtp(code), expires],
    );
    return code;
  }
  async verifyAndConsume(walletId: string, msisdn: string, code: string): Promise<boolean> {
    const res = await this.pool.query(
      `DELETE FROM otp_challenges
       WHERE wallet_id = $1 AND msisdn = $2 AND code_hash = $3 AND expires_at > now()
       RETURNING wallet_id`,
      [walletId, msisdn, hashOtp(code)],
    );
    return (res.rowCount ?? 0) > 0;
  }
}

export class PgTotpSecrets implements TotpSecretStore {
  constructor(private readonly pool: pg.Pool) {}
  async secretFor(walletId: string): Promise<Uint8Array | null> {
    const res = await this.pool.query<{ secret_enc: Buffer }>(
      'SELECT secret_enc FROM totp_secrets WHERE wallet_id = $1', [walletId]);
    const raw = res.rows[0]?.secret_enc;
    return raw ? new Uint8Array(raw) : null;
  }
}

export class PgDynamicQrGuard implements DynamicQrGuard {
  constructor(private readonly pool: pg.Pool) {}
  async consume(walletId: string, step: number): Promise<boolean> {
    const res = await this.pool.query(
      'INSERT INTO dynamic_qr_used (wallet_id, time_step) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [walletId, step],
    );
    return (res.rowCount ?? 0) === 1;
  }
}

export class PgJobQueue implements JobQueue {
  constructor(private readonly pool: pg.Pool) {}
  async enqueue(kind: string, payload: unknown, idempotencyKey: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO jobs (kind, payload, idempotency_key) VALUES ($1, $2, $3)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [kind, JSON.stringify(payload), idempotencyKey],
    );
  }
  async claimNext(nowIso: string): Promise<Job | null> {
    const res = await this.pool.query<{ id: string; kind: string; payload: unknown; attempts: number }>(
      `UPDATE jobs SET attempts = attempts + 1
       WHERE id = (
         SELECT id FROM jobs WHERE NOT done AND ready_at <= $1::timestamptz
         ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1
       )
       RETURNING id, kind, payload, attempts`,
      [nowIso],
    );
    const row = res.rows[0];
    if (!row) return null;
    return { id: String(row.id), kind: row.kind, payload: row.payload, attempts: row.attempts };
  }
  async complete(id: string): Promise<void> {
    await this.pool.query('UPDATE jobs SET done = TRUE WHERE id = $1', [id]);
  }
  async fail(id: string, nextAttemptIso: string): Promise<void> {
    await this.pool.query('UPDATE jobs SET ready_at = $2 WHERE id = $1', [id, nextAttemptIso]);
  }
}

export class PgRefundSink implements RefundRequestSink {
  constructor(private readonly jobs: JobQueue) {}
  async enqueue(walletId: string, payoutMsisdn: string, idempotencyKey: string, atIso: string): Promise<void> {
    await this.jobs.enqueue('REFUND', { walletId, payoutMsisdn, atIso }, idempotencyKey);
  }
}

export class PgTerminalKeys implements TerminalKeyRegistry {
  constructor(private readonly pool: pg.Pool) {}
  async validKeys(terminalId: string, atIso: string): Promise<Uint8Array[]> {
    const res = await this.pool.query<{ public_key: Buffer }>(
      `SELECT public_key FROM terminal_keys
       WHERE terminal_id = $1 AND valid_from <= $2::timestamptz
         AND (valid_until IS NULL OR $2::timestamptz < valid_until)`,
      [terminalId, atIso],
    );
    return res.rows.map((r) => new Uint8Array(r.public_key));
  }
}

export class PgVendorSighting implements RecentVendorSighting {
  constructor(private readonly pool: pg.Pool) {}
  async remember(walletId: string, vendorId: string, atIso: string, windowMs: number): Promise<string | null> {
    const prev = await this.pool.query<{ vendor_id: string; seen_at: Date }>(
      'SELECT vendor_id, seen_at FROM vendor_sightings WHERE wallet_id = $1', [walletId]);
    await this.pool.query(
      `INSERT INTO vendor_sightings (wallet_id, vendor_id, seen_at) VALUES ($1, $2, $3)
       ON CONFLICT (wallet_id) DO UPDATE SET vendor_id = $2, seen_at = $3`,
      [walletId, vendorId, atIso],
    );
    const row = prev.rows[0];
    if (!row || row.vendor_id === vendorId) return null;
    if (Date.parse(atIso) - row.seen_at.getTime() > windowMs) return null;
    return row.vendor_id;
  }
}

export class PgWalletHistory implements WalletHistoryReader {
  constructor(private readonly pool: pg.Pool) {}
  async recent(walletId: string, limit: number) {
    const res = await this.pool.query<{ at: Date; kind: WalletHistoryEntry['kind']; amount_xof: string; vendor_id: string | null }>(
      'SELECT at, kind, amount_xof, vendor_id FROM wallet_history WHERE wallet_id = $1 ORDER BY at DESC LIMIT $2',
      [walletId, limit],
    );
    const asOf = res.rows[0]?.at.toISOString() ?? new Date().toISOString();
    return {
      asOfIso: asOf,
      entries: res.rows.map((r) => ({
        atIso: r.at.toISOString(), kind: r.kind, amountXof: Number(r.amount_xof),
        ...(r.vendor_id ? { vendorName: r.vendor_id } : {}),
      })),
    };
  }
}
