/** Adapters in-memory pour tests d'intégration/e2e. Implémentent les mêmes ports que
 *  les adapters Postgres (LSP) : les use cases ne voient aucune différence. */
import type { PaymentRecord } from '@jotay/protocol';
import type { Anomaly, ServerWalletState, AmountXof } from '@jotay/ledger-core';
import { xof, DEFAULT_QR_LIMITS } from '@jotay/ledger-core';
import type { Clock } from '../src/application/ports/clock.js';
import type { IngestResult, LedgerEventStore } from '../src/application/ports/ledger-event-store.js';
import type { BlocklistRepository, BlocklistDelta } from '../src/application/ports/blocklist-repository.js';
import type { AnomalySink } from '../src/application/ports/anomaly-sink.js';
import type { WalletBalanceRepository } from '../src/application/ports/wallet-balance-repository.js';
import type { PinVerifier } from '../src/application/ports/pin-verifier.js';
import type { WalletDirectory } from '../src/application/ports/wallet-directory.js';
import type { OtpChannel, OtpMessage } from '../src/application/ports/otp-channel.js';
import type { OtpChallengeStore } from '../src/application/ports/otp-challenge-store.js';
import type { PortalSession, PortalSessionStore } from '../src/application/ports/portal-session-store.js';
import type { WalletHistoryReader } from '../src/application/ports/wallet-history-reader.js';
import type { RefundRequestSink } from '../src/application/ports/refund-request-sink.js';
import type { SignatureVerifier } from '../src/application/ports/signature-verifier.js';
import type { TerminalKeyRegistry } from '../src/application/ports/terminal-key-registry.js';
import type { OpaqueIdMinter } from '../src/application/ports/opaque-id-minter.js';
import type { QrBindingStore } from '../src/application/ports/qr-binding-store.js';
import type { TotpSecretStore } from '../src/application/ports/totp-secret-store.js';
import type { DynamicQrGuard } from '../src/application/ports/dynamic-qr-guard.js';
import type { QrRenderer } from '../src/application/ports/qr-renderer.js';
import type { PaymentRecord as _PR } from '@jotay/protocol';
import type { MerchantRegistry, MerchantSession } from '../src/application/ports/merchant-registry.js';
import type { EventPaymentConfig, QrEventLimits } from '../src/application/ports/event-payment-config.js';
import type { RecentVendorSighting } from '../src/application/ports/recent-vendor-sighting.js';

export class FixedClock implements Clock {
  constructor(private iso: string) {}
  nowIso() { return this.iso; }
  set(iso: string) { this.iso = iso; }
}

export class MemLedgerEventStore implements LedgerEventStore {
  private byKey = new Map<string, PaymentRecord>();
  async append(records: readonly PaymentRecord[]): Promise<IngestResult> {
    let inserted = 0;
    for (const r of records) {
      const key = `${r.cardUid}#${r.cardTxCounter}`;
      if (!this.byKey.has(key)) { this.byKey.set(key, r); inserted++; }
    }
    return { inserted, duplicates: records.length - inserted };
  }
  async readCard(cardUid: string): Promise<PaymentRecord[]> {
    return [...this.byKey.values()].filter((r) => r.cardUid === cardUid).sort((a, b) => a.cardTxCounter - b.cardTxCounter);
  }
  async readEvent(eventId: string): Promise<PaymentRecord[]> {
    return [...this.byKey.values()].filter((r) => r.eventId === eventId);
  }
}

export class MemBlocklist implements BlocklistRepository {
  added: string[] = [];
  private version = 0;
  async add(cardUid: string) { if (!this.added.includes(cardUid)) { this.added.push(cardUid); this.version++; } }
  async deltaSince(v: number): Promise<BlocklistDelta> { return { version: this.version, addedCardUids: v < this.version ? this.added : [] }; }
}

export class RecordingAnomalySink implements AnomalySink {
  reported: Anomaly[] = [];
  async report(anomalies: readonly Anomaly[], _batchId?: string, _atIso?: string) { this.reported.push(...anomalies); }
}

