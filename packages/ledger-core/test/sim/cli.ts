/** CLI : `pnpm sim [seed] [cards]` — exécute l'event-sim et vérifie la réconciliation exacte. */
import { runScenario } from '../../src/index.js';
import { generateNominal } from './event-sim.js';

const seed = Number(process.argv[2] ?? 20250817);
const cards = Number(process.argv[3] ?? 200);
const { records, truth } = generateNominal({ seed, cards, vendors: 12, cashierSessions: 6, maxOpsPerCard: 20 });
const out = runScenario(records);

const exact =
  JSON.stringify(out.balances) === JSON.stringify(truth.finalBalanceByCard) &&
  out.ledger.balanced && out.anomalies.length === 0;

console.log(JSON.stringify({
  seed, cards, records: records.length,
  totalToppedUp: truth.totalToppedUp, totalSpent: truth.totalSpent,
  balanced: out.ledger.balanced, anomalies: out.anomalies.length, exact,
}, null, 2));
if (!exact) { console.error('ÉCHEC : réconciliation non exacte'); process.exit(1); }
console.log('OK — réconciliation exacte au FCFA près');
