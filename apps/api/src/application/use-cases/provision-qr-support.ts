/** Provisionne un support QR : forge un identifiant opaque, le lie au wallet, renvoie l'URL
 *  à encoder dans le QR imprimé. SRP. */
import { ok, type Result } from '@jotay/shared';
import type { OpaqueIdMinter } from '../ports/opaque-id-minter.js';
import type { QrBindingStore } from '../ports/qr-binding-store.js';
import type { Clock } from '../ports/clock.js';

export interface ProvisionQrInput { walletId: string; }
export interface ProvisionQrOutput { opaqueId: string; url: string; }

export class ProvisionQrSupport {
  constructor(
    private readonly minter: OpaqueIdMinter,
    private readonly bindings: QrBindingStore,
    private readonly clock: Clock,
    private readonly baseUrl = 'https://m.jotay.sn',
  ) {}

  async execute(input: ProvisionQrInput): Promise<Result<ProvisionQrOutput, never>> {
    const opaqueId = this.minter.mint();
    await this.bindings.bind(opaqueId, input.walletId, this.clock.nowIso());
    return ok({ opaqueId, url: `${this.baseUrl}/w/${opaqueId}` });
  }
}
