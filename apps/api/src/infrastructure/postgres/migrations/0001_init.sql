-- Journal append-only. AUCUN UPDATE/DELETE ne doit jamais être écrit sur cette table.
CREATE TABLE IF NOT EXISTS ledger_events (
  id            BIGSERIAL PRIMARY KEY,
  event_id      TEXT        NOT NULL,
  card_uid      TEXT        NOT NULL,
  card_tx_counter INTEGER   NOT NULL,
  payload       JSONB       NOT NULL,
  batch_id      TEXT        NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL,
  UNIQUE (card_uid, card_tx_counter)
);
CREATE INDEX IF NOT EXISTS idx_ledger_events_event ON ledger_events (event_id);

CREATE TABLE IF NOT EXISTS blocklist (
  card_uid   TEXT PRIMARY KEY,
  reason     TEXT NOT NULL,
  version    BIGSERIAL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS anomalies (
  id         BIGSERIAL PRIMARY KEY,
  batch_id   TEXT NOT NULL,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  resolved   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS sync_batches (
  batch_id     TEXT PRIMARY KEY,
  device_id    TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL
);
