import type { Anomaly } from '@jotay/ledger-core';

/** Où atterrissent les anomalies (quarantaine + alerte). Jamais d'écrasement silencieux. */
export interface AnomalySink {
  report(anomalies: readonly Anomaly[], batchId: string, atIso: string): Promise<void>;
}
