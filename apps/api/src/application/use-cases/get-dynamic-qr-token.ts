/** Fournit à la PWA le code tournant courant + secondes avant rotation. Le secret reste serveur. */
import { err, ok, type Result } from '@jotay/shared';
import { totp, secondsUntilRotation } from '@jotay/card-crypto';
import type { PortalSessionStore } from '../ports/portal-session-store.js';
import type { WalletDirectory } from '../ports/wallet-directory.js';
import type { TotpSecretStore } from '../ports/totp-secret-store.js';
import type { Clock } from '../ports/clock.js';

export interface GetDynamicQrTokenInput { sessionToken: string; opaqueId: string; }
export interface GetDynamicQrTokenOutput { payload: string; expiresInSec: number; }
export type GetDynamicQrTokenError = { kind: 'NO_SESSION' } | { kind: 'MISMATCH' } | { kind: 'NO_SECRET' };

export class GetDynamicQrToken {
  constructor(
    private readonly sessions: PortalSessionStore,
    private readonly directory: WalletDirectory,
    private readonly secrets: TotpSecretStore,
    private readonly clock: Clock,
    private readonly stepSec = 30,
  ) {}

  async execute(input: GetDynamicQrTokenInput): Promise<Result<GetDynamicQrTokenOutput, GetDynamicQrTokenError>> {
    const session = await this.sessions.resolve(input.sessionToken, this.clock.nowIso());
    if (!session) return err({ kind: 'NO_SESSION' });
    // L'opaqueId présenté par la PWA doit appartenir au wallet de la session.
    const resolved = await this.directory.resolveOpaqueId(input.opaqueId);
    if (!resolved || resolved.walletId !== session.walletId) return err({ kind: 'MISMATCH' });
    const secret = await this.secrets.secretFor(session.walletId);
    if (!secret) return err({ kind: 'NO_SECRET' });
    const nowMs = Date.parse(this.clock.nowIso());
    const code = totp(Buffer.from(secret), nowMs, this.stepSec);
    return ok({ payload: `${input.opaqueId}:${code}`, expiresInSec: secondsUntilRotation(nowMs, this.stepSec) });
  }
}
