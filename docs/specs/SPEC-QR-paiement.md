# SPEC-QR — Paiement online (statique et dynamique)

- **Statut** : validée (régularisation du code + corrections cibles)
- **Chapitre(s) de référence** : SPEC-JOTAY.md § 18, 20 ; ADR-011 ; [SPEC-poches-et-transfert.md](./SPEC-poches-et-transfert.md)
- **Capacité** : `qr-payment` + `dynamic-qr` + `merchant-qr`
- **Change OpenSpec** : n/a

> Un QR n’est **pas** un porte-monnaie. Réseau obligatoire au paiement. Cycle : `GUIDE-FEATURE.md`.

## Comportement nominal

### QR statique (identifiant)

1. Le QR encode `https://m.jotay.sn/w/{opaqueId}` — 128 bits d’aléa, **pas** de solde, **pas** de MSISDN, **pas** de walletId interne.
2. Provisionnement : `ProvisionQrSupport` mint + bind (`opaqueId` → `walletId`).
3. Le marchand authentifié (`X-Merchant-Key`) saisit le montant, scanne, envoie `opaqueId` (jamais le walletId ni le `vendorId` — fourni par la clé).
4. `AuthorizeQrPayment` : résolution directory → **plafonds événement** → état SERVER → PIN si besoin → `authorizeQrPayment` (pur) → `applyDebit` idempotent par `authId`.
5. Succès : poche SERVER décrémentée. CHIP **intacte**.

### QR dynamique (TOTP)

1. Session portail + `GET /portal/qr-token` : payload `opaqueId:code`. Le **secret TOTP ne quitte pas le serveur**.
2. Pas de temps : **30 s**, fenêtre de vérification ±1 pas (`AuthorizeDynamicQrPayment`).
3. `consume(wallet, step)` atomique : un pas = une conso. Concurrent → une seule réussite.
4. Délègue ensuite **exactement** à `AuthorizeQrPayment` (mêmes règles de poche / PIN / vélocité).

### Routage PWA marchande

Payload avec `:` → flux dynamique ; sinon → statique (`opaqueId` seul).

### Hors ligne

Le client **n’appelle pas** l’API. Message : « réseau indisponible, utilisez un bracelet ». Aucun débit SERVER local, aucune file d’autorisation QR.

## Cas dégradés

| Cas | Comportement |
|---|---|
| opaqueId inconnu | 404 `WALLET_UNKNOWN` — pas d’énumération de walletId |
| Solde SERVER insuffisant | 402 `INSUFFICIENT` — aucun débit |
| Wallet gelé | 402 `FROZEN` |
| Montant > micro-plafond, pas de PIN | 402 `PIN_REQUIRED` |
| PIN faux | 401 `BAD_PIN` |
| Vélocité montant / nombre | 402 `VELOCITY_*` |
| TOTP faux / expiré | 402 `bad_totp` |
| Rejeu même pas de temps | 409 `REPLAY` (garde unique) |
| `authId` rejoué (même débit) | Idempotent : pas de second débit |
| opaqueId du token ≠ session | 409 `MISMATCH` |
| Pas de secret TOTP | 409 `NO_SECRET` |
| QR photographié / partagé | Statique : PIN + vélocité + gel. Dynamique : expire + usage unique |
| Double dépense QR + tap | Impossible si SPEC-poches respectée |

## Règles chiffrées (plafonds, fenêtres, arrondis)

Les plafonds sont des **paramètres d’événement côté serveur**. Le body **ne porte plus** `params` ni `vendorId`. Header `X-Merchant-Key` obligatoire ; `Idempotency-Key` obligatoire sur les POST mutateurs.

