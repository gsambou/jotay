# settlement-close

Sources : `docs/specs/SPEC-F7-cloture.md`, `docs/specs/SPEC-F5-remboursement.md`.

## Purpose

Clôturer un événement seulement si la réconciliation unifiée (CHIP + SERVER) tombe juste au FCFA près.

## Requirements

### Requirement: Pas de force
Si `discrepancy !== 0` ou s'il existe une anomalie, le système SHALL refuser la clôture et SHALL NOT lancer de payout.
