import type { WindowState } from '@jotay/ledger-core';
import type { RateLimitStore } from '../application/ports/rate-limit-store.js';
/** Store en mémoire (mono-instance). Multi-instance -> adapter Redis via le même port. */
export class MemoryRateLimitStore implements RateLimitStore {
  private m = new Map<string, WindowState>();
  async get(key: string) { return this.m.get(key) ?? null; }
  async set(key: string, state: WindowState) { this.m.set(key, state); }
}
