// CRITICAL-PATH
/**
 * HOTP (RFC 4226) et TOTP (RFC 6238) — node:crypto, temps INJECTÉ (déterministe).
 * Sert le QR dynamique : un code tournant à usage unique qui expire (résistance au rejeu).
 */
import { createHmac } from 'node:crypto';

export type TotpAlgo = 'sha1' | 'sha256';

/** HOTP : code à `digits` chiffres pour un compteur donné (RFC 4226, dynamic truncation). */
export function hotp(secret: Buffer, counter: number, digits = 6, algo: TotpAlgo = 'sha1'): string {
  const buf = Buffer.alloc(8);
  // compteur 64 bits big-endian (les entiers JS sûrs suffisent pour l'horloge).
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac(algo, secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const bin = ((hmac[offset]! & 0x7f) << 24) | (hmac[offset + 1]! << 16) | (hmac[offset + 2]! << 8) | hmac[offset + 3]!;
  return (bin % 10 ** digits).toString().padStart(digits, '0');
}

export function timeStep(nowMs: number, stepSec = 30, t0Sec = 0): number {
  return Math.floor((Math.floor(nowMs / 1000) - t0Sec) / stepSec);
}

/** TOTP : HOTP indexé par le pas de temps courant. */
export function totp(secret: Buffer, nowMs: number, stepSec = 30, digits = 6, algo: TotpAlgo = 'sha1'): string {
  return hotp(secret, timeStep(nowMs, stepSec), digits, algo);
}

/** Secondes restantes avant rotation du code. */
export function secondsUntilRotation(nowMs: number, stepSec = 30): number {
  return stepSec - (Math.floor(nowMs / 1000) % stepSec);
}

export interface TotpVerification { valid: boolean; step: number | null; }

/** Vérifie un code sur la fenêtre [-window, +window] pas ; renvoie le pas exact (usage unique). */
export function verifyTotp(
  secret: Buffer, code: string, nowMs: number,
  stepSec = 30, window = 1, digits = 6, algo: TotpAlgo = 'sha1',
): TotpVerification {
  const current = timeStep(nowMs, stepSec);
  for (let d = -window; d <= window; d++) {
    if (hotp(secret, current + d, digits, algo) === code) return { valid: true, step: current + d };
  }
  return { valid: false, step: null };
}
