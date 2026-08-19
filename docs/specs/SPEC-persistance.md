# SPEC-persistance — Schéma Postgres des ports encore stubés

- **Statut** : validée (cible) — migrations `0006`+
- **Chapitre(s) de référence** : SPEC-JOTAY.md § 6.8 ; [SPEC-F2](./SPEC-F2-rechargement.md) ; [SPEC-QR-paiement](./SPEC-QR-paiement.md) ; [SPEC-portail-participant](./SPEC-portail-participant.md)
- **Capacité** : socle (directory, soldes SERVER, OTP, PIN, événement)
- **Change OpenSpec** : n/a

> Les adapters Postgres restent à écrire. Cette spec **interdit** d'inventer des tables au fil de l'eau.

## Tables (migration 0006)

| Table | Port |
|---|---|
| `events` | config événement (plafonds QR) |
| `vendors` | `MerchantRegistry` (vendorId, eventId, clé hashée) |
| `wallets` | solde SERVER + frozen + compteurs vélocité |
| `qr_bindings` | `opaqueId → walletId` (`WalletDirectory`, `QrBindingStore`) |
| `otp_challenges` | `OtpChallengeStore` |
| `totp_secrets` | `TotpSecretStore` |
| `pin_credentials` | hash PIN + compteur d'échecs + locked |
| `nfc_media` | F1 (états) — créée vide, pas d'usage avant SPEC-F1 |
| `wallet_mutations` | idempotence `applyDebit` / `applyCredit` |
| `vendor_sightings` | `RecentVendorSighting` |
| `wallet_history` | `WalletHistoryReader` |

`wallets.payout_msisdn` : numéro de payout vérifié (SPEC-portail). `wallets.velocity_window_start` : fenêtre 24 h (défaut produit, pas un plafond BCEAO).

Pas de secret en clair. Hash des clés marchandes et PIN : `node:crypto` (scrypt ou sha256+sel) à l'implémentation de l'adapter — `TODO(question)` algorithme exact si un standard partenaire s'impose.

## Comportement

- `events.qr_limits` JSONB : `microPinThresholdXof`, `velocityAmountCapXof`, `velocityTxCap`, `pinMaxFailures`.
- `wallets.server_balance_xof` BIGINT entier ≥ 0.
- `qr_bindings.opaque_id` UNIQUE, 128 bits d'aléa côté minter.

## Tests

- Migration 0006 applicable sur Postgres vide (intégration future). Unitaire N/A (SQL).
- Régression : ne pas retirer 0001–0005.
