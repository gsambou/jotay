import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeQrPayment, xof, type ServerWalletState } from '../src/index.js';

const base: ServerWalletState = {
  serverBalanceXof: xof(5000), frozen: false, spentInWindowXof: xof(0), txCountInWindow: 0,
};
const params = {
  microPinThresholdXof: xof(1000), pinVerified: true,
  velocityAmountCapXof: xof(50000), velocityTxCap: 20,
};

test('nominal : débite le solde serveur', () => {
  const d = authorizeQrPayment(base, { ...params, amountXof: xof(2000) });
  assert.deepEqual(d, { ok: true, balanceAfterXof: 3000 });
});

test('solde insuffisant : refus honnête, aucun découvert', () => {
  const d = authorizeQrPayment(base, { ...params, amountXof: xof(9000) });
  assert.deepEqual(d, { ok: false, reason: 'INSUFFICIENT' });
});

test('au-dessus du micro-plafond sans PIN vérifié : PIN requis', () => {
  const d = authorizeQrPayment(base, { ...params, amountXof: xof(2000), pinVerified: false });
  assert.deepEqual(d, { ok: false, reason: 'PIN_REQUIRED' });
});

test('sous le micro-plafond sans PIN : autorisé', () => {
  const d = authorizeQrPayment(base, { ...params, amountXof: xof(500), pinVerified: false });
  assert.equal(d.ok, true);
});

test('vélocité en montant dépassée : refus', () => {
  const s = { ...base, spentInWindowXof: xof(49000) };
  const d = authorizeQrPayment(s, { ...params, amountXof: xof(2000) });
  assert.deepEqual(d, { ok: false, reason: 'VELOCITY_AMOUNT' });
});

test('wallet gelé : refus', () => {
  const d = authorizeQrPayment({ ...base, frozen: true }, { ...params, amountXof: xof(100) });
  assert.deepEqual(d, { ok: false, reason: 'FROZEN' });
});
