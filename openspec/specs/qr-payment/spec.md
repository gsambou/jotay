# qr-payment

Source de vérité comportementale : `docs/specs/SPEC-QR-paiement.md`, ADR-011.

## Purpose

Autoriser un paiement online sur la poche SERVER via un identifiant opaque, sans jamais faire confiance aux plafonds envoyés par le client.

## Requirements

### Requirement: Autorité serveur
Le système SHALL débiter uniquement la poche SERVER après résolution `opaqueId → wallet` côté serveur.

#### Scenario: Opaque inconnu
- GIVEN un opaqueId non lié
- WHEN le marchand autorise
- THEN la réponse est 404 et aucun débit

### Requirement: Plafonds d'événement
Le système SHALL charger micro-plafond, vélocité et N échecs PIN depuis la config événement, jamais depuis le body HTTP.

#### Scenario: Body qui tente de s'auto-plafonner
- GIVEN un body contenant `params`
- WHEN la route autorise
- THEN ces champs sont ignorés (rejet validation ou ignorés)
