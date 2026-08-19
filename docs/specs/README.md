# Specs fonctionnelles

Une spec FR par capacité ou feature. Le produit entier : [SPEC-JOTAY.md](./SPEC-JOTAY.md).
Modèle : [SPEC-TEMPLATE.md](./SPEC-TEMPLATE.md).
Cycle d’écriture : [../architecture/GUIDE-FEATURE.md](../architecture/GUIDE-FEATURE.md).

Les specs **poches, F2, QR, portail, F5, F7** sont le lot qui ferme le trou des deux autorités de solde. Les lire **dans cet ordre** : poches → F2 → QR → portail → F7 → F5.

| Spec | Capacité | Statut |
|---|---|---|
| [SPEC-JOTAY.md](./SPEC-JOTAY.md) | Produit + architecture | v0.6 draft |
| [SPEC-poches-et-transfert.md](./SPEC-poches-et-transfert.md) | Cloisonnement CHIP/SERVER + chargement puce | validée (cible) |
| [SPEC-F2-rechargement.md](./SPEC-F2-rechargement.md) | Cash + Wave/OM + caisse | validée (cible) |
| [SPEC-QR-paiement.md](./SPEC-QR-paiement.md) | QR statique + dynamique | validée (régularisation) |
| [SPEC-portail-participant.md](./SPEC-portail-participant.md) | PWA participant | validée (régularisation) |
| [SPEC-F7-cloture.md](./SPEC-F7-cloture.md) | Réconciliation unifiée + settlement | validée (cible) |
| [SPEC-F5-remboursement.md](./SPEC-F5-remboursement.md) | Payouts + demande portail | validée (cible) |
| [SPEC-F3-paiement-offline.md](./SPEC-F3-paiement-offline.md) | Tap NFC | brouillon — à réécrire après F1 |
| [SPEC-persistance.md](./SPEC-persistance.md) | Schéma ports stubés | validée (cible) |

## Encore à éclater (pas bloquant pour le lot ci-dessus)

| Spec | Pourquoi plus tard |
|---|---|
| SPEC-F4-annulation | Fenêtre 5 min + re-crédit puce ; aujourd’hui dans F3 par erreur |
| SPEC-F6-opposition | Runbook 4 lignes ; quelle poche on réémet |
| SPEC-F1-provisionnement | Machine d’états + DESFire — prérequis terminal |
| SPEC-F3 réécrit | APDU, arrachage, file, QR second mode |
| F8 / F9 | Dashboard, RBAC — Phase 1 |
| F10 | Grille « offline ? » à recopier dans F1–F4, pas un fichier solo |

Ne pas inventer un plafond KYC, un format Wave/OM, ou un comportement opérateur : `TODO(question)` dans chaque spec.
