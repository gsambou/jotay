/** Exige Idempotency-Key sur les POST mutateurs (règle 20-api). */
import type { FastifyInstance } from 'fastify';

const MUTATORS = [
  '/sync/batches',
  '/payments/qr/authorize',
  '/payments/qr/authorize-dynamic',
  '/portal/refund-request',
  '/wallets/load-chip',
  '/supports/qr',
  '/adjustments',
  '/events',
];

export function registerIdempotencyKey(app: FastifyInstance): void {
  app.addHook('onRequest', async (req, reply) => {
    if (req.method !== 'POST') return;
    const path = req.url.split('?')[0] ?? '';
    const needs = MUTATORS.some((p) => path === p || path.startsWith(`${p}/`));
    if (!needs) return;
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length < 8) {
      return reply.code(400).send({ error: 'idempotency_key_required' });
    }
  });
}
