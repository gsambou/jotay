import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayCard } from '../src/index.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../../fixtures/regression');

for (const file of readdirSync(dir).filter((f: string) => f.endsWith('.json')).sort()) {
  const fx = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  test(`régression: ${file}`, () => {
    // Simule l'ingestion : le rejeu voit tous les records (union), le clone doit ressortir.
    const replay = replayCard(fx.records);
    assert.deepEqual(replay.anomalies.map((a: { kind: string }) => a.kind), fx.expected.anomalyKinds);
    assert.equal(replay.blockCard, fx.expected.blockedCards.length > 0);
  });
}
