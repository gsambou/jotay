# SPEC-F5 — Remboursement post-événement

- **Statut** : validée (cible) — demande portail + file existent ; payout opérateur stub
- **Chapitre(s) de référence** : SPEC-JOTAY.md § F5, 3.3 ; [SPEC-poches-et-transfert.md](./SPEC-poches-et-transfert.md) ; [SPEC-F7-cloture.md](./SPEC-F7-cloture.md)
- **Capacité** : `settlement-close` (payouts) + `participant-portal`
- **Change OpenSpec** : n/a

> Frais participant = **0**. Le breakage n’est pas un revenu. Cycle : `GUIDE-FEATURE.md`.

## Comportement nominal

Deux déclencheurs, **même poche SERVER** aujourd’hui (voir limites) :

1. **Demande participante** (pendant ou après) : `RequestRefund` — session + PIN + MSISDN vérifié → job idempotent.
2. **Pont clôture** : après F7 `reconciled=true`, `PayoutRemainingBalances` parcourt les soldes restants → un job `PAYOUT` par `(eventId, walletId)` si MSISDN vérifié ; sinon skip **audité**.

Exécution du job (cible, adapter `MobileMoneyGateway` payout — **absent**) : payout Wave/OM vers le MSISDN vérifié, statut `QUEUED → SENT | FAILED` (table `payouts` 0005). Retry via la file (backoff). Pas de double payout : unique `(event_id, wallet_id)`.

Guichet espèces pendant l’événement : **hors code actuel**. Cible : même discipline que le cash drawer (F2), débit CHIP ou SERVER selon la poche vidée, runbook dédié. Non livrable avant terminal.

## Cas dégradés

| Cas | Comportement |
|---|---|
| Pas de MSISDN vérifié | Pas de job. Audit `PAYOUT_SKIPPED_NO_VERIFIED_MSISDN`. L’argent reste en `liability:wallets` — **pas** de perte silencieuse |
| Clôture non réconciliée | Interdit d’appeler le pont payout (F7) |
| Job rejoué | Idempotence `payout:{eventId}:{walletId}` |
| Payout opérateur échoué | `FAILED`, retry ; jamais un second montant différent |
| Demande portail **et** pont clôture | Une seule ligne `payouts` ; la seconde enqueue est un no-op |
| Solde restant 0 | Skip sans audit bruyant |
| Rembourser la poche CHIP non synchronisée | **Interdit** : on ne rembourse que ce que le serveur justifie. CHIP hors-sync = attendre sync ou F6 (opposition) |

## Règles chiffrées (plafonds, fenêtres, arrondis)

- Fenêtre auto après clôture : **72 h** (SPEC-JOTAY). Le pont peut être lancé dès réconciliation ; le SLA 72 h est opérationnel.
- Fenêtre guichet : `TODO(question)` « X jours » du chap. F5 — ne pas inventer (ex. 14 jours = exemple produit, pas figé).
- Montant = solde **SERVER justifié** + soldes CHIP **déjà synchronisés** et encore en `liability:wallets` après close. Un wallet = une ligne, somme des poches restantes **connues**.
- Frais : 0 pour le participant. Coût opérateur → `expense:refunds_costs` si un jour mesuré, pas aujourd’hui.

**Limite du code actuel** : `PayoutRemainingBalances` reçoit une liste `remainingXof` déjà calculée — souvent le seul SERVER. Cible : l’appelant (F7) fournit **CHIP sync + SERVER** par wallet, sans double compte (un load-chip déjà fait n’apparaît que côté CHIP).

## Exemples entrée → sortie

**F5-1.** SERVER 2 500, CHIP sync 0, MSISDN vérifié → 1 job 2 500, `enqueued=1`.  
**F5-2.** SERVER 1 000, pas de MSISDN → `skippedNoPayout=1`, audit, 0 job.  
**F5-3.** Rejeu pont → `enqueued` métier 0 effet net (unique key).  
**F5-4.** CHIP 4 000 sync + SERVER 0 → job 4 000 **seulement si** F7 agrège les deux poches (aujourd’hui non).

## Impacts ledger

```
REFUND X : debit liability:wallets  X | credit asset:float_partner  X
```

Passer en `SENT` seulement après confirmation opérateur (même esprit que l’active check F2). `QUEUED` n’écrit pas encore cette ligne — ou écrit une provision ; à trancher à l’implémentation de l’adapter, **sans** diminuer `liability` avant l’envoi confirmé.

## Ports et surfaces

| Surface | État |
|---|---|
| `RequestRefund`, `PayoutRemainingBalances` | faits |
| `RefundRequestSink`, `JobQueue`, `MobileMoneyGateway` payout | stubs / mémoire |
| Table `payouts` | 0005 |
| Guichet cash refund | absent |

## Tests

- Intégration : skip sans MSISDN + enqueue idempotent (existe).
- E2E payout opérateur : N/A jusqu’à fake gateway payout.
- Régression : ne jamais payer deux fois le même `(event, wallet)`.

## Runbook

`docs/runbooks/cloture-evenement.md` étape 4–5. Soldes sans MSISDN : liste d’exception, relance humaine, pas d’écriture manuelle de solde.

## Questions ouvertes

- TODO(question) : API payout Wave/OM réelle (idempotence côté opérateur).
- TODO(question) : durée de la fenêtre guichet.
- TODO(question) : un refund portail **avant** clôture débite-t-il tout de suite le SERVER (oui, cible) ou attend-il F7 (non — la confiance exige le geste à la demande) ?
