# ADR-001 — TypeScript, Clean Architecture, SOLID

- **Statut** : accepté
- **Date** : 2026-08-04

## Contexte
Le chapitre 17 de la spec recommandait Go stdlib pour minimiser les dépendances.
L'équipe est TypeScript ; la vélocité et la maîtrise priment sur un système d'argent.

## Décision
TypeScript (Node 22) sur tout le backend, en Clean Architecture stricte :
- Domaine = packages purs (`ledger-core`, `protocol`, `shared`), zéro dépendance.
- `apps/api` : application (use cases + ports) / infrastructure (adapters) /
  interface (HTTP) / composition root (`main.ts`, injection manuelle).
- SOLID : SRP (un use case par fichier), OCP (extension par nouveaux adapters),
  LSP (tests de contrat des ports), ISP (ports étroits), DIP (application ne
  connaît que des interfaces).

## Alternatives évaluées
Go stdlib (surface minimale mais coût d'apprentissage) ; NestJS (rejeté : framework
DI + centaines de dépendances transitives, contraire à la politique du chap. 17).

## Conséquences
Budget de dépendances runtime : `pg` + `zod` pour l'API, zéro pour les packages.
Routeur HTTP, migrations et jobs : maison (~250 lignes au total, testées).
