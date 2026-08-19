/** Limiteur de débit à fenêtre fixe — PUR (temps injecté). L'appelant persiste l'état
 *  via un port ; ici, uniquement la transition. Sert /portal/session, /payments/qr. */
export interface WindowState { windowStartMs: number; count: number; }

export interface RateDecision { allowed: boolean; state: WindowState; retryAfterMs: number; }

export function checkRate(
  state: WindowState | null, nowMs: number, limit: number, windowMs: number,
): RateDecision {
  if (!state || nowMs - state.windowStartMs >= windowMs) {
    return { allowed: true, state: { windowStartMs: nowMs, count: 1 }, retryAfterMs: 0 };
  }
  if (state.count < limit) {
    return { allowed: true, state: { ...state, count: state.count + 1 }, retryAfterMs: 0 };
  }
  return { allowed: false, state, retryAfterMs: state.windowStartMs + windowMs - nowMs };
}
