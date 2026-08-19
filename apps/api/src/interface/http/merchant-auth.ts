import type { FastifyRequest } from 'fastify';
import type { MerchantRegistry, MerchantSession } from '../../application/ports/merchant-registry.js';

export async function requireMerchant(
  registry: MerchantRegistry,
  req: FastifyRequest,
): Promise<MerchantSession | { error: 'unauthorized' }> {
  const key = req.headers['x-merchant-key'];
  if (typeof key !== 'string' || !key) return { error: 'unauthorized' };
  const session = await registry.authenticate(key);
  if (!session) return { error: 'unauthorized' };
  return session;
}

export function isUnauthorized(s: MerchantSession | { error: 'unauthorized' }): s is { error: 'unauthorized' } {
  return 'error' in s;
}
