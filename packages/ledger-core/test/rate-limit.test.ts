import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRate, type WindowState } from '../src/index.js';

test('rate — autorise jusqu\'à la limite puis bloque dans la fenêtre', () => {
  let st: WindowState | null = null;
  for (let i = 0; i < 3; i++) { const d = checkRate(st, 1000, 3, 60000); assert.equal(d.allowed, true); st = d.state; }
  const blocked = checkRate(st, 1500, 3, 60000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
});

test('rate — la fenêtre se réinitialise après windowMs', () => {
  let d = checkRate(null, 0, 2, 1000); d = checkRate(d.state, 100, 2, 1000);
  assert.equal(checkRate(d.state, 200, 2, 1000).allowed, false); // 3e dans la fenêtre
  assert.equal(checkRate(d.state, 1100, 2, 1000).allowed, true);  // nouvelle fenêtre
});
