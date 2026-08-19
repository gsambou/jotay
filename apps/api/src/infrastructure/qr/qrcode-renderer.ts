import qrcode from 'qrcode-generator';
import type { QrRenderer } from '../../application/ports/qr-renderer.js';
/** Rendu SVG via qrcode-generator (zéro dépendance transitive) — ADR-010. */
export class QrCodeRenderer implements QrRenderer {
  async toSvg(payload: string): Promise<string> {
    const qr = qrcode(0, 'M'); // type auto, correction M
    qr.addData(payload); qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 4 });
  }
}
