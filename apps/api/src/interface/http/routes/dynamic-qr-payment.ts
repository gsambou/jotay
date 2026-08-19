/** Autorisation QR dynamique — mêmes gardes marchand / plafonds serveur que le statique. */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { AuthorizeDynamicQrPayment } from '../../../application/use-cases/authorize-dynamic-qr-payment.js';
import type { MerchantRegistry } from '../../../application/ports/merchant-registry.js';
import type { EventPaymentConfig } from '../../../application/ports/event-payment-config.js';
import { isUnauthorized, requireMerchant } from '../merchant-auth.js';

const schema = z.object({
  opaqueId: z.string().min(1),
  totpCode: z.string().regex(/^\d{6,8}$/),
  amountXof: z.number().int().positive(),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
  authId: z.string().uuid(),
}).strict();

export function registerDynamicQrPaymentRoute(
  app: FastifyInstance,
  useCase: AuthorizeDynamicQrPayment,
  merchants: MerchantRegistry,
  events: EventPaymentConfig,
): void {
  app.post('/payments/qr/authorize-dynamic', async (req, reply) => {
    const session = await requireMerchant(merchants, req);
    if (isUnauthorized(session)) return reply.code(401).send({ error: 'unauthorized' });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation', issues: parsed.error.issues });
    const limits = await events.qrLimits(session.eventId);
    const { pin, ...rest } = parsed.data;
    const res = await useCase.execute({
      ...rest, vendorId: session.vendorId, params: limits, ...(pin === undefined ? {} : { pin }),
    });
    if (res.ok) return reply.code(200).send(res.value);
    switch (res.error.kind) {
      case 'WALLET_UNKNOWN': return reply.code(404).send({ error: 'wallet_unknown' });
      case 'BAD_TOTP': return reply.code(402).send({ error: 'declined', reason: 'bad_totp' });
      case 'REPLAY': return reply.code(409).send({ error: 'replay' });
      case 'BAD_PIN': return reply.code(401).send({ error: 'bad_pin' });
      case 'DECLINED': return reply.code(402).send({ error: 'declined', reason: res.error.reason });
    }
  });
}
