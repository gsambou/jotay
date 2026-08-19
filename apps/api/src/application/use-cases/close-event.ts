/** Orchestration clôture : rejeu des records CHIP de l'événement. SPEC-F7. */
import { ok, type Result } from '@jotay/shared';
import { closeEvent, type CloseReport, type VendorCommission } from '@jotay/ledger-core';
import type { LedgerEventStore } from '../ports/ledger-event-store.js';

export interface CloseEventInput { eventId: string; commissions: readonly VendorCommission[]; }
export class CloseEvent {
  constructor(private readonly store: LedgerEventStore) {}
  async execute(input: CloseEventInput): Promise<Result<CloseReport, never>> {
    const records = await this.store.readEvent(input.eventId);
    return ok(closeEvent(records, input.commissions));
  }
}
