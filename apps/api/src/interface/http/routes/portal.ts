/** Routes portail participant (plugin Fastify). Session en cookie HttpOnly.
 *  Le flag Secure est configurable : true en prod (https), false pour le serveur e2e (http). */
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { RequestPortalOtp } from '../../../application/use-cases/request-portal-otp.js';
import type { VerifyPortalOtp } from '../../../application/use-cases/verify-portal-otp.js';
import type { GetWalletView } from '../../../application/use-cases/get-wallet-view.js';
import type { RequestRefund } from '../../../application/use-cases/request-refund.js';
import type { GetDynamicQrToken } from '../../../application/use-cases/get-dynamic-qr-token.js';
import type { QrRenderer } from '../../../application/ports/qr-renderer.js';

const msisdn = z.string().regex(/^\+?\d{8,15}$/);

function sessionCookie(token: string, expiresAtIso: string, secure: boolean): string {
  const base = `jotay_ps=${token}; HttpOnly; SameSite=Strict; Path=/portal; Expires=${new Date(expiresAtIso).toUTCString()}`;
  return secure ? `${base}; Secure` : base;
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k === name && v) return decodeURIComponent(v);
  }
  return null;
}

export function registerPortalRoutes(
  app: FastifyInstance,
  deps: { requestOtp: RequestPortalOtp; verifyOtp: VerifyPortalOtp; wallet: GetWalletView; refund: RequestRefund; dynamicToken?: GetDynamicQrToken },
  opts: { secureCookies: boolean; qrRenderer?: QrRenderer },
): void {
  app.post('/portal/session', async (req, reply) => {
    const parsed = z.object({ opaqueId: z.string().min(1), msisdn }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation' });
    const res = await deps.requestOtp.execute(parsed.data);
    // Réponse toujours neutre (anti-énumération), que le wallet existe ou non.
    return reply.code(200).send(res.ok ? res.value : { dispatched: true, ttlMinutes: 15 });
  });

  app.post('/portal/session/verify', async (req, reply) => {
    const parsed = z.object({ opaqueId: z.string().min(1), msisdn, code: z.string().regex(/^\d{4,8}$/) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation' });
    const res = await deps.verifyOtp.execute(parsed.data);
    if (!res.ok) return reply.code(401).send({ error: 'invalid_or_expired' });
    reply.header('set-cookie', sessionCookie(res.value.token, res.value.expiresAtIso, opts.secureCookies));
    return reply.code(200).send({ ok: true, expiresAtIso: res.value.expiresAtIso });
  });

  app.get('/portal/wallet', async (req, reply) => {
    const token = readCookie(req.headers['cookie'], 'jotay_ps');
    if (!token) return reply.code(401).send({ error: 'no_session' });
    const res = await deps.wallet.execute({ sessionToken: token });
    if (!res.ok) return reply.code(401).send({ error: res.error.kind.toLowerCase() });
    return reply.code(200).send(res.value);
  });

  app.post('/portal/refund-request', async (req, reply) => {
    const token = readCookie(req.headers['cookie'], 'jotay_ps');
    if (!token) return reply.code(401).send({ error: 'no_session' });
    const parsed = z.object({ pin: z.string().regex(/^\d{4,6}$/), idempotencyKey: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'validation' });
    const res = await deps.refund.execute({ sessionToken: token, ...parsed.data });
    if (!res.ok) {
      const map = { NO_SESSION: 401, BAD_PIN: 401, NO_VERIFIED_PAYOUT: 409 } as const;
      return reply.code(map[res.error.kind]).send({ error: res.error.kind.toLowerCase() });
    }
    return reply.code(202).send(res.value);
  });

  if (deps.dynamicToken) {
    app.get('/portal/qr-token', async (req, reply) => {
      const token = readCookie(req.headers['cookie'], 'jotay_ps');
      if (!token) return reply.code(401).send({ error: 'no_session' });
      const opaqueId = (req.query as { w?: string }).w ?? '';
      const res = await deps.dynamicToken!.execute({ sessionToken: token, opaqueId });
      if (!res.ok) return reply.code(res.error.kind === 'NO_SESSION' ? 401 : 409).send({ error: res.error.kind.toLowerCase() });
      const svg = opts.qrRenderer ? await opts.qrRenderer.toSvg(res.value.payload) : undefined;
      return reply.code(200).send({ ...res.value, ...(svg ? { svg } : {}) });
    });
  }
}
