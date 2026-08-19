# ADR-002 — Pas de framework HTTP/DI/ORM

- **Statut** : partiellement remplacé par ADR-006 (le volet HTTP). Les volets DI et ORM restent en vigueur.
- **Date** : 2026-08-04

## Décision
`node:http` + routeur maison (~70 lignes) ; SQL manuscrit via `pg` + migrations par
fichiers numérotés ; injection de dépendances manuelle dans `main.ts` ; jobs futurs
par table Postgres + `FOR UPDATE SKIP LOCKED`.

## Contexte / Alternatives
Express/Fastify/NestJS apportent des arbres de dépendances transitifs non audités
sur un système de paiement. Le besoin réel (une poignée de routes JSON) tient en
moins de 100 lignes maison entièrement testées.

## Conséquences
Nous maintenons ce code : toute limite rencontrée (streaming, multipart…) sera
traitée par ADR avant d'introduire une bibliothèque.