| Paramètre | Défaut produit | Source |
|---|---|---|
| Montant min | 25 FCFA | SPEC-JOTAY F3 (même min) |
| Montant max / tx | 50 000 FCFA | paramètre événement |
| Micro-plafond PIN | **1 000 FCFA** (seuil des tests `qr-authorize`) | paramètre événement |
| PIN | 4–6 chiffres, vérifié **serveur** | — |
| Échecs PIN max | **5** (défaut produit, paramètre événement) | chap. 18.5 — pas une valeur BCEAO |
| Deux vendeurs / fenêtre | alerte `MULTI_VENDOR_WINDOW` (deux `vendorId`, pas de km) | pas de seuil géographique inventé |
| Vélocité montant | 50 000 FCFA / fenêtre | paramètre événement |
| Vélocité nombre | 20 tx / fenêtre | paramètre événement |
| Fenêtre de vélocité | **60 min glissantes** | non codée aujourd’hui — à implémenter dans l’adapter d’état |
| TOTP | 30 s, fenêtre ±1 | RFC 6238, code actuel |
| Rate limit HTTP | 60 req / min / IP sur authorize | hook Fastify |
| `authId` | UUID, clé d’idempotence | body |

`TODO(question)` : valeurs de vélocité / micro-plafond du premier événement réel (1 000 / 50 000 / 20 = défauts de test, pas un règlement).

## Exemples entrée → sortie (deviendront des golden fixtures)

Déjà ancrés dans `packages/ledger-core/test/qr-authorize.test.ts` :

**QR-1.** SERVER 5 000, débit 2 000, PIN ok → `balanceAfter` 3 000.  
**QR-2.** Débit 9 000 → `INSUFFICIENT`.  
**QR-3.** 2 000 sans PIN, seuil 1 000 → `PIN_REQUIRED`.  
**QR-4.** 500 sans PIN, seuil 1 000 → ok.  
**QR-5.** `spentInWindow` 49 000 + 2 000 → `VELOCITY_AMOUNT`.  
**QR-6.** `frozen` → `FROZEN`.

À ajouter : rejeu `authId` ; TOTP + `REPLAY` ; refus hors-ligne (e2e client).

## Impacts ledger

Paiement QR X chez vendeur V (cible) :

```
debit  liability:wallets           X
credit liability:vendor_payable:V  X
```

**Écart actuel** : `applyDebit` met à jour la poche SERVER **sans** fait append-only visible par `closeEvent` / `vendorGross`. Non conforme à F7.

Cible : persister un fait `PaymentRecord` v2 `mediumType: QR`, `balanceAuthority: SERVER`, `serverAuthId = authId`, **au moment de l’autorisation** (pas via le batch terminal). Le settlement vendeur inclut les ventes QR.

## Ports et surfaces

| Surface | État |
|---|---|
| `authorizeQrPayment` (pur) | fait |
| `AuthorizeQrPayment` / `AuthorizeDynamicQrPayment` / `GetDynamicQrToken` / `ProvisionQrSupport` | faits |
| `POST /payments/qr/authorize` (+ `-dynamic`) | faits (`X-Merchant-Key`, plafonds événement) |
| PWA marchande | faite (`X-Merchant-Key` + `Idempotency-Key`) |
| `WalletDirectory`, soldes, PIN, TOTP, garde | **stubs prod** |
| Config événement pour `params` | port `EventPaymentConfig` (stub prod, fake tests) |

## Tests

- Unitaire : `qr-authorize` + TOTP RFC (faits).
- Intégration / e2e HTTP : authorize + portail token (faits, fakes).
- E2E navigateur : PWA marchande (Playwright).
- Régression : anti-rejeu TOTP concurrent (contrat 0004) — à garder.
- E2E HTTP : body `params` / `vendorId` rejetés (400) ; sans clé marchande (401).

## Runbook

N/A (pas un geste caisse). Incident : QR partagé → geler le wallet (`frozen`), pas de débit à l’aveugle.

## Questions ouvertes

- TODO(question) : rotation / stockage hash des clés marchandes en prod (KMS).
- TODO(question) : micro-plafond / vélocité du pilote (défauts ci-dessus).
- F9 complet (RBAC, sessions) : la clé API est le minimum v1.
