# ADR-004 — Rendu front : helper d'échappement maison, avant toute bibliothèque

- **Statut** : accepté
- **Date** : 2026-08-17

## Contexte
Les PWA sont en HTML + JS ESM natif, zéro dépendance (ADR-003). La seule vraie faiblesse
du vanilla sur une app qui manipule solde et remboursement est l'injection (XSS) : elle
dépend de la discipline d'éviter innerHTML avec des données serveur. Un framework échappe
par défaut, mais on n'a pas besoin d'un framework pour ce bénéfice.

## Décision
Fournir un helper maison `html` (tagged template) qui **échappe automatiquement** chaque
interpolation, dans `apps/participant-pwa/public/dom.js` (~40 lignes, zéro dépendance,
zéro build). Toute insertion de données serveur dans le DOM passe par ce helper ou par
textContent/createElement. `innerHTML` avec de la donnée non échappée est interdit.

## Seuil de révision (adoption d'une petite bibliothèque)
Si le portail gagne plusieurs actions de valeur interdépendantes avec de l'état qui se
propage entre vues (recharge, litige, association de numéro, multi-événements), le DOM
manuel devient la source des bugs. Alors, et seulement alors, introduire **une** petite
bibliothèque de rendu via un ADR dédié, aux conditions suivantes :
- **Lit** privilégié (tagged-templates natifs, échappement auto, ~5 Ko, pas de build,
  quasi aucune dépendance transitive). Alternative : Preact + htm.
- **Alpine écarté** : évalue des expressions dans le HTML → impose `unsafe-eval` en CSP,
  refusé sur une app de paiement.
- Bibliothèque **vendorée dans le repo** (jamais un CDN live = dépendance réseau non
  auditée au chargement), version épinglée, sous budget de dépendances déclaré.
- Séparation vue / fetch-session préservée, pour que le changement ne touche que le rendu.

## Conséquences
Zéro dépendance aujourd'hui, risque XSS neutralisé, chemin d'évolution balisé.
