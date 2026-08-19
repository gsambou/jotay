# Inventaire Jotay

Carte du système **à construire** et de ce qui **existe vraiment** dans le dépôt.
Source produit : `docs/specs/SPEC-JOTAY.md` (v0.6). Ce fichier fait foi sur l'état.

Légende : **fait** · **scaffoldé** (port + fake + migration, adapter réel manquant) · **spécifié** · **hors code**.

---

## 1. Qu'est-ce que Jotay

Système **cashless en boucle fermée**, **offline-first**, Sénégal / UEMOA d'abord.

- Le participant paie par **bracelet NFC** (solde sur la puce, sans réseau) **ou** par **QR** (solde serveur, réseau obligatoire).
- Les deux poches ne se recouvrent jamais (anti-double-dépense, chap. 18).
- Le ledger serveur est la vérité **comptable** ; la puce est la vérité **offline**.
- Jotay ne détient pas les fonds : un **partenaire émetteur agréé** porte le float (hors code).

```
                    ┌─────────────────────────────────────────┐
                    │         WALLET (wallet_id interne)      │
                    │   MSISDN optionnel · opaqueId public    │
                    └───────────────┬─────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                                           ▼
     POCHE PUCE (CHIP)                           POCHE SERVEUR
     autorité = DESFire                          autorité = API
     tap NFC · offline                           QR · online
              │                                           │
              ▼                                           ▼
     IngestSyncBatch                          AuthorizeQrPayment
     (batch signé, compteur)                  (PIN + vélocité)
```

---

## 2. Acteurs

| Acteur | Rôle | Surface actuelle |
|---|---|---|
| Participant | Recharge, paie, se fait rembourser | PWA `apps/participant-pwa` + support NFC/QR |
| Vendeur (marchand) | Encaisse | Terminal Android **spécifié** ; PWA QR-only **faite** |
| Caissier top-up | Espèces / Wave / OM | Même terminal, rôle cashier — **spécifié** |
| Organisateur | Configure, suit le CA | Dashboard — **spécifié** (Phase 1) |
| Superviseur Jotay | Opposition, ajustements, clôture | Use cases partiels ; pas d'UI |
| Partenaire émetteur | Float, payouts, agrément | Port `MobileMoneyGateway` **scaffoldé** |

---

## 3. Surfaces du monorepo

```
jotay/
├── packages/                 DOMAINES PURS (zéro I/O, zéro dépendance runtime)
│   ├── ledger-core/          moteur comptable, close, rate-limit, qr-authorize
│   ├── protocol/             PaymentRecord v2 + sérialisation canonique
│   ├── card-crypto/          AES-CMAC RFC 4493, TOTP RFC 6238, diversification
│   └── shared/               Result, Brand, identifiants
│
├── apps/
│   ├── api/                  Fastify + Clean Architecture (cœur opérationnel)
│   ├── participant-pwa/      portail participant (vanilla, ADR-003)
│   ├── merchant-pwa/         encaissement QR-only (vanilla)
│   ├── terminal/             Android Kotlin — README seulement
│   └── dashboard/            Phase 1 — README seulement
│
├── tests/e2e/                Playwright (ADR-005)
├── fixtures/golden|regression
├── tools/                    event-sim (dans ledger-core), qr-provision, seed-demo, card-sim
├── docs/specs|adr|runbooks|architecture
└── openspec/                 changements spec-driven
```

---

## 4. Capacités produit (F1–F10 + extensions)

| ID | Capacité | État | Code / spec |
|---|---|---|---|
| F1 | Provisionnement NFC | spécifié | pas d'app terminal ; diversification dans `card-crypto` |
| F2 | Rechargement | partiel | [SPEC-F2](../specs/SPEC-F2-rechargement.md) ; webhook MM **fait** ; cash / caisse / load-chip **absents** |
| F3 | Paiement offline NFC | spécifié | `SPEC-F3` ; moteur `replayCard` **fait** ; tap Android **absent** |
| F4 | Annulation / litige | partiel | `REVERSAL` dans le protocole ; fenêtre vendeur + UI **spécifiées** |
| F5 | Remboursement post-événement | partiel | [SPEC-F5](../specs/SPEC-F5-remboursement.md) ; use cases **faits** ; payout opérateur **stub** |
| F6 | Opposition / blocklist | scaffoldé | port + table ; stub dans `main.ts` ; pas de push terminal |
| F7 | Settlement vendeurs | partiel | [SPEC-F7](../specs/SPEC-F7-cloture.md) ; `closeEvent` **CHIP-only** (non conforme) |
| F8 | Dashboard organisateur | spécifié | `apps/dashboard` vide |
| F9 | Administration / RBAC | spécifié | audit port **scaffoldé** ; pas de rôles HTTP |
| F10 | Mode totalement dégradé | contrat | vrai seulement quand le terminal NFC existe |
| — | Poches + chargement puce | fait | [SPEC-poches](../specs/SPEC-poches-et-transfert.md) ; `LoadChip` + `POST /wallets/load-chip` |
| — | QR statique (opaqueId) | fait | [SPEC-QR](../specs/SPEC-QR-paiement.md) ; plafonds événement + `X-Merchant-Key` |
| — | QR dynamique (TOTP) | fait | même spec ; secret TOTP **stub** |
| — | Portail participant | fait | [SPEC-portail](../specs/SPEC-portail-participant.md) ; adapters **stubs** |
| — | Sync terminaux | fait | `POST` sync + Ed25519 ; registre de clés **stub** |
| — | Jobs / observabilité | partiel | file mémoire + `/metrics` ; PG jobs **migration only** |
| Chap. 16 | Réseau du quotidien | spécifié | hors Phase 0/1 |
| PI-SPI | Interop UEMOA | spécifié | canal dans le protocole, pas d'adapter |

