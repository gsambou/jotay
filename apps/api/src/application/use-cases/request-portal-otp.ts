/**
 * Use case : demander un OTP de connexion au portail (chap. 19.2/19.3) — SRP.
 * Anti-énumération : renvoie TOUJOURS un succès neutre, que le wallet/MSISDN existe ou
 * non — on ne révèle jamais qui possède un wallet à partir d'un QR photographié.
 */
import { ok, type Result } from '@jotay/shared';
import type { WalletDirectory } from '../ports/wallet-directory.js';
import type { OtpChallengeStore } from '../ports/otp-challenge-store.js';
import type { OtpChannel } from '../ports/otp-channel.js';

export interface RequestPortalOtpInput { opaqueId: string; msisdn: string; }
export interface RequestPortalOtpOutput { dispatched: true; ttlMinutes: number; }

export class RequestPortalOtp {
  constructor(
    private readonly directory: WalletDirectory,
    private readonly challenges: OtpChallengeStore,
    private readonly channel: OtpChannel,
    private readonly ttlMinutes = 15,
  ) {}

  async execute(input: RequestPortalOtpInput): Promise<Result<RequestPortalOtpOutput, never>> {
    const wallet = await this.directory.resolveOpaqueId(input.opaqueId);
    // Réponse neutre quoi qu'il arrive : pas de fuite d'existence.
    if (wallet) {
      const code = await this.challenges.issue(wallet.walletId, input.msisdn);
      await this.channel.send(input.msisdn, { code, purpose: 'PORTAL_LOGIN', ttlMinutes: this.ttlMinutes });
    }
    return ok({ dispatched: true, ttlMinutes: this.ttlMinutes });
  }
}
