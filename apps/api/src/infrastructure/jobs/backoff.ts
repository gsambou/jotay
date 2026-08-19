/** Backoff exponentiel plafonné (pur). attempt commence à 1. */
export function nextRetryDelayMs(attempt: number, baseMs = 1000, capMs = 3_600_000): number {
  return Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
}
