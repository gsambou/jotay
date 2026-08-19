# poches

Source : `docs/specs/SPEC-poches-et-transfert.md`.

## Purpose

Cloisonner CHIP et SERVER. Un chargement puce déplace de l'argent sans augmenter `liability:wallets`.

## Requirements

### Requirement: Pas de poche partagée
Un paiement QR SHALL débiter SERVER seulement. Un tap NFC SHALL débiter CHIP seulement.

### Requirement: Chargement explicite
Le système SHALL exiger une opération `LoadChip` (réseau + tap) pour passer de SERVER à CHIP. Jamais de crédit puce sur foi d'un webhook.
