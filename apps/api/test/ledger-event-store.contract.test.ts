/** Contrat LSP de LedgerEventStore — append-only + idempotence (cardUid, counter). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PaymentRecord } from '@jotay/protocol';
import type { LedgerEventStore } from '../src/application/ports/ledger-event-store.js';
import { MemLedgerEventStore } from './fakes.js';

const rec = (over: { cardUid: string; cardTxCounter: number; eventId?: string }): PaymentRecord => ({
  schemaVersion: 2, mediumType: 'NFC', balanceAuthority: 'CHIP', eventId: 'E',
  terminalId: 'T', terminalSeq: 1, tsTerminal: '2026-08-01T18:00:00Z',
  opType: 'TOPUP', amountXof: 1000, balanceAfter: 1000, cardTxMac: 'm', terminalSig: 's',
  ...over,
} as unknown as PaymentRecord);

function runContract(name: string, factory: () => LedgerEventStore) {
  test(`contrat LedgerEventStore [${name}] — insert puis doublon strict`, async () => {
    const store = factory();
    const a = rec({ cardUid: 'C1', cardTxCounter: 1 });
    const first = await store.append([a], 'b1', 't');
    const second = await store.append([a], 'b2', 't');
    assert.equal(first.inserted, 1);
    assert.equal(second.inserted, 0);
    assert.equal(second.duplicates, 1);
    assert.equal((await store.readCard('C1')).length, 1);
  });
  test(`contrat LedgerEventStore [${name}] — readEvent filtre`, async () => {
    const store = factory();
    await store.append([
      rec({ cardUid: 'C2', cardTxCounter: 1, eventId: 'E1' }),
      rec({ cardUid: 'C3', cardTxCounter: 1, eventId: 'E2' }),
    ], 'b', 't');
    assert.equal((await store.readEvent('E1')).length, 1);
    assert.equal((await store.readEvent('E1'))[0]!.cardUid, 'C2');
  });
}

runContract('MemLedgerEventStore', () => new MemLedgerEventStore());
