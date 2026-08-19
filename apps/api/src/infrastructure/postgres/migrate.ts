/** Migrations maison : fichiers .sql numérotés, appliqués une fois, dans l'ordre. ~40 lignes, zéro dépendance. */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from './pool.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function migrate(connectionString: string): Promise<void> {
  const pool = createPool(connectionString);
  const client = await pool.connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      const done = await client.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
      if (done.rowCount) continue;
      await client.query('BEGIN');
      try {
        await client.query(readFileSync(join(dir, file), 'utf8'));
        await client.query('INSERT INTO _migrations (name, applied_at) VALUES ($1, now())', [file]);
        await client.query('COMMIT');
        console.log(`applied ${file}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL manquant');
  migrate(url).catch((e) => { console.error(e); process.exit(1); });
}
