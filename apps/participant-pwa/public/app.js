// Portail participant — JavaScript ESM natif, zéro dépendance (ADR-003).
// Rendu des données serveur via helper à échappement automatique (ADR-004).
import { html, render } from '/dom.js';
const API = (window.JOTAY && window.JOTAY.API_BASE) || '';
const $ = (id) => document.getElementById(id);

// L'identifiant opaque vient de l'URL /w/{opaqueId} (ou ?w=).
function opaqueId() {
  const m = location.pathname.match(/\/w\/([^/]+)/);
  if (m) return decodeURIComponent(m[1]);
  return new URLSearchParams(location.search).get('w') || '';
}

async function api(path, body) {
  const headers = body ? { 'content-type': 'application/json' } : {};
  if (body && body.idempotencyKey) headers['idempotency-key'] = body.idempotencyKey;
  const res = await fetch(API + path, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include', // session en cookie HttpOnly
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n);
function show(el) { $(el).classList.remove('hidden'); }
function hide(el) { $(el).classList.add('hidden'); }

function reflectOnline() {
  const off = !navigator.onLine;
  $('offline').classList.toggle('hidden', !off);
  const rb = $('btn-refund'); if (rb) rb.disabled = off;
}
addEventListener('online', reflectOnline);
addEventListener('offline', reflectOnline);

$('btn-otp').onclick = async () => {
  $('err-phone').textContent = '';
  const msisdn = $('msisdn').value.trim();
  if (!/^\+?\d{8,15}$/.test(msisdn)) { $('err-phone').textContent = 'Numéro invalide.'; return; }
  $('btn-otp').disabled = true;
  await api('/portal/session', { opaqueId: opaqueId(), msisdn }); // réponse neutre
  $('btn-otp').disabled = false;
  hide('step-phone'); show('step-code');
};

$('btn-verify').onclick = async () => {
  $('err-code').textContent = '';
  const code = $('code').value.trim();
  const { status } = await api('/portal/session/verify', { opaqueId: opaqueId(), msisdn: $('msisdn').value.trim(), code });
  if (status !== 200) { $('err-code').textContent = 'Code invalide ou expiré.'; return; }
  hide('step-code'); await loadWallet();
};

async function loadWallet() {
  const { status, data } = await api('/portal/wallet');
  if (status !== 200) { show('step-phone'); return; }
  $('balance').textContent = fmt(data.serverBalanceXof);
  const d = new Date(data.asOfIso);
  $('asof').textContent = 'À jour à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  $('frozen').classList.toggle('hidden', !data.frozen);
  // Chaque interpolation ${...} est échappée par le helper html`` (ADR-004) :
  // vendorName vient du serveur et ne doit jamais être injecté brut.
  const rows = (data.history || []).map((e) => html`
    <div class="row">
      <span>${e.vendorName || e.kind}</span>
      <span>${(e.kind === 'PAYMENT' ? '-' : '+') + fmt(e.amountXof)}</span>
    </div>`);
  $('history-list').replaceChildren(render(html`${rows}`));
  show('step-wallet'); show('history'); reflectOnline();
}

$('btn-refund').onclick = async () => {
  $('err-refund').textContent = '';
  const pin = prompt('PIN à 4 chiffres pour confirmer le remboursement');
  if (!pin) return;
  const idempotencyKey = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
  const { status, data } = await api('/portal/refund-request', { pin, idempotencyKey });
  if (status === 202) $('err-refund').textContent = 'Demande enregistrée (' + data.payoutMsisdnMasked + ').';
  else if (status === 409) $('err-refund').textContent = 'Aucun numéro de remboursement vérifié. Associez-en un d\'abord.';
  else $('err-refund').textContent = 'Refusé. Vérifiez votre PIN.';
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
reflectOnline();

// QR de paiement dynamique : poll du jeton tournant (le secret reste serveur).
let qrTimer = null;
async function refreshQr() {
  const { status, data } = await api('/portal/qr-token?w=' + encodeURIComponent(opaqueId()));
  if (status !== 200) { $('qrexp').textContent = 'QR indisponible.'; return; }
  $('qrimg').innerHTML = data.svg || ''; // SVG rendu serveur (échappement non requis : SVG maîtrisé)
  $('qrexp').textContent = 'Se renouvelle dans ' + data.expiresInSec + ' s';
}
const showQrBtn = document.getElementById('btn-showqr');
if (showQrBtn) showQrBtn.onclick = async () => {
  $('qrbox').classList.remove('hidden');
  await refreshQr();
  if (qrTimer) clearInterval(qrTimer);
  qrTimer = setInterval(refreshQr, 15000); // re-fetch avant rotation (fenêtre 30 s)
};
