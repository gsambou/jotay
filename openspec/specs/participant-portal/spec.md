# participant-portal

Source : `docs/specs/SPEC-portail-participant.md`.

## Purpose

Consultation et actions de valeur sans traiter l'URL du QR comme un secret.

## Requirements

### Requirement: Anti-énumération
`POST /portal/session` SHALL renvoyer la même forme de succès que le wallet existe ou non.

### Requirement: Vue serveur datée
`GET /portal/wallet` SHALL exposer le solde SERVER et `asOfIso`, jamais une estimation.
