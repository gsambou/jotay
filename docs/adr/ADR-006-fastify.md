# ADR-006 — Adoption de Fastify comme adapter HTTP

- **Statut** : accepté
- **Date** : 2026-08-18
- **Remplace** : la décision « routeur node:http maison » de l'ADR-002 (le reste d'ADR-002
  — pas de framework DI, pas d'ORM — reste en vigueur).

## Contexte
L'API est destinée à grandir. Le routeur node:http maison couvrait le besoin initial, mais
chaque brique supplémentaire (validation, hooks, rate limiting, logs de requêtes) devait
être réécrite à la main. L'équipe utilise Fastify au quotidien.

## Décision
Adopter **Fastify** comme unique adapter HTTP, confiné à la couche interface
(`apps/api/src/interface/http`). Le domaine et les use cases restent inchangés et ignorent
le framework — la migration n'a touché que la couche interface et la composition root, ce
qui valide l'architecture hexagonale.
- Validation des entrées : **zod** conservé (déjà en place, testé) plutôt que les schémas
  JSON de Fastify, pour garder une seule source de vérité de validation.
- Cookies : gérés à la main (pas de plugin) ; le flag `Secure` est configurable
  (`secureCookies`) — true en prod (https), false pour le serveur e2e (http).
- Budget de dépendances runtime de apps/api porté de 2 à **3** (pg, zod, fastify).

## Alternatives
- node:http maison (rejeté : coût de réécriture croissant à l'échelle et à mesure que
  l'équipe grandit).
- Express (rejeté : async/await et typage plus faibles, perfs moindres).
- NestJS (rejeté antérieurement : DI + arbre transitif massif — ADR-001).

## Conséquences
Accès à l'écosystème Fastify (plugins, hooks, logger pino) quand le besoin viendra. La
surface d'attaque runtime augmente d'une dépendance maîtrisée et très répandue. Les tests
e2e HTTP utilisent `buildApp` + `listen` ; le serveur e2e Playwright réutilise `buildApp`.
