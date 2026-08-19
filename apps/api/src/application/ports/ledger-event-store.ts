import type { PaymentRecord } from '@jotay/protocol';

export interface IngestResult {
  inserted: number;
  /** Doublons stricts déjà connus — ACK silencieux (idempotence). */
  duplicates: number;
}

/** Port du journal append-only. Aucune méthode update/delete : elles n'existeront jamais. */
export interface LedgerEventStore {
  /** Insertion idempotente sur UNIQUE(card_uid, card_tx_counter). */
  append(records: readonly PaymentRecord[], batchId: string, receivedAtIso: string): Promise<IngestResult>;
  readCard(cardUid: string): Promise<PaymentRecord[]>;
  readEvent(eventId: string): Promise<PaymentRecord[]>;
}
