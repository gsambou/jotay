/**
 * Clôture d'événement (SPEC chap. 7, F7) — PUR. Calcule le rapprochement tripartite et
 * les règlements vendeurs. `reconciled=false` DOIT bloquer la clôture (échec honnête) :
 * on n'émet jamais de payout sur un événement qui ne tombe pas juste au FCFA près.
 */
import type { PaymentRecord } from '@jotay/protocol';
import { runScenario } from './scenario.js';
import { computeSettlement } from './settlement.js';
import { xof } from './money.js';

export interface VendorCommission { vendorId: string; commissionBps: number; }
export interface VendorSettlement { vendorId: string; gross: number; fee: number; net: number; }

export interface CloseReport {
  totalToppedUp: number;
  totalSpent: number;
  totalRemaining: number;
  /** Σ recharges - (Σ dépenses + Σ soldes restants) ; 0 si équilibré. */
  discrepancy: number;
  reconciled: boolean;
  anomalyKinds: string[];
  settlements: VendorSettlement[];
}

export function closeEvent(records: readonly PaymentRecord[], commissions: readonly VendorCommission[]): CloseReport {
  const scenario = runScenario(records);

  let totalToppedUp = 0, totalSpent = 0;
  for (const r of records) {
    if (r.balanceAuthority === 'SERVER') continue; // hors périmètre puce
    if (r.opType === 'TOPUP') totalToppedUp += r.amountXof;
    else if (r.opType === 'PAYMENT') totalSpent += r.amountXof;
    else if (r.opType === 'REVERSAL') totalSpent -= r.amountXof;
  }
  const totalRemaining = Object.values(scenario.balances).reduce((s, b) => s + b, 0);
  const discrepancy = totalToppedUp - (totalSpent + totalRemaining);

  const bps = new Map(commissions.map((c) => [c.vendorId, c.commissionBps]));
  const settlements: VendorSettlement[] = Object.entries(scenario.vendorGross).map(([vendorId, gross]) => {
    const s = computeSettlement(xof(gross), bps.get(vendorId) ?? 0);
    return { vendorId, gross: s.gross, fee: s.fee, net: s.net };
  });

  const reconciled = discrepancy === 0 && scenario.ledger.balanced && scenario.anomalies.length === 0;
  return {
    totalToppedUp, totalSpent, totalRemaining, discrepancy, reconciled,
    anomalyKinds: scenario.anomalies.map((a) => a.kind), settlements,
  };
}
