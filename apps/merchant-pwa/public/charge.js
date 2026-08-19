/** Construction de la requête d'encaissement — extraite pour test unitaire (zéro I/O). */

export function buildChargeRequest({ scanned, amountXof, pin, authId, merchantKey }) {
  const dyn = scanned.includes(':');
  const [opaqueId, totpCode] = dyn ? scanned.split(':') : [scanned, undefined];
  const url = dyn ? '/payments/qr/authorize-dynamic' : '/payments/qr/authorize';
  const body = dyn
    ? { opaqueId, totpCode, amountXof, authId, ...(pin ? { pin } : {}) }
    : { opaqueId, amountXof, authId, ...(pin ? { pin } : {}) };
  return {
    url,
    headers: {
      'content-type': 'application/json',
      'idempotency-key': authId,
      'x-merchant-key': merchantKey,
    },
    body,
  };
}

/** Seuil UX uniquement — la source de vérité est la config événement serveur. */
export const UX_MICRO_PIN_XOF = 1000;
