import { EventEmitter } from 'events';
import chalk from 'chalk';
import ora from 'ora';
import { ProgressInfo } from './ParallelAnalyzer';

export interface ProgressReporterOptions {
  showSpinner?: boolean;
  showBar?: boolean;
  showDetails?: boolean;
  silent?: boolean;
}

export class ProgressReporter extends EventEmitter {
  private options: ProgressReporterOptions;
  private spinner?: ReturnType<typeof ora>;
  private startTime?: number;
  private lastUpdate: number = 0;
  private updateInterval: number = 100; // ms

  constructor(options: ProgressReporterOptions = {}) {
    super();
    this.options = {
      showSpinner: true,
      showBar: true,
      showDetails: true,
      silent: false,
      ...options,
    };
  }

  start(message: string = 'Starting analysis...'): void {
    if (this.options.silent) return;

    this.startTime = Date.now();

    if (this.options.showSpinner) {
      this.spinner = ora({
        text: message,
        spinner: 'dots',
        color: 'cyan',
      }).start();
    } else {
      console.log(chalk.cyan(message));
    }
  }

  update(info: ProgressInfo): void {
    if (this.options.silent) return;

    const now = Date.now();
    if (now - this.lastUpdate < this.updateInterval) {
      return; // Throttle updates
    }
    this.lastUpdate = now;

    const message = this.formatProgressMessage(info);

    if (this.spinner) {
      this.spinner.text = message;
    } else {
      this.clearLine();
      process.stdout.write(message);
    }

    // Emit progress event for external listeners
    this.emit('progress', info);
  }

  success(message?: string): void {
    if (this.options.silent) return;

    const finalMessage = message || this.getCompletionMessage();

    if (this.spinner) {
      this.spinner.succeed(chalk.green(finalMessage));
    } else {
      this.clearLine();
      console.log(chalk.green('✔ ' + finalMessage));
    }
  }

  fail(error: string | Error): void {
    if (this.options.silent) return;

    const errorMessage = error instanceof Error ? error.message : error;

    if (this.spinner) {
      this.spinner.fail(chalk.red(errorMessage));
    } else {
      this.clearLine();
      console.log(chalk.red('✖ ' + errorMessage));
    }
  }

  warn(message: string): void {
    if (this.options.silent) return;

    if (this.spinner) {
      this.spinner.warn(chalk.yellow(message));
    } else {
      console.log(chalk.yellow('⚠ ' + message));
    }
  }

  info(message: string): void {
    if (this.options.silent) return;

    if (this.spinner) {
      // Temporarily pause spinner to show info
      const currentText = this.spinner.text;
      this.spinner.stop();
      console.log(chalk.blue('ℹ ' + message));
      this.spinner = ora({
        text: currentText,
        spinner: 'dots',
        color: 'cyan',
      }).start();
    } else {
      console.log(chalk.blue('ℹ ' + message));
    }
  }

  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = undefined;
    }
  }

  private formatProgressMessage(info: ProgressInfo): string {
    const { total, completed, current, percentage } = info;
    const parts: string[] = [];

    // Basic progress
    parts.push(`Analyzing: ${completed}/${total} files`);

    // Progress bar
    if (this.options.showBar) {
      const barWidth = 20;
      const filled = Math.round((percentage / 100) * barWidth);
      const empty = barWidth - filled;
      const bar = '█'.repeat(filled) + '░'.repeat(empty);
      parts.push(`[${bar}]`);
    }

    // Percentage
    parts.push(`${percentage.toFixed(1)}%`);

    // Current file
    if (this.options.showDetails && current) {
      const fileName = this.truncateFileName(current, 30);
      parts.push(`- ${fileName}`);
    }

    // Time elapsed
    if (this.startTime) {
      const elapsed = Date.now() - this.startTime;
      const timeStr = this.formatTime(elapsed);
      parts.push(`(${timeStr})`);
    }

    return parts.join(' ');
  }

  private truncateFileName(path: string, maxLength: number): string {
    if (path.length <= maxLength) return path;

    const parts = path.split('/');
    const fileName = parts[parts.length - 1];

    if (fileName.length > maxLength) {
      return '...' + fileName.slice(-(maxLength - 3));
    }

    let result = fileName;
    for (let i = parts.length - 2; i >= 0; i--) {
      const newResult = parts[i] + '/' + result;
      if (newResult.length > maxLength) {
        return '.../' + result;
      }
      result = newResult;
    }

    return result;
  }

  private formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  private getCompletionMessage(): string {
    if (!this.startTime) return 'Analysis completed';

    const elapsed = Date.now() - this.startTime;
    const timeStr = this.formatTime(elapsed);
    return `Analysis completed in ${timeStr}`;
  }

  private clearLine(): void {
    if (process.stdout.isTTY) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    }
  }

  // Factory method for common progress scenarios
  static forFileAnalysis(options?: ProgressReporterOptions): ProgressReporter {
    return new ProgressReporter({
      showSpinner: true,
      showBar: true,
      showDetails: true,
      ...options,
    });
  }

  static forBatchOperation(options?: ProgressReporterOptions): ProgressReporter {
    return new ProgressReporter({
      showSpinner: false,
      showBar: true,
      showDetails: false,
      ...options,
    });
  }

  static silent(): ProgressReporter {
    return new ProgressReporter({ silent: true });
  }
}
