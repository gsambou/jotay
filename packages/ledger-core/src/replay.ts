/**
 * Rejeu des transactions d'une carte, ordonné par compteur — cf. SPEC chap. 6.6.
 * Détecte : doublons stricts (dédupliqués), doublons divergents (clonage présumé),
 * trous de compteur, chaînes de solde incohérentes, soldes négatifs.
 * Pur : aucune I/O ; l'appelant fournit les records déjà lus.
 */
import type { PaymentRecord } from '@jotay/protocol';

export type Anomaly =
  | { kind: 'CLONE_SUSPECTED'; cardUid: string; counter: number }
  | { kind: 'COUNTER_GAP'; cardUid: string; expected: number; got: number }
  | { kind: 'BALANCE_CHAIN_BROKEN'; cardUid: string; counter: number; expected: number; got: number }
  | { kind: 'NEGATIVE_BALANCE'; cardUid: string; counter: number }
  | { kind: 'BAD_SIGNATURE'; cardUid: string; counter: number; terminalId: string }
  | { kind: 'MULTI_VENDOR_WINDOW'; walletId: string; vendorA: string; vendorB: string };

export interface CardReplayOutput {
  /** Records valides, dédupliqués, ordonnés — seuls eux alimentent le ledger. */
  accepted: PaymentRecord[];
  /** Records écartés (quarantaine) avec l'anomalie associée. */
  quarantined: { record: PaymentRecord; anomaly: Anomaly }[];
  anomalies: Anomaly[];
  /** Solde final reconstruit à partir des records acceptés (null si aucun record). */
  finalBalance: number | null;
  /** true si la carte doit être mise en blocklist (clonage présumé). */
  blockCard: boolean;
}

const stableKey = (r: PaymentRecord) =>
  `${r.opType}|${r.amountXof}|${r.balanceAfter}|${r.vendorId ?? ''}|${r.topupChannel ?? ''}|${r.cardTxMac}`;

export function replayCard(records: readonly PaymentRecord[]): CardReplayOutput {
  const out: CardReplayOutput = { accepted: [], quarantined: [], anomalies: [], finalBalance: null, blockCard: false };
  if (records.length === 0) return out;

  // Groupement par compteur pour traiter doublons stricts vs divergents.
  const byCounter = new Map<number, PaymentRecord[]>();
  for (const r of records) {
    const list = byCounter.get(r.cardTxCounter) ?? [];
    list.push(r);
    byCounter.set(r.cardTxCounter, list);
  }

  const counters = [...byCounter.keys()].sort((a, b) => a - b);
  let running: number | null = null;
  let prevCounter: number | null = null;

  for (const c of counters) {
    const group = byCounter.get(c)!;
    const uid = group[0]!.cardUid;
    const distinct = new Set(group.map(stableKey));

    if (distinct.size > 1) {
      // Même compteur, contenus différents → clonage présumé : tout le groupe en quarantaine.
      const anomaly: Anomaly = { kind: 'CLONE_SUSPECTED', cardUid: uid, counter: c };
      out.anomalies.push(anomaly);
      out.blockCard = true;
      for (const r of group) out.quarantined.push({ record: r, anomaly });
      continue;
    }
    const r = group[0]!; // doublons stricts dédupliqués silencieusement (idempotence)

    if (prevCounter !== null && c !== prevCounter + 1) {
      // Trou : transaction pas encore synchronisée. Non bloquant, mais tracé —
      // la clôture d'événement exigera zéro trou.
      out.anomalies.push({ kind: 'COUNTER_GAP', cardUid: uid, expected: prevCounter + 1, got: c });
      // Ré-ancrage : la transaction manquante n'est pas encore synchronisée, le solde
      // de ce record devient la nouvelle référence. Le trou bloque la clôture d'événement.
      running = null;
    }

    if (r.balanceAfter < 0) {
      const anomaly: Anomaly = { kind: 'NEGATIVE_BALANCE', cardUid: uid, counter: c };
      out.anomalies.push(anomaly);
      out.quarantined.push({ record: r, anomaly });
      prevCounter = c;
      continue;
    }

    if (running !== null) {
      const base: number = running;
      const expected: number =
        r.opType === 'PAYMENT' ? base - r.amountXof
        : r.opType === 'TOPUP' || r.opType === 'REVERSAL' || r.opType === 'ADJUSTMENT' ? base + r.amountXof
        : base; // ACTIVATION/BLOCK : neutre
      if (expected !== r.balanceAfter) {
        const anomaly: Anomaly = { kind: 'BALANCE_CHAIN_BROKEN', cardUid: uid, counter: c, expected, got: r.balanceAfter };
        out.anomalies.push(anomaly);
        out.quarantined.push({ record: r, anomaly });
        prevCounter = c;
        continue;
      }
    }

    out.accepted.push(r);
    running = r.balanceAfter;
    prevCounter = c;
  }

  out.finalBalance = running;
  return out;
}
