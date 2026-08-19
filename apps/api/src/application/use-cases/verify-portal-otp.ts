/** Use case : vérifier l'OTP et ouvrir une session de consultation — SRP. */
import { err, ok, type Result } from '@jotay/shared';
import type { WalletDirectory } from '../ports/wallet-directory.js';
import type { OtpChallengeStore } from '../ports/otp-challenge-store.js';
import type { PortalSession, PortalSessionStore } from '../ports/portal-session-store.js';
import type { Clock } from '../ports/clock.js';

export interface VerifyPortalOtpInput { opaqueId: string; msisdn: string; code: string; }
export type VerifyPortalOtpError = { kind: 'INVALID_OR_EXPIRED' };

export class VerifyPortalOtp {
  constructor(
    private readonly directory: WalletDirectory,
    private readonly challenges: OtpChallengeStore,
    private readonly sessions: PortalSessionStore,
    private readonly clock: Clock,
  ) {}

  async execute(input: VerifyPortalOtpInput): Promise<Result<PortalSession, VerifyPortalOtpError>> {
    const wallet = await this.directory.resolveOpaqueId(input.opaqueId);
    if (!wallet) return err({ kind: 'INVALID_OR_EXPIRED' }); // neutre, même erreur que code faux
    const good = await this.challenges.verifyAndConsume(wallet.walletId, input.msisdn, input.code);
    if (!good) return err({ kind: 'INVALID_OR_EXPIRED' });
    const session = await this.sessions.create(wallet.walletId, input.msisdn, this.clock.nowIso());
    return ok(session);
  }
}
