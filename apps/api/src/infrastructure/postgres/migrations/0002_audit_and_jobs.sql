-- Journal d'audit immuable (aucun UPDATE/DELETE ne doit exister dans le code).
CREATE TABLE IF NOT EXISTS audit_log (
  id       BIGSERIAL PRIMARY KEY,
  actor    TEXT NOT NULL,
  action   TEXT NOT NULL,
  target   TEXT NOT NULL,
  details  JSONB,
  at       TIMESTAMPTZ NOT NULL
);

-- File de jobs (payouts, remboursements, retry). Consommée via FOR UPDATE SKIP LOCKED.
CREATE TABLE IF NOT EXISTS jobs (
  id              BIGSERIAL PRIMARY KEY,
  kind            TEXT NOT NULL,
  payload         JSONB NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  ready_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  done            BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_jobs_ready ON jobs (ready_at) WHERE NOT done;

-- Sessions portail (expiration/révocation côté serveur).
CREATE TABLE IF NOT EXISTS portal_sessions (
  token      TEXT PRIMARY KEY,
  wallet_id  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked    BOOLEAN NOT NULL DEFAULT FALSE
);
