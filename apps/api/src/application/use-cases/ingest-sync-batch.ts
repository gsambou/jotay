/**
 * Use case : ingestion d'un batch de synchronisation terminal — cf. SPEC chap. 6.6.
 * SRP : ce fichier ne fait QUE l'ingestion. La vérification des signatures est faite
 * en amont (interface) via un vérificateur injecté ; la clôture d'événement est un
 * autre use case.
 */
import { err, ok, type Result } from '@jotay/shared';
import type { PaymentRecord } from '@jotay/protocol';
import { replayCard } from '@jotay/ledger-core';
import type { Clock } from '../ports/clock.js';
import type { LedgerEventStore } from '../ports/ledger-event-store.js';
import type { BlocklistRepository } from '../ports/blocklist-repository.js';
import type { AnomalySink } from '../ports/anomaly-sink.js';
import type { SignatureVerifier } from '../ports/signature-verifier.js';

export interface IngestSyncBatchInput {
  batchId: string;
  records: PaymentRecord[];
  knownBlocklistVersion: number;
}

export interface IngestSyncBatchOutput {
  inserted: number;
  duplicates: number;
  anomalies: number;
  blocklistDelta: { version: number; addedCardUids: string[] };
}

export type IngestError = { kind: 'EMPTY_BATCH' };

export class IngestSyncBatch {
  constructor(
    private readonly store: LedgerEventStore,
    private readonly blocklist: BlocklistRepository,
    private readonly anomalies: AnomalySink,
    private readonly clock: Clock,
    private readonly signatures: SignatureVerifier,
  ) {}

  async execute(input: IngestSyncBatchInput): Promise<Result<IngestSyncBatchOutput, IngestError>> {
    if (input.records.length === 0) return err({ kind: 'EMPTY_BATCH' });
    const now = this.clock.nowIso();

    // Vérification des signatures AVANT tout stockage : un record dont la signature
    // terminal ne valide pas (forgé, ou terminal révoqué) est écarté et signalé,
    // jamais ingéré. CRITICAL-PATH.
    const verified: typeof input.records[number][] = [];
    let anomalyCount = 0;
    for (const r of input.records) {
      if (await this.signatures.verify(r)) { verified.push(r); continue; }
      anomalyCount++;
      await this.anomalies.report(
        [{ kind: 'BAD_SIGNATURE', cardUid: r.cardUid, counter: r.cardTxCounter, terminalId: r.terminalId }],
        input.batchId, now,
      );
    }

    const { inserted, duplicates } = await this.store.append(verified, input.batchId, now);

    // Rejeu par carte sur l'historique complet (moteur pur) pour détecter les anomalies.
    const touched = [...new Set(verified.map((r) => r.cardUid))];
    for (const cardUid of touched) {
      const stored = await this.store.readCard(cardUid);
      // On rejoue l'historique stocké UNION les records entrants (sans redéduplication).
      // Le store a pu écarter un doublon DIVERGENT (même compteur, contenu différent) à
      // l'insertion ; sans le réintroduire ici, le clonage passerait inaperçu. replayCard
      // absorbe les doublons stricts et signale les divergents (CLONE_SUSPECTED).
      const incoming = verified.filter((r) => r.cardUid === cardUid);
      const replay = replayCard([...stored, ...incoming]);
      if (replay.anomalies.length > 0) {
        anomalyCount += replay.anomalies.length;
        await this.anomalies.report(replay.anomalies, input.batchId, now);
      }
      if (replay.blockCard) {
        await this.blocklist.add(cardUid, 'CLONE_SUSPECTED', now); // CRITICAL-PATH
      }
    }

    const blocklistDelta = await this.blocklist.deltaSince(input.knownBlocklistVersion);
    return ok({ inserted, duplicates, anomalies: anomalyCount, blocklistDelta });
  }
}
