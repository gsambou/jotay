# Jotay — instructions pour les agents

Monorepo cashless offline-first (Sénégal / UEMOA). Spec-driven.

## Avant toute feature ou tout refactor

1. Lire [docs/architecture/README.md](docs/architecture/README.md).
2. Suivre [GUIDE-FEATURE.md](docs/architecture/GUIDE-FEATURE.md) ou [GUIDE-REFACTOR.md](docs/architecture/GUIDE-REFACTOR.md).
3. Placer le code selon [COUCHES.md](docs/architecture/COUCHES.md).
4. Mettre à jour [INVENTAIRE.md](docs/architecture/INVENTAIRE.md) / [CAPACITES.md](docs/architecture/CAPACITES.md) si l'état change.

Ne pas implémenter hors de ce cycle. Ne pas écrire d'application code pendant un `/opsx-explore` ou un `/opsx-propose`.

## Contraintes permanentes

- Docs / specs / ADR : **français**. Code, commits, branches : **anglais**.
- Argent : entiers FCFA via `AmountXof`. Jamais de flottant.
- Pas de dépendance nouvelle sans ADR. Budget : `packages/*` = 0 ; API = `pg` + `zod` + `fastify`.
- 4 niveaux de tests (règle 41). `pnpm sim` si le ledger bouge.
- `// CRITICAL-PATH` : revue humaine, pas d'application automatique.

## Commandes

```bash
pnpm typecheck && pnpm test && pnpm dep:budget
pnpm sim
pnpm e2e          # après pnpm --filter @jotay/e2e e2e:install
```

## OpenSpec

Changements : `openspec new change "<nom>"` puis proposal / specs / design / tasks.
Contexte projet : `openspec/config.yaml`.
