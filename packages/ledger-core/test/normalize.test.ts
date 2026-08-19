import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecord } from '../src/normalize.js';
import type { PaymentRecord } from '@jotay/protocol';

test('un record v1 (sans medium) devient NFC/CHIP', () => {
  const v1 = { schemaVersion: 1, eventId: 'E', cardUid: 'C', cardTxCounter: 1, terminalId: 'T', terminalSeq: 1, opType: 'PAYMENT', amountXof: 100, balanceAfter: 0, tsTerminal: '2026-08-01T00:00:00Z', cardTxMac: 'm', terminalSig: 's' } as unknown as PaymentRecord;
  const n = normalizeRecord(v1);
  assert.equal(n.mediumType, 'NFC');
  assert.equal(n.balanceAuthority, 'CHIP');
});

test('un record QR sans authority explicite devient SERVER', () => {
  const qr = { schemaVersion: 2, mediumType: 'QR', eventId: 'E', cardUid: 'W', cardTxCounter: 0, terminalId: 'T', terminalSeq: 1, opType: 'PAYMENT', amountXof: 100, balanceAfter: 0, tsTerminal: '2026-08-01T00:00:00Z', terminalSig: 's' } as unknown as PaymentRecord;
  assert.equal(normalizeRecord(qr).balanceAuthority, 'SERVER');
});
