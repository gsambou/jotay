# SPEC-poches-et-transfert — Cloisonnement CHIP / SERVER et chargement puce

- **Statut** : validée (cible Phase 0/1)
- **Chapitre(s) de référence** : SPEC-JOTAY.md § 16.3, 18.2–18.4, 6.7
- **Capacité** : `poches` (nouvelle — transversale F2, QR, F5, F7, F3)
- **Change OpenSpec** : n/a (régularisation + trou non implémenté)

> Décision produit retenue ici. Toute spec d’argent (F2, QR, F5, F7) s’y réfère.
> Cycle : `docs/architecture/GUIDE-FEATURE.md`.

## Décision retenue

Un wallet a **deux poches qui ne se recouvrent jamais**. Il n’existe pas de solde « partagé ».

| Poche | Autorité | Comment on l’alimente | Comment on la dépense |
|---|---|---|---|
| **CHIP** | la puce DESFire | top-up **cash** (caisse, offline) ; **chargement puce** (transfert depuis SERVER) | tap NFC uniquement |
| **SERVER** | l’API | top-up **Wave / OM** après active check | paiement QR uniquement |

```
  espèces (caisse) ──offline──► POCHE CHIP ──tap──► vendeur
                                      ▲
                                      │ chargement puce
                                      │ (terminal CONNECTÉ + tap)
                                      │
  Wave / OM ──webhook+check──► POCHE SERVER ──QR──► vendeur
```

**Rejetées**

- **A pure** (Wave reste SERVER, tap impossible) — casse le geste festival.
- **B seule** (Wave n’existe qu’au guichet) — casse la recharge autonome (PWA / Checkout).
- Crédit optimiste de la puce sur foi d’un webhook — interdit (F2, F10).

Le code actuel implémente la moitié SERVER (Wave → `applyCredit`, QR → `applyDebit`) et **aucun** chargement puce. `closeEvent` ignore `SERVER`. Cette spec rend ces écarts **non conformes**.

## Comportement nominal

### Chargement puce (SERVER → CHIP)

Opération **explicite**, jamais automatique.

1. Terminal **connecté** (le débit SERVER est synchrone). Hors ligne → refus honnête : « réseau requis pour charger le bracelet ».
2. Le participant présente le support NFC.
3. Le terminal demande `POST /wallets/load-chip` (nom cible) : montant ≤ solde SERVER, idempotency-key.
4. Le serveur réserve / débite la poche SERVER (idempotent). **Ensuite seulement** le terminal écrit le value file (crédit CHIP) et produit un `PaymentRecord` CHIP.
5. Si l’écriture puce échoue (arrachage, refuse) : le serveur **annule la réservation** (re-crédit SERVER, même `loadId`). On n’invente pas de valeur. État résultant : soit les deux poches ont bougé, soit aucune.

Sens inverse (CHIP → SERVER, « déchargement ») : **hors Phase 0/1**. Un participant qui veut payer en QR après n’avoir que du cash doit passer par un geste distinct — non spécifié ici ; `TODO(question)` si le pilote l’exige.

### Invariant comptable unifié

```
liability:wallets = Σ soldes CHIP (rejeu des records CHIP)
                  + Σ soldes SERVER (journal serveur)
```

Un chargement de 3 000 FCFA **ne change pas** `liability:wallets` : il déplace 3 000 d’une poche à l’autre.

## Cas dégradés

| Cas | Comportement |
|---|---|
| Réseau absent au chargement | Refus. La puce n’est pas écrite. SERVER inchangé. |
| Solde SERVER < montant demandé | Refus `INSUFFICIENT`. Aucun débit. |
| Wallet gelé / support blocklist | Refus. |
| Arrachage après débit SERVER, avant commit puce | Re-crédit SERVER (compensation). CHIP inchangé. Audit `LOAD_CHIP_ROLLED_BACK`. |
| Rejeu du même `loadId` | ACK idempotent : pas de second débit SERVER, pas de second crédit puce. |
| Double dépense (payer QR **et** tap sur la même somme) | Impossible si le cloisonnement est respecté : l’argent n’est que dans une poche. |
| Sync d’un record CHIP `TRANSFER` sans fait SERVER correspondant | Anomalie `TRANSFER_UNMATCHED` — pas d’écrasement. Bloque la clôture (F7). |

