# Jotay — Cashless événementiel & paiements de proximité (Sénégal / UEMOA)

Monorepo TypeScript en **Clean Architecture** avec principes **SOLID** et politique de
**dépendances minimales** (voir `docs/adr/ADR-001-typescript-clean-architecture.md`).
Spécification produit : `docs/specs/SPEC-JOTAY.md`.

## Démarrage

```bash
corepack enable            # active pnpm
pnpm install               # .npmrc: ignore-scripts + save-exact actifs
pnpm typecheck             # tsc sur tous les packages
pnpm test                  # node:test — inclut les golden fixtures
pnpm dep:budget            # vérifie le budget de dépendances runtime
# API locale (Postgres requis) :
# cp .env.example .env
# pnpm --filter @jotay/api migrate && pnpm --filter @jotay/api seed
# pnpm --filter @jotay/api dev
```

## Cartographie Clean Architecture (apps/api)

| Couche | Dossier | Règle de dépendance |
|---|---|---|
| **Domain** | `packages/ledger-core`, `packages/protocol` | Ne dépend de RIEN (zéro import externe, zéro I/O) |
| **Application** | `apps/api/src/application` | Dépend du domaine + de ses **ports** (interfaces). Un use case = une classe/fonction = une responsabilité (SRP) |
| **Infrastructure** | `apps/api/src/infrastructure` | Implémente les ports (adapters Postgres, horloge système). Substituable (LSP), jamais importée par application/ (DIP) |
| **Interface** | `apps/api/src/interface` | HTTP via **Fastify** (ADR-006), confiné à cette couche. Traduit requêtes ⇄ use cases |
| **Composition root** | `apps/api/src/main.ts` | SEUL endroit où l'on instancie les adapters et câble les dépendances (injection manuelle, pas de framework DI) |

SOLID appliqué : SRP (un use case par fichier), OCP (nouveaux canaux de top-up = nouveaux
adapters, zéro modification des use cases), LSP (tout adapter respecte le contrat de son port,
vérifié par des tests de contrat partagés), ISP (ports étroits : `Clock`, `LedgerEventStore`,
`BlocklistRepository` séparés), DIP (application ne connaît que des interfaces).

## Dépendances runtime autorisées (budget CI)

- `apps/api` : `pg`, `zod`, `fastify`, `qrcode-generator` (ADR-006, ADR-010). Jobs et migrations : maison.
- `packages/*` : **zéro**.

Toute nouvelle dépendance exige un ADR (`docs/adr/`) — règle appliquée par `.cursor/rules/05-dependencies.mdc` et par la CI.

## Ordre de travail (Phase 0)

1. Golden fixtures (`fixtures/golden/`) — relire/compléter À LA MAIN.
2. `packages/ledger-core` — faire passer toutes les fixtures.
3. `tools/card-bench` (DESFire sur lecteur USB) dès réception des cartes.
4. `apps/api` — ingestion sync idempotente + réconciliation.
5. `apps/terminal` (Android/Kotlin) — chemin de paiement seul.


## Niveaux de tests (règle 41-test-levels.mdc)

- `pnpm test` — unitaire + intégration + e2e (HTTP) + régression, sur tous les packages.
- `pnpm sim [seed] [cards]` — event-sim : réconciliation exacte au FCFA près (barrière CI).
- Tests de propriété seedés (générateur maison, zéro dépendance) : `packages/ledger-core/test/sim`.
- E2e navigateur : Playwright sur la PWA (`tests/e2e`, ADR-005). Prérequis :
  `pnpm --filter @jotay/e2e e2e:install` (télécharge Chromium), puis `pnpm e2e`.

## Hors code

Voir `docs/HORS-CODE.md` : validation DESFire sur matériel, partenaire émetteur agréé, marque OAPI.
