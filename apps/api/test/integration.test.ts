import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PaymentRecord } from '@jotay/protocol';
import { IngestSyncBatch } from '../src/application/use-cases/ingest-sync-batch.js';
import { AuthorizeQrPayment } from '../src/application/use-cases/authorize-qr-payment.js';
import { ProvisionQrSupport } from '../src/application/use-cases/provision-qr-support.js';
import { AuthorizeDynamicQrPayment } from '../src/application/use-cases/authorize-dynamic-qr-payment.js';
import { HandleMobileMoneyTopup } from '../src/application/use-cases/handle-mobile-money-topup.js';
import { RecordAdjustment } from '../src/application/use-cases/record-adjustment.js';
import { PayoutRemainingBalances } from '../src/application/use-cases/payout-remaining-balances.js';
import { LoadChip } from '../src/application/use-cases/load-chip.js';
import { MemoryJobQueue } from '../src/infrastructure/jobs/memory-job-queue.js';
import { totp } from '@jotay/card-crypto';
import { RequestPortalOtp } from '../src/application/use-cases/request-portal-otp.js';
import { VerifyPortalOtp } from '../src/application/use-cases/verify-portal-otp.js';
import { GetWalletView } from '../src/application/use-cases/get-wallet-view.js';
import { RequestRefund } from '../src/application/use-cases/request-refund.js';
import * as F from './fakes.js';

const chip = (o: { cardUid: string; cardTxCounter: number; opType: PaymentRecord['opType']; amountXof: number; balanceAfter: number; vendorId?: string; topupChannel?: PaymentRecord['topupChannel']; cashierSessionId?: string; cardTxMac?: string; }): PaymentRecord => ({
  schemaVersion: 2, mediumType: 'NFC', balanceAuthority: 'CHIP', eventId: 'E',
  terminalId: 'T', terminalSeq: 1, tsTerminal: '2026-08-01T18:00:00Z',
  cardTxMac: 'm', terminalSig: 's', ...o,
} as unknown as PaymentRecord);

test('intégration — ingestion : un clone met la carte en blocklist et remonte l\'anomalie', async () => {
  const store = new F.MemLedgerEventStore(); const block = new F.MemBlocklist();
  const anom = new F.RecordingAnomalySink(); const clock = new F.FixedClock('2026-08-01T21:00:00Z');
  const ingest = new IngestSyncBatch(store, block, anom, clock, new F.FakeSignatureVerifier());
  const res = await ingest.execute({ batchId: 'b1', knownBlocklistVersion: 0, records: [
    chip({ cardUid: 'C', cardTxCounter: 1, opType: 'TOPUP', amountXof: 8000, balanceAfter: 8000, cardTxMac: 'a' }),
    chip({ cardUid: 'C', cardTxCounter: 2, opType: 'PAYMENT', vendorId: 'V1', amountXof: 1000, balanceAfter: 7000, cardTxMac: 'x' }),
    chip({ cardUid: 'C', cardTxCounter: 2, opType: 'PAYMENT', vendorId: 'V3', amountXof: 4000, balanceAfter: 3000, cardTxMac: 'y' }),
  ] });
  assert.equal(res.ok, true);
  assert.ok(block.added.includes('C'), 'carte clonée en blocklist');
  assert.ok(anom.reported.some((a) => a.kind === 'CLONE_SUSPECTED'));
});

test('intégration — ingestion idempotente : rejouer le batch n\'insère rien de nouveau', async () => {
  const store = new F.MemLedgerEventStore(); const block = new F.MemBlocklist();
  const ingest = new IngestSyncBatch(store, block, new F.RecordingAnomalySink(), new F.FixedClock('2026-08-01T21:00:00Z'), new F.FakeSignatureVerifier());
  const batch = { batchId: 'b', knownBlocklistVersion: 0, records: [chip({ cardUid: 'D', cardTxCounter: 1, opType: 'TOPUP', amountXof: 5000, balanceAfter: 5000 })] };
  const first = await ingest.execute(batch); const second = await ingest.execute(batch);
  assert.equal(first.ok && first.value.inserted, 1);
  assert.equal(second.ok && second.value.inserted, 0);
});

