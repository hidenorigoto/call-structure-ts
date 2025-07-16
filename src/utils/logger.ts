import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private level: LogLevel = LogLevel.INFO;
  private progressEnabled: boolean = true;
  private suppressInCI: boolean = false;

  constructor() {
    // Suppress error output in CI when running tests
    // This prevents expected error messages from cluttering CI output
    this.suppressInCI = Boolean(
      process.env.CI && // GitHub Actions, CircleCI, etc set CI=true
        (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID)
    );
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  setProgressEnabled(enabled: boolean): void {
    this.progressEnabled = enabled;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(chalk.gray('[DEBUG]'), message, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(chalk.blue('[INFO]'), message, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(chalk.yellow('[WARN]'), message, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.level <= LogLevel.ERROR) {
      if (this.suppressInCI) {
        // In CI, write plain error message to stderr for tests to capture
        // but without formatting to reduce noise
        process.stderr.write(message + '\n');
      } else {
        // Normal formatted output
        console.error(chalk.red('[ERROR]'), message, ...args);
      }
    }
  }

  success(message: string, ...args: unknown[]): void {
    console.log(chalk.green(''), message, ...args);
  }

  progress(message: string, ...args: unknown[]): void {
    if (this.progressEnabled && this.level <= LogLevel.INFO) {
      console.log(chalk.cyan('�'), message, ...args);
    }
  }
}

export const logger = new Logger();
