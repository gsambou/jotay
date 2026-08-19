# ADR-005 — E2E navigateur (Playwright) différé

- **Statut** : remplacé par [ADR-005-e2e-navigateur-playwright.md](./ADR-005-e2e-navigateur-playwright.md)
- **Date** : 2026-08-17

## Contexte
Le niveau e2e (règle 41) est aujourd'hui couvert au niveau HTTP : Router node:http réel
piloté par fetch, adapters in-memory, zéro dépendance. L'e2e navigateur (cliquer dans la
PWA, scanner un QR, saisir l'OTP) exige un pilote type Playwright — une grosse dépendance
(navigateurs embarqués), contraire à la politique du chap. 17.

## Décision
Différer l'e2e navigateur. Le mettre en place quand la PWA aura un comportement stateful
non trivial à protéger. À ce moment : Playwright en devDependency isolée (jamais runtime),
job CI séparé (non bloquant au début), sous ADR de mise à jour de ce document.

## Conséquences
Couverture e2e actuelle = surface API complète. Les parcours PWA sont validés
manuellement en attendant, et par les tests unitaires du rendu (dom.test.mjs).
