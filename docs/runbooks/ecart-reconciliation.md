# Runbook — Écart de réconciliation détecté

Un écart n'est JAMAIS corrigé silencieusement. Procédure :
1. Geler la clôture concernée.
2. Isoler : par carte (compteurs manquants/divergents ?), par terminal (lot non synchronisé ?),
   par session caissier (écart cash ?). Les anomalies (COUNTER_GAP, CLONE_SUSPECTED,
   BALANCE_CHAIN_BROKEN, BAD_SIGNATURE) pointent la source.
3. Si transaction manquante : attendre/forcer la sync du terminal en cause.
4. Si clonage/forge : la carte est déjà en blocklist ; quarantaine des transactions douteuses.
5. Décision d'ajustement (écriture en partie double, motivée, tracée à l'audit) par un superviseur.
   Jamais d'écriture de solde à la main.
