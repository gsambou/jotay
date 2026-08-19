-- Garde anti-rejeu du QR dynamique : un (wallet, pas de temps) n'est consommable qu'UNE fois.
-- L'atomicité vient de la contrainte UNIQUE : INSERT ... ON CONFLICT DO NOTHING ; si 0 ligne
-- insérée -> déjà consommé (rejeu), même sous course de deux terminaux dans la même fenêtre.
CREATE TABLE IF NOT EXISTS dynamic_qr_used (
  wallet_id TEXT NOT NULL,
  time_step BIGINT NOT NULL,
  used_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet_id, time_step)
);
-- Purge périodique des pas anciens (housekeeping) : DELETE WHERE used_at < now() - interval '1 day'.
