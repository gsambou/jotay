/** Routes superviseur : provision QR, ajustement, clôture, chargement puce, payout. */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { ProvisionQrSupport } from '../../../application/use-cases/provision-qr-support.js';
import type { RecordAdjustment } from '../../../application/use-cases/record-adjustment.js';
import type { CloseEvent } from '../../../application/use-cases/close-event.js';
import type { LoadChip } from '../../../application/use-cases/load-chip.js';
import type { PayoutRemainingBalances } from '../../../application/use-cases/payout-remaining-balances.js';
import type { MerchantRegistry } from '../../../application/ports/merchant-registry.js';
import { isUnauthorized, requireMerchant } from '../merchant-auth.js';

async function supervisor(registry: MerchantRegistry, req: Parameters<typeof requireMerchant>[1]) {
  const s = await requireMerchant(registry, req);
  if (isUnauthorized(s) || s.role !== 'supervisor') return null;
  return s;
}

export function registerOpsRoutes(
  app: FastifyInstance,
  merchants: MerchantRegistry,
  deps: {
    provision?: ProvisionQrSupport;
    adjust?: RecordAdjustment;
    close?: CloseEvent;
    loadChip?: LoadChip;
    payout?: PayoutRemainingBalances;
  },
): void {
  if (deps.provision) {
    const provision = deps.provision;
    app.post('/supports/qr', async (req, reply) => {
      if (!(await supervisor(merchants, req))) return reply.code(401).send({ error: 'unauthorized' });
      const parsed = z.object({ walletId: z.string().min(1) }).safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'validation' });
      const res = await provision.execute(parsed.data);
      if (!res.ok) return reply.code(500).send({ error: 'unexpected' });
      return reply.code(201).send(res.value);
    });
  }
  if (deps.adjust) {
    const adjust = deps.adjust;
    app.post('/adjustments', async (req, reply) => {
      const s = await supervisor(merchants, req);
      if (!s) return reply.code(401).send({ error: 'unauthorized' });
      const parsed = z.object({
        walletId: z.string().min(1), direction: z.enum(['CREDIT', 'DEBIT']),
        amountXof: z.number().int().positive(), reason: z.string().min(1), adjustmentId: z.string().uuid(),
      }).safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'validation' });
      const res = await adjust.execute({ ...parsed.data, actor: s.vendorId });
      if (!res.ok) return reply.code(500).send({ error: 'unexpected' });
      return reply.code(200).send(res.value);
    });
  }
  if (deps.close) {
    const close = deps.close;
    app.post('/events/:eventId/close', async (req, reply) => {
      if (!(await supervisor(merchants, req))) return reply.code(401).send({ error: 'unauthorized' });
      const eventId = (req.params as { eventId: string }).eventId;
      const parsed = z.object({
        commissions: z.array(z.object({
          vendorId: z.string(), commissionBps: z.number().int().nonnegative(),
        })).default([]),
      }).safeParse(req.body ?? {});
      if (!parsed.success) return reply.code(400).send({ error: 'validation' });
      const res = await close.execute({ eventId, commissions: parsed.data.commissions });
      if (!res.ok) return reply.code(500).send({ error: 'unexpected' });
      const report = res.value;
      return reply.code(report.reconciled ? 200 : 409).send(report);
    });
  }
  if (deps.payout) {
    const payout = deps.payout;
    app.post('/events/:eventId/payouts', async (req, reply) => {
      const s = await supervisor(merchants, req);
      if (!s) return reply.code(401).send({ error: 'unauthorized' });
      const eventId = (req.params as { eventId: string }).eventId;
      const parsed = z.object({
        balances: z.array(z.object({
          walletId: z.string().min(1), remainingXof: z.number().int().nonnegative(),
        })),
      }).safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'validation' });
      const res = await payout.execute({ eventId, actor: s.vendorId, balances: parsed.data.balances });
      if (!res.ok) return reply.code(500).send({ error: 'unexpected' });
      return reply.code(200).send(res.value);
    });
  }
  if (deps.loadChip) {
    const load = deps.loadChip;
    app.post('/wallets/load-chip', async (req, reply) => {
      const s = await requireMerchant(merchants, req);
      if (isUnauthorized(s)) return reply.code(401).send({ error: 'unauthorized' });
      const parsed = z.object({
        opaqueId: z.string().min(1), amountXof: z.number().int().positive(),
        loadId: z.string().uuid(), rollback: z.boolean().optional(),
      }).safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'validation' });
      const { rollback, ...input } = parsed.data;
      const res = rollback ? await load.rollback(input) : await load.execute(input);
      if (!res.ok) {
        const map = { WALLET_UNKNOWN: 404, INSUFFICIENT: 402, FROZEN: 402, AMOUNT_INVALID: 400 } as const;
        return reply.code(map[res.error.kind]).send({ error: res.error.kind.toLowerCase() });
      }
      return reply.code(200).send(res.value);
    });
  }
}
