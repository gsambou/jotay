/** Port horloge — le domaine ne lit JAMAIS l'heure lui-même (déterminisme). */
export interface Clock {
  nowIso(): string;
}
