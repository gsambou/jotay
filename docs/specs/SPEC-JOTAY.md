# JOTAY — Paiement sans contact pour événements & commerces de proximité
## Spécification produit & architecture — v0.6 (draft)
> v0.6 : mise en cohérence avec le code réel. Stack API corrigée (TypeScript + Clean Architecture + **Fastify**, plus NestJS/Drizzle). Ajout du chapitre 21 (état d'implémentation : signatures Ed25519, card-crypto, clôture, rate limiting, observabilité, jobs, audit, i18n fr/en, tests 4 niveaux). Renommage Xaalis→Jotay effectué.
> v0.5 : ajout du chapitre 20 (modèle d'acceptation unifié : un terminal marchand natif NFC+QR, PWA marchande QR-only). WhatsApp OTP retenu (chap. 19.3).
> v0.4 : ajout du chapitre 19 (interface participant en PWA, sans application native).
> v0.3 : projet renommé **Jotay**. Ajout du chapitre 18 et **décision d'adopter le double support NFC + QR (ADR-011)**.

> Nom du projet : **Jotay** (renommage depuis l'ancien nom de travail « Xaalis » effectué dans tout le code et la doc). Recherche d'antériorité OAPI à effectuer avant tout dépôt de marque.
> Documentation en français, identifiants de code et commits en anglais.

---

## 1. Idée principale

**Un système cashless en boucle fermée (closed-loop), offline-first, pour les événements en Afrique de l'Ouest — Sénégal d'abord.**

Le participant reçoit un support NFC (bracelet ou carte) qui est un **portefeuille prépayé dont le solde vit sur la puce elle-même**. Il le recharge via Wave, Orange Money, espèces ou carte bancaire. Il paie chez les vendeurs de l'événement par simple tap (< 500 ms), **sans qu'aucune connexion réseau ne soit nécessaire au moment du paiement**. Les terminaux synchronisent leurs transactions dès qu'un réseau est disponible. Après l'événement, le solde restant est remboursé automatiquement vers le mobile money du participant.

### Pourquoi cette architecture et pas une autre

| Alternative | Pourquoi elle échoue sur le terrain |
|---|---|
| Paiement mobile money direct (QR Wave chez chaque vendeur) | Dépend du réseau mobile — saturé ou absent sur les sites événementiels (30 000 personnes sur une cellule) ; 15–30 s par transaction ; files d'attente |
| Cartes bancaires / TPE classiques | Pénétration carte très faible au Sénégal ; coût des TPE ; dépendance réseau |
| Solde en base de données centrale (carte = simple identifiant) | Exige le réseau à chaque tap → même problème ; ou autorisation offline aveugle → fraude massive |
| **Solde sur la puce + ledger serveur (choisi)** | Paiement instantané sans réseau, sécurité cryptographique sur la carte, réconciliation comptable à la synchronisation |

### Proposition de valeur

- **Participant** : plus de cash sur soi (vol, perte), paiement en < 1 seconde, pas de monnaie à rendre, remboursement garanti du solde restant.
- **Vendeur** : zéro manipulation d'espèces, totaux en temps réel, règlement J+1 sur son compte Wave/OM, fin des vols de caisse (fuites estimées à 10–20 % en gestion cash).
- **Organisateur** : visibilité temps réel sur les ventes, commission sur le volume, données produit par produit, fin de la réconciliation manuelle, réduction drastique de la fraude interne.

---

## 2. Contexte marché — Sénégal

### Paysage des paiements
- Le mobile money est le rail dominant : **Wave** (leader, frais très bas, forte pénétration urbaine), **Orange Money**, Free Money, Wizall/Mixx. La carte bancaire reste marginale dans la consommation courante.
- La BCEAO a lancé le 30 septembre 2025 la plateforme **PI-SPI** (paiement instantané interopérable UEMOA), avec connexion obligatoire de toutes les institutions financières au 30 juin 2026. Conséquence stratégique : les top-ups et remboursements peuvent devenir interopérables (n'importe quel wallet → notre partenaire émetteur) sans intégration bilatérale avec chaque opérateur.

### Événements cibles (par ordre d'attaque commercial)
1. **Festivals & concerts** : Saint-Louis Jazz, Dakar Music Expo, concerts au Grand Théâtre, Esplanade du Monument — 2 000 à 30 000 participants, forte consommation bar/restauration.
2. **Foires & salons** : FIDAK, foires régionales — durée longue, nombreux exposants.
3. **Sport** : lutte (arènes), stade Abdoulaye-Wade — volumes massifs, sécurité cash critique.
4. **Campus & lieux récurrents** : universités, complexes de loisirs, beach clubs (Almadies, Saly) — revenus récurrents hors saison événementielle.
5. **Grands rassemblements religieux** (Magal, Gamou) — volumes énormes mais sensibilité culturelle : à aborder plus tard, avec des partenaires locaux.

### Problèmes actuels documentés
- Files d'attente aux points de vente (paiement cash + rendu monnaie).
- Fuites de caisse et fraude interne côté vendeurs et organisateurs.
- Aucune donnée : l'organisateur ne sait pas ce qui se vend, ni quand, ni où.
- Sécurité : transport et stockage d'espèces sur site.

---

## 3. Cadre réglementaire (UEMOA / BCEAO / Sénégal)

⚠️ **Ce chapitre conditionne tout le go-to-market. À valider avec un conseil juridique local avant tout pilote payant.**

### 3.1 Monnaie électronique
- L'émission de monnaie électronique dans l'UEMOA est régie par l'**Instruction n° 008-05-2015** de la BCEAO. Émettre un porte-monnaie prépayé rechargeable = émettre de la monnaie électronique = activité réservée aux banques et **Établissements de Monnaie Électronique (EME)** agréés.
- Un système cashless événementiel en boucle fermée peut, selon la structuration, être analysé comme de la monnaie électronique dès lors qu'il est accepté par des vendeurs tiers (pas seulement l'organisateur). **Hypothèse prudente : nous sommes dans le champ de la monnaie électronique.**

### 3.2 Stratégie réglementaire recommandée — en 3 phases
- **Phase 1 — Prestataire technique d'un émetteur agréé.** Jotay ne détient jamais les fonds. Le float (somme des soldes chargés) est logé sur un compte de cantonnement chez un partenaire agréé (banque ou EME : par ex. un EME local, ou une banque avec offre e-money). Jotay fournit la technologie et opère les événements ; le partenaire porte l'agrément, le cantonnement et la conformité LBC/FT. C'est le modèle le plus rapide pour lancer légalement.
- **Phase 2 — Agrément Établissement de Paiement (EP)** auprès de la BCEAO (statut plus récent, moins lourd que l'agrément EME) pour internaliser l'acquisition et le règlement des vendeurs.
- **Phase 3 — Connexion PI-SPI** (directement ou via le partenaire) pour des top-ups depuis n'importe quelle institution de l'Union et une expansion aux 8 pays UEMOA avec un cadre unique (même monnaie XOF, même banque centrale : avantage énorme vs le reste de l'Afrique).

### 3.3 Contraintes opérationnelles issues de la réglementation
- **KYC allégé** possible pour les porte-monnaie à faibles plafonds (le régime e-money BCEAO prévoit des paliers de plafonds selon le niveau d'identification — les valeurs exactes applicables sont à confirmer avec le partenaire émetteur). Design produit : plafond bas par défaut (ex. 200 000 FCFA de solde max), identification simple (numéro de téléphone), montée en plafond avec pièce d'identité.
- **Remboursabilité obligatoire** : la monnaie électronique doit être remboursable à sa valeur nominale. → Le « breakage » (soldes non réclamés) ne peut PAS être un revenu ; prévoir un processus de remboursement actif et une gestion des fonds dormants conforme.
- **LBC/FT** : plafonds de transaction, détection d'anomalies, conservation des journaux.
- **Protection des données** : loi sénégalaise n° 2008-12, déclaration auprès de la **CDP** (Commission de protection des Données Personnelles). Minimisation : le système fonctionne avec un simple numéro de téléphone.

---

## 4. Concept produit — acteurs et parcours

### 4.1 Acteurs
| Acteur | Rôle |
|---|---|
| **Participant** | Détient le support NFC, recharge, paie, se fait rembourser |
| **Vendeur (marchand)** | Encaisse via terminal Android, suit ses ventes, est réglé à J+1 |
| **Caissier top-up** | Opère un point de recharge (cash / Wave / OM / carte) |
| **Organisateur** | Configure l'événement, suit le dashboard temps réel, perçoit sa part |
| **Superviseur Jotay** | Provisionne le matériel, gère les incidents, la blocklist, la clôture |
| **Partenaire émetteur** | Détient le float, porte l'agrément, exécute les payouts |

### 4.2 Parcours participant (nominal)
1. Achète son billet (hors scope v1 — intégration billetterie en v2).
2. À l'entrée : reçoit un bracelet NFC, activé par tap sur un terminal d'enrôlement (association support ↔ numéro de téléphone, optionnelle mais recommandée pour le remboursement).
3. Recharge à un guichet ou en autonomie : QR Wave / Orange Money, espèces, carte bancaire. Le solde est écrit sur la puce.
4. Paie chez n'importe quel vendeur par tap. Solde affiché après chaque paiement.
5. Consulte son solde à toute borne, sur le terminal d'un vendeur, ou par USSD/SMS (v2).
6. Après l'événement : remboursement automatique du solde restant vers son mobile money (si téléphone associé), ou au guichet pendant une fenêtre définie (ex. 14 jours).

### 4.3 Parcours vendeur
1. Reçoit un terminal Android provisionné (compte vendeur, catalogue produits optionnel).
2. Saisit un montant (ou sélectionne des produits) → le participant tape → confirmation sonore + visuelle < 500 ms.
3. Suit son total en temps réel (local) et son total consolidé (dès sync).
4. J+1 : reçoit son règlement (volume brut − commission) sur son compte Wave/OM/bancaire, avec un relevé détaillé.

### 4.4 Parcours dégradés (à concevoir dès la v1 — c'est là que les systèmes meurent)
- **Support perdu/volé** → opposition au guichet → entrée en blocklist → propagation aux terminaux à la prochaine sync → réémission d'un nouveau support avec le solde reconstitué depuis le ledger serveur.
- **Terminal perdu/volé** → révocation de l'appareil (clés de terminal invalidées), les transactions déjà signées restent valides.
- **Litige participant** (« on m'a débité deux fois ») → chaque transaction a un reçu consultable ; annulation possible par le vendeur dans une fenêtre courte (ex. 5 min) avec re-crédit sur la puce ; au-delà, arbitrage superviseur via le ledger.
- **Panne totale de réseau pendant tout l'événement** → le système fonctionne intégralement ; la sync se fait au retour au bureau. C'est un scénario nominal, pas une exception.
- **Puce illisible/endommagée** → réémission depuis le ledger (dernier état synchronisé + estimation ; règle : on rembourse le solde serveur, jamais moins — « honest failure », on n'invente pas de valeur).

---

## 5. Spécifications fonctionnelles

### F1 — Provisionnement des supports NFC
- Encodage en masse avant l'événement : diversification de clés par UID, création des fichiers (solde, compteur, journal), association à l'événement.
- États d'un support : `provisioned → activated → active → blocked | expired → refunded → recycled`.
- Un support est lié à UN événement (v1). Multi-événements avec le même support : v3.

### F2 — Rechargement (top-up)
- Canaux v1 : **espèces** (caisse contrôlée par session caissier), **Wave** (Checkout API : QR généré par le terminal, confirmation par webhook OU vérification active si le webhook n'arrive pas), **Orange Money** (v1.1).
- Canaux v2+ : carte bancaire (via PSP régional type CinetPay/PayDunya/Bictorys), PI-SPI via le partenaire.
- Règles : plafond de solde par support (paramétrable, défaut 200 000 FCFA) ; plafond de recharge par opération ; une recharge en attente de confirmation réseau ne crédite JAMAIS la puce (pas de crédit optimiste).
- Chaque session caissier cash a un `cash_drawer` propre : ouverture avec fonds de caisse, clôture avec comptage — l'écart théorique/réel est calculé automatiquement.

### F3 — Paiement offline
- Tap → lecture solde + compteur → vérification cryptographique → décrément atomique → écriture MAC de transaction → confirmation. Objectif : **p95 < 500 ms**.
- Solde insuffisant → refus clair avec solde affiché (pas de découvert, jamais).
- Idempotence : un tap ne peut débiter qu'une fois (transaction atomique DESFire ; en cas d'arrachage de carte pendant l'écriture, la puce garantit rollback ou commit complet).
- Montant min : 25 FCFA ; montant max par transaction : paramétrable (défaut 50 000 FCFA).

### F4 — Annulation / remboursement d'une transaction
- Annulation par le vendeur dans une fenêtre de N minutes (défaut 5), le support devant être présenté à nouveau (re-crédit sur la puce). Au-delà : demande d'arbitrage → superviseur → ajustement au ledger serveur (re-crédit à la prochaine présentation du support ou au remboursement final).

### F5 — Remboursement post-événement
- Automatique vers le mobile money associé (payout Wave/OM via le partenaire), dans les 72 h après clôture.
- Au guichet (espèces) pendant l'événement et une fenêtre de X jours.
- Frais de remboursement : 0 pour le participant (impératif de confiance ; coût intégré à la commission).

### F6 — Opposition et blocklist
- Blocklist distribuée : liste compacte (IDs) poussée aux terminaux à chaque sync ; un terminal refuse tout support en blocklist même offline.
- Réémission : nouveau support crédité du solde serveur du support bloqué.

### F7 — Règlement des vendeurs (settlement)
- Clôture d'événement → calcul par vendeur : `brut − commission − ajustements litiges = net`.
- Génération d'un relevé détaillé (CSV/PDF) + exécution du payout via le partenaire.
- Rapprochement tripartite obligatoire avant tout payout : `Σ recharges = Σ dépenses + Σ soldes restants` (au FCFA près). Tout écart bloque la clôture et ouvre une investigation — le système ne « force » jamais une réconciliation.

### F8 — Dashboard organisateur (temps réel, à la fraîcheur de la sync)
- CA global et par vendeur/stand, recharges par canal, solde total en circulation, courbes horaires, top produits (si catalogue), nombre de supports actifs, alertes (caisse en écart, terminal muet depuis > X min).

### F9 — Administration
- Multi-événements, multi-organisateurs, rôles et permissions (RBAC), paramètres par événement (plafonds, commission, fenêtres), journaux d'audit immuables de toute action humaine.

### F10 — Mode totalement dégradé
- Tout le cœur (enrôlement, top-up cash, paiement, annulation courte) fonctionne sans aucun réseau. Seuls les top-ups mobile money et le dashboard consolidé exigent du réseau. Documenter ce contrat de service noir sur blanc pour les organisateurs.

---

## 6. Architecture technique

### 6.1 Principes directeurs
1. **Offline-first** : le réseau est une optimisation, jamais une dépendance du chemin de paiement.
2. **La puce est la vérité du solde offline ; le ledger serveur est la vérité comptable.** La sync réconcilie les deux ; toute divergence est une anomalie tracée, jamais écrasée silencieusement.
3. **Moteur comptable déterministe** : le cœur (ledger, calculs de settlement, règles de plafonds) est un ensemble de fonctions pures — aucune I/O, aucun appel réseau, aucune horloge interne (`Date.now()`/`datetime.now()` interdits dans les moteurs : le temps est toujours un paramètre d'entrée).
4. **Event sourcing sur les transactions** : on ne stocke pas des soldes, on stocke des faits immuables (append-only) ; les soldes sont des projections.
5. **Échec honnête** : en cas de doute (puce illisible, écart de compteur), le système expose l'anomalie et s'arrête ; il n'invente jamais une valeur.

### 6.2 Vue d'ensemble

```
 [Support NFC]──tap──[Terminal Android]──sync (HTTPS, batch signé)──[API Backend]
  DESFire EV3         Kotlin natif                                    Fastify/TS
  solde+compteur      SQLite chiffré                                    │
  clés AES divers.    file d'attente                              [Postgres: event store
                                                                   + projections ledger]
 [Guichet top-up] = même app Android, rôle "cashier"                    │
        │                                                         [Dashboard Next.js]
        └──QR Wave/OM──[APIs opérateurs]──webhooks──────────────────────┤
                                                                  [Partenaire émetteur]
                                                                   float, payouts, PI-SPI
```

### 6.3 Support NFC — choix matériel
- **Recommandé : NXP MIFARE DESFire EV3** (bracelet silicone ou carte PVC, ~0,8–2 USD/unité en volume).
  - AES-128, transactions atomiques natives, **Value Files** (crédit/débit avec bornes imposées par la puce), **Transaction MAC** (la puce signe elle-même chaque transaction validée → preuve non falsifiable par un terminal compromis), compteurs anti-rejeu.
- Alternative économique : NTAG 424 DNA (moins riche, pas de value file — logique déportée, moins robuste). **Rester sur DESFire.**
- Diversification des clés : `K_card = KDF(K_master_event, UID)` — la compromission d'une carte ne compromet jamais le parc.
- La clé maître ne quitte jamais le HSM/KMS côté serveur ; les terminaux reçoivent des clés de session ou embarquent les opérations sensibles via SAM (v2 : SAM AV3 dans les terminaux ; v1 acceptable : clés diversifiées calculées au provisionnement et clés de terminal stockées dans le Keystore Android/StrongBox).

### 6.4 Terminal — application Android native (Kotlin)
- Pourquoi natif et pas React Native/Flutter : la fiabilité et la latence NFC (IsoDep, gestion des arrachages, réémissions APDU) exigent un contrôle bas niveau ; c'est le composant le plus critique du système.
- Matériel : smartphones Android NFC d'entrée de gamme (~80–120 USD) en v1 ; terminaux durcis type Sunmi/PAX Android en v2 (batterie, lecteur dédié, imprimante optionnelle).
- Stockage local : SQLite chiffré (SQLCipher), file d'attente de transactions à synchroniser, blocklist locale, config événement signée.
- Modes (RBAC embarqué) : `vendor` (encaissement), `cashier` (top-up), `enrollment` (activation), `supervisor` (opposition, arbitrage, inspection).
- Kiosk mode (device owner) : l'appareil ne fait que ça.

### 6.5 Backend
- **API** : TypeScript en architecture Clean/hexagonale — `domain` (moteurs purs) / `application` (use cases + ports) / `infrastructure` (adapters Postgres, crypto, KMS) / `interface` (**Fastify**, ADR-006) / composition root (injection manuelle, aucun framework DI). Validation par **zod**.
- **Base** : PostgreSQL. Event store en table append-only (`ledger_events`) + projections matérialisées (`balances`, `vendor_totals`). Pas de Kafka en v1 — Postgres suffit largement (< 100 tx/s même sur un très gros événement).
- **Files/queues** : file de jobs maison (table Postgres + `FOR UPDATE SKIP LOCKED`, backoff exponentiel) — pas de BullMQ/pg-boss.
- **KMS/HSM** : clés maîtres dans AWS KMS / GCP KMS (ou HSM local si souveraineté exigée).
- **Infra** : v1 sur un PaaS (Railway/Fly.io/Scaleway) + Docker ; prévoir résidence des données et latence (région Europe acceptable au début, migration possible). Sentry + Grafana/Prometheus + logs structurés.

### 6.6 Protocole de transaction offline (cœur du système)

Chaque paiement produit un enregistrement signé :

```
PaymentRecord {
  schema_version: u8
  event_id: uuid
  card_uid: bytes            // UID du support
  card_tx_counter: u32       // compteur monotone lu/incrémenté sur la puce
  terminal_id: uuid
  terminal_seq: u64          // séquence monotone du terminal
  amount_xof: u32            // toujours en unités entières FCFA — jamais de flottants
  balance_after: u32         // solde résiduel constaté
  op_type: enum { PAYMENT, TOPUP, REVERSAL, ADJUSTMENT, ACTIVATION, BLOCK }
  ts_terminal: iso8601       // horloge terminal (indicative, non fiable)
  card_tx_mac: bytes         // Transaction MAC générée par la puce (preuve)
  terminal_sig: bytes        // signature Ed25519 du terminal
}
```

**Séquencement et anti-fraude :**
- Le couple `(card_uid, card_tx_counter)` est unique au monde → idempotence absolue à l'ingestion.
- À la sync, le serveur rejoue les événements par carte dans l'ordre des compteurs. Trou de compteur = transaction manquante (terminal pas encore synchronisé) → attente ; doublon de compteur avec contenus différents = **clonage présumé** → carte en blocklist immédiate + quarantaine des transactions.
- Le serveur vérifie la Transaction MAC de la puce : un terminal compromis ne peut pas fabriquer de fausses transactions créditrices.

**Protocole de sync :** `POST /sync/batches` — batch signé de N records + version de blocklist connue → réponse : accusés idempotents + delta de blocklist + éventuelle nouvelle config signée. Retry avec backoff, reprise sur coupure au record près.

### 6.7 Modèle comptable — ledger en partie double

Comptes (par événement) :
```
liability:wallets            // somme des soldes en circulation (dette envers participants)
liability:vendor_payable:{v} // dû à chaque vendeur
asset:float_partner          // fonds cantonnés chez le partenaire émetteur
asset:cash_drawer:{session}  // espèces par session caissier
revenue:fees                 // commissions Jotay
expense:refunds_costs        // coûts de payout éventuels
```

Écritures types :
```
TOPUP cash 10 000      : debit asset:cash_drawer:S1   10 000 | credit liability:wallets 10 000
TOPUP Wave 10 000      : debit asset:float_partner    10 000 | credit liability:wallets 10 000
PAYMENT 3 000 (vend. V): debit liability:wallets       3 000 | credit liability:vendor_payable:V 3 000
SETTLEMENT V (com. 2 %) : debit liability:vendor_payable:V X | credit asset:float_partner X·0,98
                                                             | credit revenue:fees      X·0,02
REFUND participant      : debit liability:wallets      solde | credit asset:float_partner solde
```
**Invariant vérifié en continu : Σ débits = Σ crédits, et `liability:wallets` = Σ soldes attendus des puces.** Montants en entiers FCFA uniquement.

### 6.8 Schéma de données (Postgres, simplifié)
```
events(id, name, starts_at, ends_at, currency='XOF', params_jsonb, status)
organizers(id, ...) / vendors(id, event_id, name, payout_msisdn, commission_bps)
nfc_media(uid PK, event_id, status, holder_msisdn NULL, provisioned_at, blocked_at)
devices(id, event_id, role, pubkey, status, last_sync_at)
operators(id, role, ...) + operator_sessions(cash_drawer ouverture/clôture)
ledger_events(id bigserial, event_id, card_uid, card_tx_counter, payload_jsonb,
              received_at, batch_id, UNIQUE(card_uid, card_tx_counter))
sync_batches(id, device_id, sig, received_at, record_count, status)
projections: balances(card_uid, balance, as_of_counter), vendor_totals(...)
settlements(id, event_id, vendor_id, gross, fee, net, status, payout_ref)
blocklist(card_uid, reason, created_at, version)
audit_log(actor, action, target, before, after, at)  // append-only
```

---

## 7. Sécurité — synthèse des menaces

| Menace | Contre-mesure |
|---|---|
| Clonage de support | AES DESFire + diversification par UID ; détection doublons de compteur à la sync |
| Rejeu de transaction | Compteur monotone sur puce + unicité `(uid, counter)` serveur |
| Terminal volé/compromis | Clés par terminal révocables, Keystore/StrongBox, kiosk mode, Transaction MAC de la puce (le terminal ne peut pas créditer sans la puce) |
| Caissier frauduleux (top-up cash fictif ou détourné) | Cash drawer par session avec comptage d'ouverture/clôture, tout top-up cash tracé par session, écarts bloquants |
| Vendeur qui annule abusivement | Fenêtre d'annulation courte, présence physique du support requise, taux d'annulation surveillé |
| Insider backend | Ledger append-only, audit log immuable, aucune écriture manuelle de solde (seules des écritures d'ajustement signées, en partie double, avec motif) |
| MITM sur la sync | TLS + signature applicative des batches + pinning |
| Fuite de données personnelles | Minimisation (MSISDN seul), chiffrement au repos, conformité CDP, rétention limitée |

**Hors scope PCI-DSS** tant qu'aucun PAN de carte bancaire ne transite par nos systèmes (les paiements carte passent par un PSP en redirection/token).

---

## 8. Intégrations externes

| Intégration | Usage | Notes |
|---|---|---|
| **Wave Business API** | Checkout (top-up par QR) + Payout (settlements, refunds) | Accès B2B à négocier ; webhooks + vérification active en fallback |
| **Orange Money (API marchand)** | Idem, v1.1 | Via Orange Developer / agrégateur |
| **Agrégateur PSP régional** (PayDunya, CinetPay, Bictorys…) | Carte bancaire + couverture multi-opérateurs en un contrat | Compromis frais vs vitesse d'intégration |
| **PI-SPI** (via partenaire émetteur) | Top-up/refund interopérables UEMOA | Levier d'expansion régionale majeur |
| **SMS** (agrégateur local) | Reçus, notification de remboursement | Optionnel v1 |
| **USSD** | Consultation de solde sans smartphone | v2, via agrégateur |

---

## 9. Stack technique retenue (résumé exécutable)

| Couche | Choix | Justification |
|---|---|---|
| Moteurs (ledger, settlement, règles) | **TypeScript pur, zéro dépendance** (`packages/ledger-core`) | Fonctions pures testables par golden fixtures ; portables |
| API | **Fastify + PostgreSQL (`pg`, SQL manuscrit) + zod** + rendu QR (ADR-001, ADR-006, ADR-010) | Clean Architecture ; budget runtime 4 (pg, zod, fastify, qrcode-generator) |
| Terminal | **Android natif Kotlin** (minSdk 26) | Maîtrise NFC (IsoDep/APDU), fiabilité terrain |
| Dashboard | **Next.js + Tailwind** | Vélocité |
| Jobs | File maison (table Postgres + SKIP LOCKED) | Zéro dépendance de plus |
| Clés | KMS cloud (+ Keystore Android côté terminal) | Rotation, non-extraction |
| Observabilité | Logs JSON (pino/Fastify), endpoint `/metrics` Prometheus maison, Sentry optionnel (ADR-009) | Métriques métier : écart de réconciliation, anomalies, terminaux muets |
| CI | GitHub Actions : typecheck, tests 4 niveaux, budget de dépendances, event-sim, e2e navigateur séparé | Gate obligatoire (règle 41) |

---

## 10. Roadmap

**Phase 0 — Prototype (4–6 semaines)**
`ledger-core` complet et testé ; app Android : enrôlement + top-up cash + paiement + sync ; 30 supports DESFire ; test grandeur nature sur un petit événement ami (soirée, kermesse). Critère de sortie : 0 écart de réconciliation sur 500+ transactions réelles.

**Phase 1 — MVP commercial (8–10 semaines)**
Top-up Wave, blocklist distribuée, dashboard organisateur, settlement + relevés, remboursement guichet, durcissement sécurité (Keystore, signatures batch), contrat partenaire émetteur signé. Pilote payant : événement 1 000–3 000 personnes.

**Phase 2 — Industrialisation (T+6 mois)**
Orange Money, remboursement automatique par payout, multi-événements simultanés, terminaux durcis (Sunmi/PAX), catalogue produits vendeurs, exports comptables, marque blanche organisateurs récurrents.

**Phase 3 — Échelle régionale (T+12 mois)**
Agrément Établissement de Paiement (ou approfondissement partenariat), PI-SPI, Côte d'Ivoire (Abidjan = marché événementiel majeur, même monnaie, même régulateur), lieux permanents (campus, complexes).

---

## 11. Modèle économique

- **Commission sur volume dépensé** : 2–3 % (référence : les acteurs cashless européens facturent 1,5–4 % + location matériel).
- **Location du matériel** : forfait par terminal/jour + caution bracelet éventuelle refacturée à l'organisateur.
- **SaaS** pour lieux permanents (abonnement mensuel + commission réduite).
- **Interdit** : compter le breakage comme revenu (obligation de remboursement e-money). Les frais éventuels d'inactivité, s'ils sont un jour appliqués, doivent être validés juridiquement et contractualisés.
- Ordre de grandeur : festival de 5 000 personnes × 8 000 FCFA dépensés = 40 M FCFA de volume → 800 K–1,2 M FCFA de commission (~1 200–1 800 €) + location. Le modèle exige du **volume d'événements** : la vente est B2B (organisateurs), pas B2C.

---

## 12. Risques majeurs & mitigations

| Risque | Gravité | Mitigation |
|---|---|---|
| Requalification réglementaire (émission e-money sans agrément) | Fatal | Partenaire agréé dès le 1er événement payant ; avis juridique écrit |
| Dépendance au partenaire émetteur | Élevée | Contrat avec SLA, architecture agnostique du partenaire, 2e partenaire en backup |
| Fraude interne (caissiers) | Élevée | Cash drawers, écarts bloquants, caméras aux guichets, rotation |
| Logistique matériel (perte, casse, charge des terminaux) | Moyenne | Checklists, parc de rechange 15 %, valises de charge |
| Adoption vendeurs (résistance au tracé fiscal) | Moyenne | Pédagogie, règlement J+1 fiable, l'organisateur impose le cashless dans le contrat de stand |
| Saisonnalité des événements | Moyenne | Lieux permanents (Phase 2/3) pour lisser |
| Concurrence (Weezevent/PayTech local, ou Wave qui descend sur ce marché) | Moyenne | Vitesse, excellence offline, relation organisateurs |

---

## 13. KPIs

Produit : latence tap p95, taux d'échec de lecture, temps moyen de top-up, % de supports remboursés automatiquement.
Intégrité : écart de réconciliation (cible : 0 FCFA), anomalies de compteur / 10 000 tx, délai médian de sync.
Business : volume par événement, dépense moyenne/participant, take rate effectif, NPS organisateurs, coût matériel par participant.

---

## 14. Méthode d'implémentation avec Cursor

### 14.1 Philosophie
Développement **spec-driven** : chaque fonctionnalité part d'un fichier de spécification en français dans `docs/specs/`, puis est implémentée en TDD sur les moteurs purs. Cursor est un accélérateur sous contrainte : les règles ci-dessous bornent ce qu'il a le droit de produire, et les chemins critiques (ledger, protocole NFC, settlement) exigent une revue humaine ligne à ligne.

### 14.2 Structure du monorepo

```
jotay/
├── .cursor/
│   └── rules/
│       ├── 00-global.mdc
│       ├── 10-ledger-core.mdc
│       ├── 20-api.mdc
│       ├── 30-terminal.mdc
│       ├── 40-tests.mdc
│       └── 50-security.mdc
├── docs/
│   ├── specs/            # specs fonctionnelles FR, une par feature (SPEC-F3-paiement-offline.md…)
│   ├── adr/              # Architecture Decision Records (ADR-001-typescript-clean-architecture.md…)
│   └── runbooks/         # procédures opérationnelles terrain FR
├── packages/
│   ├── ledger-core/      # moteur comptable pur + close, rate-limit (TS, zéro dépendance)
│   ├── protocol/         # types & sérialisation canonique PaymentRecord — pur
│   ├── card-crypto/      # AES-CMAC (RFC 4493) + diversification de clés DESFire — pur
│   └── shared/           # Result, brand types
├── apps/
│   ├── api/              # Fastify + Clean Architecture (domain/application/infra/interface)
│   ├── participant-pwa/  # PWA participant (vanilla, zéro dépendance) + i18n fr/en
│   ├── merchant-pwa/     # PWA marchande QR-only (vanilla)
│   ├── dashboard/        # (Phase 1)
│   └── terminal/         # Android Kotlin (Gradle)
├── tests/
│   └── e2e/              # Playwright (devDependency, ADR-005)
├── fixtures/
│   ├── golden/           # scénarios de réconciliation versionnés
│   └── regression/       # un bug corrigé = une entrée figée
└── tools/                # event-sim, seed-demo, card-bench (à venir)
```

### 14.3 Règles Cursor — contenu proposé

**`.cursor/rules/00-global.mdc`** (alwaysApply: true)
```markdown
---
description: Règles globales Jotay
alwaysApply: true
---
- Documentation, specs et commentaires de doc : en FRANÇAIS. Identifiants de code,
  messages de commit, noms de branches : en ANGLAIS.
- Tous les montants sont des ENTIERS en FCFA (XOF). Aucun nombre flottant pour
  l'argent, nulle part, jamais. Type dédié `AmountXof` (branded type).
- Toute modification commence par lire la spec correspondante dans docs/specs/.
  S'il n'y a pas de spec, en proposer une AVANT de coder.
- Ne jamais inventer une valeur, un plafond réglementaire ou un comportement
  d'API externe : si l'information manque, poser la question ou marquer TODO(question).
- Interdiction de supprimer ou d'affaiblir un test existant pour faire passer le build.
- Toute décision d'architecture non triviale → proposer un ADR dans docs/adr/.
```

**`.cursor/rules/10-ledger-core.mdc`** (globs: packages/ledger-core/**, packages/protocol/**)
```markdown
---
description: Moteur comptable et protocole — pureté absolue
globs: ["packages/ledger-core/**", "packages/protocol/**"]
---
- Ces packages sont des MOTEURS DÉTERMINISTES : fonctions pures uniquement.
  INTERDITS : I/O, réseau, accès base, Date.now(), Math.random(), variables
  d'environnement, imports depuis apps/*. Le temps et l'aléa sont TOUJOURS
  des paramètres d'entrée.
- Zéro dépendance externe (hors devDependencies de test).
- Chaque écriture comptable est en partie double ; exporter un invariant
  `assertBalanced(entries)` appelé par construction, pas par convention.
- Les fonctions retournent Result<T, LedgerError> — jamais d'exception pour
  un cas métier ; jamais de valeur par défaut silencieuse (échec honnête).
- Toute évolution de PaymentRecord : bump de schema_version + test de
  compatibilité ascendante sur les fixtures existantes.
```

**`.cursor/rules/20-api.mdc`** (globs: apps/api/**)
```markdown
- Architecture hexagonale : domain n'importe jamais infrastructure.
- Ingestion sync : idempotence par UNIQUE(card_uid, card_tx_counter) ; un
  doublon strict est un ACK silencieux, un doublon divergent est une ANOMALIE
  (quarantaine + alerte), jamais un écrasement.
- ledger_events est append-only : aucune requête UPDATE/DELETE sur cette table
  ne doit exister dans le code. Corrections = écritures d'ajustement.
- Tout endpoint mutateur exige une Idempotency-Key.
- Les webhooks opérateurs (Wave/OM) sont vérifiés par signature ET confirmés
  par un appel actif avant de créditer quoi que ce soit.
```

**`.cursor/rules/30-terminal.mdc`** (globs: apps/terminal/**)
```markdown
- Kotlin natif. Le chemin de paiement NFC (tap → débit → confirmation) ne doit
  contenir AUCUN appel réseau, même optionnel.
- Toute séquence APDU DESFire est encapsulée dans des fonctions testées contre
  un simulateur de puce (tools/card-sim) ; pas d'APDU inline dans l'UI.
- L'écriture sur la puce et l'enregistrement local SQLite sont couplés :
  transaction locale validée UNIQUEMENT après commit DESFire confirmé.
- Gérer explicitement l'arrachage de carte (TagLostException) à chaque étape :
  l'état résultant doit être déterminé (commit complet ou rollback), jamais ambigu.
- Clés dans Android Keystore/StrongBox ; aucune clé en clair dans le code,
  les logs ou les préférences.
```

**`.cursor/rules/40-tests.mdc`**
```markdown
- ledger-core et protocol : couverture par tests basés sur les GOLDEN FIXTURES
  de fixtures/golden/ (scénario complet en entrée → état comptable exact en
  sortie). Les fixtures sont versionnées et ne sont JAMAIS réduites ; on ne
  modifie une fixture attendue que via une PR dédiée expliquant le changement métier.
- Tout bug corrigé = une fixture ajoutée reproduisant le bug.
- Tests de propriété (fast-check) sur : conservation des montants
  (Σ débits = Σ crédits), idempotence de l'ingestion, monotonie des compteurs.
- Un simulateur d'événement (tools/event-sim) génère des charges réalistes :
  N cartes, M terminaux, pannes de sync aléatoires → la réconciliation finale
  doit être exacte au FCFA près.
```

**`.cursor/rules/50-security.mdc`**
```markdown
- Aucun secret dans le repo (scan CI). Clés maîtres : KMS uniquement.
- Toute donnée personnelle est limitée au MSISDN ; tout ajout de champ
  personnel exige une justification écrite (docs/adr) au regard de la loi
  2008-12 / CDP.
- Ne jamais logger : soldes associés à un MSISDN en clair, clés, MACs complets.
- Tout code touchant crypto/clés/blocklist est marqué `// CRITICAL-PATH` et
  exige une revue humaine — Cursor ne doit pas l'auto-appliquer.
```

### 14.4 Workflow de développement avec Cursor
1. **Écrire la spec** (`docs/specs/SPEC-Fx-….md`) : comportement nominal, cas dégradés, règles chiffrées, exemples entrée/sortie. C'est le document que Cursor lit en premier (le référencer avec `@docs/specs/...` dans le prompt).
2. **Fixtures d'abord** : demander à Cursor de générer les golden fixtures depuis la spec, les relire humainement (c'est là que se joue la correction du système), puis seulement implémenter.
3. **Implémenter le moteur pur**, faire passer les fixtures, puis brancher l'infrastructure.
4. **Chemins critiques** (`CRITICAL-PATH`) : revue ligne à ligne, jamais de « apply all » aveugle.
5. **Simulateur avant terrain** : chaque release passe l'event-sim (10 000 tx, pannes injectées, réconciliation exacte) avant tout déploiement.

Exemple de prompt type :
> « Lis @docs/specs/SPEC-F3-paiement-offline.md et @packages/protocol/src/index.ts. Génère d'abord 8 golden fixtures couvrant : nominal, solde insuffisant, plafond de transaction, doublon strict, doublon divergent (clonage), trou de compteur, annulation dans la fenêtre, annulation hors fenêtre. N'implémente rien encore. »

### 14.5 Definition of Done (par feature)
- Spec FR à jour ; fixtures golden couvrant nominal + dégradés ; moteurs purs sans I/O ; invariant comptable vérifié ; revue humaine des chemins critiques ; runbook terrain mis à jour si la feature touche l'opérationnel ; event-sim vert.

---

## 15. Questions ouvertes (à trancher avant la Phase 1)

1. Quel partenaire émetteur ? (EME local, banque avec offre e-money, ou fintech agréée EP cherchant des cas d'usage) — c'est LE chemin critique non technique.
2. Accès effectif aux APIs Wave Business / Orange Money au Sénégal : conditions, délais, frais réels.
3. Plafonds KYC exacts applicables au produit (à confirmer avec le partenaire et son juriste BCEAO).
4. Sourcing DESFire EV3 : fournisseur (Alibaba vs distributeurs NXP), MOQ, délais, personnalisation (impression logo événement).
5. Assurance responsabilité + trésorerie : qui porte le risque d'un écart de réconciliation vis-à-vis de l'organisateur ?
6. Positionnement vs Weezevent/Billetweb s'ils entrent sur la zone : différenciation = intégration mobile money + opération terrain locale.

---

*Fin du document v0.1 — chaque chapitre a vocation à être éclaté en specs détaillées dans `docs/specs/` au démarrage du projet.*

---

## 16. Extension — Paiements du quotidien (réseau de proximité) — v0.2

### 16.1 Vision révisée
L'événement n'est plus la finalité : c'est le **canal d'acquisition**. Le support NFC reçu à un festival ne meurt plus à la clôture — il devient un instrument de micro-paiement du quotidien dans un réseau de commerces partenaires : boutiques de quartier, cantines scolaires et universitaires, gargotes, transport, kiosques.

**Positionnement honnête face à Wave/Orange Money** — le réseau de proximité ne gagne PAS en concurrence frontale avec le QR mobile money. Il gagne là où le mobile money est structurellement faible :
1. **Micro-montants** (25–2 000 FCFA : pain, eau, transport, beignets) où le flux QR est trop lent et où chaque seconde de file compte.
2. **Payeurs sans smartphone** : enfants, élèves, personnes âgées, personnel — une carte suffit.
3. **Argent délégué et fléché** : le cas d'usage le plus fort — un parent recharge à distance (depuis Dakar ou la diaspora, via Wave) la carte cantine de son enfant, avec plafonds journaliers et restrictions de catégories de commerces. Idem cartes repas d'entreprise. C'est un produit que les opérateurs mobile money n'offrent pas.
4. **Zones à connectivité médiocre** : le tap fonctionne toujours.

### 16.2 Impacts sur l'architecture (deltas vs chapitres 4–7)

| Domaine | Événementiel (v0.1) | Réseau du quotidien (v0.2) |
|---|---|---|
| Cycle de vie du support | Lié à UN événement, remboursé à la clôture | **Wallet persistant lié au réseau** ; les événements deviennent des « zones d'acceptation » temporaires du même réseau |
| Settlement | À la clôture de l'événement | **Quotidien** (J+1 glissant) par commerçant |
| Onboarding accepteur | Vendeur inscrit par l'organisateur | **KYB commerçant** (registre de commerce ou NINEA si formel, régime allégé sinon — à cadrer avec le partenaire), contrat d'acceptation, terminal ou app SoftPOS |
| Sync des terminaux | Opportuniste pendant l'événement | **Au moins quotidienne obligatoire** (les boutiques ont généralement une connectivité intermittente suffisante) |
| Blocklist | Petite liste par événement | Diffusion à l'échelle du réseau : deltas versionnés + filtre de Bloom pour le test rapide, liste exacte pour la confirmation |
| Clés | Hiérarchie par événement | **Hiérarchie par génération de réseau** avec rotation : les cartes sont re-clefées lors d'un contact avec un terminal en ligne ; date d'expiration sur chaque support (ex. 24 mois) forçant le renouvellement |

### 16.3 Maîtrise du risque offline longue durée (nouveau — critique)
Un solde offline qui vit des mois (et non 3 jours) élargit la fenêtre de fraude. Contre-mesures **obligatoires** :
- **Deux paliers de solde** : plafond « quotidien » bas sur la puce (ex. 50 000 FCFA) ; le reste du wallet vit côté serveur (« solde en ligne ») et se transfère vers la puce lors d'un passage sur un terminal connecté ou une borne.
- **Obligation de contact** : une carte qui n'a pas « vu » de terminal en ligne depuis N jours (ex. 30) ou T transactions (ex. 50) passe en `soft-block` : les terminaux offline la refusent jusqu'à re-synchronisation. Le compteur de contact est sur la puce, vérifiable hors ligne.
- **Vélocité offline** : plafond de dépense par jour hors ligne écrit sur la puce (fichier compteur journalier).
- **Réconciliation d'ombre** : le serveur maintient en permanence le solde attendu de chaque carte ; tout écart détecté à la sync → quarantaine + investigation (jamais de correction silencieuse).

### 16.4 Recharge dans le réseau du quotidien
- Auto-service : l'utilisateur (ou le parent à distance) paie via Wave/OM → le crédit atterrit sur le **solde en ligne** → transfert vers la puce au prochain contact connecté (boutique partenaire, borne, ou téléphone NFC du commerçant).
- **Commerçant-agent (cash-in)** : le commerçant encaisse des espèces et crédite la carte via son terminal connecté. ⚠️ Ceci fait du commerçant un agent de distribution de monnaie électronique — régime des agents BCEAO à respecter via le partenaire émetteur (contrat d'agent, plafonds, formation). Ne pas improviser ce point.

### 16.5 Cas d'usage prioritaires du réseau (ordre d'attaque)
1. **Cantines scolaires/universitaires** (écosystème fermé, payeur = parent, valeur évidente, densité de transactions) — le meilleur second marché après l'événementiel.
2. **Campus** (cafétérias, photocopies, transport interne).
3. **Réseaux de boutiques autour des campus/écoles** (extension naturelle).
4. **Transport organisé** (navettes d'entreprises, lignes privées) — le transport public de masse (AFTU, TER) est un chantier séparé, institutionnel.

### 16.6 Impacts réglementaires
L'extension au quotidien lève toute ambiguïté : c'est de la monnaie électronique en réseau ouvert-restreint. Conséquences : le partenariat EME devient structurel (pas provisoire) ; le régime des agents s'applique au cash-in commerçant ; les paliers KYC pilotent les plafonds produit (palier léger = petite carte du quotidien, palier complet = plafonds étendus). L'objectif d'agrément Établissement de Paiement (Phase 3) devient un objectif d'agrément **EME** si l'on veut un jour émettre en propre.

---

## 17. Politique de dépendances minimales — v0.2 (révise le chapitre 9)

> **Décision effective (v0.6) :** l'équipe a retenu **TypeScript + Fastify** (ADR-001, ADR-006), pas Go. La table ci-dessous est conservée comme historique de la comparaison ; lire la colonne « Alternative si l'équipe reste TS » comme le choix réel. Budget runtime actuel : **4** (pg, zod, fastify, qrcode-generator — ADR-010).

### 17.1 Principe
Chaque dépendance est une surface d'attaque (supply chain), une charge de maintenance et un aléa de pérennité. Règle : **une dépendance n'entre que si la réécrire nous coûterait plus cher que le risque qu'elle importe — et chaque entrée est justifiée par un ADR.** Les primitives de sécurité ne viennent JAMAIS de bibliothèques tierces : uniquement des plateformes (node:crypto / crypto Go / Android Keystore).

### 17.2 Stack révisée

| Couche | v0.1 | **v0.2 (retenu)** | Justification |
|---|---|---|---|
| Moteurs ledger/protocol | TS pur, zéro dép. | **Inchangé — zéro dépendance** | Déjà conforme |
| API | NestJS + Drizzle + pg-boss | **Go, bibliothèque standard** : `net/http` (routeur 1.22+), `database/sql` + `pgx` (seule dépendance runtime vetted), `crypto/ed25519`, `encoding/json` | NestJS tire des centaines de paquets transitifs ; Go stdlib couvre HTTP, crypto, SQL ; binaire statique unique, image distroless, surface minimale. Le moteur ledger est alors **porté en Go** (même sémantique, mêmes golden fixtures JSON partagées — les fixtures deviennent le contrat inter-langages) |
| Alternative si l'équipe reste TS | — | Node 22 : `node:http` + routeur maison (~100 lignes) ou Fastify seul, `pg` seul (SQL manuscrit + migrations par fichiers numérotés), `zod` seul pour la validation. **Interdits : ORM, framework DI, BullMQ** (jobs = table Postgres + `FOR UPDATE SKIP LOCKED`, ~80 lignes maison) | Trois dépendances runtime au lieu de plusieurs centaines |
| Terminal Android | Kotlin + SQLCipher | Kotlin + AndroidX minimal (core, lifecycle). **Ni Firebase, ni SDK analytics, ni RN.** SQLite de la plateforme + chiffrement applicatif des colonnes sensibles avec clé enveloppée par le Keystore (supprime SQLCipher) | Zéro télémétrie tierce sur un terminal de paiement |
| Dashboard | Next.js | Toléré (hors chemin critique) OU rendu serveur Go + templates `html/template`. Isolation stricte : le dashboard n'a **aucun** accès en écriture au ledger ni aux clés | Le risque d'une dépendance front n'atteint jamais l'argent |
| Jobs, queues | pg-boss | Table Postgres maison (voir ci-dessus) | — |

### 17.3 Règles de chaîne d'approvisionnement (CI bloquante)
- Versions **épinglées exactement** (lockfiles commités ; `go.sum` vérifié ; vendoring Go activé).
- `ignore-scripts` npm activé globalement (aucun script post-install ne s'exécute).
- Scan **osv-scanner** + audit des licences à chaque PR ; SBOM (syft) générée à chaque release.
- Toute mise à jour de dépendance = PR dédiée, diff du lockfile relu, jamais mélangée à une feature.
- Images Docker : base **distroless/static**, build reproductible, utilisateur non-root.
- Budget : le nombre de dépendances runtime directes par service est affiché en CI ; tout dépassement du budget déclaré échoue le build.

### 17.4 Règle Cursor supplémentaire — `.cursor/rules/05-dependencies.mdc` (alwaysApply: true)
```markdown
---
description: Politique de dépendances minimales
alwaysApply: true
---
- INTERDIT d'ajouter une dépendance (package.json, go.mod, build.gradle) sans
  ADR approuvé dans docs/adr/ justifiant : besoin, alternatives stdlib
  évaluées, coût de réécriture, réputation/maintenance du paquet.
- Préférer TOUJOURS la bibliothèque standard : si la fonctionnalité tient en
  < 200 lignes maison testées, l'écrire plutôt que l'importer.
- Crypto, aléa, gestion de clés : primitives de plateforme UNIQUEMENT
  (node:crypto, crypto Go, Android Keystore). Aucune lib crypto tierce, jamais.
- Aucun SDK de télémétrie/analytics tiers dans apps/terminal.
- Ne jamais proposer un framework (ORM, DI, state management) pour résoudre
  un problème local : proposer d'abord la solution sans dépendance.
- Toute suggestion de code qui introduirait une dépendance transitive nouvelle
  doit le signaler explicitement dans la réponse.
```

### 17.5 Ce que ce choix coûte (à assumer)
Moins de dépendances = plus de code maison à tester (routeur, jobs, migrations). C'est un échange délibéré : ~500–800 lignes d'infrastructure maison, triviales et stables, contre des milliers de paquets transitifs non audités. Les golden fixtures et le simulateur d'événement (ch. 14) sont ce qui rend cet échange sûr.

---

## 18. Double support : NFC **ou** QR-code — v0.3

> **Décision d'architecture : ADR-011 (adoption du double support NFC + QR).** Ce chapitre en est l'analyse détaillée ; la décision, ses alternatives écartées et ses conséquences sont consignées dans l'ADR-011.

### 18.1 Pourquoi et l'avertissement qui va avec
Offrir un QR-code en plus du support NFC élargit fortement la portée : personnes sans bracelet, pré-enrôlement à distance (billet acheté en ligne → QR reçu par WhatsApp/SMS avant l'événement), remplacement immédiat d'un support perdu, coût matériel nul pour le canal QR.

**Mais il faut le dire sans détour : un QR-code ne peut PAS être un porte-monnaie hors ligne comme la puce.** C'est la décision d'architecture la plus importante de cette version.

- La sécurité du modèle NFC repose sur le fait que **le solde et sa preuve vivent dans la puce** (DESFire, AES, Transaction MAC, décrément atomique) : personne, pas même un terminal compromis, ne peut fabriquer de la valeur.
- Un QR-code n'est qu'une **suite de caractères** : il ne calcule rien, ne signe rien, se photographie et se partage. Il ne peut donc jamais *porter* un solde. Il ne peut être qu'un **identifiant** pointant vers un solde gardé sur le serveur.
- Conséquence inévitable : **un paiement par QR exige le réseau au moment du tap** (le serveur est l'autorité du solde). Le QR hérite exactement du problème que l'architecture NFC était conçue pour éviter.

On ne résout pas cette tension, on l'**assume** avec un modèle à deux niveaux d'autorité.

### 18.2 Modèle retenu — wallet unique, deux autorités de solde

Le concept central devient le **wallet** (identifié par un `wallet_id` interne, lié à un MSISDN optionnel). Un wallet peut être exposé par un ou deux supports :

| | **Support NFC (DESFire)** | **QR-code** |
|---|---|---|
| Autorité du solde | **La puce** (offline) | **Le serveur** (online) |
| Paiement sans réseau | Oui — cœur du système | **Non** — réseau requis au tap |
| Latence cible | p95 < 500 ms | dépend du réseau (viser < 3 s online) |
| Menace principale | clonage puce (contrée par AES+MAC) | copie/partage/rejeu du code |
| Idéal pour | forte affluence, zones sans réseau, gros montants cumulés | portée, pré-enrôlement distant, dépannage, petits montants |

Un même wallet peut avoir les deux : un solde « puce » (offline) et un solde « serveur » (online), réconciliés — mais **jamais dépensables deux fois** (voir 18.4).

### 18.3 Trois variantes de QR — et laquelle choisir
1. **QR statique = identifiant du wallet** (imprimé sur billet/bracelet papier). Le plus simple, le plus large. **Ne porte aucune valeur** ; le terminal l'envoie au serveur qui autorise le débit. Réseau obligatoire. Risque : quiconque photographie le code peut tenter de payer avec → **obligation** d'un second facteur pour la valeur (code PIN à 4 chiffres saisi sur le terminal, ou plafond très bas sans PIN).
2. **QR dynamique présenté par le téléphone du payeur** (jeton tournant type TOTP, régénéré toutes les 30–60 s dans une mini-app/PWA). Résiste au rejeu (un code capturé expire). Exige que le payeur ait un smartphone et une appli — donc réduit l'avantage « portée » et rapproche l'expérience de Wave. Utile pour les montants plus élevés.
3. **QR présenté par le marchand + montant, scanné par le payeur** qui confirme dans son appli. Entièrement online, c'est le schéma mobile-money classique — peu différenciant, à réserver aux marchands sans terminal.

**Recommandation v3 :** QR **statique = identifiant**, avec **PIN obligatoire au-delà d'un micro-plafond** et **plafonds de vélocité serveur** stricts. La variante dynamique (2) est une option de durcissement pour gros montants, pas le défaut.

### 18.4 Règle d'or anti-double-dépense
Le danger d'un wallet à deux supports : dépenser le même argent via la puce (offline) ET via le QR (online). Règles obligatoires :
- **Cloisonnement des soldes** : le solde chargé sur la puce est *transféré* hors du solde serveur (débité côté serveur au moment de l'écriture sur puce). Les deux poches ne se recouvrent jamais.
- Un paiement QR ne peut puiser QUE dans le solde serveur ; un paiement NFC QUE dans le solde puce.
- Recharger l'une des poches est une opération explicite ; il n'y a pas de solde « partagé » ambigu.
- À la réconciliation, l'invariant du chapitre 6.7 devient : `liability:wallets = Σ soldes puce (reconstruits) + Σ soldes serveur`.

### 18.5 Sécurité spécifique au QR
- Le QR encode un identifiant opaque **non devinable** (aléa 128 bits), jamais le MSISDN ni un solde.
- PIN vérifié **côté serveur** (jamais dérivable du QR), avec limitation stricte des tentatives (verrouillage après N échecs).
- Plafonds de vélocité serveur par wallet (montant/heure, nb de transactions/heure) — première barrière contre un QR partagé.
- Détection d'anomalies : même wallet utilisé à deux endroits éloignés en peu de temps → alerte + gel.
- **Mode dégradé honnête** : si le réseau tombe, les terminaux **refusent clairement** les paiements QR (« réseau indisponible, utilisez un bracelet »). Ils n'autorisent JAMAIS un débit QR à l'aveugle hors ligne — ce serait rouvrir la faille de fraude.

### 18.6 Impacts sur le code (delta v0.3)
- `packages/protocol` : le `PaymentRecord` doit distinguer l'autorité. Ajouter `mediumType: 'NFC' | 'QR'` et `balanceAuthority: 'CHIP' | 'SERVER'`. Pour un paiement QR, `cardTxMac` (preuve puce) est absent et remplacé par une autorisation serveur signée (`serverAuthId`). → **bump `SCHEMA_VERSION` à 2** + fixtures de compatibilité ascendante (règle 10-ledger-core).
- `ledger-core` : le rejeu par compteur (`replayCard`) concerne la puce. Les paiements QR, étant online et séquencés par le serveur, suivent un chemin d'autorisation distinct (pas de compteur puce) — introduire un `authorizeServerPayment()` pur (vérifie solde serveur + vélocité + PIN déjà validé) séparé de `replayCard()`. SRP respecté : deux use cases, deux fichiers.
- `apps/api` : nouveau use case `AuthorizeQrPayment` (online, synchrone) à côté de `IngestSyncBatch` (offline, batch). Nouveau port `WalletBalanceRepository` (solde serveur) distinct de `LedgerEventStore`.
- `apps/terminal` : le scan QR (caméra) est un mode d'entrée alternatif au tap NFC, mais route vers le chemin **online** ; l'UI doit rendre l'exigence réseau visible et l'échec explicite.

### 18.7 Ce que ce choix change dans le discours commercial
Ne pas vendre le QR comme « la même chose sans le bracelet ». Le positionner honnêtement : le bracelet NFC est le produit *premium* (instantané, sans réseau, pour les zones denses) ; le QR est le produit *d'accès* (large, distant, dépendant du réseau, plafonné). Sur un site sans couverture, seul le NFC fonctionne — c'est un argument de vente du bracelet, pas une faiblesse à cacher.

---

## 19. Interface participant — PWA, sans application native — v0.4

### 19.1 Décision
Le participant n'installe **rien**. Il scanne le QR (avec l'appareil photo natif de son téléphone) et arrive sur une **PWA** (progressive web app) : solde en cours, historique des dépenses, actions (associer un numéro pour le remboursement, demander un remboursement, recharger). Installable sur l'écran d'accueil, mais jamais obligatoire.

Cela ne change **pas** le fait que le terminal marchand NFC reste natif (Android/Kotlin) : aucun navigateur ne sait faire une transaction DESFire authentifiée. « Sans app » concerne le **participant**, pas l'acceptation.

### 19.2 L'avertissement central : l'URL du QR n'est PAS un mot de passe
Le QR se porte au poignet toute la journée ; il est **photographié** en une seconde. L'URL qu'il contient doit donc être traitée comme **publique**.

Règle absolue : **la simple possession de l'URL ne donne accès à RIEN de sensible.**
- Le QR encode une URL à identifiant **opaque et non devinable** (128 bits d'aléa) : `https://m.jotay.sn/w/{opaqueId}`. Jamais le solde, jamais le MSISDN, jamais un jeton porteur de valeur.
- La page d'atterrissage ne montre au départ **rien de sensible** (au plus : « Portefeuille Jotay — événement X »).
- **Voir** le solde et l'historique, et **surtout agir** (remboursement, changement de numéro), exige un **second facteur** qui ouvre une session courte. La possession du lien ne suffit jamais.

Sans cette règle, quiconque photographie un bracelet voit les dépenses de la personne et peut tenter de détourner son remboursement. C'est le risque n°1 de ce parcours.

### 19.3 Modèle d'authentification recommandé (à deux niveaux)
- **Niveau 1 — ouvrir une session de consultation** : le participant saisit son numéro et reçoit un code à usage unique (OTP). Au Sénégal, envisager **WhatsApp OTP** en premier (ubiquité, coût, fiabilité) avec **SMS** en repli. La session est courte (ex. 15 min), liée à l'appareil, révocable.
- **Niveau 2 — actions qui déplacent de l'argent** (demander un remboursement, changer le numéro de payout) : exiger un **PIN** en plus de la session, et n'autoriser le remboursement que vers un **MSISDN déjà associé et vérifié**. Changer ce numéro déclenche une re-vérification renforcée + délai de sécurité. Vélocité et détection d'anomalie s'appliquent.

Ce choix (OTP de session + PIN pour la valeur) est le compromis sûreté/friction retenu ; il reste paramétrable.

### 19.4 Ce que la PWA montre et fait
- **Solde** : c'est la **vue serveur** du wallet. Rappel du chapitre 18 : le navigateur ne peut pas lire la puce DESFire (le Web NFC ne fait pas d'authentification DESFire). La PWA reflète donc le solde **serveur** + l'historique **synchronisé** ; les dépenses puce hors ligne apparaissent **après la synchronisation** du terminal. Afficher honnêtement « à jour à HH:MM » et un indicateur clair de fraîcheur — ne jamais laisser croire à un temps réel qu'on n'a pas.
- **Historique** des dépenses (montant, marchand, heure) issu du ledger serveur.
- **Actions** : associer/vérifier un numéro pour le remboursement, demander le remboursement du solde, recharger (lien profond Wave/Orange Money), signaler un litige.
- **Payer par QR (variante optionnelle)** : si l'on retient le schéma « marchand présente un QR de montant, le participant le scanne dans la PWA et confirme » (chap. 18.3, option 3), la PWA devient instrument de paiement — entièrement en ligne, plafonné, PIN au-delà du micro-plafond. Défaut conservé : c'est le marchand qui scanne le support du participant ; ce mode est un complément pour les marchands sans terminal.

### 19.5 Contraintes techniques PWA
- **Offline** : un service worker met en cache la coquille (UI) pour un chargement instantané, mais le solde exige le réseau (autorité serveur). État hors ligne = affichage du dernier solde connu **daté**, actions de valeur **désactivées**.
- **Caméra** (pour la variante paiement) : `BarcodeDetector` quand disponible, repli sur un décodeur QR embarqué minimal. Pas de SDK tiers lourd (politique de dépendances, chap. 17).
- **Confidentialité** : aucune donnée sensible en `localStorage` ; session en cookie `HttpOnly`/`Secure`/`SameSite=Strict`. Rien de personnel dans l'URL ni les logs (chap. 7, CDP).
- **Accessibilité/terrain** : fonctionne sur navigateurs Android anciens et petits écrans, gros boutons, faible bande passante, français par défaut, anglais pour l'expansion sous-régionale.

### 19.6 Impacts sur le code (delta v0.4)
- **Nouvelle app** `apps/participant-pwa` (hors chemin critique de l'argent, mais soumise à la politique de dépendances : à trancher par ADR — coquille minimale plutôt qu'un gros framework).
- **Nouveaux endpoints API** (lecture surtout ; une seule action mutante) :
  - `POST /portal/session` (demande OTP) et `POST /portal/session/verify` (ouvre la session) ;
  - `GET /portal/wallet` (solde serveur + fraîcheur + historique) — **authentifié** ;
  - `POST /portal/refund-request` — **action de valeur** : session + PIN + MSISDN vérifié ; confirmation explicite ; idempotente.
- **Nouveaux ports** (ISP) : `OtpChannel` (envoi WhatsApp/SMS), `PortalSessionStore` (sessions courtes révocables), réutilisation de `WalletBalanceRepository` (lecture) et `PinVerifier` (niveau 2).
- Le solde exposé par le portail est **toujours** la projection serveur : aucune écriture de solde, aucune invention de valeur (échec honnête si la projection est en retard → on affiche la date, pas une estimation).

---

## 20. Modèle d'acceptation unifié — v0.5

### 20.1 La règle simple qui organise tout
On sépare **par appareil** ce qui doit rester natif de ce qui peut être web, selon une seule frontière : **lire une puce DESFire en sécurité exige du natif ; tout le reste peut être web.**

- **Participant** : jamais d'app. Support NFC (bracelet/carte) qu'on lui tape, **ou** QR + PWA de consultation (chap. 19). Un participant peut avoir les deux.
- **Marchand standard** : **un seul terminal natif** (Android/Kotlin) qui accepte les **deux** entrées — tap NFC (chemin offline, autorité puce) et scan QR (chemin online, autorité serveur), via la même caméra et le même lecteur NFC.
- **Micro-marchand sans équipement** : **PWA marchande QR-only** — scanne le QR du participant, saisit le montant, appelle l'API d'autorisation en ligne. Aucun matériel, onboarding immédiat, mais réseau obligatoire et pas de tap sous-500 ms.

### 20.2 Trois appareils, deux chemins de paiement déjà construits
Aucun nouveau moteur : les deux chemins existent déjà dans le code (chap. 18).

| Appareil | Nature | Entrées | Chemin de paiement | Réseau requis au paiement |
|---|---|---|---|---|
| Support participant | NFC ou QR imprimé | — | — | — |
| Terminal marchand standard | **natif** Android | tap NFC **+** scan QR | NFC → `IngestSyncBatch` (offline, batch) ; QR → `AuthorizeQrPayment` (online) | NFC : non · QR : oui |
| PWA marchande (micro) | **web** | scan QR | `AuthorizeQrPayment` (online) | oui |
| PWA participant | **web** | — (consultation) | aucun (lecture) | oui |

### 20.3 Comment le terminal standard route une transaction
1. Le caissier saisit le montant (ou sélectionne des produits).
2. Il présente l'écran d'encaissement ; deux gestes possibles pour le client :
   - **Tap NFC** → le terminal exécute la transaction DESFire **hors ligne** (débit sur la puce, record signé) et l'empile pour la synchronisation. Instantané, sans réseau.
   - **Scan QR** → le terminal résout le wallet, appelle `POST /payments/qr/authorize` **en ligne** (PIN si au-delà du micro-plafond), affiche l'accord/refus. Nécessite le réseau.
3. Si le réseau manque **et** que le client n'a qu'un QR → refus honnête et explicite (« réseau indisponible, utilisez un bracelet »). Le terminal ne devine jamais un solde serveur hors ligne (chap. 18.5).

### 20.4 Conséquence commerciale
Le tap NFC sans réseau est l'atout maître ; le QR est la portée. Un même terminal les porte tous deux, ce qui évite de gérer deux parcs. La PWA marchande QR-only ouvre la longue traîne des micro-vendeurs à coût nul, sans jamais dégrader l'expérience premium du bracelet.

### 20.5 Impact sur le code (delta v0.5)
- **Aucun nouveau moteur ni nouvel endpoint de paiement** : le terminal standard réutilise `IngestSyncBatch` (NFC/offline) et `AuthorizeQrPayment` (QR/online) ; la PWA marchande n'utilise que ce dernier.
- **Nouvelle app** `apps/merchant-pwa` (web, QR-only) — coquille minimale sans framework (ADR-003), appelle `/payments/qr/authorize`.
- Le terminal natif `apps/terminal` gagne un second mode d'entrée (caméra QR) routant vers le chemin online, à côté du tap NFC déjà spécifié (SPEC-F3). Les deux chemins restent étanches : jamais de débit QR hors ligne, jamais de record puce sans commit DESFire.

---

## 21. État d'implémentation — v0.6 (spec vs code réel)

Ce chapitre réconcilie la spec avec le dépôt. Il fait foi sur « ce qui existe vraiment ».

### 21.1 Implémenté et testé (4 niveaux : unitaire / intégration / e2e / régression)
- **Moteur comptable** (`ledger-core`) : partie double, rejeu par compteur, détection de clonage / trous / soldes négatifs, projections, invariant `liability:wallets = Σ soldes`. Tests golden + **tests de propriété seedés** (conservation, idempotence, insensibilité à l'ordre, aucun solde négatif).
- **Protocole v2** (`protocol`) : `PaymentRecord` avec `mediumType` (NFC/QR) et `balanceAuthority` (CHIP/SERVER), sérialisation canonique signée.
- **Vérification des signatures Ed25519** à l'ingestion : tout record forgé ou de terminal révoqué est écarté avant stockage et signalé `BAD_SIGNATURE` (node:crypto, port `SignatureVerifier` + registre de clés).
- **Card-crypto** (`card-crypto`) : AES-CMAC **validé contre les vecteurs RFC 4493** + diversification de clés par UID (schéma type NXP AN10922).
- **Paiement QR online, de bout en bout** :
  - identifiant **opaque** minté (128 bits, node:crypto) et lié au wallet au provisionnement
    (`ProvisionQrSupport`, ports `OpaqueIdMinter` + `QrBindingStore`) ;
  - `AuthorizeQrPayment` résout `opaqueId → wallet` **côté serveur** — le marchand ne
    manipule jamais le walletId interne ; autorité serveur, PIN au-delà du micro-plafond,
    vélocité, cloisonnement anti-double-dépense ; opaqueId inconnu → 404 ;
  - PWA marchande QR-only : scan (BarcodeDetector) → envoi de l'opaqueId → `/payments/qr/authorize` ;
  - QR **imprimable** généré par l'outil de provisionnement (`pnpm qr:sample`, ADR-010).
- **QR dynamique** (variante tournante, chap. 18.3 option 2) : TOTP (RFC 6238, **validé
  contre les vecteurs officiels** dans `card-crypto`), code régénéré toutes les 30 s,
  **usage unique** (garde anti-rejeu par pas de temps). `AuthorizeDynamicQrPayment` vérifie
  le code puis délègue au flux serveur ; `GetDynamicQrToken` fournit le code à la PWA (le
  **secret ne quitte jamais le serveur**) ; rendu SVG via `qrcode-generator` (zéro dép
  transitive, ADR-010). La PWA marchande route automatiquement selon le payload (`opaqueId`
  statique ou `opaqueId:code` dynamique).
- **Portail participant** (PWA + API) : WhatsApp OTP (port `OtpChannel` agnostique), session cookie HttpOnly (flag Secure configurable), vue du solde datée, remboursement (PIN + MSISDN vérifié), anti-énumération. i18n **fr/en**.
- **Clôture d'événement** (`closeEvent`) : réconciliation tripartite bloquante + settlement vendeurs.
- **Rate limiting** (moteur pur + hook Fastify) sur `/portal/session` et `/payments/qr/authorize`.
- **Observabilité** : `/metrics` Prometheus maison, logger pino activable.
- **Jobs** : file idempotente + backoff exponentiel (adapter mémoire ; PG à venir).
- **HTTP** : Fastify (`buildApp`), validation zod. E2e HTTP + e2e navigateur Playwright (ADR-005).
- **Cohérence puce↔serveur, cas limites testés** : terminal perdu avant sync -> `COUNTER_GAP` ;
  arrivée tardive du lot -> trou refermé au rejeu complet ; solde annoncé incohérent ->
  `BALANCE_CHAIN_BROKEN`. Aucune divergence n'est corrigée silencieusement.
- **Rotation de clés Ed25519 à période de grâce** : un lot offline signé avec l'ancienne clé
  reste vérifiable pendant la fenêtre de grâce (validKeys par instant) ; refusé après.
- **Anti-rejeu QR dynamique atomique** : unicité `(wallet, pas de temps)` (migration + contrat
  d'atomicité) ; consommations concurrentes -> exactement une réussit.
- **Recharge Mobile Money (Wave / Orange Money)** : webhook signé + **ACTIVE CHECK**
  (re-confirmation auprès de l'opérateur, jamais sur la seule foi du webhook), crédit
  idempotent par référence, audité.
- **Ajustements superviseur audités** : crédit/débit idempotent + entrée d'audit obligatoire
  (jamais d'écriture de solde silencieuse).
- **Pont clôture -> payout** : soldes restants avec MSISDN vérifié -> jobs de remboursement
  idempotents ; sans MSISDN vérifié -> compté et audité (pas de perte silencieuse).

### 21.2 Scaffoldé (port + migration + fake, câblage/adapter réel à finir)
- **Journal d'audit** immuable : port `AuditLog` + migration ; câblage dans les use cases (opposition, ajustement, remboursement, clôture) à faire.
- **Sessions portail** : logique d'expiration/révocation pure + migration ; adapter Postgres réel à écrire.
- **Adapters Postgres/opérateur réels** (stubs explicites, échouent bruyamment) : registre de clés de terminaux (migration 0003), sessions, file de jobs, historique, secret TOTP par wallet, garde anti-rejeu (migration 0004), journal d'audit, passerelle Mobile Money (Wave/OM), payouts (migration 0005).

### 21.3 Spécifié, non implémenté
- Terminal Android natif (chemin de paiement NFC, scan QR) — SPEC-F3.
- PI-SPI via partenaire (interopérabilité BCEAO).
- Blocklist distribuée côté terminal (filtre de Bloom + delta).
- Dashboard organisateur.
- Réseau du quotidien / cantines (chap. 16) au-delà du modèle de données.

### 21.4 Hors code (voir `docs/HORS-CODE.md`)
- **Validation DESFire sur matériel réel** (vecteurs NXP, SAM, APDU) — nécessite cartes + lecteur.
- **Partenaire émetteur agréé** et conformité BCEAO — chantier juridique/business.
- Recherche d'antériorité de marque « Jotay » à l'OAPI.

### 21.5 Décisions d'architecture (ADR)
ADR-001 TypeScript + Clean Architecture · ADR-002 pas de DI/ORM (volet HTTP remplacé) ·
ADR-003 PWA sans framework · ADR-004 helper d'échappement · ADR-005 Playwright e2e ·
**ADR-006 Fastify** · ADR-007 KMS/secrets · ADR-008 sauvegarde/DR · ADR-009 observabilité · ADR-010 génération QR (hors runtime) · **ADR-011 adoption du double support NFC + QR**.

### 21.6 Discipline de tests (règle 41)
Après chaque implémentation : unitaire + intégration + e2e + régression. Barrière avant
déploiement : `pnpm sim` (réconciliation exacte au FCFA près). État actuel : **63 tests au vert**.
