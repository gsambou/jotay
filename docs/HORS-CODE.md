# Ce qui n'est pas (et ne peut pas être) du code

Deux chantiers critiques ne se règlent pas dans ce dépôt :

1. **Validation DESFire sur matériel réel.** La diversification de clés et la logique de
   transaction sont implémentées et testées (AES-CMAC validé contre RFC 4493), mais
   l'exactitude vis-à-vis des vecteurs NXP AN10922, le SAM, et le comportement des APDU
   doivent être validés avec des cartes et un lecteur physiques. Sans ça, le cœur offline
   reste une hypothèse. → Commander le matériel, monter le banc (tools/card-bench), valider.

2. **Partenaire émetteur agréé et conformité réglementaire.** Émettre de la monnaie
   électronique acceptée par des tiers relève d'un agrément BCEAO. Le lancement légal passe
   par un partenaire agréé (cantonnement du float, KYC, LBC/FT). C'est un chantier
   juridique/business, chemin critique non technique. → Identifier et contracter le partenaire.

Autre : recherche d'antériorité de la marque « Jotay » à l'OAPI avant tout dépôt/investissement.
