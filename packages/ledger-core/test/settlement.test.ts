import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSettlement, xof } from '../src/index.js';

test('settlement 2% arrondi au FCFA inférieur', () => {
  const s = computeSettlement(xof(40_001), 200);
  assert.equal(s.fee, 800);       // floor(40001*0.02)
  assert.equal(s.net, 39_201);
  assert.equal(s.gross, s.fee + s.net); // conservation
});
