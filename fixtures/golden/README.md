# Golden fixtures — contrat du moteur

Chaque fichier JSON est un scénario complet : `records` (PaymentRecord bruts, y compris
doublons et anomalies volontaires) → `expected` (état exact attendu en sortie de
`runScenario`). Règles :

- Les fixtures ne sont JAMAIS réduites. Toute modification d'une valeur `expected`
  passe par une PR dédiée expliquant le changement métier.
- Tout bug corrigé = une fixture ajoutée qui le reproduit.
- Champs `expected` : `balances` (par carte), `vendorGross` (par vendeur),
  `anomalyKinds` (ordonnées), `blockedCards`, `balanced` (invariant
  liability:wallets == somme des soldes puces).
- Les MAC/signatures sont fictifs ici : la vérification cryptographique est testée
  séparément (infrastructure), le moteur étant purement comptable.
