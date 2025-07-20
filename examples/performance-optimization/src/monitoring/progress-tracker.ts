export class ProgressTracker {
  private total: number = 0;
  private current: number = 0;
  private startTime: number = 0;
  private lastUpdate: number = 0;
  private updateInterval: number = 1000;

  start(total: number): void {
    this.total = total;
    this.current = 0;
    this.startTime = Date.now();
    this.lastUpdate = Date.now();
    
    this.logProgress();
  }

  update(processed: number): void {
    this.current = processed;
    
    const now = Date.now();
    if (now - this.lastUpdate >= this.updateInterval) {
      this.logProgress();
      this.lastUpdate = now;
    }
  }

  complete(): void {
    this.current = this.total;
    this.logProgress();
    
    const duration = Date.now() - this.startTime;
    console.log(`\nCompleted ${this.total} items in ${this.formatDuration(duration)}`);
  }

  private logProgress(): void {
    const percentage = this.total > 0 ? (this.current / this.total) * 100 : 0;
    const elapsed = Date.now() - this.startTime;
    const rate = this.current > 0 ? this.current / (elapsed / 1000) : 0;
    const eta = rate > 0 ? (this.total - this.current) / rate : 0;
    
    const progressBar = this.createProgressBar(percentage);
    
    process.stdout.write('\r' + ' '.repeat(100) + '\r');
    process.stdout.write(
      `Progress: ${progressBar} ${percentage.toFixed(1)}% ` +
      `(${this.current}/${this.total}) ` +
      `Rate: ${rate.toFixed(1)}/s ` +
      `ETA: ${this.formatDuration(eta * 1000)}`
    );
  }

  private createProgressBar(percentage: number): string {
    const width = 30;
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  getStats(): any {
    const elapsed = Date.now() - this.startTime;
    const rate = this.current > 0 ? this.current / (elapsed / 1000) : 0;
    
    return {
      total: this.total,
      processed: this.current,
      remaining: this.total - this.current,
      percentage: this.total > 0 ? (this.current / this.total) * 100 : 0,
      elapsed,
      rate,
      eta: rate > 0 ? (this.total - this.current) / rate * 1000 : 0,
    };
  }
}