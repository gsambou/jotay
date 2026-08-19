# Couches — où poser le code

Règle de dépendance (DIP). Une flèche = « peut importer ».

```
  interface/http          Fastify, zod, cookies, codes HTTP
        │
        ▼
  application/            use cases + ports (interfaces)
        │
        ▼
  packages/*              ledger-core, protocol, card-crypto, shared
                          (fonctions pures, zéro I/O)

  infrastructure/         implémente les ports
        │
        └── importé UNIQUEMENT par main.ts (composition root)
```

Interdit : `application/` → `infrastructure/` · `packages/*` → `apps/*` · domaine → `Date.now()` / `pg` / Fastify.

---

## Arbre de décision

```
Le code touche à l'argent, un plafond, un invariant comptable ?
  OUI → packages/ledger-core (pur). Temps et aléa = paramètres.
  NON ↓

C'est un type de transaction ou sa forme signée ?
  OUI → packages/protocol (+ bump SCHEMA_VERSION + fixtures compat).
  NON ↓

C'est de la crypto (CMAC, TOTP, KDF) sans I/O ?
  OUI → packages/card-crypto. Marquer // CRITICAL-PATH.
  NON ↓

C'est un identifiant / Result ?
  OUI → packages/shared.
  NON ↓

C'est une intention métier (une action) ?
  OUI → un use case, un fichier, execute(): Promise<Result<…>>
         Les I/O passent par un PORT ÉTROIT (un besoin = un port).
  NON ↓

C'est Postgres, KMS, Wave, horloge, file, rendu QR ?
  OUI → infrastructure/ adapter. Tests de contrat du port.
  NON ↓

C'est HTTP (route, cookie, status) ?
  OUI → interface/http. Zod AVANT le use case. Idempotency-Key si mutation.
  NON ↓

C'est l'écran participant ou micro-marchand ?
  OUI → apps/*-pwa, vanilla, zéro dépendance (ADR-003).
  NON ↓

C'est le tap NFC / APDU ?
  OUI → apps/terminal (Kotlin). Aucun réseau sur le chemin de paiement.
```

---

## Recette d'un use case

```
apps/api/src/application/use-cases/<verbe-objet>.ts
  class Xxx {
    constructor(private readonly portA: PortA, ...) {}
    async execute(input): Promise<Result<Output, Error>>
  }
```

- Un use case = un fichier = une responsabilité (SRP).
- Pas d'import `pg`, Fastify, `node:http`.
- Cas métier = `err(...)`, jamais une exception. Exception = bug de programmation.

## Recette d'un port

```
apps/api/src/application/ports/<besoin>.ts     ← interface étroite
apps/api/src/infrastructure/.../<besoin>.*.ts  ← adapter
apps/api/test/fakes.ts                         ← fake in-memory (intégration)
```

Ne pas créer de `Repository` fourre-tout. Exemples déjà en place : `Clock`, `LedgerEventStore`, `WalletBalanceRepository`, `OtpChannel`.

## Recette d'une route

1. Schéma zod.
2. Appel `useCase.execute`.
3. Mapping `Result` → status HTTP.
4. Rien de métier dans la route.

Câblage : uniquement dans `main.ts` (prod) ou `apps/api/test/fakes.ts` / serveur e2e (tests).
