/**
 * Use case : demander le remboursement du solde serveur (action de VALEUR) — SRP.
 * Garde-fous chap. 19.3 : session valide + PIN + remboursement UNIQUEMENT vers un MSISDN
 * déjà associé et vérifié. Idempotent via idempotencyKey. CRITICAL-PATH.
 */
import { err, ok, type Result } from '@jotay/shared';
import type { PortalSessionStore } from '../ports/portal-session-store.js';
import type { PinVerifier } from '../ports/pin-verifier.js';
import type { WalletDirectory } from '../ports/wallet-directory.js';
import type { RefundRequestSink } from '../ports/refund-request-sink.js';
import type { Clock } from '../ports/clock.js';

export interface RequestRefundInput { sessionToken: string; pin: string; idempotencyKey: string; }
export type RequestRefundError =
  | { kind: 'NO_SESSION' } | { kind: 'BAD_PIN' } | { kind: 'NO_VERIFIED_PAYOUT' };
export interface RequestRefundOutput { accepted: true; payoutMsisdnMasked: string; }

const mask = (m: string) => m.length <= 4 ? '****' : `${'*'.repeat(m.length - 3)}${m.slice(-3)}`;

export class RequestRefund {
  constructor(
    private readonly sessions: PortalSessionStore,
    private readonly pins: PinVerifier,
    private readonly directory: WalletDirectory,
    private readonly sink: RefundRequestSink,
    private readonly clock: Clock,
  ) {}

  async execute(input: RequestRefundInput): Promise<Result<RequestRefundOutput, RequestRefundError>> {
    const session = await this.sessions.resolve(input.sessionToken, this.clock.nowIso());
    if (!session) return err({ kind: 'NO_SESSION' });
    if (!(await this.pins.verify(session.walletId, input.pin))) return err({ kind: 'BAD_PIN' });
    const payout = await this.directory.verifiedPayoutMsisdn(session.walletId);
    if (!payout) return err({ kind: 'NO_VERIFIED_PAYOUT' }); // jamais vers un numéro non vérifié
    await this.sink.enqueue(session.walletId, payout, input.idempotencyKey, this.clock.nowIso());
    return ok({ accepted: true, payoutMsisdnMasked: mask(payout) });
  }
}
