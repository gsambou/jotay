// CRITICAL-PATH
/**
 * Diversification de clé par UID (schéma inspiré de NXP AN10922, AES-128 CMAC).
 * K_card = CMAC_AES128(K_master, DivInput(UID)). node:crypto uniquement (chap. 17).
 *
 * ⚠️ À VALIDER contre les vecteurs de référence NXP AN10922 et un SAM réel AVANT
 *    production. Ce module fournit la logique et ses propriétés ; l'exactitude
 *    bit-à-bit vis-à-vis de NXP se vérifie sur matériel (frontière hardware, cf. SPEC).
 */
import { createCipheriv } from 'node:crypto';

const BLOCK = 16;
const xor = (a: Buffer, b: Buffer): Buffer => { const o = Buffer.alloc(BLOCK); for (let i = 0; i < BLOCK; i++) o[i] = a[i]! ^ b[i]!; return o; };

function shiftLeft1(b: Buffer): Buffer {
  const o = Buffer.alloc(b.length); let carry = 0;
  for (let i = b.length - 1; i >= 0; i--) { const v = (b[i]! << 1) | carry; o[i] = v & 0xff; carry = (b[i]! & 0x80) ? 1 : 0; }
  return o;
}
function aesEcbBlock(key: Buffer, block: Buffer): Buffer {
  const c = createCipheriv('aes-128-ecb', key, null); c.setAutoPadding(false);
  return Buffer.concat([c.update(block), c.final()]);
}
/** Sous-clés CMAC (K1, K2) — RFC 4493. */
function cmacSubkeys(key: Buffer): { k1: Buffer; k2: Buffer } {
  const Rb = Buffer.alloc(BLOCK); Rb[BLOCK - 1] = 0x87;
  const L = aesEcbBlock(key, Buffer.alloc(BLOCK));
  const k1raw = shiftLeft1(L); const k1 = (L[0]! & 0x80) ? xor(k1raw, Rb) : k1raw;
  const k2raw = shiftLeft1(k1); const k2 = (k1[0]! & 0x80) ? xor(k2raw, Rb) : k2raw;
  return { k1, k2 };
}
/** AES-CMAC (RFC 4493) sur un message court. */
export function aesCmac(key: Buffer, msg: Buffer): Buffer {
  const { k1, k2 } = cmacSubkeys(key);
  const n = Math.ceil(msg.length / BLOCK) || 1;
  const complete = msg.length > 0 && msg.length % BLOCK === 0;
  let last: Buffer;
  if (complete) { last = xor(msg.subarray((n - 1) * BLOCK), k1); }
  else {
    const rest = msg.subarray((n - 1) * BLOCK);
    const padded = Buffer.alloc(BLOCK); rest.copy(padded); padded[rest.length] = 0x80;
    last = xor(padded, k2);
  }
  let x = Buffer.alloc(BLOCK);
  for (let i = 0; i < n - 1; i++) x = aesEcbBlock(key, xor(x, msg.subarray(i * BLOCK, (i + 1) * BLOCK)));
  return aesEcbBlock(key, xor(x, last));
}

/**
 * Dérive la clé de carte à partir de la clé maître de l'événement et de l'UID.
 * DivInput = 0x01 || UID || label — un préfixe/label distinct par usage évite la
 * réutilisation de clé entre applications.
 */
export function diversifyKey(masterKey: Buffer, uid: Buffer, label = 'JOTAY-CARD'): Buffer {
  if (masterKey.length !== 16) throw new TypeError('master key = 16 octets (AES-128)');
  const div = Buffer.concat([Buffer.from([0x01]), uid, Buffer.from(label, 'ascii')]);
  return aesCmac(masterKey, div);
}
