import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScenario } from '../src/scenario.js';

// Les tests LISENT le disque ; le moteur, lui, reste pur.
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../../../fixtures/golden');

for (const file of readdirSync(fixturesDir).filter((f: string) => f.endsWith('.json')).sort()) {
  const fixture = JSON.parse(readFileSync(join(fixturesDir, file), 'utf8'));
  test(`golden: ${fixture.name} (${file})`, () => {
    const out = runScenario(fixture.records);
    assert.deepEqual(out.balances, fixture.expected.balances, 'balances');
    assert.deepEqual(out.vendorGross, fixture.expected.vendorGross, 'vendorGross');
    assert.deepEqual(out.anomalies.map((a: { kind: string }) => a.kind), fixture.expected.anomalyKinds, 'anomalies');
    assert.deepEqual(out.blockedCards, fixture.expected.blockedCards, 'blockedCards');
    assert.equal(out.ledger.balanced, fixture.expected.balanced, 'invariant ledger');
  });
}
