/**
 * Autorisation d'un paiement QR (autorité serveur) — cf. SPEC chap. 18.4/18.5.
 * PUR et déterministe : l'appelant fournit l'état du wallet et les paramètres ; cette
 * fonction ne lit ni horloge ni base. La vérification du PIN est faite EN AMONT
 * (infrastructure) ; ici on reçoit seulement `pinVerified`. Refus honnête, jamais
 * d'exception pour un cas métier, jamais de découvert.
 *
 * Règle d'or anti-double-dépense : un paiement QR ne puise QUE dans le solde SERVEUR ;
 * il n'a aucune connaissance du solde puce (cloisonnement, chap. 18.4).
 */
import { xof, type AmountXof } from './money.js';

export interface ServerWalletState {
  /** Solde serveur cloisonné (jamais le solde puce). Entier FCFA. */
  serverBalanceXof: AmountXof;
  frozen: boolean;
  /** Consommation dans la fenêtre de vélocité courante (fournie par l'appelant). */
  spentInWindowXof: AmountXof;
  txCountInWindow: number;
}

export interface QrAuthorizeParams {
  amountXof: AmountXof;
  /** Au-delà de ce montant, le PIN est obligatoire (chap. 18.3). */
  microPinThresholdXof: AmountXof;
  pinVerified: boolean;
  /** Plafonds de vélocité serveur (chap. 18.5). */
  velocityAmountCapXof: AmountXof;
  velocityTxCap: number;
}

export type QrAuthorizeDecision =
  | { ok: true; balanceAfterXof: AmountXof }
  | { ok: false; reason: 'FROZEN' | 'PIN_REQUIRED' | 'INSUFFICIENT' | 'VELOCITY_AMOUNT' | 'VELOCITY_COUNT' };

export function authorizeQrPayment(state: ServerWalletState, p: QrAuthorizeParams): QrAuthorizeDecision {
  if (state.frozen) return { ok: false, reason: 'FROZEN' };
  if (p.amountXof > p.microPinThresholdXof && !p.pinVerified) return { ok: false, reason: 'PIN_REQUIRED' };
  if (state.txCountInWindow + 1 > p.velocityTxCap) return { ok: false, reason: 'VELOCITY_COUNT' };
  if (state.spentInWindowXof + p.amountXof > p.velocityAmountCapXof) return { ok: false, reason: 'VELOCITY_AMOUNT' };
  if (p.amountXof > state.serverBalanceXof) return { ok: false, reason: 'INSUFFICIENT' };
  return { ok: true, balanceAfterXof: xof(state.serverBalanceXof - p.amountXof) };
}
