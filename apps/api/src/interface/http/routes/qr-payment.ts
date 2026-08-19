/** Autorisation QR statique. Plafonds et vendorId viennent du serveur, pas du body. */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AuthorizeQrPayment } from '../../../application/use-cases/authorize-qr-payment.js';
import type { MerchantRegistry } from '../../../application/ports/merchant-registry.js';
import type { EventPaymentConfig } from '../../../application/ports/event-payment-config.js';
import type { RecentVendorSighting } from '../../../application/ports/recent-vendor-sighting.js';
import type { AnomalySink } from '../../../application/ports/anomaly-sink.js';
import { isUnauthorized, requireMerchant } from '../merchant-auth.js';

const schema = z.object({
  opaqueId: z.string().min(1),
  amountXof: z.number().int().positive(),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
  authId: z.string().uuid(),
}).strict();

export function registerQrPaymentRoute(
  app: FastifyInstance,
  useCase: AuthorizeQrPayment,
  merchants: MerchantRegistry,
  events: EventPaymentConfig,
  extras?: { sighting?: RecentVendorSighting; anomalies?: AnomalySink },
): void {
  app.post('/payments/qr/authorize', async (req, reply) => {
    const session = await requireMerchant(merchants, req);
    if (isUnauthorized(session)) return reply.code(401).send({ error: 'unauthorized' });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation', issues: parsed.error.issues });
    const limits = await events.qrLimits(session.eventId);
    const { pin, ...rest } = parsed.data;
    const res = await useCase.execute({
      ...rest, vendorId: session.vendorId, params: limits, ...(pin === undefined ? {} : { pin }),
    });
    if (res.ok) {
      if (extras?.sighting) {
        const prev = await extras.sighting.remember(rest.opaqueId, session.vendorId, new Date().toISOString(), 3_600_000);
        if (prev && extras.anomalies) {
          await extras.anomalies.report(
            [{ kind: 'MULTI_VENDOR_WINDOW', walletId: rest.opaqueId, vendorA: prev, vendorB: session.vendorId }],
            rest.authId, new Date().toISOString(),
          );
        }
      }
      return reply.code(200).send(res.value);
    }
    if (res.error.kind === 'WALLET_UNKNOWN') return reply.code(404).send({ error: 'wallet_unknown' });
    if (res.error.kind === 'BAD_PIN') return reply.code(401).send({ error: 'bad_pin' });
    return reply.code(402).send({ error: 'declined', reason: res.error.reason });
  });
}
