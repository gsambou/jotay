# apps/participant-pwa — Portail participant (PWA, sans framework)

Coquille servie en statique (ADR-003). Le QR encode `https://m.jotay.sn/w/{opaqueId}`.
Parcours : saisie du numéro → OTP WhatsApp → session (cookie HttpOnly) → solde daté +
historique + actions. Aucune dépendance, aucun build.

Dev : servir `public/` derrière l'API (proxy `/portal/*` vers apps/api) avec n'importe
quel serveur statique. Configurer `API_BASE` dans public/config.js si l'API est sur une
autre origine (CORS + credentials).
