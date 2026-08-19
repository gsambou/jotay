/** Webhook recharge Mobile Money (plugin Fastify). La signature vient d'un en-tête opérateur ;
 *  le corps BRUT est requis pour la vérification de signature. */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { HandleMobileMoneyTopup } from '../../../application/use-cases/handle-mobile-money-topup.js';

const schema = z.object({ provider: z.enum(['WAVE', 'ORANGE_MONEY']), providerRef: z.string().min(1), opaqueId: z.string().min(1) });

export function registerMobileMoneyWebhook(app: FastifyInstance, useCase: HandleMobileMoneyTopup): void {
  app.post('/webhooks/mobile-money', async (req, reply) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation' });
    const signature = (req.headers['x-mm-signature'] as string | undefined) ?? '';
    const res = await useCase.execute({ ...parsed.data, rawBody: JSON.stringify(req.body), signature });
    if (res.ok) return reply.code(200).send(res.value);
    switch (res.error.kind) {
      case 'BAD_WEBHOOK_SIGNATURE': return reply.code(401).send({ error: 'bad_signature' });
      case 'NOT_CONFIRMED':         return reply.code(409).send({ error: 'not_confirmed' });
      case 'WALLET_UNKNOWN':        return reply.code(404).send({ error: 'wallet_unknown' });
    }
  });
}
