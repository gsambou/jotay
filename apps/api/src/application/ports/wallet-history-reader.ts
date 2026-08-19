/** Lecture seule de l'historique projeté (ledger serveur) pour l'affichage portail. */
export interface WalletHistoryEntry {
  atIso: string;
  kind: 'PAYMENT' | 'TOPUP' | 'REFUND' | 'REVERSAL';
  amountXof: number;
  vendorName?: string;
}
export interface WalletHistoryReader {
  recent(walletId: string, limit: number): Promise<{ entries: WalletHistoryEntry[]; asOfIso: string }>;
}
