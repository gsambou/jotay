import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xof, addXof, subXof, makeEntry, debit, credit, adjustmentToEntry } from '../src/index.js';

test('xof rejette les non-entiers et les négatifs (bug, pas cas métier)', () => {
  assert.throws(() => xof(-1));
  assert.throws(() => xof(1.5));
  assert.equal(xof(0), 0);
});

test('subXof retourne null plutôt qu\'un solde négatif (échec honnête)', () => {
  assert.equal(subXof(xof(100), xof(150)), null);
  assert.equal(subXof(xof(150), xof(100)), 50);
  assert.equal(addXof(xof(100), xof(50)), 150);
});

test('makeEntry rejette une écriture déséquilibrée', () => {
  const r = makeEntry('ref', [debit('liability:wallets', xof(100)), credit('revenue:fees', xof(90))]);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'UNBALANCED');
});

test('makeEntry accepte une écriture équilibrée', () => {
  const r = makeEntry('ref', [debit('asset:float_partner', xof(100)), credit('liability:wallets', xof(100))]);
  assert.equal(r.ok, true);
});

test('makeEntry rejette un posting débit ET crédit simultanés', () => {
  const bad = { account: 'liability:wallets' as const, debit: xof(10), credit: xof(10) };
  const r = makeEntry('ref', [bad, credit('revenue:fees', xof(0))]);
  assert.equal(r.ok, false);
});

test('adjustmentToEntry DEBIT diminue liability:wallets (partie double)', () => {
  const r = adjustmentToEntry('adj-d', xof(500), 'DEBIT');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const d = r.value.postings.find((p) => p.account === 'liability:wallets');
  assert.equal(d?.debit, 500);
  assert.equal(d?.credit, 0);
});

test('adjustmentToEntry CREDIT augmente liability:wallets', () => {
  const r = adjustmentToEntry('adj-c', xof(500), 'CREDIT');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const c = r.value.postings.find((p) => p.account === 'liability:wallets');
  assert.equal(c?.credit, 500);
});
