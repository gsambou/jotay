/** File de jobs (payouts, remboursements, retry webhooks). L'adapter Postgres réel
 *  utilisera FOR UPDATE SKIP LOCKED ; l'adapter mémoire sert les tests. */
export interface Job { id: string; kind: string; payload: unknown; attempts: number; }
export interface JobQueue {
  enqueue(kind: string, payload: unknown, idempotencyKey: string): Promise<void>;
  claimNext(nowIso: string): Promise<Job | null>;
  complete(id: string): Promise<void>;
  fail(id: string, nextAttemptIso: string): Promise<void>;
}
