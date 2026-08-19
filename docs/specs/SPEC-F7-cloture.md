# SPEC-F7 — Clôture d’événement et settlement vendeurs

- **Statut** : validée (cible) — moteur CHIP fait ; SERVER et ventes QR **non conformes**
- **Chapitre(s) de référence** : SPEC-JOTAY.md § F7, 6.7 ; [SPEC-poches-et-transfert.md](./SPEC-poches-et-transfert.md) ; [SPEC-F2-rechargement.md](./SPEC-F2-rechargement.md) ; [SPEC-QR-paiement.md](./SPEC-QR-paiement.md) ; [SPEC-F5-remboursement.md](./SPEC-F5-remboursement.md)
- **Capacité** : `settlement-close`
- **Change OpenSpec** : n/a

> On ne **force** jamais une réconciliation. Écart = investigation. Cycle : `GUIDE-FEATURE.md`.

## Comportement nominal

1. Tous les terminaux ont sync (aucune file locale, aucun terminal muet au-delà du seuil ops).
2. Le moteur de clôture agrège **les deux poches** et **tous les canaux** (cash, Wave/OM, tap, QR).
3. Invariant bloquant (au FCFA près) **et** zéro anomalie ouverte :

```
Σ recharges_externes = Σ dépenses + Σ soldes_restants

où
  recharges_externes = TOPUP CASH (CHIP) + TOPUP Wave/OM (SERVER)
                       + autres inflows externes
                       − hors TRANSFER / chargement puce

  dépenses           = PAYMENT CHIP + PAYMENT QR SERVER
                       − REVERSAL (fenêtre F4)

  soldes_restants    = Σ CHIP (rejeu) + Σ SERVER
```

4. `liability:wallets` (livre) = `soldes_restants`. `recordToEntry` et les faits SERVER doivent coller.
5. Si `reconciled=true` : settlement par vendeur `brut − commission = net` (`computeSettlement`, arrondi **inférieur** sur la commission, bps par vendeur). Relevés. Pont [SPEC-F5](./SPEC-F5-remboursement.md).
6. Si `reconciled=false` : clôture **refusée**. Runbook écart. Aucun payout vendeur ni participant.

### Écart actuel du code (`close.ts`)

```
if (balanceAuthority === 'SERVER') continue;   // ignore Wave et QR
totalToppedUp / totalSpent = records CHIP only
```

Les golden `balanced` testent `liability:wallets == Σ soldes puces`. **Non conforme** à cette spec. Corriger le moteur + une PR dédiée de fixtures (règle 40) — pas un « petit fix » silencieux.

## Cas dégradés

| Cas | Comportement |
|---|---|
| Terminal muet / `COUNTER_GAP` | `reconciled=false`, `anomalyKinds` inclut le trou |
| `CLONE_SUSPECTED` / `BALANCE_CHAIN_BROKEN` / `BAD_SIGNATURE` | idem |
| `TRANSFER_UNMATCHED` (load CHIP sans fait SERVER) | idem |
| Caisse en écart (F2) | n’empêche pas à elle seule le tripartite **si** le ledger cash_drawer est cohérent ; l’écart espèces est un signal ops parallèle |
| Commission bps invalide | erreur de programmation (`TypeError`), pas un arrondi inventé |
| Relance clôture après sync tardive | le trou se referme ; `reconciled` peut passer à true. Idempotence du pont F5 |
| Forcer la clôture « pour payer les vendeurs » | **interdit** |

## Règles chiffrées (plafonds, fenêtres, arrondis)

- Tolérance : **0 FCFA**.
- Commission : entier `commissionBps` ∈ [0, 10 000] ; `fee = floor(gross × bps / 10_000)` ; `net = gross − fee`. Défaut commercial 2–3 % (200–300 bps) — **par contrat organisateur**, pas une constante magique dans le moteur.
- Seuil « terminal muet » : `TODO(question)` (le chap. F8 dit « > X min ») — ne pas inventer ; en v1 clôture : **tous** les devices provisionnés ont un `last_sync` postérieur à `ends_at` (ou exemption superviseur **auditée**).

## Exemples entrée → sortie (deviendront des golden fixtures)

**F7-1 — CHIP seul (déjà proche).** TOPUP CASH 10 000, PAYMENT 4 500, reste 5 500 → `discrepancy=0`, `reconciled=true`. Comme `001` + `closeEvent`.

**F7-2 — deux poches.** Wave SERVER 8 000, load 8 000, tap 3 000, QR 0. Recharges externes 8 000, dépenses 3 000, restant CHIP 5 000 + SERVER 0 → 0. Les 8 000 de load **ne** sont **pas** une recharge.

**F7-3 — QR.** SERVER top-up 5 000, QR 2 000 chez V1, reste SERVER 3 000. `vendorGross.V1` inclut 2 000. Aujourd’hui `closeEvent` donnerait recharge 0, dépense 0 — **fixture qui doit échouer avant correctif**.

**F7-4 — clone.** Deux PAYMENT même compteur, contenus différents → `reconciled=false` (test `close.test.ts` déjà).

**F7-5 — settlement.** V1 gross 10 000, 200 bps → fee 200, net 9 800.

## Impacts ledger

Settlement V (après réconciliation seulement) :

```
debit  liability:vendor_payable:V   gross
credit asset:float_partner          net
credit revenue:fees                 fee
```

Pas d’écriture settlement si `reconciled=false`.

## Ports et surfaces

| Surface | État |
|---|---|
| `closeEvent`, `computeSettlement` | faits, **périmètre CHIP** |
| `PayoutRemainingBalances` | fait (liste fournie par l’appelant) |
| Route / job « clôturer l’événement » | **absente** |
| Faits SERVER append-only + `vendorGross` QR | **absents** |
| Relevés CSV/PDF | spécifiés, non faits |

## Tests

- Unitaire : `close.test.ts`, `settlement.test.ts` (faits, à étendre F7-2, F7-3).
- Intégration : pont F5 après close ok / refusé si non reconciled.
- E2E HTTP : N/A tant que pas de route ; puis une clôture + refus d’écart.
- `pnpm sim` : barrière — le sim est aujourd’hui CHIP-only ; l’étendre quand les faits SERVER existent.
- Fixtures `expected` actuelles : **ne pas les modifier** dans la même PR que le changement métier two-pocket (PR dédiée, règle 40).

## Runbook

`docs/runbooks/cloture-evenement.md` + `ecart-reconciliation.md`. Aucun ajustement sans motif + audit (F4 / superviseur).

## Questions ouvertes

- TODO(question) : seuil / exemption « terminal muet » signée par qui.
- TODO(question) : format du relevé vendeur (CSV d’abord, PDF plus tard — ne pas ajouter de dépendance PDF sans ADR).
- Exemption de device perdu : déjà un cas `lost-terminal` côté replay ; la clôture attend le lot ou constate un trou — pas de solde inventé.
