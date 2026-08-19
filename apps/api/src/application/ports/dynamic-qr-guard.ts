/** Garde anti-rejeu du QR dynamique : un (wallet, pas de temps) n'est utilisable qu'UNE fois. */
export interface DynamicQrGuard {
  /**
   * true si (walletId, step) est neuf (et le marque consommé) ; false si déjà utilisé.
   * DOIT être ATOMIQUE : deux terminaux qui présentent le même code dans la même fenêtre
   * ne doivent obtenir true qu'une seule fois. Impl. Postgres = INSERT ... ON CONFLICT
   * DO NOTHING sur la clé (wallet_id, time_step), true ssi une ligne a été insérée.
   */
  consume(walletId: string, step: number): Promise<boolean>;
}