test('intégration — QR : refus si solde serveur insuffisant, aucun débit', async () => {
  const wallets = new F.MemWalletBalance(); wallets.seed('W1', 1000);
  const dir = new F.FakeWalletDirectory(); dir.bind('OPAQUE-QR', 'W1');
  const uc = new AuthorizeQrPayment(dir, wallets, new F.FakePinVerifier(), new F.FixedClock('t'));
  const res = await uc.execute({ opaqueId: 'OPAQUE-QR', amountXof: 5000, vendorId: 'V', authId: '11111111-1111-1111-1111-111111111111', params: { microPinThresholdXof: 100000, velocityAmountCapXof: 1000000, velocityTxCap: 100 } });
  assert.equal(res.ok, false);
  if (!res.ok && res.error.kind === 'DECLINED') assert.equal(res.error.reason, 'INSUFFICIENT');
  assert.equal((await wallets.loadState('W1'))!.serverBalanceXof, 1000);
});

test('intégration — portail complet : OTP -> session -> vue -> remboursement', async () => {
  const dir = new F.FakeWalletDirectory(); dir.bind('OPAQUE', 'W9'); dir.setPayout('W9', '+221771234567');
  const chal = new F.FakeOtpChallengeStore('654321'); const ch = new F.RecordingOtpChannel();
  const sess = new F.MemSessionStore(); const clock = new F.FixedClock('2026-08-01T20:00:00Z');
  const wallets = new F.MemWalletBalance(); wallets.seed('W9', 4500);
  const sink = new F.RecordingRefundSink();

  const request = new RequestPortalOtp(dir, chal, ch);
  const verify = new VerifyPortalOtp(dir, chal, sess, clock);
  const view = new GetWalletView(sess, wallets, new F.FakeHistory(), clock);
  const refund = new RequestRefund(sess, new F.FakePinVerifier(), dir, sink, clock);

  await request.execute({ opaqueId: 'OPAQUE', msisdn: '+221771234567' });
  assert.equal(ch.sent.length, 1, 'OTP envoyé par le canal (WhatsApp)');
  const v = await verify.execute({ opaqueId: 'OPAQUE', msisdn: '+221771234567', code: '654321' });
  assert.equal(v.ok, true);
  const token = v.ok ? v.value.token : '';
  const w = await view.execute({ sessionToken: token });
  assert.equal(w.ok && w.value.serverBalanceXof, 4500);
  const r = await refund.execute({ sessionToken: token, pin: '1234', idempotencyKey: '22222222-2222-2222-2222-222222222222' });
  assert.equal(r.ok, true);
  assert.equal(sink.enqueued.length, 1);
  assert.equal(sink.enqueued[0]!.payoutMsisdn, '+221771234567');
});

test('intégration — remboursement refusé sans numéro de payout vérifié', async () => {
  const dir = new F.FakeWalletDirectory(); dir.bind('O', 'W'); // pas de setPayout
  const sess = new F.MemSessionStore(); const clock = new F.FixedClock('2026-08-01T20:00:00Z');
  const s = await sess.create('W', '+221770000000', clock.nowIso());
  const refund = new RequestRefund(sess, new F.FakePinVerifier(), dir, new F.RecordingRefundSink(), clock);
  const r = await refund.execute({ sessionToken: s.token, pin: '1234', idempotencyKey: '33333333-3333-3333-3333-333333333333' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'NO_VERIFIED_PAYOUT');
});

test('intégration — signature invalide : record écarté, non stocké, anomalie BAD_SIGNATURE', async () => {
  const store = new F.MemLedgerEventStore(); const anom = new F.RecordingAnomalySink();
  const sig = new F.FakeSignatureVerifier(); sig.reject('FORGE');
  const ingest = new IngestSyncBatch(store, new F.MemBlocklist(), anom, new F.FixedClock('2026-08-01T21:00:00Z'), sig);
  const res = await ingest.execute({ batchId: '55555555-5555-5555-5555-555555555555', knownBlocklistVersion: 0, records: [
    chip({ cardUid: 'FORGE', cardTxCounter: 1, opType: 'TOPUP', amountXof: 999999, balanceAfter: 999999 }),
    chip({ cardUid: 'OK', cardTxCounter: 1, opType: 'TOPUP', amountXof: 5000, balanceAfter: 5000 }),
  ] });
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.value.inserted, 1); // seul OK stocké
  assert.ok(anom.reported.some((a) => a.kind === 'BAD_SIGNATURE'));
  assert.equal((await store.readCard('FORGE')).length, 0); // le forgé n'existe pas
});

