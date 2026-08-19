-- Suivi des payouts de fin d'événement (idempotent par (event_id, wallet_id)).
CREATE TABLE IF NOT EXISTS payouts (
  event_id   TEXT NOT NULL,
  wallet_id  TEXT NOT NULL,
  msisdn     TEXT NOT NULL,
  amount_xof BIGINT NOT NULL CHECK (amount_xof > 0),
  status     TEXT NOT NULL DEFAULT 'QUEUED',   -- QUEUED | SENT | FAILED
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, wallet_id)
);
