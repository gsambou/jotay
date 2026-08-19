# ADR-003 — PWA sans framework (participant & marchand QR-only)

- **Statut** : accepté
- **Date** : 2026-08-17

## Contexte
Le participant n'installe pas d'app (chap. 19) ; un micro-marchand peut encaisser en
QR via une PWA (chap. 20). La politique de dépendances (chap. 17) proscrit les gros
frameworks front sans justification.

## Décision
PWA en **HTML + JavaScript ESM natif + service worker**, **zéro dépendance runtime**,
**aucune étape de build**. Servies comme fichiers statiques. Cible : navigateurs Android
anciens, faible bande passante, français par défaut.

## Alternatives évaluées
Next.js / Vite+React (rejeté : arbre de dépendances et build lourds pour quelques écrans) ;
Web NFC pour lire la puce (rejeté : incapable d'authentification DESFire — cf. chap. 20).

## Conséquences
- Session en cookie HttpOnly (jamais de jeton en localStorage).
- Solde = vue serveur datée ; actions de valeur désactivées hors ligne (échec honnête).
- Toute future dépendance front exige un nouvel ADR.
