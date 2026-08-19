/** Provisionnement QR (back-office) : forge un identifiant opaque et produit un QR SVG
 *  imprimable encodant l'URL du portail. `pnpm qr:sample`. Hors chemin de paiement (ADR-010). */
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import qrcode from 'qrcode-generator';

const base = process.env['PORTAL_BASE'] ?? 'https://m.jotay.sn';
const opaqueId = randomBytes(16).toString('base64url');
const url = `${base}/w/${opaqueId}`;
const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
const svg = qr.createSvgTag({ cellSize: 6, margin: 4 });
writeFileSync('qr-sample.svg', svg);
console.log(JSON.stringify({ opaqueId, url, file: 'qr-sample.svg', bytes: svg.length }, null, 2));
