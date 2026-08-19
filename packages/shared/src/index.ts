/** Types utilitaires partagés — zéro dépendance, zéro I/O. */

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Identifiants opaques (brand types) — évite de mélanger des string entre eux. */
export type Brand<T, B extends string> = T & { readonly __brand: B };
export type EventId = Brand<string, 'EventId'>;
export type CardUid = Brand<string, 'CardUid'>;
export type TerminalId = Brand<string, 'TerminalId'>;
export type VendorId = Brand<string, 'VendorId'>;
