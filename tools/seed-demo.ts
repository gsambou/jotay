/** Seed de démo : génère un petit événement réaliste et affiche le rapport de clôture.
 *  `pnpm demo`. Ne touche aucune base — sert à montrer le produit et vérifier la cohérence. */
import { closeEvent, runScenario } from '../packages/ledger-core/src/index.js';
import { generateNominal } from '../packages/ledger-core/test/sim/event-sim.js';

const { records } = generateNominal({ seed: 2025, cards: 30, vendors: 6, cashierSessions: 3, maxOpsPerCard: 15 });
const scenario = runScenario(records);
const report = closeEvent(records, [{ vendorId: 'V1', commissionBps: 250 }, { vendorId: 'V2', commissionBps: 250 }]);
console.log(JSON.stringify({
  cartes: Object.keys(scenario.balances).length,
  transactions: records.length,
  recharges: report.totalToppedUp, depenses: report.totalSpent, restant: report.totalRemaining,
  reconcilie: report.reconciled, ecart: report.discrepancy,
  settlements: report.settlements,
}, null, 2));
