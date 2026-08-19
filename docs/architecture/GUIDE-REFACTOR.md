# Guide — refactoring

Un refactor **préserve le comportement observable**. S'il change un invariant, un status HTTP, une écriture ledger ou une fixture `expected`, ce n'est plus un refactor : suivre [GUIDE-FEATURE.md](./GUIDE-FEATURE.md).

```
 1. Nommer   ce qui ne change PAS (contrats : ports, fixtures, HTTP)
 2. Ancrer   tests existants verts ; en ajouter si le filet est troué
 3. Bouger   dans le respect des couches (COUCHES.md)
 4. Vérifier même suite + sim si packages/ledger-core|protocol bougent
 5. Interdit affaiblir ou supprimer un test pour « faire passer »
```

## Ce qu'on a le droit de déplacer

| Depuis | Vers | OK ? |
|---|---|---|
| Logique métier dans une route | use case / `ledger-core` | oui — c'est le refactor le plus utile |
| I/O dans un use case | port + adapter | oui |
| Adapter importé par `application/` | uniquement `main.ts` | oui (rétablir le DIP) |
| Type d'argent en `number` | `AmountXof` | oui |
| Fastify hors `interface/http` | le rentrer | oui |

## Ce qu'on ne « nettoie » pas

- Golden fixtures et `fixtures/regression/` — jamais réduites, jamais renommées sans PR dédiée.
- `SCHEMA_VERSION` — tout changement de `PaymentRecord` = bump + test de compat ascendante.
- Marqueurs `// CRITICAL-PATH` — on ne les retire pas pour « simplifier ».
- Stubs bruyants de `main.ts` — on ne les rend pas silencieux ; on les remplace par un adapter, ou on les laisse échouer.

## Refactors à risque (traiter comme une feature)

- Changement de sérialisation canonique (`canonicalBytesForSignature`).
- Fusion de ports (viole souvent ISP).
- Introduction d'une abstraction « au cas où » sans deuxième implémentation.
- Déplacer de l'argent vers le dashboard ou la PWA (lecture seule côté dashboard).

## Checklist PR refactor

- [ ] Comportement : mêmes fixtures / mêmes e2e.
- [ ] Couches : aucun import interdit (voir COUCHES.md).
- [ ] Pas de nouvelle dépendance.
- [ ] Si un test « ne s'applique plus » : l'expliquer, ne pas le supprimer en silence.
