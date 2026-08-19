# Capacités — index de navigation

Une **capacité** = un morceau de comportement que l'on peut spécifier, tester et faire évoluer sans tout relire. Toute feature nouvelle s'accroche à une capacité existante **ou** en crée une (spec FR + éventuel dossier OpenSpec).

| Capacité | Spec | Domaine | Application | Interface | État |
|---|---|---|---|---|---|
| **poches** | [SPEC-poches-et-transfert](../specs/SPEC-poches-et-transfert.md) | — | `LoadChip` | `POST /wallets/load-chip` | fait (adapters soldes stub prod) |
| **ledger** | SPEC-JOTAY §6.7 | `ledger-core` (entry, replay, posting-rules, accounts, money) | — | — | fait (invariant encore CHIP-only) |
| **protocol** | SPEC-JOTAY §6.6, 18 | `protocol` (PaymentRecord v2) | — | — | fait ; v3 si `TRANSFER` |
| **card-crypto** | SPEC-JOTAY §6.3 | `card-crypto` | — | — | fait (vecteurs RFC ; pas NXP matériel) |
| **sync-ingestion** | SPEC-JOTAY §6.6 | replay + normalize | `ingest-sync-batch` | `routes/sync` | fait + stubs clés/blocklist |
| **qr-payment** | [SPEC-QR-paiement](../specs/SPEC-QR-paiement.md) | `qr-authorize` | `authorize-qr-payment`, `provision-qr-support` | `routes/qr-payment` | plafonds événement + `X-Merchant-Key` |
| **dynamic-qr** | [SPEC-QR-paiement](../specs/SPEC-QR-paiement.md) | TOTP | `authorize-dynamic-qr-payment`, `get-dynamic-qr-token` | `routes/dynamic-qr-payment` | fait + stubs secret/garde |
| **participant-portal** | [SPEC-portail-participant](../specs/SPEC-portail-participant.md) | — | OTP, session, wallet view, refund | `routes/portal` | régularisé + stubs stores |
| **merchant-qr** | [SPEC-QR-paiement](../specs/SPEC-QR-paiement.md) | — | réutilise qr-payment | `apps/merchant-pwa` | package workspace + clé marchande |
| **mobile-money** | [SPEC-F2-rechargement](../specs/SPEC-F2-rechargement.md) | — | `handle-mobile-money-topup` | webhook | use case fait, gateway stub |
| **cash-drawer** | [SPEC-F2-rechargement](../specs/SPEC-F2-rechargement.md) | comptes `cash_drawer` | — | terminal cashier | spec validée, code absent |
| **adjustments** | SPEC-JOTAY §F4, 7 | posting ADJUSTMENT | `record-adjustment` | `POST /adjustments` | fait + audit stub |
| **settlement-close** | [SPEC-F7-cloture](../specs/SPEC-F7-cloture.md), [SPEC-F5](../specs/SPEC-F5-remboursement.md) | `close`, `settlement` | `close-event`, `payout-remaining-balances` | `POST /events/:id/close`, `.../payouts` | moteur CHIP ; SERVER/QR à corriger |
| **rate-limit** | — | `rate-limit` | port store | hook Fastify | fait |
| **jobs** | SPEC-JOTAY §6.5 | — | port `JobQueue` | — | mémoire testée, PG à venir |
| **observability** | ADR-009 | — | `metrics` | `GET /metrics` | fait |
| **nfc-terminal** | SPEC-F3 | — | — | `apps/terminal` | spécifié (brouillon) |
| **dashboard** | SPEC-JOTAY §F8 | — | projections lecture | `apps/dashboard` | spécifié |
| **blocklist-distribuee** | SPEC-JOTAY §F6 | — | port blocklist | sync delta | scaffoldé |
| **reseau-quotidien** | SPEC-JOTAY §16 | — | — | — | spécifié, hors Phase 0/1 |

## Créer une capacité

1. Entrée dans ce tableau (nom kebab, spec, dossiers).
2. Fichier `docs/specs/SPEC-<id>-<slug>.md` depuis `SPEC-TEMPLATE.md` (pas de suffixe `.fr.md`).
3. Si le travail passe par OpenSpec : `openspec/specs/<capability-path>/` (delta dans le change, puis sync).
4. Ports étroits plutôt qu'un gros « service ».
