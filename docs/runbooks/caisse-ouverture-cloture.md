# Runbook — Session caissier (top-up cash)

Ouverture : déclarer le fonds de caisse, ouvrir la session (cash_drawer dédié).
Pendant : chaque recharge cash est rattachée à la session ; aucun crédit optimiste.
Clôture : compter les espèces, saisir le réel. L'écart théorique/réel est calculé
automatiquement ; tout écart non nul est signalé et documenté avant de clôturer la session.
