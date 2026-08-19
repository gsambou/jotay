# ADR-008 — Sauvegarde et reprise (ledger financier)

- **Statut** : accepté (mise en œuvre = étape infra)
- **Date** : 2026-08-18

## Décision
Le ledger étant append-only et source de vérité comptable, il exige :
- **PITR** (point-in-time recovery) sur PostgreSQL, sauvegardes chiffrées quotidiennes +
  WAL archivé continu ; rétention conforme aux obligations (monnaie électronique).
- Tests de restauration RÉGULIERS (une sauvegarde non testée n'existe pas).
- Objectifs explicites : RPO ≤ 5 min, RTO ≤ 1 h (à confirmer avec le partenaire émetteur).
- Réplique en lecture pour le reporting, jamais en écriture sur le ledger.

## Conséquences
Aucune perte comptable tolérée. La procédure de restauration fait l'objet d'un runbook dédié
une fois l'hébergement choisi.
