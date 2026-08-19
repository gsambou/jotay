import type { WindowState } from '@jotay/ledger-core';
export interface RateLimitStore {
  get(key: string): Promise<WindowState | null>;
  set(key: string, state: WindowState): Promise<void>;
}
