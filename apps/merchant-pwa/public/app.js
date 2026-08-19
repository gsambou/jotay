// Encaissement QR-only — ESM natif, zéro dépendance (ADR-003).
import { buildChargeRequest, UX_MICRO_PIN_XOF } from './charge.js';

const API = (window.JOTAY && window.JOTAY.API_BASE) || '';
const MERCHANT_KEY = (window.JOTAY && window.JOTAY.MERCHANT_KEY) || '';
const $ = (id) => document.getElementById(id);

$('scan').onclick = async () => {
  if (!('BarcodeDetector' in window)) { $('out').textContent = 'Scanner indisponible — saisir l\'ID manuellement.'; return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const track = stream.getVideoTracks()[0];
    const det = new BarcodeDetector({ formats: ['qr_code'] });
    const cap = new ImageCapture(track);
    const bmp = await cap.grabFrame();
    const codes = await det.detect(bmp);
    track.stop();
    if (codes[0]) {
      const m = codes[0].rawValue.match(/\/w\/([^/?#]+)/);
      $('wallet').value = m ? decodeURIComponent(m[1]) : codes[0].rawValue;
    }
  } catch { $('out').textContent = 'Échec du scan — saisir l\'ID manuellement.'; }
};

$('charge').onclick = async () => {
  const scanned = $('wallet').value.trim();
  const amountXof = parseInt($('amount').value, 10);
  if (!scanned || !Number.isInteger(amountXof) || amountXof <= 0) { $('out').textContent = 'QR et montant requis.'; return; }
  if (!MERCHANT_KEY) { $('out').textContent = 'Clé marchande manquante (config.js).'; return; }
  let pin;
  if (amountXof > UX_MICRO_PIN_XOF) { pin = prompt('PIN du client (4 chiffres)') || undefined; }
  const authId = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
  const { url, headers, body } = buildChargeRequest({ scanned, amountXof, pin, authId, merchantKey: MERCHANT_KEY });
  const res = await fetch(API + url, { method: 'POST', headers, credentials: 'include', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  $('out').textContent = res.status === 200
    ? 'Accepté. Nouveau solde : ' + new Intl.NumberFormat('fr-FR').format(data.balanceAfterXof) + ' FCFA'
    : 'Refusé (' + (data.reason || data.error || res.status) + ').';
};
