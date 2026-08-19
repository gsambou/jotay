import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aesCmac, diversifyKey } from '../src/index.js';

// Vecteur officiel RFC 4493 : valide notre AES-CMAC (donc les sous-clés, le padding, XOR).
const KEY = Buffer.from('2b7e151628aed2a6abf7158809cf4f3c', 'hex');
test('AES-CMAC — vecteur RFC 4493 (message vide)', () => {
  assert.equal(aesCmac(KEY, Buffer.alloc(0)).toString('hex'), 'bb1d6929e95937287fa37d129b756746');
});
test('AES-CMAC — vecteur RFC 4493 (16 octets)', () => {
  const m = Buffer.from('6bc1bee22e409f96e93d7e117393172a', 'hex');
  assert.equal(aesCmac(KEY, m).toString('hex'), '070a16b46b4d4144f79bdd9dd04a287c');
});
test('AES-CMAC — vecteur RFC 4493 (40 octets)', () => {
  const m = Buffer.from('6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411', 'hex');
  assert.equal(aesCmac(KEY, m).toString('hex'), 'dfa66747de9ae63030ca32611497c827');
});

const master = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
test('diversification — déterministe (même UID -> même clé)', () => {
  const uid = Buffer.from('04a1b2c3d4e5f6', 'hex');
  assert.deepEqual(diversifyKey(master, uid), diversifyKey(master, uid));
});
test('diversification — unicité (UID différents -> clés différentes)', () => {
  const k1 = diversifyKey(master, Buffer.from('04a1b2c3d4e5f6', 'hex'));
  const k2 = diversifyKey(master, Buffer.from('04a1b2c3d4e5f7', 'hex')); // 1 bit d'UID
  assert.notDeepEqual(k1, k2);
});
test('diversification — la clé fait 16 octets et diffère de la maîtresse', () => {
  const k = diversifyKey(master, Buffer.from('04a1b2c3d4e5f6', 'hex'));
  assert.equal(k.length, 16);
  assert.notDeepEqual(k, master);
});
test('diversification — un label distinct donne une clé distincte (séparation d\'usage)', () => {
  const uid = Buffer.from('04a1b2c3d4e5f6', 'hex');
  assert.notDeepEqual(diversifyKey(master, uid, 'JOTAY-CARD'), diversifyKey(master, uid, 'JOTAY-TOPUP'));
});
