import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totp, verifyTotp, secondsUntilRotation, timeStep } from '../src/index.js';

// Vecteurs officiels RFC 6238 (SHA-1, seed ASCII "12345678901234567890", 8 chiffres, step 30).
const SEED = Buffer.from('12345678901234567890', 'ascii');
const at = (sec: number) => sec * 1000;

test('TOTP — vecteurs RFC 6238 (SHA-1, 8 chiffres)', () => {
  assert.equal(totp(SEED, at(59), 30, 8), '94287082');
  assert.equal(totp(SEED, at(1111111109), 30, 8), '07081804');
  assert.equal(totp(SEED, at(1111111111), 30, 8), '14050471');
  assert.equal(totp(SEED, at(1234567890), 30, 8), '89005924');
});

test('TOTP — verify accepte le code courant et un pas de dérive', () => {
  const now = at(1111111111);
  const code = totp(SEED, now, 30, 8);
  const v = verifyTotp(SEED, code, now, 30, 1, 8);
  assert.equal(v.valid, true);
  assert.equal(v.step, timeStep(now, 30));
});

test('TOTP — verify rejette un code hors fenêtre / erroné', () => {
  const now = at(1111111111);
  assert.equal(verifyTotp(SEED, '00000000', now, 30, 1, 8).valid, false);
  // Un code de 10 pas plus tôt n'est plus valide (fenêtre = 1).
  const old = totp(SEED, now - 300 * 1000, 30, 8);
  assert.equal(verifyTotp(SEED, old, now, 30, 1, 8).valid, false);
});

test('TOTP — secondes avant rotation dans [1,30]', () => {
  const s = secondsUntilRotation(at(1111111105), 30);
  assert.ok(s >= 1 && s <= 30);
});
