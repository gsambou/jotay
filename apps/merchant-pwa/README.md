# apps/merchant-pwa — Encaissement QR-only (PWA, sans framework)

Pour micro-marchands sans terminal (chap. 20). Scanne le QR du participant (BarcodeDetector
si dispo), saisit le montant, appelle `POST /payments/qr/authorize`. Réseau obligatoire ;
pas de tap NFC (impossible en navigateur). Zéro dépendance, zéro build (ADR-003).

Authentification : header `X-Merchant-Key` (valeur dans `public/config.js`, jamais dans le
body). `Idempotency-Key` = `authId`. Les plafonds viennent de la config événement serveur ;
le client n'envoie plus `params` ni `vendorId`.
