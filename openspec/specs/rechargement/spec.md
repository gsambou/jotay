# rechargement

Source : `docs/specs/SPEC-F2-rechargement.md`.

## Purpose

Créditer une poche : CASH → CHIP (offline) ; Wave/OM → SERVER après signature et active check.

## Requirements

### Requirement: Pas de crédit optimiste
Une recharge en attente de confirmation opérateur SHALL NOT créditer la puce.

### Requirement: Idempotence Mobile Money
Un webhook rejoué avec la même référence SHALL NOT créditer deux fois.
