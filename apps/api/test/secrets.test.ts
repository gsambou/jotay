import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashApiKey, hashOtp, hashPin, verifyPinHash } from '../src/infrastructure/crypto/secrets.js';

test('unité — hashApiKey déterministe et distinct', () => {
  assert.equal(hashApiKey('k'), hashApiKey('k'));
  assert.notEqual(hashApiKey('k'), hashApiKey('k2'));
  assert.equal(hashApiKey('k').length, 64);
});

test('unité — PIN scrypt : bon PIN accepté, mauvais refusé, sel unique', async () => {
  const a = await hashPin('1234');
  const b = await hashPin('1234');
  assert.notEqual(a, b);
  assert.equal(await verifyPinHash('1234', a), true);
  assert.equal(await verifyPinHash('0000', a), false);
});

test('unité — OTP hashé, jamais stocké en clair dans la fonction', () => {
  assert.equal(hashOtp('654321'), hashOtp('654321'));
  assert.notEqual(hashOtp('654321'), '654321');
});
