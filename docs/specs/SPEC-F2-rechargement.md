# SPEC-F2 — Rechargement (top-up)

- **Statut** : validée (cible) — code MM partiel, cash / caisse / chargement puce absents
- **Chapitre(s) de référence** : SPEC-JOTAY.md § F2, 6.7, 8, 18.4 ; [SPEC-poches-et-transfert.md](./SPEC-poches-et-transfert.md)
- **Capacité** : `mobile-money` + `cash-drawer` + `poches`
- **Change OpenSpec** : n/a

> Une recharge **attendante** ne crédite **jamais** la puce. Cycle : `GUIDE-FEATURE.md`.

## Comportement nominal

### Canal CASH (offline — F10)

1. Session caissier ouverte : fonds de caisse déclaré → `asset:cash_drawer:{sessionId}`.
2. Participant présente le support NFC (ou s’enrôle). Le caissier saisit le montant.
3. **Écriture puce d’abord** (crédit value file). Puis record local `TOPUP` / `CASH` / `cashierSessionId` signé.
4. Sync ultérieure → `IngestSyncBatch`. Le réseau n’est pas requis au guichet.

### Canal Wave / Orange Money (online)

1. Checkout opérateur (QR Wave/OM). Le participant paie chez l’opérateur.
2. Webhook **signé** reçu par `HandleMobileMoneyTopup`.
3. **ACTIVE CHECK** : re-interrogation opérateur. Le webhook seul ne crédite rien.
4. Crédit **poche SERVER uniquement**, idempotent par `provider:providerRef`.
5. Audit `TOPUP_MOBILE_MONEY`. Pour dépenser en tap : [chargement puce](./SPEC-poches-et-transfert.md).

Orange Money : même port `MobileMoneyGateway`, autre adapter (v1.1). Pas de format d’API inventé ici.

### Session caissier (cash drawer)

| Étape | Règle |
|---|---|
| Ouverture | Saisie du fond de caisse (entier ≥ 0). Une session ouverte par caissier/terminal. |
| Pendant | Chaque TOPUP CASH porte `cashierSessionId`. Pas de crédit sans commit puce. |
| Clôture | Comptage réel. Écart = théorique − réel. Écart ≠ 0 → session **signalée**, pas d’effacement. |

Théorique = fond d’ouverture + Σ top-ups CASH de la session (records acceptés).

## Cas dégradés

| Cas | Comportement |
|---|---|
| Webhook sans signature valide | `BAD_WEBHOOK_SIGNATURE`, aucun crédit |
| Active check non confirmé / montant ≤ 0 | `NOT_CONFIRMED`, aucun crédit |
| opaqueId inconnu | `WALLET_UNKNOWN` — ne pas créer de wallet « au vol » |
| Webhook rejoué (même `providerRef`) | Idempotent : second crédit = 0 effet |
| Wave payé, réseau perdu avant webhook | Pas de crédit puce. Vérification active périodique (job) **ou** le participant revient ; pas d’optimisme |
| Plafond de solde SERVER dépassé | Refus du crédit (échec honnête). `TODO(question)` : rembourser l’opérateur ou laisser en suspens cantonnné |
| Solde CHIP + cash dépasserait le plafond support | Refus **avant** écriture puce |
| Caisse : écart à la clôture | Clôture possible mais **marquée** ; l’écart remonte à F7 / runbook écart |
| Caisse : top-up cash sans session ouverte | Interdit |
| Carte bancaire / PI-SPI | Hors v1 (canaux dans le protocole seulement) |

## Règles chiffrées (plafonds, fenêtres, arrondis)

- Min recharge : **25 FCFA**. Max par opération : paramètre événement (défaut **50 000**).
- Plafond de solde par poche / support : paramètre événement (défaut **200 000**). `TODO(question)` palier KYC.
- Frais participant sur top-up : **0** en v1 (coût dans la commission organisateur). Ne pas inventer un take-rate Wave.
- OTP / checkout : délais et UX opérateur = contrat partenaire, pas cette spec.
- Idempotence MM : clé `provider + providerRef`. Idempotence cash : `(cardUid, cardTxCounter)` à l’ingestion.

## Exemples entrée → sortie (deviendront des golden fixtures)

**F2-1 — cash nominal.** Session S1, fond 20 000. TOPUP CASH 10 000 sur CARD-A (solde 0 → 10 000). Ledger : debit `asset:cash_drawer:S1` 10 000 / credit `liability:wallets` 10 000. Fixture proche : `fixtures/golden/001`.

**F2-2 — Wave nominal.** Webhook signé + check 8 000 → SERVER +8 000. CHIP inchangé. Un seul crédit si webhook × 2.

**F2-3 — Wave non confirmé.** Signature OK, check `confirmed=false` → SERVER inchangé.

**F2-4 — cash + plafond.** CHIP 190 000, cash 20 000, plafond 200 000 → refus, puce non écrite.

**F2-5 — caisse en écart.** Fond 10 000 + cash 5 000 = théorique 15 000 ; comptage 14 500 → écart 500, session clôturée **avec** écart, pas de correction silencieuse du ledger.

## Impacts ledger

```
TOPUP CASH X     : debit asset:cash_drawer:{S}  X | credit liability:wallets  X
TOPUP Wave/OM X  : debit asset:float_partner    X | credit liability:wallets  X
```

Aujourd’hui `recordToEntry` mappe tout canal non-CASH sur `float_partner` (conforme). Le crédit Wave **code** passe par `WalletBalanceRepository`, **sans** fait `PaymentRecord` SERVER : non conforme à F7 — tout top-up SERVER doit laisser un fait append-only (voir SPEC-F7).

Chargement puce : neutre, voir SPEC-poches. Ne pas le poster comme un second TOPUP.

## Ports et surfaces

| Existe | Rôle |
|---|---|
| `HandleMobileMoneyTopup` | Wave/OM → SERVER |
| `MobileMoneyGateway` | `verifyWebhook` + `confirmPayment` — **stub prod** |
| `WalletDirectory` / `WalletBalanceRepository` / `AuditLog` | **stubs prod** |
| `POST` webhook MM | câblé dans `buildApp` |
| Session caisse, route caisse, écriture puce | **absents** (terminal) |

Cible : table session caissier (schéma §6.8 `operator_sessions`) — migration à créer, pas de SQL improvisé hors spec.

## Tests

- Unitaire : `recordToEntry` TOPUP CASH vs WAVE (existe). Plafond / caisse = à ajouter.
- Intégration : webhook + active check + idempotence (existe via fakes).
- E2E HTTP : webhook (existe). Caisse : N/A tant que pas de route.
- Régression : ne pas retirer les cas idempotence MM des tests d’intégration.

## Runbook

`docs/runbooks/caisse-ouverture-cloture.md` — à enrichir des montants et de l’écart (F2-5). Ne pas clôturer une session pour « arrondir » le tiroir.

## Questions ouvertes

- TODO(question) : format réel signature / active check Wave Business et Orange Money (ne pas inventer).
- TODO(question) : si Wave est payé mais le crédit SERVER est refusé (plafond), politique de remboursement opérateur.
- TODO(question) : OM en v1.0 ou v1.1 comme prévu au chap. 8.
