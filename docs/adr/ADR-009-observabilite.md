# ADR-009 — Observabilité

- **Statut** : accepté (socle en place, dashboards = étape infra)
- **Date** : 2026-08-18

## Décision
- Logs structurés JSON (pino via Fastify, activable par `logger`).
- Endpoint `/metrics` au format Prometheus (maison, zéro dépendance), exposant des métriques
  MÉTIER : écart de réconciliation en temps réel, compteur d'anomalies par type, âge de la
  dernière sync par terminal (détection des terminaux muets), profondeur de la file de jobs.
- Alertes (à brancher) : écart de réconciliation ≠ 0, terminal muet > seuil, file de jobs qui
  gonfle, taux de BAD_SIGNATURE anormal.
- Traçage d'erreurs (Sentry) en option, sans données personnelles (chap. 7 / CDP).

## Conséquences
La santé du système d'argent est observable en continu. Les tableaux de bord Grafana et les
règles d'alerte se configurent à l'hébergement.
