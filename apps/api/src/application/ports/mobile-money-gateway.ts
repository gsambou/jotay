/** Passerelle opérateur (Wave, Orange Money). L'ACTIVE CHECK est la règle de sécurité :
 *  on ne crédite JAMAIS sur la foi du webhook — on re-interroge l'opérateur pour confirmer. */
export interface ConfirmedPayment { confirmed: boolean; amountXof: number; opaqueRef: string; }
export interface MobileMoneyGateway {
  /** Vérifie la signature du webhook (secret partagé opérateur). */
  verifyWebhook(rawBody: string, signature: string): boolean;
  /** Confirmation ACTIVE auprès de l'opérateur pour une référence de transaction. */
  confirmPayment(provider: string, providerRef: string): Promise<ConfirmedPayment | null>;
}
