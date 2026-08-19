import type { Job, JobQueue } from '../../application/ports/job-queue.js';
/** File en mémoire, idempotente par clé. Pour tests et mono-instance de dev. */
export class MemoryJobQueue implements JobQueue {
  private jobs: (Job & { readyAtIso: string; done: boolean })[] = [];
  private seen = new Set<string>();
  private n = 0;
  async enqueue(kind: string, payload: unknown, idempotencyKey: string) {
    if (this.seen.has(idempotencyKey)) return; // idempotence
    this.seen.add(idempotencyKey);
    this.jobs.push({ id: `job-${++this.n}`, kind, payload, attempts: 0, readyAtIso: '1970-01-01T00:00:00Z', done: false });
  }
  async claimNext(nowIso: string) {
    const j = this.jobs.find((x) => !x.done && x.readyAtIso <= nowIso);
    if (!j) return null; j.attempts++; return { id: j.id, kind: j.kind, payload: j.payload, attempts: j.attempts };
  }
  async complete(id: string) { const j = this.jobs.find((x) => x.id === id); if (j) j.done = true; }
  async fail(id: string, nextAttemptIso: string) { const j = this.jobs.find((x) => x.id === id); if (j) j.readyAtIso = nextAttemptIso; }
  pending() { return this.jobs.filter((x) => !x.done).length; }
}
