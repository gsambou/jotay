/** Registre de métriques minimal (compteurs + jauges), rendu au format texte Prometheus.
 *  Zéro dépendance. Métriques MÉTIER visées : écart de réconciliation, anomalies, terminaux muets. */
export class Metrics {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  inc(name: string, by = 1) { this.counters.set(name, (this.counters.get(name) ?? 0) + by); }
  set(name: string, value: number) { this.gauges.set(name, value); }
  render(): string {
    const lines: string[] = [];
    for (const [k, v] of this.counters) { lines.push(`# TYPE ${k} counter`, `${k} ${v}`); }
    for (const [k, v] of this.gauges) { lines.push(`# TYPE ${k} gauge`, `${k} ${v}`); }
    return lines.join('\n') + '\n';
  }
}
