import { createPublicKey, verify as cryptoVerify } from 'node:crypto';
import type { PaymentRecord } from '@jotay/protocol';
import { canonicalBytesForSignature } from '@jotay/protocol';
import type { SignatureVerifier } from '../../application/ports/signature-verifier.js';
import type { TerminalKeyRegistry } from '../../application/ports/terminal-key-registry.js';

/** Vérification Ed25519 (node:crypto). Accepte la signature si elle valide sous N'IMPORTE
 *  laquelle des clés valides du terminal à l'instant du record (rotation à période de grâce). */
export class Ed25519SignatureVerifier implements SignatureVerifier {
  constructor(private readonly registry: TerminalKeyRegistry) {}

  async verify(record: PaymentRecord): Promise<boolean> {
    const keys = await this.registry.validKeys(record.terminalId, record.tsTerminal);
    if (keys.length === 0) return false;
    let sig: Buffer;
    try { sig = Buffer.from(record.terminalSig, 'hex'); } catch { return false; }
    if (sig.length !== 64) return false;
    const { terminalSig: _omit, ...unsigned } = record; void _omit;
    const data = Buffer.from(canonicalBytesForSignature(unsigned));
    for (const raw of keys) {
      if (raw.length !== 32) continue;
      try {
        const key = createPublicKey({
          key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(raw).toString('base64url') },
          format: 'jwk',
        });
        if (cryptoVerify(null, data, key, sig)) return true;
      } catch { /* clé suivante */ }
    }
    return false;
  }
}
