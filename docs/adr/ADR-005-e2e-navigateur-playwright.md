# ADR-005 — E2E navigateur : Playwright (exception à la politique de dépendances)

- **Statut** : accepté (remplace la version « différé » du 2026-08-17)
- **Date** : 2026-08-17

## Contexte
La règle 41 exige un niveau e2e. L'e2e HTTP (Router réel + fetch) couvre la surface API,
mais pas les parcours navigateur de la PWA (scan/redirection, saisie OTP, rendu du solde,
désactivation hors ligne). Les valider exige un pilote de navigateur.

## Décision
Adopter **Playwright**, en EXCEPTION explicite à la politique de dépendances (chap. 17),
sous conditions strictes :
- **devDependency uniquement**, isolée dans le package `tests/e2e`. JAMAIS en runtime,
  JAMAIS dans apps/api, packages/* ni les PWA. Le budget de dépendances runtime reste 0/2.
- Les navigateurs sont installés à la demande (`pnpm --filter @jotay/e2e exec playwright install chromium`),
  hors `pnpm install` (ignore-scripts reste actif).
- Job CI **séparé** (non bloquant au début : `continue-on-error`), pour ne pas coupler la
  vitesse de la CI unitaire/intégration à des navigateurs.
- Versions épinglées ; toute montée de version = PR dédiée.

## Alternatives
Rester en e2e HTTP seul (rejeté : ne teste pas la PWA) ; WebdriverIO/Cypress (Playwright
retenu pour son offline emulation, son multi-navigateur et son webServer intégré).

## Conséquences
On maintient un vrai e2e navigateur pour les parcours critiques du portail. La surface
d'attaque runtime est inchangée (outil de test uniquement).
