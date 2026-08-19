-- Clés publiques Ed25519 des terminaux, avec rotation à période de grâce.
-- Une clé est valide si valid_from <= ts_record < valid_until (ou valid_until NULL = active).
CREATE TABLE IF NOT EXISTS terminal_keys (
  terminal_id  TEXT NOT NULL,
  public_key   BYTEA NOT NULL,          -- 32 octets bruts
  valid_from   TIMESTAMPTZ NOT NULL,
  valid_until  TIMESTAMPTZ,             -- NULL = clé courante active
  PRIMARY KEY (terminal_id, public_key)
);
CREATE INDEX IF NOT EXISTS idx_terminal_keys_lookup ON terminal_keys (terminal_id, valid_from);
-- Rotation : on borne valid_until de l'ancienne clé (fin de grâce) et on insère la nouvelle
-- avec valid_from = début de grâce. Le chevauchement = période de grâce.
