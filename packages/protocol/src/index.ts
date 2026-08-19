/**
 * Protocole de transaction — cf. SPEC chap. 6.6 et 18.
 * Pur : types + sérialisation canonique. Aucune I/O, aucune crypto ici.
 *
 * v2 (SPEC chap. 18) : un wallet peut être exposé par deux supports d'autorités
 * de solde différentes.
 *  - NFC  -> balanceAuthority 'CHIP'   : le solde vit sur la puce, preuve = cardTxMac.
 *  - QR   -> balanceAuthority 'SERVER' : le solde vit sur le serveur, preuve = serverAuthId.
 * Les enregistrements v1 (sans mediumType) sont réputés NFC/CHIP : cf. normalizeRecord
 * dans @jotay/ledger-core (compatibilité ascendante, règle 10-ledger-core).
 */
import type { CardUid, EventId, TerminalId, VendorId } from '@jotay/shared';

export const SCHEMA_VERSION = 2 as const;
export type SchemaVersion = 1 | 2;

export type OpType = 'PAYMENT' | 'TOPUP' | 'REVERSAL' | 'ADJUSTMENT' | 'ACTIVATION' | 'BLOCK';
export type TopupChannel = 'CASH' | 'WAVE' | 'ORANGE_MONEY' | 'CARD' | 'PISPI';
export type MediumType = 'NFC' | 'QR';
export type BalanceAuthority = 'CHIP' | 'SERVER';

export interface PaymentRecord {
  schemaVersion: SchemaVersion;
  eventId: EventId;
  cardUid: CardUid;
  /** Compteur monotone de la puce — clé d'idempotence avec cardUid. Sur QR : voir serverAuthId. */
  cardTxCounter: number;
  terminalId: TerminalId;
  terminalSeq: number;
  opType: OpType;
  /** Entiers FCFA uniquement. */
  amountXof: number;
  balanceAfter: number;
  vendorId?: VendorId;
  topupChannel?: TopupChannel;
  cashierSessionId?: string;
  tsTerminal: string;

  /** v2 — support et autorité de solde. Absents en v1 (⇒ NFC/CHIP). */
  mediumType?: MediumType;
  balanceAuthority?: BalanceAuthority;
  /** Preuve puce (Transaction MAC hex) — présent ssi balanceAuthority = CHIP. */
  cardTxMac?: string;
  /** Autorisation serveur (id opaque de la décision AuthorizeQrPayment) — ssi SERVER. */
  serverAuthId?: string;

  /** Signature Ed25519 du terminal (hex) sur la forme canonique. */
  terminalSig: string;
}

/** Sérialisation canonique signée par le terminal et vérifiée par le serveur. */
export function canonicalBytesForSignature(r: Omit<PaymentRecord, 'terminalSig'>): Uint8Array {
  const canonical = [
    r.schemaVersion, r.eventId, r.cardUid, r.cardTxCounter, r.terminalId, r.terminalSeq,
    r.opType, r.amountXof, r.balanceAfter, r.vendorId ?? '', r.topupChannel ?? '',
    r.cashierSessionId ?? '', r.tsTerminal, r.mediumType ?? 'NFC',
    r.balanceAuthority ?? 'CHIP', r.cardTxMac ?? '', r.serverAuthId ?? '',
  ].join('|');
  return new TextEncoder().encode(canonical);
}
