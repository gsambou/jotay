# ADR-010 — Génération des QR (bibliothèque `qrcode-generator`, zéro dépendance transitive)

- **Statut** : accepté (révisé pour le QR dynamique)
- **Date** : 2026-08-18

## Contexte
Deux besoins de rendu QR : (1) QR statique imprimable au provisionnement ; (2) QR
**dynamique** tournant affiché dans la PWA participant (chap. 18.3 option 2), rendu
côté serveur pour que le secret TOTP ne quitte jamais le navigateur.

## Décision
Utiliser **`qrcode-generator`** — un encodeur QR **à zéro dépendance transitive** — pour :
- l'outil de provisionnement (`tools/qr-provision.ts`) ;
- l'API, via l'adapter `QrCodeRenderer` (rendu SVG du jeton dynamique).
Le budget de dépendances runtime de `apps/api` passe de 3 à **4** (pg, zod, fastify,
qrcode-generator). Le choix de `qrcode-generator` (vs `qrcode`) est motivé par l'absence de
dépendances transitives : une seule dépendance ajoutée, aucune surface transitive.

## Conséquences
QR statiques et dynamiques rendus de façon fiable. Le QR ne contient qu'un identifiant
opaque (statique) ou `opaqueId:code` (dynamique) ; jamais de solde, de walletId ni de secret.
La résolution `opaqueId → wallet` et la vérification TOTP restent 100 % serveur.
