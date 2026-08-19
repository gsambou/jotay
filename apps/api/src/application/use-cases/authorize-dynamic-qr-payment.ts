/**
 * Paiement par QR DYNAMIQUE (chap. 18.3 option 2) — SRP.
 * Vérifie le code TOTP tournant + son usage unique, puis délègue l'autorisation de solde au
 * flux serveur existant (AuthorizeQrPayment). Un QR photographié expire (fenêtre courte) et
 * ne peut être rejoué (garde par pas de temps).
 */
import { err, type Result } from '@jotay/shared';
import { verifyTotp } from '@jotay/card-crypto';
import type { WalletDirectory } from '../ports/wallet-directory.js';
import type { TotpSecretStore } from '../ports/totp-secret-store.js';
import type { DynamicQrGuard } from '../ports/dynamic-qr-guard.js';
import type { Clock } from '../ports/clock.js';
import type { AuthorizeQrPayment, AuthorizeQrOutput } from './authorize-qr-payment.js';

export interface AuthorizeDynamicQrInput {
  opaqueId: string;
  totpCode: string;
  amountXof: number;
  vendorId: string;
  pin?: string;
  authId: string;
  params: { microPinThresholdXof: number; velocityAmountCapXof: number; velocityTxCap: number };
}
export type AuthorizeDynamicQrError =
  | { kind: 'WALLET_UNKNOWN' } | { kind: 'BAD_TOTP' } | { kind: 'REPLAY' }
  | { kind: 'BAD_PIN' } | { kind: 'DECLINED'; reason: string };

export class AuthorizeDynamicQrPayment {
  constructor(
    private readonly directory: WalletDirectory,
    private readonly secrets: TotpSecretStore,
    private readonly guard: DynamicQrGuard,
    private readonly clock: Clock,
    private readonly staticAuthorize: AuthorizeQrPayment,
    private readonly stepSec = 30,
    private readonly window = 1,
  ) {}

  async execute(input: AuthorizeDynamicQrInput): Promise<Result<AuthorizeQrOutput, AuthorizeDynamicQrError>> {
    const resolved = await this.directory.resolveOpaqueId(input.opaqueId);
    if (!resolved) return err({ kind: 'WALLET_UNKNOWN' });
    const secret = await this.secrets.secretFor(resolved.walletId);
    if (!secret) return err({ kind: 'WALLET_UNKNOWN' });

    const nowMs = Date.parse(this.clock.nowIso());
    const v = verifyTotp(Buffer.from(secret), input.totpCode, nowMs, this.stepSec, this.window);
    if (!v.valid || v.step === null) return err({ kind: 'BAD_TOTP' });

    // Usage unique : le même code (même pas de temps) ne peut pas servir deux fois.
    if (!(await this.guard.consume(resolved.walletId, v.step))) return err({ kind: 'REPLAY' });

    // Autorisation de solde : on réutilise EXACTEMENT le flux serveur (cloisonnement, PIN, vélocité).
    const res = await this.staticAuthorize.execute({
      opaqueId: input.opaqueId, amountXof: input.amountXof, vendorId: input.vendorId,
      authId: input.authId, ...(input.pin !== undefined ? { pin: input.pin } : {}), params: input.params,
    });
    if (res.ok) return res;
    if (res.error.kind === 'DECLINED') return err({ kind: 'DECLINED', reason: res.error.reason });
    return err(res.error);
  }
}
