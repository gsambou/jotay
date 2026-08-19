/**
 * Serveur e2e : une instance Fastify unique sert la PWA participant (statique) ET l'API
 * (adapters in-memory seedés). Même origine => cookies opérationnels. secureCookies=false
 * car le serveur de test tourne en http (la prod reste Secure).
 */
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../../apps/api/src/interface/http/app.js';
import { IngestSyncBatch } from '../../apps/api/src/application/use-cases/ingest-sync-batch.js';
import { AuthorizeQrPayment } from '../../apps/api/src/application/use-cases/authorize-qr-payment.js';
import { RequestPortalOtp } from '../../apps/api/src/application/use-cases/request-portal-otp.js';
import { VerifyPortalOtp } from '../../apps/api/src/application/use-cases/verify-portal-otp.js';
import { GetWalletView } from '../../apps/api/src/application/use-cases/get-wallet-view.js';
import { RequestRefund } from '../../apps/api/src/application/use-cases/request-refund.js';
import * as F from '../../apps/api/test/fakes.js';

const PUB = join(dirname(fileURLToPath(import.meta.url)), '../../apps/participant-pwa/public');
const clock = new F.FixedClock('2026-08-01T20:00:00Z');
const dir = new F.FakeWalletDirectory(); dir.bind('OPAQUE', 'W1'); dir.setPayout('W1', '+221771112233');
const wallets = new F.MemWalletBalance(); wallets.seed('W1', 3000);
const chal = new F.FakeOtpChallengeStore('654321'); const sess = new F.MemSessionStore();

const app = buildApp({
  ingest: new IngestSyncBatch(new F.MemLedgerEventStore(), new F.MemBlocklist(), new F.RecordingAnomalySink(), clock, new F.FakeSignatureVerifier()),
  authorizeQr: new AuthorizeQrPayment(dir, wallets, new F.FakePinVerifier(), clock),
  portal: {
    requestOtp: new RequestPortalOtp(dir, chal, new F.RecordingOtpChannel()),
    verifyOtp: new VerifyPortalOtp(dir, chal, sess, clock),
    wallet: new GetWalletView(sess, wallets, new F.FakeHistory(), clock),
    refund: new RequestRefund(sess, new F.FakePinVerifier(), dir, new F.RecordingRefundSink(), clock),
  },
  merchants: new F.FakeMerchantRegistry(),
  events: new F.FixedEventPaymentConfig(),
  secureCookies: false,
});

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

// Statique : tout ce qui n'est pas une route API. / et /w/* -> index.html.
app.setNotFoundHandler(async (req, reply) => {
  if (req.method !== 'GET') return reply.code(404).send({ error: 'not_found' });
  const path = new URL(req.url, 'http://x').pathname;
  const file = path === '/' || path.startsWith('/w/') ? '/index.html' : path;
  try {
    const data = await readFile(join(PUB, file));
    return reply.type(MIME[extname(file)] ?? 'application/octet-stream').send(data);
  } catch { return reply.code(404).send('not found'); }
});

app.listen({ port: 4321, host: '127.0.0.1' })
  .then(() => console.log('e2e server on http://127.0.0.1:4321'))
  .catch((e) => { console.error(e); process.exit(1); });
