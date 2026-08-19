// Vérifie que chaque package respecte son budget de dépendances runtime
// (déclaré dans package.json racine, champ depBudgets). Échec CI sinon.
import { readFileSync } from 'node:fs';

const root = JSON.parse(readFileSync('package.json', 'utf8'));
const budgets = root.depBudgets ?? {};
let failed = false;

for (const [dir, budget] of Object.entries(budgets)) {
  const pkg = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8'));
  const runtime = Object.keys(pkg.dependencies ?? {}).filter((d) => !d.startsWith('@jotay/'));
  const status = runtime.length <= budget ? 'OK' : 'DÉPASSEMENT';
  console.log(`${dir}: ${runtime.length}/${budget} [${status}] ${runtime.join(', ')}`);
  if (runtime.length > budget) failed = true;
}

if (failed) {
  console.error('Budget de dépendances dépassé — un ADR et une mise à jour de depBudgets sont requis.');
  process.exit(1);
}