## Règles chiffrées (plafonds, fenêtres, arrondis)

- Montants : entiers FCFA (`AmountXof`). Min chargement = min paiement = **25 FCFA**. Max = plafond de transaction événement (défaut **50 000**).
- Plafond de poche CHIP après chargement : plafond de solde support (défaut **200 000** — `TODO(question)` palier KYC partenaire).
- Le montant de chargement est **saisi ou choisi** (tout le SERVER, ou une partie). Pas de chargement implicite « tout vider » sans confirmation.
- Horloge : le serveur tranche le débit SERVER ; `ts_terminal` est indicatif.

## Exemples entrée → sortie (deviendront des golden fixtures)

**P0 — cloisonnement.** SERVER 10 000, CHIP 0. Paiement QR 3 000 → SERVER 7 000, CHIP 0. Tap 3 000 → refus puce (solde 0). Pas de découverte.

**P1 — chargement nominal.** SERVER 10 000, CHIP 2 000. Load 4 000 → SERVER 6 000, CHIP 6 000. `liability:wallets` = 12 000 avant et après.

**P2 — rollback arrachage.** SERVER 5 000. Load 2 000 : SERVER débité, puce arrachée → SERVER 5 000, CHIP inchangé, audit rollback.

**P3 — idempotence.** Load `loadId=L1` 1 000 réussi ; rejeu L1 → soldes inchangés.

**P4 — Wave puis tap.** Wave 8 000 confirmé → SERVER 8 000, CHIP 0. Load 8 000 → CHIP 8 000, SERVER 0. Tap 2 000 → CHIP 6 000. QR 1 000 → refus SERVER insuffisant.

## Impacts ledger (écritures en partie double attendues)

Le chargement est **neutre** sur le total des passifs.

Faits à persister (cible — aujourd’hui absents) :

1. **Fait SERVER** : débit poche serveur, `ref = loadId`, append-only.
2. **Fait CHIP** : `PaymentRecord` v2+ `opType` à ajouter (`TRANSFER` ou équivalent), `balanceAuthority: CHIP`, `amountXof` = montant chargé, `balanceAfter` = solde puce. **Bump `SCHEMA_VERSION` à 3** + test de compat v1/v2.

Écriture comptable nette : aucune (mouvement interne). Interdit : compter un chargement comme un `TOPUP` dans `closeEvent` (sinon double comptage des recharges Wave).

`recordToEntry` : `TRANSFER` → `ok(null)` (pas d’impact) **ou** deux lignes qui s’annulent. Jamais un second `credit liability:wallets`.

## Ports et surfaces

| Cible | Détail |
|---|---|
| Use case | `LoadChip` (à créer) — `execute({ opaqueOrCard, amountXof, loadId })` |
| Ports | `WalletBalanceRepository.applyDebit` (existe) ; compensation crédit ; `LedgerEventStore` pour le fait CHIP à la sync |
| HTTP | `POST /wallets/load-chip` — **n’existe pas** |
| Terminal | rôle `cashier` ou `enrollment`, réseau + tap — **n’existe pas** |
| Hors scope | PWA (ne sait pas écrire la puce) |

## Tests

- Unitaire : moteur de décision load (soldes, gel, min/max) — pur, à ajouter dans `ledger-core`.
- Intégration : `LoadChip` + fakes (débit SERVER, rollback, idempotence).
- E2E HTTP : route + fakes, une fois exposée.
- Régression : fixture `REG-00x` si un bug de double comptage apparaît.
- Golden : P0–P4 ci-dessus. `pnpm sim` devra inclure des loads dès que le protocole v3 existe.

## Runbook

Compléter `docs/runbooks/caisse-ouverture-cloture.md` : « charger le bracelet » = geste distinct du top-up cash. En cas d’arrachage : revérifier le solde puce, ne pas rejouer un autre `loadId`.

## Questions ouvertes

- TODO(question) : le pilote exige-t-il un CHIP → SERVER (payer en QR après un top-up cash) ?
- TODO(question) : plafond KYC exact du solde CHIP (200 000 = hypothèse produit, pas une valeur BCEAO).
- Nom d’`opType` (`TRANSFER` vs `LOAD_CHIP`) : à figer dans l’ADR de bump v3, pas ici.
