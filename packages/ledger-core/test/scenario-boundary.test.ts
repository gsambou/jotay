import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScenario } from '../src/index.js';
import type { PaymentRecord } from '@jotay/protocol';

test('un enregistrement QR/SERVER dans la réconciliation offline lève une erreur (frontière)', () => {
  const qr = { schemaVersion: 2, mediumType: 'QR', balanceAuthority: 'SERVER', eventId: 'E', cardUid: 'W', cardTxCounter: 0, terminalId: 'T', terminalSeq: 1, opType: 'PAYMENT', vendorId: 'V1', amountXof: 100, balanceAfter: 0, tsTerminal: '2026-08-01T00:00:00Z', serverAuthId: 'a', terminalSig: 's' } as unknown as PaymentRecord;
  assert.throws(() => runScenario([qr]), /hors périmètre/);
});
