import type { Clock } from '../application/ports/clock.js';

/** Seul endroit du service autorisé à lire l'horloge système. */
export class SystemClock implements Clock {
  nowIso(): string {
    return new Date().toISOString();
  }
}
