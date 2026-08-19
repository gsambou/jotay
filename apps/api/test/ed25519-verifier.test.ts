import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as cryptoSign, KeyObject } from 'node:crypto';
import { canonicalBytesForSignature, type PaymentRecord } from '@jotay/protocol';
import { Ed25519SignatureVerifier } from '../src/infrastructure/crypto/ed25519-verifier.js';
import type { TerminalKeyRegistry } from '../src/application/ports/terminal-key-registry.js';

function rawPublicKey(pub: KeyObject): Uint8Array {
  const jwk = pub.export({ format: 'jwk' }) as { x: string };
  return new Uint8Array(Buffer.from(jwk.x, 'base64url'));
}
const rec = (over: Partial<PaymentRecord> = {}): PaymentRecord => ({
  schemaVersion: 2, mediumType: 'NFC', balanceAuthority: 'CHIP', eventId: 'E',
  cardUid: 'C' as never, cardTxCounter: 1, terminalId: 'T1' as never, terminalSeq: 1,
  opType: 'PAYMENT', amountXof: 1000, balanceAfter: 4000, vendorId: 'V1' as never,
  tsTerminal: '2026-08-01T19:00:00Z', cardTxMac: 'mac', terminalSig: '', ...over,
} as PaymentRecord);

function signed(priv: KeyObject, r: PaymentRecord): PaymentRecord {
  const { terminalSig: _s, ...unsigned } = r; void _s;
  const sig = cryptoSign(null, Buffer.from(canonicalBytesForSignature(unsigned)), priv);
  return { ...r, terminalSig: sig.toString('hex') };
}
const registry = (id: string, raw: Uint8Array, from = '1970-01-01T00:00:00Z', until: string | null = null): TerminalKeyRegistry => ({
  validKeys: async (t, atIso) => (t === id && from <= atIso && (until === null || atIso < until) ? [raw] : []),
});

test('unité — signature valide acceptée', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const v = new Ed25519SignatureVerifier(registry('T1', rawPublicKey(publicKey)));
  assert.equal(await v.verify(signed(privateKey, rec())), true);
});

test('unité — record altéré après signature : rejeté', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const v = new Ed25519SignatureVerifier(registry('T1', rawPublicKey(publicKey)));
  const good = signed(privateKey, rec());
  const tampered = { ...good, amountXof: 9999 }; // montant modifié -> signature invalide
  assert.equal(await v.verify(tampered), false);
});

test('unité — terminal inconnu/révoqué : rejeté', async () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const v = new Ed25519SignatureVerifier(registry('AUTRE', new Uint8Array(32)));
  assert.equal(await v.verify(signed(privateKey, rec())), false);
});

test('unité — signature d\'une autre clé : rejetée', async () => {
  const { publicKey } = generateKeyPairSync('ed25519');
  const other = generateKeyPairSync('ed25519');
  const v = new Ed25519SignatureVerifier(registry('T1', rawPublicKey(publicKey)));
  assert.equal(await v.verify(signed(other.privateKey, rec())), false);
});

test('unité — rotation : lot signé avec l\'ancienne clé, accepté pendant la grâce', async () => {
  const oldKp = generateKeyPairSync('ed25519');
  // L'ancienne clé est valide jusqu'à fin de grâce ; le record est daté AVANT la fin de grâce.
  const reg: TerminalKeyRegistry = {
    validKeys: async () => [rawPublicKey(oldKp.publicKey)], // en grâce, l'ancienne reste renvoyée
  };
  const v = new Ed25519SignatureVerifier(reg);
  assert.equal(await v.verify(signed(oldKp.privateKey, rec({ tsTerminal: '2026-08-01T10:00:00Z' }))), true);
});

test('unité — rotation : après la fin de grâce, l\'ancienne clé n\'est plus renvoyée -> refus', async () => {
  const oldKp = generateKeyPairSync('ed25519');
  const reg: TerminalKeyRegistry = { validKeys: async () => [] }; // grâce terminée : plus aucune clé valide
  const v = new Ed25519SignatureVerifier(reg);
  assert.equal(await v.verify(signed(oldKp.privateKey, rec())), false);
});
