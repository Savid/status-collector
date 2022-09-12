import { collectDefaultMetrics, register } from 'prom-client';

class Metrics {
  static collectDefaultMetrics = collectDefaultMetrics;

  static async metrics() {
    return register.metrics();
  }

  static nowMicro() {
    const [secs, nano] = process.hrtime();
    return Math.floor(secs * 1000000 + nano / 1000);
  }
}

Metrics.collectDefaultMetrics({ register });

export default Metrics;
