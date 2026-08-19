/**
 * COMPOSITION ROOT — seul endroit où infrastructure et application se rencontrent.
 * Injection de dépendances manuelle : pas de framework DI (cf. ADR-002).
 */
import { createPool } from './infrastructure/postgres/pool.js';
import { PgLedgerEventStore } from './infrastructure/postgres/ledger-event-store.pg.js';
import { SystemClock } from './infrastructure/system-clock.js';
import { IngestSyncBatch } from './application/use-cases/ingest-sync-batch.js';
import { Ed25519SignatureVerifier } from './infrastructure/crypto/ed25519-verifier.js';
import type { TerminalKeyRegistry } from './application/ports/terminal-key-registry.js';
import { AuthorizeQrPayment } from './application/use-cases/authorize-qr-payment.js';
import { AuthorizeDynamicQrPayment } from './application/use-cases/authorize-dynamic-qr-payment.js';
import { GetDynamicQrToken } from './application/use-cases/get-dynamic-qr-token.js';
import { QrCodeRenderer } from './infrastructure/qr/qrcode-renderer.js';
import { HandleMobileMoneyTopup } from './application/use-cases/handle-mobile-money-topup.js';
import { RecordAdjustment } from './application/use-cases/record-adjustment.js';
import { PayoutRemainingBalances } from './application/use-cases/payout-remaining-balances.js';
import type { MobileMoneyGateway } from './application/ports/mobile-money-gateway.js';
import type { AuditLog } from './application/ports/audit-log.js';
import type { JobQueue } from './application/ports/job-queue.js';
import type { TotpSecretStore } from './application/ports/totp-secret-store.js';
import type { DynamicQrGuard } from './application/ports/dynamic-qr-guard.js';
import { buildApp } from './interface/http/app.js';
import { RequestPortalOtp } from './application/use-cases/request-portal-otp.js';
import { VerifyPortalOtp } from './application/use-cases/verify-portal-otp.js';
import { GetWalletView } from './application/use-cases/get-wallet-view.js';
import { RequestRefund } from './application/use-cases/request-refund.js';
import type { WalletDirectory } from './application/ports/wallet-directory.js';
import type { OtpChannel } from './application/ports/otp-channel.js';
import type { OtpChallengeStore } from './application/ports/otp-challenge-store.js';
import type { PortalSessionStore } from './application/ports/portal-session-store.js';
import type { WalletHistoryReader } from './application/ports/wallet-history-reader.js';
import type { RefundRequestSink } from './application/ports/refund-request-sink.js';
import type { WalletBalanceRepository } from './application/ports/wallet-balance-repository.js';
import type { PinVerifier } from './application/ports/pin-verifier.js';
import type { BlocklistRepository } from './application/ports/blocklist-repository.js';
import type { AnomalySink } from './application/ports/anomaly-sink.js';
import type { MerchantRegistry } from './application/ports/merchant-registry.js';
import type { EventPaymentConfig } from './application/ports/event-payment-config.js';
import type { OpaqueIdMinter } from './application/ports/opaque-id-minter.js';
import type { QrBindingStore } from './application/ports/qr-binding-store.js';
import { LoadChip } from './application/use-cases/load-chip.js';
import { CloseEvent } from './application/use-cases/close-event.js';
import { ProvisionQrSupport } from './application/use-cases/provision-qr-support.js';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL manquant'); // échec honnête au démarrage

const pool = createPool(databaseUrl);
const clock = new SystemClock();
const store = new PgLedgerEventStore(pool);

// TODO: adapters Postgres réels (étape 7). Stubs temporaires explicites — pas silencieux.
const blocklist: BlocklistRepository = {
  add: async (uid, reason) => console.log(JSON.stringify({ level: 'warn', msg: 'blocklist.add(stub)', uid, reason })),
  deltaSince: async (version) => ({ version, addedCardUids: [] }),
};
const anomalies: AnomalySink = {
  report: async (list, batchId) => console.log(JSON.stringify({ level: 'warn', msg: 'anomalies(stub)', batchId, count: list.length })),
};

// Registre de clés de terminaux : adapter Postgres réel = étape suivante (stub explicite).
const terminalKeys: TerminalKeyRegistry = {
  validKeys: async () => { throw new Error('TerminalKeyRegistry non implémenté (stub)'); },
};
const signatures = new Ed25519SignatureVerifier(terminalKeys);
const ingest = new IngestSyncBatch(store, blocklist, anomalies, clock, signatures);

