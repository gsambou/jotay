# Runbook — Clôture d'événement (réconciliation tripartite)

1. S'assurer que tous les terminaux ont synchronisé (aucun terminal muet, aucune file en attente).
2. Lancer la clôture : le système calcule Σ recharges, Σ dépenses, Σ soldes restants.
3. Invariant BLOQUANT : `Σ recharges = Σ dépenses + Σ soldes restants` (au FCFA près) ET
   zéro anomalie. Tout écart bloque la clôture et ouvre une investigation — on ne force jamais.
4. Une fois réconcilié : générer les relevés vendeurs (brut − commission = net) et déclencher
   les payouts via le partenaire (file de jobs, idempotente).
5. Ouvrir la fenêtre de remboursement des soldes participants ; consigner la clôture à l'audit.
