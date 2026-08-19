import { randomBytes } from 'node:crypto';
import type { OpaqueIdMinter } from '../../application/ports/opaque-id-minter.js';
/** 128 bits d'aléa cryptographique, encodés base64url (22 caractères, sûrs en URL). */
export class RandomOpaqueIdMinter implements OpaqueIdMinter {
  mint(): string { return randomBytes(16).toString('base64url'); }
}
