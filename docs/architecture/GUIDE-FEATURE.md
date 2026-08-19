# Guide — nouvelle feature

Aucune feature n'est « commencée » dans le code. Le cycle ci-dessous est obligatoire.
S'il ne s'applique pas (doc pure, typo), l'écrire en une ligne dans la PR.

```
 1. Lire     INVENTAIRE + CAPACITES + SPEC-JOTAY (chapitre visé)
 2. Cadrer   OpenSpec change (proposal → specs → design → tasks)
 3. Spécifier  docs/specs/SPEC-…  (FR, nominal + dégradés + ledger)
 4. Trancher ADR si décision non triviale ou nouvelle dépendance
 5. Fixtures d'abord (golden / exemples entrée→sortie) — revue humaine
 6. Moteur pur     packages/*   (si l'argent ou un invariant bouge)
 7. Use case+ports application/ (SRP, Result, pas d'I/O concrète)
 8. Adapter        infrastructure/ + fake dans test/fakes.ts
 9. Interface      route Fastify + zod  |  PWA vanilla  |  Kotlin
10. Preuves        4 niveaux (règle 41) + sim si le ledger bouge
11. Terrain        runbook si ça change l'opération
```

## 1. Lire avant d'écrire

- `docs/architecture/INVENTAIRE.md` — état réel vs spec.
- `docs/architecture/CAPACITES.md` — accroche existante ou nouvelle capacité.
- Le chapitre de `SPEC-JOTAY.md` et toute `SPEC-Fx` déjà là.
- `docs/architecture/COUCHES.md` — emplacement des fichiers.

Ne pas inventer un plafond, un comportement Wave/OM, ou un palier KYC : `TODO(question)` ou demander.

## 2. OpenSpec

Toute feature de comportement passe par un change (`openspec new change "<nom-anglais>"`).

- Proposal : problème, pourqui, hors-scope, capacité touchée.
- Specs delta : exigences + scénarios (nominal **et** dégradés).
- Design : couches, ports, écritures ledger, `CRITICAL-PATH` oui/non.
- Tasks : ordre fixtures → moteur → ports → HTTP/PWA → tests.

Le contexte et les règles d'artefacts sont dans `openspec/config.yaml`.

## 3. Spec FR

Copier `docs/specs/SPEC-TEMPLATE.md`. Une spec par capacité/feature, pas un pavé fourre-tout.

Doit contenir : nominal, dégradés exhaustifs, règles chiffrées, exemples qui deviendront des fixtures, impacts ledger (partie double), questions ouvertes.

## 4. ADR

Obligatoire si : nouvelle dépendance, nouveau framework, nouveau champ personnel, changement de protocole (`SCHEMA_VERSION`), choix d'opérateur, ou toute décision que l'on ne veut pas « retrouver dans le code ».

## 5. Fixtures avant le code

> Générer les golden fixtures, les relire, **puis** implémenter.

Couvrir au minimum : nominal, refus métier, doublon/idempotence, un dégradé honnête (réseau, solde, PIN, trou de compteur…).

On ne réduit jamais une fixture existante. Changer un `expected` = PR dédiée métier.

## 6–9. Ordre d'implémentation

Domaine pur → use case + ports → fake d'intégration → adapter → route/UI.

Le chemin NFC ne contient aucun appel réseau. Le chemin QR refuse clairement hors ligne.

## 10. Definition of Done

- [ ] Spec FR à jour et référencée.
- [ ] Inventaire / capacités mis à jour si l'état change.
- [ ] Fixtures golden ou exemples d'entrée→sortie relus.
- [ ] Moteurs sans I/O ; montants en `AmountXof`.
- [ ] Unitaire + intégration + e2e (ou justification d'absence en une ligne).
- [ ] Régression si c'est un bugfix (`fixtures/regression/`).
- [ ] `pnpm sim` vert si le ledger ou le replay bouge.
- [ ] Revue humaine de tout `// CRITICAL-PATH`.
- [ ] Runbook si l'opération terrain change.
- [ ] Aucune dépendance nouvelle sans ADR.

## Anti-patterns

| Ne pas | Faire plutôt |
|---|---|
| Commencer par la route Fastify | Spec + fixture + use case |
| Créditer sur la foi d'un webhook | Signature **et** active check |
| Partager un solde NFC/QR | Transfert explicite de poche |
| Logger un solde + MSISDN | Loguer des ids opaques |
| « Apply all » sur du crypto | Revue ligne à ligne |
| Ajouter Nest/ORM/React « pour aller plus vite » | Ports + vanilla / Fastify déjà là |
