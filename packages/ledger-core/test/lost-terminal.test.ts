import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replayCard } from '../src/index.js';

const rec = (o: Record<string, unknown>) => ({
  schemaVersion: 2, mediumType: 'NFC', balanceAuthority: 'CHIP', eventId: 'E',
  cardUid: 'C', terminalSeq: 1, tsTerminal: '2026-08-01T19:00:00Z', cardTxMac: 'm', terminalSig: 's', ...o,
}) as never;

test('cohérence — terminal perdu avant sync : trou de compteur signalé (COUNTER_GAP)', () => {
  // Recharge (c=1) sur T1, paiement (c=2) sur T-perdu jamais reçu, recharge (c=3) sur T2.
  const seen = [
    rec({ cardTxCounter: 1, terminalId: 'T1', opType: 'TOPUP', amountXof: 5000, balanceAfter: 5000 }),
    rec({ cardTxCounter: 3, terminalId: 'T2', opType: 'TOPUP', amountXof: 2000, balanceAfter: 6000 }),
  ];
  const r = replayCard(seen);
  assert.ok(r.anomalies.some((a) => a.kind === 'COUNTER_GAP' && a.expected === 2 && a.got === 3),
    JSON.stringify(r.anomalies));
});

test('cohérence — arrivée tardive du terminal perdu : le trou se referme au rejeu complet', () => {
  // Quand le lot du terminal perdu arrive enfin, on rejoue l'UNION : plus de trou.
  const complete = [
    rec({ cardTxCounter: 1, terminalId: 'T1', opType: 'TOPUP', amountXof: 5000, balanceAfter: 5000 }),
    rec({ cardTxCounter: 2, terminalId: 'Tperdu', opType: 'PAYMENT', vendorId: 'V', amountXof: 1000, balanceAfter: 4000 }),
    rec({ cardTxCounter: 3, terminalId: 'T2', opType: 'TOPUP', amountXof: 2000, balanceAfter: 6000 }),
  ];
  const r = replayCard(complete);
  assert.equal(r.anomalies.length, 0, JSON.stringify(r.anomalies));
  assert.equal(r.finalBalance, 6000);
});

test('cohérence — divergence de solde annoncé : chaîne rompue signalée', () => {
  // Le terminal annonce un balanceAfter incohérent avec le calcul -> BALANCE_CHAIN_BROKEN.
  const bad = [
    rec({ cardTxCounter: 1, terminalId: 'T1', opType: 'TOPUP', amountXof: 5000, balanceAfter: 5000 }),
    rec({ cardTxCounter: 2, terminalId: 'T1', opType: 'PAYMENT', vendorId: 'V', amountXof: 1000, balanceAfter: 9999 }),
  ];
  const r = replayCard(bad);
  assert.ok(r.anomalies.some((a) => a.kind === 'BALANCE_CHAIN_BROKEN'), JSON.stringify(r.anomalies));
});
