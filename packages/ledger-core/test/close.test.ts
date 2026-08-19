import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeEvent } from '../src/index.js';
import { generateNominal } from './sim/event-sim.js';

test('clôture — événement nominal : équilibré, settlement calculé', () => {
  const { records, truth } = generateNominal({ seed: 42, cards: 15, vendors: 4, cashierSessions: 2, maxOpsPerCard: 10 });
  const rep = closeEvent(records, [{ vendorId: 'V1', commissionBps: 200 }]);
  assert.equal(rep.reconciled, true);
  assert.equal(rep.discrepancy, 0);
  assert.equal(rep.totalToppedUp, truth.totalToppedUp);
  assert.equal(rep.totalSpent, truth.totalSpent);
  // Commission 2% sur V1, 0% sur les autres (non listés).
  const v1 = rep.settlements.find((s) => s.vendorId === 'V1');
  if (v1) assert.equal(v1.fee, Math.floor(v1.gross * 0.02));
});

test('clôture — anomalie présente : NON réconcilié (clôture bloquée)', () => {
  const clone = [
    { schemaVersion: 2, mediumType: 'NFC', balanceAuthority: 'CHIP', eventId: 'E', cardUid: 'C', cardTxCounter: 1, terminalId: 'T', terminalSeq: 1, opType: 'TOPUP', topupChannel: 'CASH', cashierSessionId: 'S1', amountXof: 5000, balanceAfter: 5000, tsTerminal: '2026-08-01T18:00:00Z', cardTxMac: 'm1', terminalSig: 's1' },
    { schemaVersion: 2, mediumType: 'NFC', balanceAuthority: 'CHIP', eventId: 'E', cardUid: 'C', cardTxCounter: 2, terminalId: 'T1', terminalSeq: 1, opType: 'PAYMENT', vendorId: 'V1', amountXof: 1000, balanceAfter: 4000, tsTerminal: '2026-08-01T19:00:00Z', cardTxMac: 'a', terminalSig: 's2' },
    { schemaVersion: 2, mediumType: 'NFC', balanceAuthority: 'CHIP', eventId: 'E', cardUid: 'C', cardTxCounter: 2, terminalId: 'T2', terminalSeq: 1, opType: 'PAYMENT', vendorId: 'V2', amountXof: 3000, balanceAfter: 2000, tsTerminal: '2026-08-01T19:01:00Z', cardTxMac: 'b', terminalSig: 's3' },
  ] as never;
  const rep = closeEvent(clone, []);
  assert.equal(rep.reconciled, false);
  assert.ok(rep.anomalyKinds.includes('CLONE_SUSPECTED'));
});
