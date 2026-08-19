import { test } from 'node:test';
import assert from 'node:assert/strict';
import qrcode from 'qrcode-generator';

test('qr — génère un SVG scannable pour une URL de portail', () => {
  const qr = qrcode(0, 'M'); qr.addData('https://m.jotay.sn/w/AbCdEf0123456789xyzABC'); qr.make();
  const svg = qr.createSvgTag({ cellSize: 4, margin: 4 });
  assert.match(svg, /<svg/);
  assert.ok(svg.length > 200);
});
test('qr — déterministe pour une même entrée', () => {
  const mk = (d) => { const q = qrcode(0, 'M'); q.addData(d); q.make(); return q.createSvgTag(); };
  assert.equal(mk('https://m.jotay.sn/w/X'), mk('https://m.jotay.sn/w/X'));
});
