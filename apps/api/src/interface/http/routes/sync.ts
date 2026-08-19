/** Route de synchronisation (plugin Fastify). Validation zod PUIS délégation au use case. */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { IngestSyncBatch } from '../../../application/use-cases/ingest-sync-batch.js';
import type { PaymentRecord } from '@jotay/protocol';

const recordSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  eventId: z.string().min(1),
  cardUid: z.string().min(1),
  cardTxCounter: z.number().int().nonnegative(),
  terminalId: z.string().min(1),
  terminalSeq: z.number().int().nonnegative(),
  opType: z.enum(['PAYMENT', 'TOPUP', 'REVERSAL', 'ADJUSTMENT', 'ACTIVATION', 'BLOCK']),
  amountXof: z.number().int().nonnegative(),
  balanceAfter: z.number().int(),
  vendorId: z.string().optional(),
  topupChannel: z.enum(['CASH', 'WAVE', 'ORANGE_MONEY', 'CARD', 'PISPI']).optional(),
  cashierSessionId: z.string().optional(),
  tsTerminal: z.string().datetime(),
  mediumType: z.enum(['NFC', 'QR']).optional(),
  balanceAuthority: z.enum(['CHIP', 'SERVER']).optional(),
  cardTxMac: z.string().min(1).optional(),
  serverAuthId: z.string().min(1).optional(),
  terminalSig: z.string().min(1),
}).refine(
  // Le lot de sync HORS LIGNE ne transporte QUE des opérations d'autorité puce (chap. 18.5).
  (r) => (r.balanceAuthority ?? 'CHIP') === 'CHIP',
  { message: 'un enregistrement QR/SERVER ne peut pas transiter par /sync/batches' },
);

const batchSchema = z.object({
  batchId: z.string().uuid(),
  knownBlocklistVersion: z.number().int().nonnegative(),
  records: z.array(recordSchema).max(1000),
});

export function registerSyncRoute(app: FastifyInstance, useCase: IngestSyncBatch): void {
  app.post('/sync/batches', async (req, reply) => {
    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation', issues: parsed.error.issues });
    const result = await useCase.execute({
      batchId: parsed.data.batchId,
      knownBlocklistVersion: parsed.data.knownBlocklistVersion,
      records: parsed.data.records as PaymentRecord[],
    });
    if (!result.ok) return reply.code(422).send({ error: result.error.kind });
    return reply.code(200).send(result.value);
  });
}