// TODO: adapters Postgres réels (chemin QR, chap. 18). Stubs explicites — jamais silencieux.
const wallets: WalletBalanceRepository = {
  loadState: async () => { throw new Error('WalletBalanceRepository non implémenté (stub QR)'); },
  applyDebit: async () => { throw new Error('WalletBalanceRepository non implémenté (stub QR)'); },
  applyCredit: async () => { throw new Error('WalletBalanceRepository non implémenté (stub QR)'); },
};
const pins: PinVerifier = {
  verify: async () => { throw new Error('PinVerifier non implémenté (stub QR)'); },
};
// ---- Portail participant (PWA). Adapters réels = étape suivante ; stubs explicites. ----
const directory: WalletDirectory = {
  resolveOpaqueId: async () => notImpl('WalletDirectory.resolveOpaqueId'),
  verifiedPayoutMsisdn: async () => notImpl('WalletDirectory.verifiedPayoutMsisdn'),
};
const notImpl = (name: string) => { throw new Error(`${name} non implémenté (stub)`); };
const authorizeQr = new AuthorizeQrPayment(directory, wallets, pins, clock);


const otpChallenges: OtpChallengeStore = {
  issue: async () => notImpl('OtpChallengeStore.issue'),
  verifyAndConsume: async () => notImpl('OtpChallengeStore.verifyAndConsume'),
};
// Adapter OTP par défaut = WhatsApp (agnostique : SMS = même port, autre adapter).
const otpChannel: OtpChannel = {
  send: async (msisdn) => notImpl(`OtpChannel.send(WhatsApp) -> ${msisdn.slice(-3)}`),
};
const sessions: PortalSessionStore = {
  create: async () => notImpl('PortalSessionStore.create'),
  resolve: async () => notImpl('PortalSessionStore.resolve'),
  revoke: async () => notImpl('PortalSessionStore.revoke'),
};
const walletHistory: WalletHistoryReader = { recent: async () => notImpl('WalletHistoryReader.recent') };
const refundSink: RefundRequestSink = { enqueue: async () => notImpl('RefundRequestSink.enqueue') };

const portal = {
  requestOtp: new RequestPortalOtp(directory, otpChallenges, otpChannel),
  verifyOtp: new VerifyPortalOtp(directory, otpChallenges, sessions, clock),
  wallet: new GetWalletView(sessions, wallets, walletHistory, clock),
  refund: new RequestRefund(sessions, pins, directory, refundSink, clock),
};

// QR dynamique (chap. 18.3 option 2). Adapters réels (secret par wallet, garde anti-rejeu
// persistante) = étape suivante ; stubs explicites.
const totpSecrets: TotpSecretStore = { secretFor: async () => notImpl('TotpSecretStore.secretFor') };
const dynamicGuard: DynamicQrGuard = { consume: async () => notImpl('DynamicQrGuard.consume') };
const authorizeDynamicQr = new AuthorizeDynamicQrPayment(directory, totpSecrets, dynamicGuard, clock, authorizeQr);
const dynamicToken = new GetDynamicQrToken(sessions, directory, totpSecrets, clock);
const qrRenderer = new QrCodeRenderer();

// Adapters réels (opérateur MM, audit, jobs) = étape suivante ; stubs explicites.
const auditLog: AuditLog = { append: async () => notImpl('AuditLog.append') };
const jobQueue: JobQueue = {
  enqueue: async () => notImpl('JobQueue.enqueue'), claimNext: async () => notImpl('JobQueue.claimNext'),
  complete: async () => notImpl('JobQueue.complete'), fail: async () => notImpl('JobQueue.fail'),
};
const mmGateway: MobileMoneyGateway = {
  verifyWebhook: () => { throw new Error('MobileMoneyGateway non implémenté (stub)'); },
  confirmPayment: async () => notImpl('MobileMoneyGateway.confirmPayment'),
};
const mobileMoneyTopup = new HandleMobileMoneyTopup(mmGateway, directory, wallets, auditLog, clock);
const recordAdjustment = new RecordAdjustment(wallets, auditLog, clock);
const payoutRemaining = new PayoutRemainingBalances(directory, jobQueue, auditLog, clock);
const loadChip = new LoadChip(directory, wallets, auditLog, clock);
const closeEvent = new CloseEvent(store);
const opaqueMinter: OpaqueIdMinter = { mint: () => notImpl('OpaqueIdMinter.mint') };
const qrBindings: QrBindingStore = { bind: async () => notImpl('QrBindingStore.bind') };
const provisionQr = new ProvisionQrSupport(opaqueMinter, qrBindings, clock);
const merchants: MerchantRegistry = { authenticate: async () => notImpl('MerchantRegistry.authenticate') };
const events: EventPaymentConfig = { qrLimits: async () => notImpl('EventPaymentConfig.qrLimits') };

const app = buildApp({
  ingest, authorizeQr, authorizeDynamicQr, mobileMoneyTopup,
  portal: { ...portal, dynamicToken },
  qrRenderer, merchants, events,
  ops: { provision: provisionQr, adjust: recordAdjustment, close: closeEvent, loadChip, payout: payoutRemaining },
  secureCookies: true, // https en prod
});
const port = Number(process.env['PORT'] ?? 3000);
app.listen({ port, host: '0.0.0.0' })
  .then(() => console.log(JSON.stringify({ level: 'info', msg: 'api.started', port })))
  .catch((e) => { console.error(e); process.exit(1); });
