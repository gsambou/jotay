# ADR-007 — Gestion des secrets et des clés (KMS)

- **Statut** : accepté (mise en œuvre = étape infra, hors code applicatif)
- **Date** : 2026-08-18

## Décision
Les clés maîtres DESFire et les clés de signature ne vivent JAMAIS dans le repo ni sur
disque en clair. Elles résident dans un KMS/HSM (AWS KMS, GCP KMS, ou HSM local si
souveraineté exigée). Les terminaux stockent leurs clés dans Android Keystore/StrongBox.
Les secrets d'application (DATABASE_URL, tokens partenaires) via un gestionnaire de secrets,
injectés à l'exécution. La CI échoue si un secret est détecté dans le dépôt.

## Conséquences
Rotation des clés possible sans redéploiement du code. Le provisionnement de cartes exige
un accès KMS/SAM contrôlé et audité. Reste à câbler selon le fournisseur cloud retenu.
