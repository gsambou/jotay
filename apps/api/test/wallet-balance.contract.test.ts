/** Contrat LSP de WalletBalanceRepository — exercé sur le fake mémoire. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xof } from '@jotay/ledger-core';
import type { WalletBalanceRepository } from '../src/application/ports/wallet-balance-repository.js';
import { MemWalletBalance } from './fakes.js';

function runContract(name: string, factory: () => { repo: WalletBalanceRepository; seed: (id: string, bal: number) => void }) {
  test(`contrat WalletBalance [${name}] — débit idempotent`, async () => {
    const { repo, seed } = factory();
    seed('W', 1000);
    await repo.applyDebit('W', 'auth-1', xof(300), 't');
    await repo.applyDebit('W', 'auth-1', xof(300), 't');
    assert.equal((await repo.loadState('W'))!.serverBalanceXof, 700);
  });
  test(`contrat WalletBalance [${name}] — crédit idempotent`, async () => {
    const { repo, seed } = factory();
    seed('W', 100);
    await repo.applyCredit('W', 'ref-1', xof(50), 't');
    await repo.applyCredit('W', 'ref-1', xof(50), 't');
    assert.equal((await repo.loadState('W'))!.serverBalanceXof, 150);
  });
  test(`contrat WalletBalance [${name}] — inconnu -> null`, async () => {
    const { repo } = factory();
    assert.equal(await repo.loadState('ABSENT'), null);
  });
}

runContract('MemWalletBalance', () => {
  const mem = new MemWalletBalance();
  return { repo: mem, seed: (id, bal) => mem.seed(id, bal) };
});
