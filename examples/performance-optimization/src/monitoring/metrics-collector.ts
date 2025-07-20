export interface Timer {
  end: () => void;
}

export interface Metrics {
  counters: Record<string, number>;
  timers: Record<string, number[]>;
  averageDuration: Record<string, number>;
  totalDuration: Record<string, number>;
}

export class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private timers: Map<string, number[]> = new Map();

  increment(metric: string, value: number = 1): void {
    const current = this.counters.get(metric) || 0;
    this.counters.set(metric, current + value);
  }

  decrement(metric: string, value: number = 1): void {
    const current = this.counters.get(metric) || 0;
    this.counters.set(metric, Math.max(0, current - value));
  }

  startTimer(metric: string): Timer {
    const startTime = Date.now();
    
    return {
      end: () => {
        const duration = Date.now() - startTime;
        const timings = this.timers.get(metric) || [];
        timings.push(duration);
        this.timers.set(metric, timings);
      },
    };
  }

  recordDuration(metric: string, duration: number): void {
    const timings = this.timers.get(metric) || [];
    timings.push(duration);
    this.timers.set(metric, timings);
  }

  getMetrics(): Metrics {
    const counters: Record<string, number> = {};
    const timers: Record<string, number[]> = {};
    const averageDuration: Record<string, number> = {};
    const totalDuration: Record<string, number> = {};
    
    for (const [key, value] of this.counters) {
      counters[key] = value;
    }
    
    for (const [key, values] of this.timers) {
      timers[key] = values;
      
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        averageDuration[key] = sum / values.length;
        totalDuration[key] = sum;
      }
    }
    
    return {
      counters,
      timers,
      averageDuration,
      totalDuration,
    };
  }

  reset(): void {
    this.counters.clear();
    this.timers.clear();
  }

  getPercentile(metric: string, percentile: number): number | null {
    const timings = this.timers.get(metric);
    
    if (!timings || timings.length === 0) {
      return null;
    }
    
    const sorted = [...timings].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    
    return sorted[index];
  }

  getSummary(metric: string): any {
    const timings = this.timers.get(metric);
    
    if (!timings || timings.length === 0) {
      return null;
    }
    
    const sorted = [...timings].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: this.getPercentile(metric, 95),
      p99: this.getPercentile(metric, 99),
    };
  }

  exportMetrics(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];
    
    lines.push('# COUNTERS');
    for (const [key, value] of Object.entries(metrics.counters)) {
      lines.push(`${key}: ${value}`);
    }
    
    lines.push('\n# TIMERS');
    for (const [key, _values] of Object.entries(metrics.timers)) {
      const summary = this.getSummary(key);
      if (summary) {
        lines.push(`${key}:`);
        lines.push(`  count: ${summary.count}`);
        lines.push(`  min: ${summary.min}ms`);
        lines.push(`  max: ${summary.max}ms`);
        lines.push(`  mean: ${summary.mean.toFixed(2)}ms`);
        lines.push(`  median: ${summary.median}ms`);
        lines.push(`  p95: ${summary.p95}ms`);
        lines.push(`  p99: ${summary.p99}ms`);
      }
    }
    
    return lines.join('\n');
  }
}