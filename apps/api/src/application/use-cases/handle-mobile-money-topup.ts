/**
 * Recharge par Mobile Money (Wave / Orange Money) déclenchée par webhook opérateur — SRP.
 * Sécurité : signature du webhook + ACTIVE CHECK (re-confirmation auprès de l'opérateur) ;
 * crédit idempotent par référence opérateur. Ne crédite jamais sur la seule foi du webhook.
 */
import { err, ok, type Result } from '@jotay/shared';
import { xof } from '@jotay/ledger-core';
import type { MobileMoneyGateway } from '../ports/mobile-money-gateway.js';
import type { WalletDirectory } from '../ports/wallet-directory.js';
import type { WalletBalanceRepository } from '../ports/wallet-balance-repository.js';
import type { AuditLog } from '../ports/audit-log.js';
import type { Clock } from '../ports/clock.js';

export interface MobileMoneyTopupInput {
  provider: string; providerRef: string; opaqueId: string; rawBody: string; signature: string;
}
export type MobileMoneyTopupError =
  | { kind: 'BAD_WEBHOOK_SIGNATURE' } | { kind: 'NOT_CONFIRMED' } | { kind: 'WALLET_UNKNOWN' };
export interface MobileMoneyTopupOutput { creditedXof: number; }

export class HandleMobileMoneyTopup {
  constructor(
    private readonly gateway: MobileMoneyGateway,
    private readonly directory: WalletDirectory,
    private readonly wallets: WalletBalanceRepository,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(input: MobileMoneyTopupInput): Promise<Result<MobileMoneyTopupOutput, MobileMoneyTopupError>> {
    if (!this.gateway.verifyWebhook(input.rawBody, input.signature)) return err({ kind: 'BAD_WEBHOOK_SIGNATURE' });

    // ACTIVE CHECK : on re-interroge l'opérateur. Le contenu du webhook n'est jamais cru sur parole.
    const confirmed = await this.gateway.confirmPayment(input.provider, input.providerRef);
    if (!confirmed || !confirmed.confirmed || confirmed.amountXof <= 0) return err({ kind: 'NOT_CONFIRMED' });

    const resolved = await this.directory.resolveOpaqueId(input.opaqueId);
    if (!resolved) return err({ kind: 'WALLET_UNKNOWN' });

    // Idempotent par référence opérateur : un webhook rejoué ne crédite pas deux fois.
    const ref = `${input.provider}:${input.providerRef}`;
    await this.wallets.applyCredit(resolved.walletId, ref, xof(confirmed.amountXof), this.clock.nowIso());
    await this.audit.append({
      actor: `gateway:${input.provider}`, action: 'TOPUP_MOBILE_MONEY', target: resolved.walletId,
      atIso: this.clock.nowIso(), details: { ref, amountXof: confirmed.amountXof },
    });
    return ok({ creditedXof: confirmed.amountXof });
  }
}
