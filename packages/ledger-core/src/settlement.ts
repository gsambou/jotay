import { xof, type AmountXof } from './money.js';

export interface SettlementLine {
  gross: AmountXof;
  fee: AmountXof;
  net: AmountXof;
}

/** Commission en basis points (200 = 2 %). Arithmétique entière, arrondi au FCFA inférieur sur la commission. */
export function computeSettlement(gross: AmountXof, commissionBps: number): SettlementLine {
  if (!Number.isSafeInteger(commissionBps) || commissionBps < 0 || commissionBps > 10_000) {
    throw new TypeError(`commissionBps invalide: ${commissionBps}`);
  }
  const fee = xof(Math.floor((gross * commissionBps) / 10_000));
  return { gross, fee, net: xof(gross - fee) };
}
