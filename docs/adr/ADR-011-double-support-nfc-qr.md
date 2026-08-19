# ADR-011 — Adoption du double support NFC + QR

- **Statut** : accepté
- **Date** : 2026-08-19
- **Analyse détaillée** : `docs/specs/SPEC-JOTAY.md` § 18–20
- **Comportement** : [SPEC-poches-et-transfert](../specs/SPEC-poches-et-transfert.md), [SPEC-QR-paiement](../specs/SPEC-QR-paiement.md), [SPEC-portail-participant](../specs/SPEC-portail-participant.md)
- **Rendu QR (biblio)** : ADR-010 — autre décision, ne pas confondre

## Contexte

Le cœur Jotay est le tap NFC offline (solde et preuve sur DESFire). Ça exclut quiconque n’a pas de bracelet : pré-enrôlement distant, perte de support, micro-montant d’accès, marchand sans terminal durci.

Un QR élargit la portée à **coût matériel nul**, mais ce n’est qu’une suite de caractères : il ne calcule rien, ne signe rien, se photographie. Il ne peut **jamais** porter un solde hors ligne. L’offrir comme « le même produit sans bracelet » rouvrirait la fraude que l’architecture NFC était faite pour fermer.

Il fallait trancher : NFC seul, QR seul (solde serveur), ou les deux avec des autorités **distinctes**.

## Décision

**Adopter le double support** : un même `wallet_id` interne peut être exposé par une puce NFC et/ou un QR. Deux poches, jamais un solde partagé.

| | NFC (DESFire) | QR |
|---|---|---|
| Autorité du solde | la puce (CHIP) | le serveur (SERVER) |
| Réseau au paiement | non | **oui** |
| Rôle commercial | premium (dense, offline, &lt; 500 ms) | accès (portée, distant, plafonné) |

**Variante QR retenue par défaut** (chap. 18.3 option 1) : QR **statique = identifiant opaque** (128 bits), PIN serveur au-delà d’un micro-plafond, vélocité serveur.  
**Option 2** (TOTP tournant, PWA) : durcissement pour montants plus élevés, déjà dans le code — pas le défaut d’impression.  
**Option 3** (QR marchand scanné par le payeur) : **hors défaut** v1 ; complément éventuel, spec dédiée avant implémentation.

**Acceptation** (chap. 20) : terminal natif = tap **et** scan QR (deux chemins étanches) ; PWA marchande = QR-only ; participant = pas d’app native.

**Interdits non négociables**

- Débit QR hors ligne (même « en file », même « au feeling »).
- Solde, MSISDN ou walletId interne dans le QR.
- Traiter l’URL comme un secret : possession du lien ≠ consultation ni action (OTP + PIN).
- Compter le QR comme un substitut offline du bracelet dans le discours commercial.

## Alternatives évaluées

| Alternative | Verdict |
|---|---|
| NFC seul | Rejeté : portée trop étroite (pas de pré-enrôlement, pas de dépannage immédiat, pas de micro-marchand sans terminal). |
| QR seul, solde serveur | Rejeté : on abandonne la raison d’être (files, cellule saturée, tap &lt; 500 ms). |
| QR « offline » (jeton signé, solde dans le code) | Rejeté : un QR se copie ; un jeton photographié **est** de la valeur volable. |
| Une seule poche partagée NFC+QR | Rejeté : double dépense (tap offline + QR online sur le même argent). |
| Option 3 comme défaut (payeur scanne le marchand) | Écarté pour v1 : peu différenciant vs Wave ; le défaut reste « le marchand scanne le participant ». |

## Conséquences

**Produit.** Deux gestes, deux contrats de service. Sur un site sans réseau, seul le NFC encaisse — argument de vente du bracelet, pas un aveu.

**Domaine.** `PaymentRecord` v2 : `mediumType`, `balanceAuthority`. Autorisation QR = moteur pur distinct du rejeu puce (`authorizeQrPayment` ≠ `replayCard`). Invariant : `liability:wallets = Σ CHIP + Σ SERVER`. Chargement puce = transfert explicite (SPEC-poches) — pas encore dans le code.

**API.** `AuthorizeQrPayment` (synchrone, online) à côté de `IngestSyncBatch`. Résolution `opaqueId → wallet` côté serveur. Plafonds = **config événement**, pas le body marchand (écart actuel : non conforme, SPEC-QR).

**Clients.** PWA participant + PWA marchande (ADR-003). Terminal : second mode caméra, chemin online uniquement — à spécifier dans la réécriture de F3, pas un nouveau moteur.

**Dépendances.** Cette décision n’en ajoute aucune. Le rendu SVG/imprimante est ADR-010 (`qrcode-generator`). Crypto : `node:crypto` + TOTP maison (RFC 6238).

**Sécurité / CDP.** Identifiant opaque public ; donnée perso toujours limitée au MSISDN. PIN et TOTP : `// CRITICAL-PATH`. Verrouillage après N PIN faux et détection « même wallet, deux lieux » : exigés au chap. 18.5, **pas encore** dans SPEC-QR — à ajouter avant durcissement prod, sans inventer le N ni le seuil km.

**Spécification.** Le chap. 18 reste l’analyse. Le comportement implémentable vit dans SPEC-QR, SPEC-poches et SPEC-portail. Cet ADR ne se réécrit pas à chaque détail de plafond : on amende les SPEC-Fx.
