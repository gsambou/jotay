import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScenario } from '../../src/index.js';
import { generateNominal, shuffleSyncOrder, type SimConfig } from './event-sim.js';

const seeds = [1, 7, 42, 99, 123, 2024, 31337, 65535];
const cfg = (seed: number): SimConfig => ({ seed, cards: 20, vendors: 5, cashierSessions: 3, maxOpsPerCard: 12 });

test('propriété — réconciliation EXACTE au FCFA près (vérité-terrain)', () => {
  for (const seed of seeds) {
    const { records, truth } = generateNominal(cfg(seed));
    const out = runScenario(records);
    assert.deepEqual(out.balances, truth.finalBalanceByCard, `soldes seed=${seed}`);
    assert.deepEqual(out.vendorGross, truth.grossByVendor, `vendeurs seed=${seed}`);
    assert.equal(out.anomalies.length, 0, `zéro anomalie seed=${seed}`);
    assert.equal(out.ledger.balanced, true, `invariant équilibré seed=${seed}`);
  }
});

test('propriété — invariant comptable : liability:wallets == somme des soldes', () => {
  for (const seed of seeds) {
    const { records, truth } = generateNominal(cfg(seed));
    const out = runScenario(records);
    const sum = Object.values(truth.finalBalanceByCard).reduce((s, b) => s + b, 0);
    assert.equal(out.ledger.liabilityWallets, sum, `seed=${seed}`);
  }
});

test('propriété — insensibilité à l\'ordre de synchronisation', () => {
  for (const seed of seeds) {
    const { records } = generateNominal(cfg(seed));
    const sorted = runScenario(records);
    const shuffled = runScenario(shuffleSyncOrder(records, seed + 1));
    assert.deepEqual(shuffled.balances, sorted.balances, `soldes seed=${seed}`);
    assert.deepEqual(shuffled.vendorGross, sorted.vendorGross, `vendeurs seed=${seed}`);
  }
});

test('propriété — idempotence : dupliquer chaque record ne change rien', () => {
  for (const seed of seeds) {
    const { records } = generateNominal(cfg(seed));
    const once = runScenario(records);
    const twice = runScenario([...records, ...records]);
    assert.deepEqual(twice.balances, once.balances, `soldes seed=${seed}`);
    assert.deepEqual(twice.vendorGross, once.vendorGross, `vendeurs seed=${seed}`);
  }
});

test('propriété — aucun solde négatif dans les records acceptés', () => {
  for (const seed of seeds) {
    const { records } = generateNominal(cfg(seed));
    const out = runScenario(records);
    for (const [card, bal] of Object.entries(out.balances)) {
      assert.ok(bal >= 0, `solde négatif ${card}=${bal} seed=${seed}`);
    }
  }
});
