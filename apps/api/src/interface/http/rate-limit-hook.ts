/** Hook Fastify de limitation de débit par IP+route, adossé au moteur pur checkRate. */
import type { FastifyInstance } from 'fastify';
import { checkRate } from '@jotay/ledger-core';
import type { RateLimitStore } from '../../application/ports/rate-limit-store.js';

export interface RateRule { limit: number; windowMs: number; }

export function registerRateLimit(
  app: FastifyInstance, store: RateLimitStore, rules: Record<string, RateRule>, nowMs: () => number = Date.now,
): void {
  app.addHook('onRequest', async (req, reply) => {
    const rule = rules[req.url.split('?')[0]!];
    if (!rule) return;
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;
    const key = `${req.method}:${req.url.split('?')[0]}:${ip}`;
    const decision = checkRate(await store.get(key), nowMs(), rule.limit, rule.windowMs);
    await store.set(key, decision.state);
    if (!decision.allowed) {
      reply.header('retry-after', Math.ceil(decision.retryAfterMs / 1000));
      return reply.code(429).send({ error: 'rate_limited' });
    }
  });
}
