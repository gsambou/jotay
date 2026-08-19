/** Contrat LSP de Clock — fake déterministe + horloge système. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Clock } from '../src/application/ports/clock.js';
import { FixedClock } from './fakes.js';
import { SystemClock } from '../src/infrastructure/system-clock.js';

function assertIso(clock: Clock) {
  const iso = clock.nowIso();
  assert.ok(!Number.isNaN(Date.parse(iso)), iso);
  assert.match(iso, /T/);
}

test('contrat Clock [FixedClock] — ISO déterministe et mutable', () => {
  const c = new FixedClock('2026-08-01T20:00:00.000Z');
  assertIso(c);
  assert.equal(c.nowIso(), '2026-08-01T20:00:00.000Z');
  c.set('2026-08-02T00:00:00.000Z');
  assert.equal(c.nowIso(), '2026-08-02T00:00:00.000Z');
});

test('contrat Clock [SystemClock] — ISO parseable', () => {
  assertIso(new SystemClock());
});