export class MemWalletBalance implements WalletBalanceRepository {
  constructor(private states = new Map<string, ServerWalletState>()) {}
  seed(walletId: string, balance: number) {
    this.states.set(walletId, { serverBalanceXof: xof(balance), frozen: false, spentInWindowXof: xof(0), txCountInWindow: 0 });
  }
  async loadState(walletId: string) { return this.states.get(walletId) ?? null; }
  private appliedRefs = new Set<string>();
  async applyDebit(walletId: string, authId: string, amount: AmountXof) {
    if (this.appliedRefs.has('d:' + authId)) return; this.appliedRefs.add('d:' + authId);
    const s = this.states.get(walletId); if (!s) return;
    this.states.set(walletId, { ...s, serverBalanceXof: xof(s.serverBalanceXof - amount) });
  }
  async applyCredit(walletId: string, ref: string, amount: AmountXof) {
    if (this.appliedRefs.has('c:' + ref)) return; this.appliedRefs.add('c:' + ref); // idempotence
    const s = this.states.get(walletId) ?? { serverBalanceXof: xof(0), frozen: false, spentInWindowXof: xof(0), txCountInWindow: 0 };
    this.states.set(walletId, { ...s, serverBalanceXof: xof(s.serverBalanceXof + amount) });
  }
}

export class FakePinVerifier implements PinVerifier {
  constructor(private good = '1234', private maxFailures = 5) {}
  private failures = new Map<string, number>();
  async verify(walletId: string, pin: string) {
    const n = this.failures.get(walletId) ?? 0;
    if (n >= this.maxFailures) return false;
    if (pin === this.good) { this.failures.set(walletId, 0); return true; }
    this.failures.set(walletId, n + 1);
    return false;
  }
}

export class FakeMerchantRegistry implements MerchantRegistry {
  constructor(private keys = new Map<string, MerchantSession>([
    ['test-merchant-key', { vendorId: 'V', eventId: 'E', role: 'merchant' }],
    ['test-supervisor-key', { vendorId: 'SUP', eventId: 'E', role: 'supervisor' }],
  ])) {}
  set(key: string, session: MerchantSession) { this.keys.set(key, session); }
  async authenticate(apiKey: string) { return this.keys.get(apiKey) ?? null; }
}

export class FixedEventPaymentConfig implements EventPaymentConfig {
  constructor(private limits: QrEventLimits = { ...DEFAULT_QR_LIMITS }) {}
  set(limits: QrEventLimits) { this.limits = limits; }
  async qrLimits(_eventId: string) { return this.limits; }
}

export class MemVendorSighting implements RecentVendorSighting {
  private last = new Map<string, { vendorId: string; atMs: number }>();
  async remember(walletId: string, vendorId: string, atIso: string, windowMs: number) {
    const atMs = Date.parse(atIso);
    const prev = this.last.get(walletId);
    this.last.set(walletId, { vendorId, atMs });
    if (!prev || prev.vendorId === vendorId || atMs - prev.atMs > windowMs) return null;
    return prev.vendorId;
  }
}

export class FakeWalletDirectory implements WalletDirectory {
  constructor(private map = new Map<string, string>(), private payouts = new Map<string, string>()) {}
  bind(opaqueId: string, walletId: string) { this.map.set(opaqueId, walletId); }
  setPayout(walletId: string, msisdn: string) { this.payouts.set(walletId, msisdn); }
  async resolveOpaqueId(opaqueId: string) { const w = this.map.get(opaqueId); return w ? { walletId: w } : null; }
  async verifiedPayoutMsisdn(walletId: string) { return this.payouts.get(walletId) ?? null; }
}

export class RecordingOtpChannel implements OtpChannel {
  sent: { msisdn: string; message: OtpMessage }[] = [];
  async send(msisdn: string, message: OtpMessage) { this.sent.push({ msisdn, message }); }
}

export class FakeOtpChallengeStore implements OtpChallengeStore {
  private current = new Map<string, string>();
  constructor(private fixedCode = '654321') {}
  async issue(walletId: string, msisdn: string) { const c = this.fixedCode; this.current.set(`${walletId}|${msisdn}`, c); return c; }
  async verifyAndConsume(walletId: string, msisdn: string, code: string) {
    const key = `${walletId}|${msisdn}`; const ok = this.current.get(key) === code; if (ok) this.current.delete(key); return ok;
  }
}

export class MemSessionStore implements PortalSessionStore {
  private sessions = new Map<string, PortalSession>();
  private n = 0;
  async create(walletId: string, _msisdn: string, nowIso: string) {
    const token = `sess-${++this.n}`;
    const expiresAtIso = new Date(new Date(nowIso).getTime() + 15 * 60000).toISOString();
    const s = { token, walletId, expiresAtIso }; this.sessions.set(token, s); return s;
  }
  async resolve(token: string, nowIso: string) {
    const s = this.sessions.get(token); if (!s) return null;
    return new Date(s.expiresAtIso).getTime() > new Date(nowIso).getTime() ? s : null;
  }
  async revoke(token: string) { this.sessions.delete(token); }
}

