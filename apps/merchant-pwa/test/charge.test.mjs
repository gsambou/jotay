import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChargeRequest } from '../public/charge.js';

test('charge — QR statique : pas de params ni vendorId, headers marchand', () => {
  const r = buildChargeRequest({
    scanned: 'OPAQUE', amountXof: 500, authId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', merchantKey: 'k',
  });
  assert.equal(r.url, '/payments/qr/authorize');
  assert.equal(r.headers['x-merchant-key'], 'k');
  assert.equal(r.headers['idempotency-key'], 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.equal('params' in r.body, false);
  assert.equal('vendorId' in r.body, false);
  assert.equal(r.body.opaqueId, 'OPAQUE');
});

test('charge — QR dynamique : totpCode, même gardes', () => {
  const r = buildChargeRequest({
    scanned: 'OPAQUE:123456', amountXof: 2000, pin: '1234',
    authId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', merchantKey: 'k',
  });
  assert.equal(r.url, '/payments/qr/authorize-dynamic');
  assert.equal(r.body.totpCode, '123456');
  assert.equal(r.body.pin, '1234');
  assert.equal('params' in r.body, false);
});
