/**
 * Exécution d'un scénario complet (pipeline pur) — c'est la fonction que les
 * golden fixtures exercent : records bruts → rejeu par carte → écritures →
 * projections + invariants.
 */
import type { PaymentRecord } from '@jotay/protocol';
import { accountNet, type JournalEntry } from './entry.js';
import { recordToEntry } from './posting-rules.js';
import { replayCard, type Anomaly } from './replay.js';
import { normalizeRecord } from './normalize.js';

export interface ScenarioOutput {
  balances: Record<string, number>;
  vendorGross: Record<string, number>;
  anomalies: Anomaly[];
  blockedCards: string[];
  ledger: {
    liabilityWallets: number;
    balanced: boolean;
  };
}

export function runScenario(records: readonly PaymentRecord[]): ScenarioOutput {
  // runScenario est le moteur de RÉCONCILIATION HORS LIGNE (autorité puce). Les
  // paiements QR (autorité serveur) sont autorisés en ligne, un par un, et ne
  // transitent JAMAIS par ce lot : les recevoir ici est une erreur de programmation.
  const byCard = new Map<string, PaymentRecord[]>();
  for (const raw of records) {
    const r = normalizeRecord(raw);
    if (r.balanceAuthority === 'SERVER') {
      throw new Error(`runScenario: enregistrement QR/SERVER hors périmètre (${r.cardUid}#${r.cardTxCounter})`);
    }
    const list = byCard.get(r.cardUid) ?? [];
    list.push(r);
    byCard.set(r.cardUid, list);
  }

  const balances: Record<string, number> = {};
  const vendorGross: Record<string, number> = {};
  const anomalies: Anomaly[] = [];
  const blockedCards: string[] = [];
  const entries: JournalEntry[] = [];

  for (const [uid, cardRecords] of byCard) {
    const replay = replayCard(cardRecords);
    anomalies.push(...replay.anomalies);
    if (replay.blockCard) blockedCards.push(uid);
    if (replay.finalBalance !== null) balances[uid] = replay.finalBalance;

    for (const r of replay.accepted) {
      const res = recordToEntry(r);
      if (!res.ok) throw new Error(`posting failed: ${JSON.stringify(res.error)}`); // bug, pas cas métier
      if (res.value) entries.push(res.value);
      if (r.opType === 'PAYMENT' && r.vendorId) {
        vendorGross[r.vendorId] = (vendorGross[r.vendorId] ?? 0) + r.amountXof;
      }
      if (r.opType === 'REVERSAL' && r.vendorId) {
        vendorGross[r.vendorId] = (vendorGross[r.vendorId] ?? 0) - r.amountXof;
      }
    }
  }

  const liabilityWallets = accountNet(entries, 'liability:wallets');
  const sumBalances = Object.values(balances).reduce((s, b) => s + b, 0);

  return {
    balances,
    vendorGross,
    anomalies,
    blockedCards,
    ledger: {
      liabilityWallets,
      // Invariant central : la dette "wallets" du ledger égale la somme des soldes puces reconstruits.
      balanced: liabilityWallets === sumBalances,
    },
  };
}
