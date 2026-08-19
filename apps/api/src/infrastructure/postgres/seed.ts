/** Seed local : un événement, un marchand, un superviseur. Pas pour la prod. */
import { DEFAULT_QR_LIMITS } from '@jotay/ledger-core';
import { createPool } from './pool.js';
import { hashApiKey } from '../crypto/secrets.js';

const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL manquant');

const merchantKey = process.env['JOTAY_SEED_MERCHANT_KEY'] ?? 'dev-merchant-key-change-me';
const supervisorKey = process.env['JOTAY_SEED_SUPERVISOR_KEY'] ?? 'dev-supervisor-key-change-me';

const pool = createPool(url);
await pool.query(
  `INSERT INTO events (id, name, qr_limits, status) VALUES ('E', 'Démo', $1, 'OPEN')
   ON CONFLICT (id) DO UPDATE SET qr_limits = $1`,
  [JSON.stringify(DEFAULT_QR_LIMITS)],
);
await pool.query(
  `INSERT INTO vendors (id, event_id, role, api_key_hash) VALUES ('V', 'E', 'merchant', $1)
   ON CONFLICT (id) DO UPDATE SET api_key_hash = $1`,
  [hashApiKey(merchantKey)],
);
await pool.query(
  `INSERT INTO vendors (id, event_id, role, api_key_hash) VALUES ('SUP', 'E', 'supervisor', $1)
   ON CONFLICT (id) DO UPDATE SET api_key_hash = $1`,
  [hashApiKey(supervisorKey)],
);
await pool.end();
console.log(JSON.stringify({ level: 'info', msg: 'seed.ok', eventId: 'E', vendorId: 'V' }));