export class FakeHistory implements WalletHistoryReader {
  constructor(private asOfIso = '2026-08-01T20:00:00Z') {}
  async recent(_walletId: string, _limit: number) {
    return { entries: [{ atIso: '2026-08-01T19:00:00Z', kind: 'PAYMENT' as const, amountXof: 1500, vendorName: 'Bar' }], asOfIso: this.asOfIso };
  }
}

export class RecordingRefundSink implements RefundRequestSink {
  enqueued: { walletId: string; payoutMsisdn: string; key: string }[] = [];
  async enqueue(walletId: string, payoutMsisdn: string, key: string) { this.enqueued.push({ walletId, payoutMsisdn, key }); }
}

/** Vérificateur de signature de test : accepte tout par défaut, ou rejette des UIDs listés. */
export class FakeSignatureVerifier implements SignatureVerifier {
  constructor(private rejectCardUids: Set<string> = new Set()) {}
  reject(cardUid: string) { this.rejectCardUids.add(cardUid); }
  async verify(r: _PR): Promise<boolean> { return !this.rejectCardUids.has(r.cardUid); }
}

/** Registre de clés de test avec fenêtres de validité (rotation à période de grâce). */
export class MemTerminalKeyRegistry implements TerminalKeyRegistry {
  private keys: { terminalId: string; raw: Uint8Array; from: string; until: string | null }[] = [];
  set(terminalId: string, raw: Uint8Array, from = '1970-01-01T00:00:00Z', until: string | null = null) {
    this.keys.push({ terminalId, raw, from, until });
  }
  async validKeys(terminalId: string, atIso: string) {
    return this.keys
      .filter((k) => k.terminalId === terminalId && k.from <= atIso && (k.until === null || atIso < k.until))
      .map((k) => k.raw);
  }
}

/** Minter déterministe pour tests (séquence stable). */
export class FakeOpaqueIdMinter implements OpaqueIdMinter {
  private n = 0;
  mint() { return `opaque-${++this.n}`; }
}

/** Binding store qui alimente aussi un FakeWalletDirectory (résolution). */
export class MemQrBindingStore implements QrBindingStore {
  constructor(private directory: FakeWalletDirectory) {}
  async bind(opaqueId: string, walletId: string) { this.directory.bind(opaqueId, walletId); }
}

/** Secret TOTP fixe par wallet (tests). */
export class MemTotpSecretStore implements TotpSecretStore {
  constructor(private m = new Map<string, Uint8Array>()) {}
  set(walletId: string, secret: Uint8Array) { this.m.set(walletId, secret); }
  async secretFor(walletId: string) { return this.m.get(walletId) ?? null; }
}

/** Garde anti-rejeu en mémoire. */
export class MemDynamicQrGuard implements DynamicQrGuard {
  private seen = new Set<string>();
  async consume(walletId: string, step: number) {
    const k = `${walletId}:${step}`; if (this.seen.has(k)) return false; this.seen.add(k); return true;
  }
}

/** Renderer QR de test (pas de vraie génération). */
export class FakeQrRenderer implements QrRenderer {
  async toSvg(payload: string) { return `<svg data-payload="${payload}"/>`; }
}

/** Journal d'audit de test (append-only en mémoire). */
export class FakeAuditLog {
  entries: { actor: string; action: string; target: string; atIso: string; details?: Record<string, unknown> }[] = [];
  async append(e: { actor: string; action: string; target: string; atIso: string; details?: Record<string, unknown> }) {
    this.entries.push(e);
  }
}

/** Passerelle Mobile Money de test : signature 'valid', confirmation pilotable. */
export class FakeMobileMoneyGateway {
  constructor(private confirmable = new Map<string, { amountXof: number; opaqueRef: string }>()) {}
  allow(ref: string, amountXof: number, opaqueRef: string) { this.confirmable.set(ref, { amountXof, opaqueRef }); }
  verifyWebhook(_rawBody: string, signature: string) { return signature === 'valid'; }
  async confirmPayment(_provider: string, providerRef: string) {
    const c = this.confirmable.get(providerRef);
    return c ? { confirmed: true, amountXof: c.amountXof, opaqueRef: c.opaqueRef } : { confirmed: false, amountXof: 0, opaqueRef: '' };
  }
}
