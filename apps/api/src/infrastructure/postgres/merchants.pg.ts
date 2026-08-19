import type pg from 'pg';
import { DEFAULT_QR_LIMITS } from '@jotay/ledger-core';
import type { MerchantRegistry, MerchantSession } from '../../application/ports/merchant-registry.js';
import type { EventPaymentConfig, QrEventLimits } from '../../application/ports/event-payment-config.js';
import { hashApiKey } from '../crypto/secrets.js';

export class PgMerchantRegistry implements MerchantRegistry {
  constructor(private readonly pool: pg.Pool) {}

  async authenticate(apiKey: string): Promise<MerchantSession | null> {
    const res = await this.pool.query<{ id: string; event_id: string; role: MerchantSession['role'] }>(
      'SELECT id, event_id, role FROM vendors WHERE api_key_hash = $1',
      [hashApiKey(apiKey)],
    );
    const row = res.rows[0];
    if (!row) return null;
    return { vendorId: row.id, eventId: row.event_id, role: row.role };
  }
}

export class PgEventPaymentConfig implements EventPaymentConfig {
  constructor(private readonly pool: pg.Pool) {}

  async qrLimits(eventId: string): Promise<QrEventLimits> {
    const res = await this.pool.query<{ qr_limits: QrEventLimits }>(
      'SELECT qr_limits FROM events WHERE id = $1', [eventId]);
    const limits = res.rows[0]?.qr_limits;
    if (!limits) throw new Error(`EventPaymentConfig : événement inconnu (${eventId})`);
    return {
      microPinThresholdXof: limits.microPinThresholdXof ?? DEFAULT_QR_LIMITS.microPinThresholdXof,
      velocityAmountCapXof: limits.velocityAmountCapXof ?? DEFAULT_QR_LIMITS.velocityAmountCapXof,
      velocityTxCap: limits.velocityTxCap ?? DEFAULT_QR_LIMITS.velocityTxCap,
      pinMaxFailures: limits.pinMaxFailures ?? DEFAULT_QR_LIMITS.pinMaxFailures,
    };
  }
}
