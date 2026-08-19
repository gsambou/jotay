/**
 * Compatibilité ascendante : un PaymentRecord v1 (sans mediumType/balanceAuthority)
 * est un enregistrement NFC dont l'autorité de solde est la puce. Fonction pure.
 */
import type { BalanceAuthority, MediumType, PaymentRecord } from '@jotay/protocol';

export interface NormalizedRecord extends PaymentRecord {
  mediumType: MediumType;
  balanceAuthority: BalanceAuthority;
}

export function normalizeRecord(r: PaymentRecord): NormalizedRecord {
  const mediumType: MediumType = r.mediumType ?? 'NFC';
  const balanceAuthority: BalanceAuthority = r.balanceAuthority ?? (mediumType === 'QR' ? 'SERVER' : 'CHIP');
  return { ...r, mediumType, balanceAuthority };
}