test('intégration — QR : provisionnement (mint+bind) puis paiement via opaqueId', async () => {
  const dir = new F.FakeWalletDirectory();
  const provision = new ProvisionQrSupport(new F.FakeOpaqueIdMinter(), new F.MemQrBindingStore(dir), new F.FixedClock('t'));
  const prov = await provision.execute({ walletId: 'W42' });
  assert.equal(prov.ok, true);
  const opaqueId = prov.ok ? prov.value.opaqueId : '';
  assert.match(prov.ok ? prov.value.url : '', /\/w\//); // URL du QR

  const wallets = new F.MemWalletBalance(); wallets.seed('W42', 3000);
  const uc = new AuthorizeQrPayment(dir, wallets, new F.FakePinVerifier(), new F.FixedClock('t'));
  const res = await uc.execute({ opaqueId, amountXof: 800, vendorId: 'V', authId: '66666666-6666-6666-6666-666666666666', params: { microPinThresholdXof: 100000, velocityAmountCapXof: 1000000, velocityTxCap: 100 } });
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.value.balanceAfterXof, 2200);
});

test('intégration — QR : opaqueId inconnu -> WALLET_UNKNOWN (aucun débit)', async () => {
  const dir = new F.FakeWalletDirectory(); // rien de bindé
  const wallets = new F.MemWalletBalance();
  const uc = new AuthorizeQrPayment(dir, wallets, new F.FakePinVerifier(), new F.FixedClock('t'));
  const res = await uc.execute({ opaqueId: 'INCONNU', amountXof: 100, vendorId: 'V', authId: '77777777-7777-7777-7777-777777777777', params: { microPinThresholdXof: 100000, velocityAmountCapXof: 1000000, velocityTxCap: 100 } });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.error.kind, 'WALLET_UNKNOWN');
});

const dynSetup = () => {
  const dir = new F.FakeWalletDirectory(); dir.bind('OPQ', 'WD');
  const wallets = new F.MemWalletBalance(); wallets.seed('WD', 5000);
  const secret = new Uint8Array(Buffer.from('12345678901234567890', 'ascii'));
  const secrets = new F.MemTotpSecretStore(); secrets.set('WD', secret);
  const guard = new F.MemDynamicQrGuard();
  const clock = new F.FixedClock(new Date(1111111111 * 1000).toISOString());
  const staticUc = new AuthorizeQrPayment(dir, wallets, new F.FakePinVerifier(), clock);
  const uc = new AuthorizeDynamicQrPayment(dir, secrets, guard, clock, staticUc);
  const code = totp(Buffer.from(secret), 1111111111 * 1000, 30, 6);
  return { uc, wallets, code };
};
const dynInput = (over: Record<string, unknown> = {}) => ({
  opaqueId: 'OPQ', amountXof: 700, vendorId: 'V', authId: '99999999-9999-9999-9999-999999999999',
  params: { microPinThresholdXof: 100000, velocityAmountCapXof: 1000000, velocityTxCap: 100 }, ...over,
});

test('intégration — QR dynamique : code valide -> débit', async () => {
  const { uc, wallets, code } = dynSetup();
  const res = await uc.execute(dynInput({ totpCode: code }) as never);
  assert.equal(res.ok, true);
  assert.equal((await wallets.loadState('WD'))!.serverBalanceXof, 4300);
});

test('intégration — QR dynamique : mauvais code -> BAD_TOTP, aucun débit', async () => {
  const { uc, wallets } = dynSetup();
  const res = await uc.execute(dynInput({ totpCode: '000000' }) as never);
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.error.kind, 'BAD_TOTP');
  assert.equal((await wallets.loadState('WD'))!.serverBalanceXof, 5000);
});

test('intégration — QR dynamique : rejeu du même code -> REPLAY', async () => {
  const { uc, code } = dynSetup();
  const first = await uc.execute(dynInput({ totpCode: code, authId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }) as never);
  assert.equal(first.ok, true);
  const second = await uc.execute(dynInput({ totpCode: code, authId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }) as never);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.error.kind, 'REPLAY');
});

