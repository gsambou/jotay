/** Hash de clés API (haute entropie) et de PIN (faible entropie). node:crypto uniquement. */
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey, 'utf8').digest('hex');
}

// CRITICAL-PATH
export async function hashPin(pin: string, salt = randomBytes(16)): Promise<string> {
  const hash = await scryptAsync(pin, salt, 32) as Buffer;
  return `${salt.toString('hex')}.${hash.toString('hex')}`;
}

// CRITICAL-PATH
export async function verifyPinHash(pin: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split('.');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(pin, salt, expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashOtp(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}
