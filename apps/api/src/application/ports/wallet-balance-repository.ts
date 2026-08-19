import type { AmountXof, ServerWalletState } from '@jotay/ledger-core';

/**
 * Solde SERVEUR cloisonné d'un wallet (chap. 18.4) — distinct du LedgerEventStore
 * (journal des opérations puce). ISP : port étroit, une seule responsabilité.
 */
export interface WalletBalanceRepository {
  /** État courant pour l'autorisation (solde, gel, compteurs de vélocité de la fenêtre). */
  loadState(walletId: string): Promise<ServerWalletState | null>;
  /**
   * Débit ATOMIQUE et idempotent du solde serveur pour une autorisation donnée.
   * Rejoue sans effet si authId déjà appliqué (idempotence). CRITICAL-PATH.
   */
  applyDebit(walletId: string, authId: string, amountXof: AmountXof, atIso: string): Promise<void>;
  /**
   * Crédit ATOMIQUE et idempotent du solde serveur (recharge, ajustement crédit).
   * Rejoue sans effet si `ref` déjà appliquée. CRITICAL-PATH.
   */
  applyCredit(walletId: string, ref: string, amountXof: AmountXof, atIso: string): Promise<void>;
}
