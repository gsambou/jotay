// Échec CI si un secret évident est commité. Pas un substitut à un vault.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage', '.pnpm-store']);
const SKIP_FILE = new Set(['pnpm-lock.yaml', '.env.example']);
const PATTERNS = [
  { name: 'PEM private key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub PAT', re: /ghp_[A-Za-z0-9]{36}/ },
  { name: 'Stripe live key', re: /sk_live_[A-Za-z0-9]+/ },
];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name) || name.startsWith('.env') && name !== '.env.example') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (!SKIP_FILE.has(name) && !name.endsWith('.png')) acc.push(p);
  }
  return acc;
}

const files = walk('.');
let failed = false;
for (const file of files) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  for (const { name, re } of PATTERNS) {
    if (re.test(text)) {
      console.error(`${file}: motif secret « ${name} »`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('Secret détecté dans le dépôt — retirer le fichier et faire tourner la clé.');
  process.exit(1);
}
console.log(`scan secrets : ${files.length} fichiers, aucun motif interdit`);
