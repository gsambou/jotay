/**
 * Adapter HTTP = Fastify (ADR-006). C'est le SEUL endroit qui connaît le framework web ;
 * les use cases et le domaine l'ignorent totalement. Remplacer Fastify ne toucherait que
 * cette couche interface — bénéfice direct de l'architecture hexagonale.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { registerRateLimit } from './rate-limit-hook.js';
import { registerIdempotencyKey } from './idempotency-hook.js';
import type { RateLimitStore } from '../../application/ports/rate-limit-store.js';
import type { QrRenderer } from '../../application/ports/qr-renderer.js';
import type { MerchantRegistry } from '../../application/ports/merchant-registry.js';
import type { EventPaymentConfig } from '../../application/ports/event-payment-config.js';
import type { RecentVendorSighting } from '../../application/ports/recent-vendor-sighting.js';
import type { AnomalySink } from '../../application/ports/anomaly-sink.js';
import { Metrics } from '../../infrastructure/metrics.js';
import type { IngestSyncBatch } from '../../application/use-cases/ingest-sync-batch.js';
import type { AuthorizeQrPayment } from '../../application/use-cases/authorize-qr-payment.js';
import type { AuthorizeDynamicQrPayment } from '../../application/use-cases/authorize-dynamic-qr-payment.js';
import type { GetDynamicQrToken } from '../../application/use-cases/get-dynamic-qr-token.js';
import type { HandleMobileMoneyTopup } from '../../application/use-cases/handle-mobile-money-topup.js';
import type { RequestPortalOtp } from '../../application/use-cases/request-portal-otp.js';
import type { VerifyPortalOtp } from '../../application/use-cases/verify-portal-otp.js';
import type { GetWalletView } from '../../application/use-cases/get-wallet-view.js';
import type { RequestRefund } from '../../application/use-cases/request-refund.js';
import type { ProvisionQrSupport } from '../../application/use-cases/provision-qr-support.js';
import type { RecordAdjustment } from '../../application/use-cases/record-adjustment.js';
import type { CloseEvent } from '../../application/use-cases/close-event.js';
import type { LoadChip } from '../../application/use-cases/load-chip.js';
import type { PayoutRemainingBalances } from '../../application/use-cases/payout-remaining-balances.js';
import { registerSyncRoute } from './routes/sync.js';
import { registerQrPaymentRoute } from './routes/qr-payment.js';
import { registerDynamicQrPaymentRoute } from './routes/dynamic-qr-payment.js';
import { registerMobileMoneyWebhook } from './routes/mobile-money-webhook.js';
import { registerPortalRoutes } from './routes/portal.js';
import { registerOpsRoutes } from './routes/ops.js';

export interface HttpDeps {
  ingest: IngestSyncBatch;
  authorizeQr: AuthorizeQrPayment;
  authorizeDynamicQr?: AuthorizeDynamicQrPayment;
  mobileMoneyTopup?: HandleMobileMoneyTopup;
  portal: { requestOtp: RequestPortalOtp; verifyOtp: VerifyPortalOtp; wallet: GetWalletView; refund: RequestRefund; dynamicToken?: GetDynamicQrToken };
  qrRenderer?: QrRenderer;
  merchants: MerchantRegistry;
  events: EventPaymentConfig;
  sighting?: RecentVendorSighting;
  anomalies?: AnomalySink;
  ops?: {
    provision?: ProvisionQrSupport;
    adjust?: RecordAdjustment;
    close?: CloseEvent;
    loadChip?: LoadChip;
    payout?: PayoutRemainingBalances;
  };
  /** true en production (https). false uniquement pour le serveur de test e2e (http). */
  secureCookies: boolean;
  /** Limitation de débit (optionnelle). */
  rateLimit?: { store: RateLimitStore; nowMs?: () => number };
  /** Journalisation pino de Fastify (true en prod). */
  logger?: boolean;
  /** Registre de métriques exposé sur /metrics. */
  metrics?: Metrics;
}

export function buildApp(deps: HttpDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: 1_048_576 });
  registerIdempotencyKey(app);
  if (deps.metrics) app.get('/metrics', async (_req, reply) => reply.type('text/plain').send(deps.metrics!.render()));
  if (deps.rateLimit) {
    registerRateLimit(app, deps.rateLimit.store, {
      '/portal/session': { limit: 5, windowMs: 60_000 },        // OTP : 5/min/IP
      '/payments/qr/authorize': { limit: 60, windowMs: 60_000 }, // paiement QR : 60/min/IP
    }, deps.rateLimit.nowMs);
  }
  registerSyncRoute(app, deps.ingest);
  registerQrPaymentRoute(app, deps.authorizeQr, deps.merchants, deps.events, {
    ...(deps.sighting ? { sighting: deps.sighting } : {}),
    ...(deps.anomalies ? { anomalies: deps.anomalies } : {}),
  });
  if (deps.authorizeDynamicQr) registerDynamicQrPaymentRoute(app, deps.authorizeDynamicQr, deps.merchants, deps.events);
  if (deps.mobileMoneyTopup) registerMobileMoneyWebhook(app, deps.mobileMoneyTopup);
  registerPortalRoutes(app, deps.portal, { secureCookies: deps.secureCookies, ...(deps.qrRenderer ? { qrRenderer: deps.qrRenderer } : {}) });
  if (deps.ops) registerOpsRoutes(app, deps.merchants, deps.ops);
  return app;
}
