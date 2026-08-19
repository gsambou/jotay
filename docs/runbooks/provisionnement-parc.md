# Runbook — Provisionnement du parc (avant événement)

1. Vérifier les cartes DESFire EV3 (authentiques NXP, pas de clone « compatible »).
2. Charger la clé maître de l'événement dans le banc (KMS/SAM) — jamais en clair sur disque.
3. Pour chaque carte : lire l'UID, dériver K_card (diversification par UID + label), créer
   l'application et les fichiers (value file, compteur, journal), passer l'état à `provisioned`.
4. Charger la config événement signée sur chaque terminal ; enregistrer la clé publique
   Ed25519 de chaque terminal dans le registre (sinon ses lots seront refusés).
5. Contrôle : 5 cartes témoins testées de bout en bout (activation → top-up → paiement → sync).
