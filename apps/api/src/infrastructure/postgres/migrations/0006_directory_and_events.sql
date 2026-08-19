-- Directory, soldes SERVER, OTP, PIN, TOTP, événement / marchands (SPEC-persistance).
-- Aucun secret en clair : hash des clés et PIN à l'adapter (node:crypto).

CREATE TABLE IF NOT EXISTS events (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  qr_limits  JSONB NOT NULL,
  status     TEXT NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendors (
  id            TEXT PRIMARY KEY,
  event_id      TEXT NOT NULL REFERENCES events (id),
  role          TEXT NOT NULL CHECK (role IN ('merchant', 'supervisor')),
  api_key_hash  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_event ON vendors (event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_api_key_hash ON vendors (api_key_hash);

CREATE TABLE IF NOT EXISTS wallets (
  id                   TEXT PRIMARY KEY,
  server_balance_xof   BIGINT NOT NULL CHECK (server_balance_xof >= 0),
  frozen               BOOLEAN NOT NULL DEFAULT FALSE,
  spent_in_window_xof  BIGINT NOT NULL DEFAULT 0 CHECK (spent_in_window_xof >= 0),
  tx_count_in_window   INTEGER NOT NULL DEFAULT 0 CHECK (tx_count_in_window >= 0),
  velocity_window_start TIMESTAMPTZ,
  payout_msisdn        TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotence des crédits/débits SERVER (authId, loadId, adjustmentId, providerRef).
CREATE TABLE IF NOT EXISTS wallet_mutations (
  ref         TEXT PRIMARY KEY,
  wallet_id   TEXT NOT NULL REFERENCES wallets (id),
  direction   TEXT NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  amount_xof  BIGINT NOT NULL CHECK (amount_xof > 0),
  at          TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS vendor_sightings (
  wallet_id  TEXT PRIMARY KEY REFERENCES wallets (id),
  vendor_id  TEXT NOT NULL,
  seen_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet_history (
  id         BIGSERIAL PRIMARY KEY,
  wallet_id  TEXT NOT NULL REFERENCES wallets (id),
  at         TIMESTAMPTZ NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('PAYMENT', 'TOPUP', 'REFUND', 'REVERSAL')),
  amount_xof BIGINT NOT NULL CHECK (amount_xof > 0),
  vendor_id  TEXT
);
CREATE INDEX IF NOT EXISTS idx_wallet_history_recent ON wallet_history (wallet_id, at DESC);

CREATE TABLE IF NOT EXISTS qr_bindings (
  opaque_id   TEXT PRIMARY KEY,
  wallet_id   TEXT NOT NULL REFERENCES wallets (id),
  bound_at    TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_qr_bindings_wallet ON qr_bindings (wallet_id);

CREATE TABLE IF NOT EXISTS otp_challenges (
  wallet_id  TEXT NOT NULL,
  msisdn     TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (wallet_id, msisdn)
);

CREATE TABLE IF NOT EXISTS totp_secrets (
  wallet_id   TEXT PRIMARY KEY REFERENCES wallets (id),
  secret_enc  BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pin_credentials (
  wallet_id      TEXT PRIMARY KEY REFERENCES wallets (id),
  pin_hash       TEXT NOT NULL,
  failure_count  INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  locked         BOOLEAN NOT NULL DEFAULT FALSE
);

-- F1 : table réservée, aucun usage avant SPEC-F1.
CREATE TABLE IF NOT EXISTS nfc_media (
  card_uid    TEXT PRIMARY KEY,
  wallet_id   TEXT NOT NULL,
  state       TEXT NOT NULL DEFAULT 'UNPROVISIONED',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
