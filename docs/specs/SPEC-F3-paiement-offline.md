# SPEC-F3 — Paiement offline

- **Statut** : brouillon
- **Chapitre(s) de référence** : SPEC-JOTAY.md § F3, 6.3, 6.6 ; [SPEC-poches-et-transfert.md](./SPEC-poches-et-transfert.md)
- **Capacité** : `nfc-terminal`
- **Note** : brouillon trop mince pour du Kotlin. La fenêtre d’annulation 5 min relève de F4, pas de F3. Réécrire après SPEC-F1.

## Comportement nominal
Tap → authentification AES (clé diversifiée par UID) → lecture solde + compteur →
débit atomique (value file) → écriture du record local signé → confirmation < 500 ms (p95).

## Cas dégradés
- Solde insuffisant → refus, solde affiché, AUCUNE écriture.
- Arrachage pendant l'écriture → la transaction DESFire garantit commit complet ou
  rollback ; l'app re-lit le compteur au tap suivant pour trancher.
- Carte en blocklist locale → refus + message superviseur.
- Compteur puce incohérent avec le dernier état local connu → refus + signalement.

## Règles chiffrées
- Montant min 25 FCFA ; max/transaction : paramètre événement (défaut 50 000).
- Fenêtre d'annulation vendeur : paramètre événement (défaut 5 min).

## Exemples entrée → sortie
Voir fixtures/golden/001, 002. À compléter : plafond dépassé, blocklist.

## Impacts ledger
PAYMENT : debit liability:wallets / credit liability:vendor_payable:{v}.

## Questions ouvertes
- TODO(question): valeur exacte du plafond réglementaire de solde selon palier KYC
  (à confirmer avec le partenaire émetteur).
