/**
 * Simulateur d'événement (chap. 14/40-tests) — génère une charge réaliste de records
 * PUCE (autorité CHIP), calcule la vérité-terrain, et modélise le réseau (ordre de sync
 * mélangé, records retardés). Zéro dépendance. Sert : tests de propriété, régression, CLI.
 */
import type { PaymentRecord } from '@jotay/protocol';
import { makePrng } from './prng.js';

export interface SimConfig {
  seed: number;
  cards: number;
  vendors: number;
  cashierSessions: number;
  maxOpsPerCard: number;
}

export interface SimResult {
  records: PaymentRecord[];
  /** Vérité-terrain calculée à la génération, indépendante du moteur. */
  truth: {
    finalBalanceByCard: Record<string, number>;
    grossByVendor: Record<string, number>;
    totalToppedUp: number;
    totalSpent: number;
  };
}

/** Génère un scénario 100 % nominal (aucune anomalie) : la réconciliation doit être EXACTE. */
export function generateNominal(cfg: SimConfig): SimResult {
  const rng = makePrng(cfg.seed);
  const vendors = Array.from({ length: cfg.vendors }, (_, i) => `V${i + 1}`);
  const sessions = Array.from({ length: cfg.cashierSessions }, (_, i) => `S${i + 1}`);
  const records: PaymentRecord[] = [];
  const finalBalanceByCard: Record<string, number> = {};
  const grossByVendor: Record<string, number> = {};
  let totalToppedUp = 0, totalSpent = 0;
  let terminalSeq = 0;

  for (let c = 0; c < cfg.cards; c++) {
    const cardUid = `CARD-${c}`;
    let counter = 0;
    let balance = 0;
    // ACTIVATION
    records.push(rec({ cardUid, counter: ++counter, opType: 'ACTIVATION', amount: 0, balanceAfter: balance, terminalId: 'T-ENR', terminalSeq: ++terminalSeq }));
    // 1..N opérations
    const ops = rng.int(2, cfg.maxOpsPerCard);
    for (let o = 0; o < ops; o++) {
      const canPay = balance >= 100;
      const doTopup = !canPay || rng.next() < 0.35;
      if (doTopup) {
        const amount = rng.int(1, 40) * 500; // 500..20000
        balance += amount; totalToppedUp += amount;
        const session = rng.pick(sessions);
        records.push(rec({ cardUid, counter: ++counter, opType: 'TOPUP', topupChannel: 'CASH', cashierSessionId: session, amount, balanceAfter: balance, terminalId: `T-${session}`, terminalSeq: ++terminalSeq }));
      } else {
        const amount = Math.min(balance, rng.int(1, Math.max(1, Math.floor(balance / 100))) * 100);
        if (amount <= 0) continue;
        balance -= amount; totalSpent += amount;
        const vendor = rng.pick(vendors);
        grossByVendor[vendor] = (grossByVendor[vendor] ?? 0) + amount;
        records.push(rec({ cardUid, counter: ++counter, opType: 'PAYMENT', vendorId: vendor, amount, balanceAfter: balance, terminalId: `T-${vendor}`, terminalSeq: ++terminalSeq }));
      }
    }
    finalBalanceByCard[cardUid] = balance;
  }
  return { records, truth: { finalBalanceByCard, grossByVendor, totalToppedUp, totalSpent } };
}

/** Modèle réseau : mélange l'ordre de synchronisation (le serveur doit être insensible à l'ordre). */
export function shuffleSyncOrder(records: readonly PaymentRecord[], seed: number): PaymentRecord[] {
  const rng = makePrng(seed);
  const a = [...records];
  for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

function rec(p: {
  cardUid: string; counter: number; opType: PaymentRecord['opType']; amount: number; balanceAfter: number;
  terminalId: string; terminalSeq: number; vendorId?: string; topupChannel?: PaymentRecord['topupChannel']; cashierSessionId?: string;
}): PaymentRecord {
  return {
    schemaVersion: 2, mediumType: 'NFC', balanceAuthority: 'CHIP',
    eventId: 'EVT-SIM' as never, cardUid: p.cardUid as never, cardTxCounter: p.counter,
    terminalId: p.terminalId as never, terminalSeq: p.terminalSeq, opType: p.opType,
    amountXof: p.amount, balanceAfter: p.balanceAfter,
    ...(p.vendorId ? { vendorId: p.vendorId as never } : {}),
    ...(p.topupChannel ? { topupChannel: p.topupChannel } : {}),
    ...(p.cashierSessionId ? { cashierSessionId: p.cashierSessionId } : {}),
    tsTerminal: '2026-08-01T18:00:00Z',
    cardTxMac: `mac-${p.cardUid}-${p.counter}`, terminalSig: `sig-${p.cardUid}-${p.counter}`,
  };
}