test('régression — QR dynamique : un code capturé et rejoué à un autre moment reste refusé (REPLAY)', async () => {
  const { uc, code } = dynSetup();
  await uc.execute(dynInput({ totpCode: code, authId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' }) as never);
  const replay = await uc.execute(dynInput({ totpCode: code, authId: 'ffffffff-ffff-ffff-ffff-ffffffffffff' }) as never);
  assert.equal(replay.ok, false);
  if (!replay.ok) assert.equal(replay.error.kind, 'REPLAY');
});

test('sécurité — anti-rejeu QR : consommations concurrentes du même pas -> exactement une réussit', async () => {
  const guard = new F.MemDynamicQrGuard();
  const results = await Promise.all(Array.from({ length: 8 }, () => guard.consume('W', 42)));
  assert.equal(results.filter((r) => r === true).length, 1, JSON.stringify(results));
  assert.equal(results.filter((r) => r === false).length, 7);
});

test('sécurité — QR dynamique : gros montant sans PIN -> refusé (PIN hérité du flux serveur)', async () => {
  const { uc, code } = dynSetup();
  // microPinThreshold bas -> montant au-dessus exige un PIN ; on n'en fournit pas.
  const res = await uc.execute(dynInput({ totpCode: code, amountXof: 3000,
    params: { microPinThresholdXof: 500, velocityAmountCapXof: 1000000, velocityTxCap: 100 } }) as never);
  assert.equal(res.ok, false);
  if (!res.ok) assert.ok(res.error.kind === 'BAD_PIN' || res.error.kind === 'DECLINED', res.error.kind);
});

// ---- G) Recharge Mobile Money : webhook + active check ----
test('intégration — Mobile Money : webhook confirmé -> crédit idempotent', async () => {
  const dir = new F.FakeWalletDirectory(); dir.bind('OPQ', 'WM');
  const wallets = new F.MemWalletBalance(); wallets.seed('WM', 1000);
  const gw = new F.FakeMobileMoneyGateway(); gw.allow('TX1', 2000, 'OPQ');
  const audit = new F.FakeAuditLog();
  const uc = new HandleMobileMoneyTopup(gw, dir, wallets, audit, new F.FixedClock('t'));
  const input = { provider: 'WAVE', providerRef: 'TX1', opaqueId: 'OPQ', rawBody: '{}', signature: 'valid' };
  const r1 = await uc.execute(input as never); assert.equal(r1.ok, true);
  const r2 = await uc.execute(input as never); assert.equal(r2.ok, true); // rejeu du webhook
  assert.equal((await wallets.loadState('WM'))!.serverBalanceXof, 3000); // crédité UNE fois (idempotent)
  assert.ok(audit.entries.some((e) => e.action === 'TOPUP_MOBILE_MONEY'));
});

test('intégration — Mobile Money : active check négatif -> aucun crédit', async () => {
  const dir = new F.FakeWalletDirectory(); dir.bind('OPQ', 'WM');
  const wallets = new F.MemWalletBalance(); wallets.seed('WM', 1000);
  const gw = new F.FakeMobileMoneyGateway(); // TX2 non confirmable par l'opérateur
  const uc = new HandleMobileMoneyTopup(gw, dir, wallets, new F.FakeAuditLog(), new F.FixedClock('t'));
  const r = await uc.execute({ provider: 'WAVE', providerRef: 'TX2', opaqueId: 'OPQ', rawBody: '{}', signature: 'valid' } as never);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'NOT_CONFIRMED');
  assert.equal((await wallets.loadState('WM'))!.serverBalanceXof, 1000); // inchangé
});

test('intégration — Mobile Money : signature webhook invalide -> rejeté avant tout', async () => {
  const uc = new HandleMobileMoneyTopup(new F.FakeMobileMoneyGateway(), new F.FakeWalletDirectory(), new F.MemWalletBalance(), new F.FakeAuditLog(), new F.FixedClock('t'));
  const r = await uc.execute({ provider: 'WAVE', providerRef: 'TX', opaqueId: 'X', rawBody: '{}', signature: 'forgee' } as never);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'BAD_WEBHOOK_SIGNATURE');
});

// ---- F) Ajustement audité ----
test('intégration — ajustement crédit : solde modifié + entrée d\'audit', async () => {
  const wallets = new F.MemWalletBalance(); wallets.seed('WA', 1000);
  const audit = new F.FakeAuditLog();
  const uc = new RecordAdjustment(wallets, audit, new F.FixedClock('t'));
  await uc.execute({ walletId: 'WA', direction: 'CREDIT', amountXof: 500, reason: 'geste commercial', actor: 'sup:alice', adjustmentId: 'adj-1' });
  assert.equal((await wallets.loadState('WA'))!.serverBalanceXof, 1500);
  const e = audit.entries.find((x) => x.action === 'ADJUSTMENT_CREDIT');
  assert.ok(e && e.actor === 'sup:alice' && e.details?.reason === 'geste commercial');
});

// ---- E) Pont clôture -> payout ----
test('intégration — payout : soldes restants -> jobs (verifié) / skip (non vérifié)', async () => {
  const dir = new F.FakeWalletDirectory(); dir.setPayout('W1', '+221771112233'); // W2 sans payout vérifié
  const jobs = new MemoryJobQueue(); const audit = new F.FakeAuditLog();
  const uc = new PayoutRemainingBalances(dir, jobs, audit, new F.FixedClock('t'));
  const res = await uc.execute({ eventId: 'E1', actor: 'sup:bob', balances: [
    { walletId: 'W1', remainingXof: 1500 }, { walletId: 'W2', remainingXof: 800 }, { walletId: 'W3', remainingXof: 0 },
  ] });
  assert.equal(res.ok, true);
  if (res.ok) { assert.equal(res.value.enqueued, 1); assert.equal(res.value.skippedNoPayout, 1); }
  assert.equal(jobs.pending(), 1);
  // Idempotence : rejouer la clôture ne double pas les payouts.
  await uc.execute({ eventId: 'E1', actor: 'sup:bob', balances: [{ walletId: 'W1', remainingXof: 1500 }] });
  assert.equal(jobs.pending(), 1);
});

test('intégration — LoadChip : débit SERVER + rollback idempotent', async () => {
  const dir = new F.FakeWalletDirectory(); dir.bind('OPQ', 'WL');
  const wallets = new F.MemWalletBalance(); wallets.seed('WL', 5000);
  const audit = new F.FakeAuditLog();
  const uc = new LoadChip(dir, wallets, audit, new F.FixedClock('t'));
  const loadId = '11111111-1111-4111-8111-111111111111';
  const r1 = await uc.execute({ opaqueId: 'OPQ', amountXof: 2000, loadId });
  assert.equal(r1.ok, true);
  assert.equal((await wallets.loadState('WL'))!.serverBalanceXof, 3000);
  const r2 = await uc.execute({ opaqueId: 'OPQ', amountXof: 2000, loadId });
  assert.equal(r2.ok, true);
  assert.equal((await wallets.loadState('WL'))!.serverBalanceXof, 3000); // même loadId : pas de double débit
  const rb = await uc.rollback({ opaqueId: 'OPQ', amountXof: 2000, loadId });
  assert.equal(rb.ok, true);
  assert.equal((await wallets.loadState('WL'))!.serverBalanceXof, 5000);
  await uc.rollback({ opaqueId: 'OPQ', amountXof: 2000, loadId });
  assert.equal((await wallets.loadState('WL'))!.serverBalanceXof, 5000); // rollback idempotent
  assert.ok(audit.entries.some((e) => e.action === 'LOAD_CHIP'));
  assert.ok(audit.entries.some((e) => e.action === 'LOAD_CHIP_ROLLED_BACK'));
});

test('intégration — LoadChip : solde insuffisant, aucun débit', async () => {
  const dir = new F.FakeWalletDirectory(); dir.bind('OPQ', 'WL');
  const wallets = new F.MemWalletBalance(); wallets.seed('WL', 100);
  const uc = new LoadChip(dir, wallets, new F.FakeAuditLog(), new F.FixedClock('t'));
  const r = await uc.execute({ opaqueId: 'OPQ', amountXof: 500, loadId: '22222222-2222-4222-8222-222222222222' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.kind, 'INSUFFICIENT');
  assert.equal((await wallets.loadState('WL'))!.serverBalanceXof, 100);
});

test('intégration — PIN : 5 échecs verrouillent, un 6e même correct échoue', async () => {
  const pins = new F.FakePinVerifier('1234', 5);
  for (let i = 0; i < 5; i++) assert.equal(await pins.verify('WLOCK', '0000'), false);
  assert.equal(await pins.verify('WLOCK', '1234'), false);
});

test('intégration — ajustement DEBIT : solde diminué + audit', async () => {
  const wallets = new F.MemWalletBalance(); wallets.seed('WD', 2000);
  const audit = new F.FakeAuditLog();
  const uc = new RecordAdjustment(wallets, audit, new F.FixedClock('t'));
  await uc.execute({ walletId: 'WD', direction: 'DEBIT', amountXof: 400, reason: 'correction', actor: 'sup:bob', adjustmentId: 'adj-d1' });
  assert.equal((await wallets.loadState('WD'))!.serverBalanceXof, 1600);
  assert.ok(audit.entries.some((e) => e.action === 'ADJUSTMENT_DEBIT'));
});
