/**
 * COMPOSITION ROOT — seul endroit où infrastructure et application se rencontrent.
 * Injection de dépendances manuelle : pas de framework DI (cf. ADR-002).
 */
import { createPool } from './infrastructure/postgres/pool.js';
import { PgLedgerEventStore } from './infrastructure/postgres/ledger-event-store.pg.js';
import { PgWalletBalance } from './infrastructure/postgres/wallet-balance.pg.js';
import { PgWalletDirectory } from './infrastructure/postgres/directory.pg.js';
import { PgEventPaymentConfig, PgMerchantRegistry } from './infrastructure/postgres/merchants.pg.js';
import { PgPinVerifier } from './infrastructure/postgres/pin-verifier.pg.js';
import {
  PgAnomalySink, PgAuditLog, PgBlocklist, PgDynamicQrGuard, PgJobQueue,
  PgOtpChallenges, PgPortalSessions, PgRefundSink, PgTerminalKeys,
  PgTotpSecrets, PgVendorSighting, PgWalletHistory,
} from './infrastructure/postgres/stores.pg.js';
import { SystemClock } from './infrastructure/system-clock.js';
import { RandomOpaqueIdMinter } from './infrastructure/crypto/opaque-id-minter.js';
import { Ed25519SignatureVerifier } from './infrastructure/crypto/ed25519-verifier.js';
import { QrCodeRenderer } from './infrastructure/qr/qrcode-renderer.js';
import { DevLogOtpChannel } from './infrastructure/otp/dev-log-channel.js';
import { IngestSyncBatch } from './application/use-cases/ingest-sync-batch.js';
import { AuthorizeQrPayment } from './application/use-cases/authorize-qr-payment.js';
import { AuthorizeDynamicQrPayment } from './application/use-cases/authorize-dynamic-qr-payment.js';
import { GetDynamicQrToken } from './application/use-cases/get-dynamic-qr-token.js';
import { HandleMobileMoneyTopup } from './application/use-cases/handle-mobile-money-topup.js';
import { RecordAdjustment } from './application/use-cases/record-adjustment.js';
import { PayoutRemainingBalances } from './application/use-cases/payout-remaining-balances.js';
import { LoadChip } from './application/use-cases/load-chip.js';
import { CloseEvent } from './application/use-cases/close-event.js';
import { ProvisionQrSupport } from './application/use-cases/provision-qr-support.js';
import { RequestPortalOtp } from './application/use-cases/request-portal-otp.js';
import { VerifyPortalOtp } from './application/use-cases/verify-portal-otp.js';
import { GetWalletView } from './application/use-cases/get-wallet-view.js';
import { RequestRefund } from './application/use-cases/request-refund.js';
import type { MobileMoneyGateway } from './application/ports/mobile-money-gateway.js';
import type { OtpChannel } from './application/ports/otp-channel.js';
import { buildApp } from './interface/http/app.js';

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('DATABASE_URL manquant');

const pool = createPool(databaseUrl);
const clock = new SystemClock();
const store = new PgLedgerEventStore(pool);
const blocklist = new PgBlocklist(pool);
const anomalies = new PgAnomalySink(pool);
const terminalKeys = new PgTerminalKeys(pool);
const signatures = new Ed25519SignatureVerifier(terminalKeys);
const ingest = new IngestSyncBatch(store, blocklist, anomalies, clock, signatures);

const wallets = new PgWalletBalance(pool);
const pins = new PgPinVerifier(pool);
const directory = new PgWalletDirectory(pool);
const authorizeQr = new AuthorizeQrPayment(directory, wallets, pins, clock);

const otpChallenges = new PgOtpChallenges(pool);
const notImpl = (name: string) => { throw new Error(`${name} non implémenté (stub)`); };
const otpChannel: OtpChannel = process.env['JOTAY_DEV_OTP'] === '1'
  ? new DevLogOtpChannel()
  : { send: async (msisdn) => notImpl(`OtpChannel.send(WhatsApp) -> ${msisdn.slice(-3)}`) };
const sessions = new PgPortalSessions(pool);
const walletHistory = new PgWalletHistory(pool);
const jobQueue = new PgJobQueue(pool);
const refundSink = new PgRefundSink(jobQueue);
const auditLog = new PgAuditLog(pool);

const portal = {
  requestOtp: new RequestPortalOtp(directory, otpChallenges, otpChannel),
  verifyOtp: new VerifyPortalOtp(directory, otpChallenges, sessions, clock),
  wallet: new GetWalletView(sessions, wallets, walletHistory, clock),
  refund: new RequestRefund(sessions, pins, directory, refundSink, clock),
};

const totpSecrets = new PgTotpSecrets(pool);
const dynamicGuard = new PgDynamicQrGuard(pool);
const authorizeDynamicQr = new AuthorizeDynamicQrPayment(directory, totpSecrets, dynamicGuard, clock, authorizeQr);
const dynamicToken = new GetDynamicQrToken(sessions, directory, totpSecrets, clock);
const qrRenderer = new QrCodeRenderer();

const mmGateway: MobileMoneyGateway = {
  verifyWebhook: () => { throw new Error('MobileMoneyGateway non implémenté (stub opérateur)'); },
  confirmPayment: async () => notImpl('MobileMoneyGateway.confirmPayment'),
};
const mobileMoneyTopup = new HandleMobileMoneyTopup(mmGateway, directory, wallets, auditLog, clock);
const recordAdjustment = new RecordAdjustment(wallets, auditLog, clock);
const payoutRemaining = new PayoutRemainingBalances(directory, jobQueue, auditLog, clock);
const loadChip = new LoadChip(directory, wallets, auditLog, clock);
const closeEvent = new CloseEvent(store);
const provisionQr = new ProvisionQrSupport(new RandomOpaqueIdMinter(), directory, clock);
const merchants = new PgMerchantRegistry(pool);
const events = new PgEventPaymentConfig(pool);
const sighting = new PgVendorSighting(pool);

const app = buildApp({
  ingest, authorizeQr, authorizeDynamicQr, mobileMoneyTopup,
  portal: { ...portal, dynamicToken },
  qrRenderer, merchants, events, sighting, anomalies,
  ops: { provision: provisionQr, adjust: recordAdjustment, close: closeEvent, loadChip, payout: payoutRemaining },
  secureCookies: process.env['JOTAY_SECURE_COOKIES'] !== '0',
});
const port = Number(process.env['PORT'] ?? 3000);
app.listen({ port, host: '0.0.0.0' })
  .then(() => console.log(JSON.stringify({ level: 'info', msg: 'api.started', port })))
  .catch((e) => { console.error(e); process.exit(1); });
