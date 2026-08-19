import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Metrics } from '../src/infrastructure/metrics.js';
test('metrics — compteurs et jauges rendus au format Prometheus', () => {
  const m = new Metrics();
  m.inc('jotay_anomalies_total'); m.inc('jotay_anomalies_total', 2); m.set('jotay_reconciliation_gap_xof', 0);
  const out = m.render();
  assert.match(out, /jotay_anomalies_total 3/);
  assert.match(out, /# TYPE jotay_reconciliation_gap_xof gauge/);
  assert.match(out, /jotay_reconciliation_gap_xof 0/);
});
