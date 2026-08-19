/**
 * E2E de la surface API : instance Fastify réelle (buildApp) + fetch. Adapters in-memory.
 * L'e2e navigateur (Playwright) est séparé (tests/e2e, ADR-005).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/interface/http/app.js';
import { IngestSyncBatch } from '../src/application/use-cases/ingest-sync-batch.js';
import { AuthorizeQrPayment } from '../src/application/use-cases/authorize-qr-payment.js';
import { AuthorizeDynamicQrPayment } from '../src/application/use-cases/authorize-dynamic-qr-payment.js';
import { GetDynamicQrToken } from '../src/application/use-cases/get-dynamic-qr-token.js';
import { totp } from '@jotay/card-crypto';
import { HandleMobileMoneyTopup } from '../src/application/use-cases/handle-mobile-money-topup.js';
import { RequestPortalOtp } from '../src/application/use-cases/request-portal-otp.js';
import { VerifyPortalOtp } from '../src/application/use-cases/verify-portal-otp.js';
import { GetWalletView } from '../src/application/use-cases/get-wallet-view.js';
import { RequestRefund } from '../src/application/use-cases/request-refund.js';
import * as F from './fakes.js';
import { MemoryRateLimitStore } from '../src/infrastructure/memory-rate-limit-store.js';
import { LoadChip } from '../src/application/use-cases/load-chip.js';
import { CloseEvent } from '../src/application/use-cases/close-event.js';
import { RecordAdjustment } from '../src/application/use-cases/record-adjustment.js';
import { ProvisionQrSupport } from '../src/application/use-cases/provision-qr-support.js';

let app: FastifyInstance; let base = '';
const clock = new F.FixedClock(new Date(1111111111 * 1000).toISOString());
let DYN_SECRET: Uint8Array;
const wallets = new F.MemWalletBalance();
const dir = new F.FakeWalletDirectory();
const store = new F.MemLedgerEventStore();
const merchants = new F.FakeMerchantRegistry();
const events = new F.FixedEventPaymentConfig();
const sighting = new F.MemVendorSighting();
const anomalies = new F.RecordingAnomalySink();

before(async () => {
  wallets.seed('W1', 3000); dir.bind('OPAQUE', 'W1'); dir.setPayout('W1', '+221771112233');
  wallets.seed('W2', 3000); dir.bind('OPAQUE2', 'W2'); dir.setPayout('W2', '+221770000000'); // wallet isolé pour le login
  wallets.seed('WLOAD', 4000); dir.bind('OPAQUE-LOAD', 'WLOAD');
  const totpSecret = new Uint8Array(Buffer.from('12345678901234567890', 'ascii'));
  const secrets = new F.MemTotpSecretStore(); secrets.set('W1', totpSecret);
  DYN_SECRET = totpSecret;
  const chal = new F.FakeOtpChallengeStore('654321');
  const sess = new F.MemSessionStore();
  const audit = new F.FakeAuditLog();
  app = buildApp({
    ingest: new IngestSyncBatch(store, new F.MemBlocklist(), anomalies, clock, new F.FakeSignatureVerifier()),
    authorizeQr: new AuthorizeQrPayment(dir, wallets, new F.FakePinVerifier(), clock),
    authorizeDynamicQr: new AuthorizeDynamicQrPayment(dir, secrets, new F.MemDynamicQrGuard(), clock, new AuthorizeQrPayment(dir, wallets, new F.FakePinVerifier(), clock)),
    portal: {
      requestOtp: new RequestPortalOtp(dir, chal, new F.RecordingOtpChannel()),
      verifyOtp: new VerifyPortalOtp(dir, chal, sess, clock),
      wallet: new GetWalletView(sess, wallets, new F.FakeHistory(), clock),
      refund: new RequestRefund(sess, new F.FakePinVerifier(), dir, new F.RecordingRefundSink(), clock),
      dynamicToken: new GetDynamicQrToken(sess, dir, secrets, clock),
    },
    qrRenderer: new F.FakeQrRenderer(),
    merchants, events, sighting, anomalies,
    ops: {
      loadChip: new LoadChip(dir, wallets, audit, clock),
      close: new CloseEvent(store),
      adjust: new RecordAdjustment(wallets, audit, clock),
      provision: new ProvisionQrSupport(new F.FakeOpaqueIdMinter(), new F.MemQrBindingStore(dir), clock),
    },
    secureCookies: false, // http de test
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});
after(async () => { await app.close(); });

const merchantHdr = (idem: string, key = 'test-merchant-key') => ({
  'content-type': 'application/json', 'x-merchant-key': key, 'idempotency-key': idem,
});
const post = (path: string, body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
const postM = (path: string, body: unknown, idem: string, key = 'test-merchant-key') =>
  post(path, body, merchantHdr(idem, key));

test('e2e — 404 sur route inconnue', async () => {
  assert.equal((await fetch(base + '/nope', { method: 'POST' })).status, 404);
});

test('e2e — validation zod : montant négatif rejeté (400)', async () => {
  const r = await postM('/payments/qr/authorize', { opaqueId: 'OPAQUE', amountXof: -5, authId: '11111111-1111-1111-1111-111111111111' }, 'idem-neg-amount');
  assert.equal(r.status, 400);
});

test('e2e — paiement QR accepté renvoie le nouveau solde', async () => {
  const r = await postM('/payments/qr/authorize', { opaqueId: 'OPAQUE', amountXof: 500, authId: '44444444-4444-4444-4444-444444444444' }, 'idem-qr-ok');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).balanceAfterXof, 2500);
});

test('e2e — QR : sans X-Merchant-Key -> 401', async () => {
  const r = await post('/payments/qr/authorize', { opaqueId: 'OPAQUE', amountXof: 100, authId: '11111111-1111-4111-8111-111111111111' }, { 'content-type': 'application/json', 'idempotency-key': 'idem-no-key' });
  assert.equal(r.status, 401);
});

test('e2e — QR : sans Idempotency-Key -> 400', async () => {
  const r = await post('/payments/qr/authorize', { opaqueId: 'OPAQUE', amountXof: 100, authId: '11111111-1111-4111-8111-111111111112' }, { 'content-type': 'application/json', 'x-merchant-key': 'test-merchant-key' });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, 'idempotency_key_required');
});

test('e2e — QR : params/vendorId client rejetés (400)', async () => {
  const r = await postM('/payments/qr/authorize', {
    opaqueId: 'OPAQUE', amountXof: 100, vendorId: 'HACK', authId: '11111111-1111-4111-8111-111111111113',
    params: { microPinThresholdXof: 99, velocityAmountCapXof: 9, velocityTxCap: 1 },
  }, 'idem-params-rejected');
  assert.equal(r.status, 400);
});

test('e2e — OTP portail : réponse neutre 200 même pour un opaqueId inconnu (anti-énumération)', async () => {
  const known = await post('/portal/session', { opaqueId: 'OPAQUE', msisdn: '+221771112233' });
  const unknown = await post('/portal/session', { opaqueId: 'NOPE', msisdn: '+221771112233' });
  assert.equal(known.status, 200); assert.equal(unknown.status, 200);
});

test('e2e — verify OTP pose un cookie de session HttpOnly', async () => {
  const r = await post('/portal/session/verify', { opaqueId: 'OPAQUE', msisdn: '+221771112233', code: '654321' });
  assert.equal(r.status, 200);
  const cookie = r.headers.get('set-cookie') ?? '';
  assert.match(cookie, /jotay_ps=/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
});

test('e2e — login complet : le cookie de session donne accès au solde', async () => {
  await post('/portal/session', { opaqueId: 'OPAQUE2', msisdn: '+221770000000' });
  const v = await post('/portal/session/verify', { opaqueId: 'OPAQUE2', msisdn: '+221770000000', code: '654321' });
  const token = /jotay_ps=([^;]+)/.exec(v.headers.get('set-cookie') ?? '')?.[1] ?? '';
  assert.ok(token, 'cookie de session émis');
  const w = await fetch(base + '/portal/wallet', { headers: { cookie: `jotay_ps=${token}` } });
  const data = await w.json();
  assert.equal(w.status, 200, JSON.stringify(data));
  assert.equal(data.serverBalanceXof, 3000);
});

test('e2e — rate limiting : bloque au-delà de la limite (429) sur une app isolée', async () => {
  const Fastify = (await import('fastify')).default;
  const { registerRateLimit } = await import('../src/interface/http/rate-limit-hook.js');
  const rlApp = Fastify();
  registerRateLimit(rlApp, new MemoryRateLimitStore(), { '/ping': { limit: 5, windowMs: 60_000 } });
  rlApp.get('/ping', async () => ({ ok: true }));
  await rlApp.listen({ port: 0, host: '127.0.0.1' });
  const p = (rlApp.server.address() as { port: number }).port;
  try {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await fetch(`http://127.0.0.1:${p}/ping`)).status);
    assert.ok(codes.slice(0, 5).every((c) => c === 200), `5 premiers OK: ${codes}`);
    assert.equal(codes[5], 429, `6e = 429: ${codes}`);
  } finally { await rlApp.close(); }
});

test('e2e — QR : opaqueId inconnu renvoie 404 (résolution serveur)', async () => {
  const r = await postM('/payments/qr/authorize', { opaqueId: 'JAMAIS-VU', amountXof: 500, authId: '88888888-8888-8888-8888-888888888888' }, 'idem-unknown');
  assert.equal(r.status, 404);
});

test('e2e — QR dynamique : code TOTP valide -> 200 et débit', async () => {
  const code = totp(Buffer.from(DYN_SECRET), 1111111111 * 1000, 30, 6);
  const r = await postM('/payments/qr/authorize-dynamic', { opaqueId: 'OPAQUE', totpCode: code, amountXof: 300, authId: 'cccccccc-cccc-cccc-cccc-cccccccccccc' }, 'idem-dyn-ok');
  assert.equal(r.status, 200, JSON.stringify(await r.json()));
});

test('e2e — QR dynamique : mauvais code -> 402 declined bad_totp', async () => {
  const r = await postM('/payments/qr/authorize-dynamic', { opaqueId: 'OPAQUE', totpCode: '000000', amountXof: 300, authId: 'dddddddd-dddd-dddd-dddd-dddddddddddd' }, 'idem-dyn-bad');
  assert.equal(r.status, 402);
  assert.equal((await r.json()).reason, 'bad_totp');
});

test('e2e — webhook Mobile Money : signature valide + confirmation -> 200 crédit', async () => {
  const Fastify = (await import('fastify')).default;
  const { buildApp: build } = await import('../src/interface/http/app.js');
  const dir2 = new F.FakeWalletDirectory(); dir2.bind('OPQ', 'WMM');
  const w2 = new F.MemWalletBalance(); w2.seed('WMM', 0);
  const gw = new F.FakeMobileMoneyGateway(); gw.allow('TXe2e', 5000, 'OPQ');
  const app2 = build({
    ingest: new IngestSyncBatch(new F.MemLedgerEventStore(), new F.MemBlocklist(), new F.RecordingAnomalySink(), clock, new F.FakeSignatureVerifier()),
    authorizeQr: new AuthorizeQrPayment(dir2, w2, new F.FakePinVerifier(), clock),
    mobileMoneyTopup: new HandleMobileMoneyTopup(gw, dir2, w2, new F.FakeAuditLog(), clock),
    portal: { requestOtp: new RequestPortalOtp(dir2, new F.FakeOtpChallengeStore('1'), new F.RecordingOtpChannel()),
      verifyOtp: new VerifyPortalOtp(dir2, new F.FakeOtpChallengeStore('1'), new F.MemSessionStore(), clock),
      wallet: new GetWalletView(new F.MemSessionStore(), w2, new F.FakeHistory(), clock),
      refund: new RequestRefund(new F.MemSessionStore(), new F.FakePinVerifier(), dir2, new F.RecordingRefundSink(), clock) },
    merchants: new F.FakeMerchantRegistry(),
    events: new F.FixedEventPaymentConfig(),
    secureCookies: false,
  });
  void Fastify;
  await app2.listen({ port: 0, host: '127.0.0.1' });
  const p2 = (app2.server.address() as { port: number }).port;
  try {
    const r = await fetch(`http://127.0.0.1:${p2}/webhooks/mobile-money`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-mm-signature': 'valid' },
      body: JSON.stringify({ provider: 'WAVE', providerRef: 'TXe2e', opaqueId: 'OPQ' }),
    });
    assert.equal(r.status, 200, JSON.stringify(await r.json()));
    assert.equal((await w2.loadState('WMM'))!.serverBalanceXof, 5000);
  } finally { await app2.close(); }
});

test('e2e — LoadChip : débit SERVER puis rollback restaure le solde', async () => {
  const loadId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const r1 = await postM('/wallets/load-chip', { opaqueId: 'OPAQUE-LOAD', amountXof: 1000, loadId }, 'idem-load-1');
  const d1 = await r1.json();
  assert.equal(r1.status, 200, JSON.stringify(d1));
  assert.equal(d1.serverBalanceAfterXof, 3000);
  const r2 = await postM('/wallets/load-chip', { opaqueId: 'OPAQUE-LOAD', amountXof: 1000, loadId, rollback: true }, 'idem-load-rb');
  assert.equal(r2.status, 200);
  assert.equal((await wallets.loadState('WLOAD'))!.serverBalanceXof, 4000);
});

test('e2e — clôture événement vide : 200 reconciled', async () => {
  const r = await postM('/events/E-EMPTY/close', { commissions: [] }, 'idem-close-empty', 'test-supervisor-key');
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  assert.equal(d.reconciled, true);
});

test('e2e — ajustement CREDIT superviseur', async () => {
  const r = await postM('/adjustments', {
    walletId: 'W2', direction: 'CREDIT', amountXof: 250,
    reason: 'geste', adjustmentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  }, 'idem-adj-1', 'test-supervisor-key');
  assert.equal(r.status, 200);
  assert.equal((await wallets.loadState('W2'))!.serverBalanceXof, 3250);
});

test('e2e — provision QR : 201 + opaqueId', async () => {
  const r = await postM('/supports/qr', { walletId: 'W2' }, 'idem-prov-1', 'test-supervisor-key');
  const d = await r.json();
  assert.equal(r.status, 201, JSON.stringify(d));
  assert.match(d.opaqueId, /^opaque-/);
});

test('e2e — deux vendeurs dans la fenêtre -> MULTI_VENDOR_WINDOW', async () => {
  merchants.set('key-va', { vendorId: 'VA', eventId: 'E', role: 'merchant' });
  merchants.set('key-vb', { vendorId: 'VB', eventId: 'E', role: 'merchant' });
  const a = await postM('/payments/qr/authorize', { opaqueId: 'OPAQUE', amountXof: 100, authId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }, 'idem-vendor-a', 'key-va');
  const b = await postM('/payments/qr/authorize', { opaqueId: 'OPAQUE', amountXof: 100, authId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }, 'idem-vendor-b', 'key-vb');
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.ok(anomalies.reported.some((x) => x.kind === 'MULTI_VENDOR_WINDOW'));
});

test('e2e — marchand ne peut pas ajuster (401)', async () => {
  const r = await postM('/adjustments', {
    walletId: 'W2', direction: 'CREDIT', amountXof: 10,
    reason: 'nope', adjustmentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  }, 'idem-adj-denied');
  assert.equal(r.status, 401);
});