---

## 5. API — ce qui est câblé vs stub

### Use cases (logique écrite, testée)

`IngestSyncBatch` · `AuthorizeQrPayment` · `AuthorizeDynamicQrPayment` · `GetDynamicQrToken` · `ProvisionQrSupport` · `HandleMobileMoneyTopup` · `RecordAdjustment` · `PayoutRemainingBalances` · `LoadChip` · `CloseEvent` · `RequestPortalOtp` · `VerifyPortalOtp` · `GetWalletView` · `RequestRefund`

### Routes HTTP

| Route | Use case |
|---|---|
| `POST /sync/batches` | IngestSyncBatch |
| `POST /payments/qr/authorize` | AuthorizeQrPayment |
| routes QR dynamique | AuthorizeDynamicQrPayment |
| webhook mobile money | HandleMobileMoneyTopup |
| `POST /portal/session` (+ verify) | OTP |
| `GET /portal/wallet` (+ history) | vue serveur datée |
| `POST /portal/refund-request` | RequestRefund |
| `GET /metrics` | Prometheus maison |
| `POST /wallets/load-chip` | LoadChip |
| `POST /supports/qr` | ProvisionQrSupport |
| `POST /adjustments` | RecordAdjustment |
| `POST /events/:id/close` | CloseEvent |
| `POST /events/:id/payouts` | PayoutRemainingBalances |

### Adapters réels

- `PgLedgerEventStore` (append-only)
- `Ed25519SignatureVerifier`
- `QrCodeRenderer` (outil, hors runtime critique)
- `SystemClock`
- `MemoryJobQueue` / `MemoryRateLimitStore` (tests)

### Stubs explicites dans `main.ts` (échouent bruyamment)

`TerminalKeyRegistry` · `WalletBalanceRepository` · `PinVerifier` · `WalletDirectory` · `OtpChannel` · `OtpChallengeStore` · `PortalSessionStore` · `WalletHistoryReader` · `RefundRequestSink` · `TotpSecretStore` · `DynamicQrGuard` · `AuditLog` · `JobQueue` (prod) · `MobileMoneyGateway` · `MerchantRegistry` · `EventPaymentConfig` · `BlocklistRepository` / `AnomalySink` (no-op log)

Les migrations `0001`–`0006` existent déjà pour plusieurs de ces ports : le schéma précède l'adapter.

---

## 6. Invariants non négociables

1. Montants = entiers FCFA (`AmountXof`). Jamais de flottant.
2. Σ débits = Σ crédits. `liability:wallets` = Σ soldes puce + Σ soldes serveur.
3. Poche CHIP et poche SERVER cloisonnées.
4. Doublon strict `(card_uid, card_tx_counter)` = ACK ; divergents = anomalie, jamais d'écrasement.
5. `ledger_events` append-only. Correction = ajustement signé.
6. QR hors ligne = refus honnête. Pas de débit serveur à l'aveugle.
7. Possession de l'URL QR ≠ accès au solde (OTP + PIN pour la valeur).
8. Échec honnête : pas de valeur inventée, pas de défaut silencieux.
9. Zéro secret dans le repo. Donnée perso = MSISDN. `// CRITICAL-PATH` = revue humaine.

---

## 7. Décisions d'architecture (ADR)

| ADR | Décision |
|---|---|
| 001 | TypeScript + Clean Architecture + SOLID |
| 002 | Pas de DI/ORM ; HTTP maison **remplacé** par ADR-006 |
| 003 | PWA sans framework, zéro build |
| 004 | Helper d'échappement HTML |
| 005 | E2E navigateur Playwright |
| 006 | Fastify confiné à `interface/http` |
| 007 | Secrets / KMS |
| 008 | Sauvegarde / reprise |
| 009 | Observabilité |
| 010 | Génération QR hors runtime (biblio) |
| 011 | Double support NFC + QR (deux autorités de solde) |

Toute décision non triviale **nouvelle** → ADR suivant le modèle `ADR-000`.

---

## 8. Tests et barrières

- Runner : `node:test`. Pas de framework de test sans ADR.
- 4 niveaux obligatoires : unitaire · intégration (fakes) · e2e HTTP + Playwright · régression.
- Golden fixtures : `fixtures/golden/` — jamais réduites.
- `pnpm sim` : réconciliation exacte au FCFA près avant déploiement.
- Budget deps CI : `packages/*` = 0 ; `apps/api` = 4 (pg, zod, fastify, qrcode-generator).
- Scan secrets : `pnpm secrets:scan`. E2E navigateur bloquant en CI.

---

## 9. Hors code (ne pas « implémenter » dans le dépôt)

Voir `docs/HORS-CODE.md` :

1. Validation DESFire sur matériel réel (`tools/card-bench`).
2. Partenaire émetteur agréé BCEAO + cantonnement.
3. Antériorité de marque OAPI « Jotay ».

---

## 10. Dettes et dérives à connaître

- La plupart des ports prod sont des stubs : les e2e passent grâce aux fakes in-memory, pas à Postgres.
- `closeEvent` ignore encore les records SERVER (invariant unifié = PR golden dédiée).
- `tools/card-bench` : annoncé, pas encore dans le dépôt (hors code / matériel).
