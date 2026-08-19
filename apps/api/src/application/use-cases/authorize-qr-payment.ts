/**
 * Use case : autoriser un paiement QR EN LIGNE (chap. 18) — SRP.
 * Orchestration seulement : charge l'état, vérifie le PIN si nécessaire, délègue la
 * DÉCISION au moteur pur authorizeQrPayment, puis débite le solde serveur de façon
 * idempotente. Aucune règle métier chiffrée ici : elle vit dans le domaine.
 *
 * Ce chemin est SYNCHRONE et exige le réseau ; hors ligne il n'existe pas (chap. 18.5) :
 * le terminal refuse le QR quand il est déconnecté, il n'appelle simplement pas ce use case.
 */
import { err, ok, type Result } from '@jotay/shared';
import { authorizeQrPayment, xof, type AmountXof, type QrAuthorizeDecision } from '@jotay/ledger-core';
import type { Clock } from '../ports/clock.js';
import type { WalletBalanceRepository } from '../ports/wallet-balance-repository.js';
import type { PinVerifier } from '../ports/pin-verifier.js';
import type { WalletDirectory } from '../ports/wallet-directory.js';

export interface AuthorizeQrPaymentInput {
  /** Identifiant opaque scanné sur le QR du participant. Résolu côté serveur ; le marchand
   *  ne manipule JAMAIS le walletId interne. */
  opaqueId: string;
  amountXof: number;
  vendorId: string;
  /** PIN saisi sur le terminal (optionnel sous le micro-plafond). */
  pin?: string;
  /** Identifiant d'autorisation fourni par le terminal — clé d'idempotence. */
  authId: string;
  params: {
    microPinThresholdXof: number;
    velocityAmountCapXof: number;
    velocityTxCap: number;
  };
}

export type AuthorizeQrError =
  | { kind: 'WALLET_UNKNOWN' }
  | { kind: 'BAD_PIN' }
  | { kind: 'DECLINED'; reason: Exclude<QrAuthorizeDecision & { ok: false }, { ok: true }>['reason'] };

export interface AuthorizeQrOutput {
  authId: string;
  balanceAfterXof: number;
}

export class AuthorizeQrPayment {
  constructor(
    private readonly directory: WalletDirectory,
    private readonly wallets: WalletBalanceRepository,
    private readonly pins: PinVerifier,
    private readonly clock: Clock,
  ) {}

  async execute(input: AuthorizeQrPaymentInput): Promise<Result<AuthorizeQrOutput, AuthorizeQrError>> {
    const resolved = await this.directory.resolveOpaqueId(input.opaqueId);
    if (!resolved) return err({ kind: 'WALLET_UNKNOWN' });
    const walletId = resolved.walletId;
    const state = await this.wallets.loadState(walletId);
    if (!state) return err({ kind: 'WALLET_UNKNOWN' });

    const amount = xof(input.amountXof) as AmountXof;
    const threshold = xof(input.params.microPinThresholdXof) as AmountXof;

    // PIN vérifié en amont seulement s'il est requis ET fourni (le domaine tranche ensuite).
    let pinVerified = false;
    if (amount > threshold) {
      if (!input.pin) return err({ kind: 'DECLINED', reason: 'PIN_REQUIRED' });
      pinVerified = await this.pins.verify(walletId, input.pin);
      if (!pinVerified) return err({ kind: 'BAD_PIN' });
    }

    const decision = authorizeQrPayment(state, {
      amountXof: amount,
      microPinThresholdXof: threshold,
      pinVerified,
      velocityAmountCapXof: xof(input.params.velocityAmountCapXof) as AmountXof,
      velocityTxCap: input.params.velocityTxCap,
    });
    if (!decision.ok) return err({ kind: 'DECLINED', reason: decision.reason });

    // Débit idempotent : rejouer la même authId ne débite pas deux fois. CRITICAL-PATH.
    await this.wallets.applyDebit(walletId, input.authId, amount, this.clock.nowIso());
    return ok({ authId: input.authId, balanceAfterXof: decision.balanceAfterXof });
  }
}
