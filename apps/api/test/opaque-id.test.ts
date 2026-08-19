import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RandomOpaqueIdMinter } from '../src/infrastructure/crypto/opaque-id-minter.js';

test('opaque-id — 128 bits base64url, non devinable, unique', () => {
  const m = new RandomOpaqueIdMinter();
  const a = m.mint(); const b = m.mint();
  assert.match(a, /^[A-Za-z0-9_-]{22}$/); // 16 octets base64url
  assert.notEqual(a, b);
  const set = new Set(Array.from({ length: 1000 }, () => m.mint()));
  assert.equal(set.size, 1000); // aucune collision sur 1000 tirages
});
