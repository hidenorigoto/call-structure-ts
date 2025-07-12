import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
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
      console.error(chalk.red('[ERROR]'), message, ...args);
    }
  }

  success(message: string, ...args: unknown[]): void {
    console.log(chalk.green('✓'), message, ...args);
  }

  progress(message: string, ...args: unknown[]): void {
    console.log(chalk.cyan('⟳'), message, ...args);
  }
}

export const logger = new Logger();