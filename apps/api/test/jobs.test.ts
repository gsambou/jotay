import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryJobQueue } from '../src/infrastructure/jobs/memory-job-queue.js';
import { nextRetryDelayMs } from '../src/infrastructure/jobs/backoff.js';

test('jobs — enqueue idempotent puis claim/complete', async () => {
  const q = new MemoryJobQueue();
  await q.enqueue('REFUND', { walletId: 'W' }, 'k1');
  await q.enqueue('REFUND', { walletId: 'W' }, 'k1'); // doublon ignoré
  assert.equal(q.pending(), 1);
  const j = await q.claimNext('2026-08-01T00:00:00Z');
  assert.ok(j && j.kind === 'REFUND');
  await q.complete(j!.id);
  assert.equal(await q.claimNext('2026-08-01T00:00:00Z'), null);
});
test('jobs — backoff exponentiel plafonné', () => {
  assert.equal(nextRetryDelayMs(1), 1000);
  assert.equal(nextRetryDelayMs(3), 4000);
  assert.equal(nextRetryDelayMs(100), 3_600_000);
});
