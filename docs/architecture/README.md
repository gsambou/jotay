# Architecture Jotay — point d'entrée

Ces fichiers **structurent** toute nouvelle feature et tout refactoring.
Ils ne remplacent pas `docs/specs/SPEC-JOTAY.md` (produit) ni les ADR (décisions) :
ils disent **où** le travail vit, **dans quel ordre** le faire, et **quand s'arrêter**.

| Fichier | Quand le lire |
|---|---|
| [INVENTAIRE.md](./INVENTAIRE.md) | Toujours en premier. Carte du système : acteurs, surfaces, capacités, état réel. |
| [COUCHES.md](./COUCHES.md) | Avant d'écrire un fichier. Où le code doit vivre (domaine → ports → adapters → HTTP). |
| [CAPACITES.md](./CAPACITES.md) | Pour savoir quelle spec, quels use cases, quels ports une feature touche. |
| [GUIDE-FEATURE.md](./GUIDE-FEATURE.md) | Avant toute **nouvelle** capacité ou endpoint. Cycle obligatoire. |
| [GUIDE-REFACTOR.md](./GUIDE-REFACTOR.md) | Avant de déplacer, extraire, renommer, ou « nettoyer » du comportement. |

## Ordre de lecture pour un agent

```
SPEC-JOTAY (contexte métier)
        │
        ▼
  INVENTAIRE + CAPACITES     ← où on en est, quoi toucher
        │
        ▼
  GUIDE-FEATURE ou GUIDE-REFACTOR
        │
        ▼
  COUCHES                    ← où poser chaque fichier
        │
        ▼
  Spec FR (docs/specs) + ADR si décision + fixtures
        │
        ▼
  Code (moteur → ports → adapter → interface) + 4 niveaux de tests
```

## Ce qui n'est PAS ici

- Règles Cursor (contraintes injectées) : `.cursor/rules/`
- Décisions déjà tranchées : `docs/adr/`
- Procédures terrain : `docs/runbooks/`
- Hors code (matériel, agrément) : `docs/HORS-CODE.md`
- Contexte OpenSpec (proposé/appliqué) : `openspec/config.yaml`
