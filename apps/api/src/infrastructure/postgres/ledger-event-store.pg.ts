import type pg from 'pg';
import type { PaymentRecord } from '@jotay/protocol';
import type { IngestResult, LedgerEventStore } from '../../application/ports/ledger-event-store.js';

export class PgLedgerEventStore implements LedgerEventStore {
  constructor(private readonly pool: pg.Pool) {}

  async append(records: readonly PaymentRecord[], batchId: string, receivedAtIso: string): Promise<IngestResult> {
    const client = await this.pool.connect();
    let inserted = 0;
    try {
      await client.query('BEGIN');
      for (const r of records) {
        // ON CONFLICT DO NOTHING = idempotence des doublons STRICTS. Les doublons
        // DIVERGENTS (même clé, contenu différent) sont détectés par le rejeu pur
        // en aval et partent en quarantaine — jamais d'écrasement.
        const res = await client.query(
          `INSERT INTO ledger_events (event_id, card_uid, card_tx_counter, payload, batch_id, received_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (card_uid, card_tx_counter) DO NOTHING`,
          [r.eventId, r.cardUid, r.cardTxCounter, JSON.stringify(r), batchId, receivedAtIso],
        );
        inserted += res.rowCount ?? 0;
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return { inserted, duplicates: records.length - inserted };
  }

  async readCard(cardUid: string): Promise<PaymentRecord[]> {
    const res = await this.pool.query(
      'SELECT payload FROM ledger_events WHERE card_uid = $1 ORDER BY card_tx_counter ASC', [cardUid]);
    return res.rows.map((row: { payload: PaymentRecord }) => row.payload);
  }

  async readEvent(eventId: string): Promise<PaymentRecord[]> {
    const res = await this.pool.query(
      'SELECT payload FROM ledger_events WHERE event_id = $1 ORDER BY card_uid, card_tx_counter', [eventId]);
    return res.rows.map((row: { payload: PaymentRecord }) => row.payload);
  }
}
