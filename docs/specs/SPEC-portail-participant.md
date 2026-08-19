# SPEC-portail — Interface participant (PWA)

- **Statut** : validée (régularisation du code)
- **Chapitre(s) de référence** : SPEC-JOTAY.md § 19, 18.3 ; [SPEC-poches-et-transfert.md](./SPEC-poches-et-transfert.md) ; [SPEC-QR-paiement.md](./SPEC-QR-paiement.md)
- **Capacité** : `participant-portal`
- **Change OpenSpec** : n/a

> L’URL du QR est **publique**. La possession du lien n’autorise ni solde ni action. Cycle : `GUIDE-FEATURE.md`.

## Comportement nominal

### Niveau 1 — session de consultation

1. Le participant ouvre `https://m.jotay.sn/w/{opaqueId}`. Page d’atterrissage : **aucun** solde, aucun historique.
2. Saisie du MSISDN → `POST /portal/session` → OTP (WhatsApp par défaut, SMS = même port).
3. **Anti-énumération** : la réponse est **toujours** `{ dispatched: true, ttlMinutes: 15 }`, que le wallet existe ou non. On n’envoie un OTP que si `opaqueId` résout.
4. `POST /portal/session/verify` : code 4–8 chiffres. Succès → cookie `jotay_ps` HttpOnly, `SameSite=Strict`, `Path=/portal`, `Secure` en prod. Même erreur `invalid_or_expired` si wallet inconnu **ou** code faux.
5. `GET /portal/wallet` : poche **SERVER** + `frozen` + `asOfIso` + historique. Jamais une estimation. Afficher « à jour à HH:MM ».

### Niveau 2 — actions de valeur

- Demande de remboursement : session + PIN + MSISDN de payout **déjà vérifié**. `POST /portal/refund-request` → 202. Voir [SPEC-F5](./SPEC-F5-remboursement.md) pour l’exécution.
- Changer le numéro de payout : **non implémenté**. Cible : re-vérification OTP + délai de sécurité. Pas dans cette livraison.
- Recharger : lien profond / Checkout Wave (F2) — la PWA n’écrit pas de solde.
- QR dynamique : `GET /portal/qr-token?w={opaqueId}` (session, opaqueId = wallet de session). Secret TOTP côté serveur.

### Hors ligne

Service worker : coquille UI en cache. Solde = dernier connu **daté**. Actions de valeur **désactivées**. Pas de débit, pas de refund.

## Cas dégradés

| Cas | Comportement |
|---|---|
| QR photographié, attaquant sans le MSISDN | Atterrissage vide ; OTP jamais reçu |
| QR + MSISDN deviné / connu | OTP sur le numéro saisi seulement si le bind opaqueId est valide ; PIN encore requis pour rembourser |
| OTP expiré / déjà consommé | 401 `invalid_or_expired` |
| Session expirée / révoquée | 401 `no_session` |
| Wallet sans projection SERVER | 401 `wallet_unknown` (échec honnête, pas de 0 inventé) |
| Refund sans PIN / PIN faux | 401 |
| Refund sans MSISDN vérifié | 409 `no_verified_payout` — pas de payout vers un numéro saisi à l’instant |
| Rate limit session | 5 req / min / IP (`/portal/session`) |

## Règles chiffrées (plafonds, fenêtres, arrondis)

| Paramètre | Valeur | Notes |
|---|---|---|
| TTL OTP | 15 min | code actuel `RequestPortalOtp` |
| Format OTP | 4–8 chiffres | validation HTTP |
| PIN | 4–6 chiffres | niveau 2 |
| Durée session | = `expiresAtIso` renvoyé à la création | `TODO(question)` : figer 15 min aussi pour la session (aujourd’hui délégué au store) |
| Historique | 20 dernières écritures (défaut) | `GetWalletView` |
| Cookie | HttpOnly, SameSite=Strict, Path=/portal | pas de jeton en `localStorage` |
| i18n | fr défaut, en disponible | PWA |

Le portail **n’affiche pas** le solde CHIP (Web NFC ≠ DESFire). Un bandeau doit le dire si un chargement puce a eu lieu : la poche SERVER peut être 0 alors que le bracelet a de l’argent.

## Exemples entrée → sortie

**PT-1 — anti-énumération.** `opaqueId` inexistant + MSISDN quelconque → 200 `{ dispatched: true, ttlMinutes: 15 }`. Aucun SMS/WhatsApp.

**PT-2 — session nominale.** opaqueId lié, OTP correct → 200 + cookie. `GET /wallet` → `{ serverBalanceXof: 3000, asOfIso, history }`.

**PT-3 — code faux.** 401 `invalid_or_expired` (identique à opaqueId inconnu).

**PT-4 — refund.** Session + PIN ok + MSISDN vérifié `+22177…123` → 202 `{ accepted, payoutMsisdnMasked: "*********123" }`. Rejeu même `idempotencyKey` → une seule file.

**PT-5 — fraîcheur.** Dernière sync il y a 2 h → `asOfIso` = cette date, pas « maintenant ».

## Impacts ledger

Aucune écriture à la consultation. Le refund **enqueue** un job (SPEC-F5) ; il ne débite pas ici au-delà de ce que F5 spécifie.

## Ports et surfaces

| Surface | État |
|---|---|
| `RequestPortalOtp`, `VerifyPortalOtp`, `GetWalletView`, `RequestRefund` | faits |
| Routes `/portal/*` + PWA vanilla | faits |
| `OtpChannel`, challenges, sessions, directory, PIN, history | **stubs prod** |
| Table `portal_sessions` | migration 0002 |
| Table `otp_challenges` | **absente** |

## Tests

- Unitaire : i18n PWA ; anti-énumération (intégration).
- Intégration / e2e HTTP : session + wallet + refund (faits, fakes).
- E2E navigateur : `tests/e2e/specs/portal.spec.ts`.
- Hors ligne PWA : e2e à ajouter (actions désactivées).

## Runbook

N/A côté caisse. Support : « je ne vois pas mon solde bracelet » → expliquer les deux poches + fraîcheur, ne pas inventer un total.

## Questions ouvertes

- TODO(question) : TTL exact de la session (15 min vs plus long).
- TODO(question) : contrat WhatsApp Business OTP (template, expéditeur) — ne pas inventer.
- Changement de MSISDN payout + délai de sécurité : spec dédiée avant implémentation.
