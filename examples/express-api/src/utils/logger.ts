// Simple logger for demo purposes
// In a real application, this would use Winston, Pino, or similar

enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private level: LogLevel;

  constructor(level: string = 'info') {
    this.level = this.parseLevel(level);
  }

  private parseLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private log(level: LogLevel, message: any, meta?: any): void {
    if (level <= this.level) {
      const timestamp = new Date().toISOString();
      const levelName = LogLevel[level];
      const output = {
        timestamp,
        level: levelName,
        message,
        ...(meta && { meta })
      };
      
      console.log(JSON.stringify(output));
    }
  }

  error(message: any, meta?: any): void {
    this.log(LogLevel.ERROR, message, meta);
  }

  warn(message: any, meta?: any): void {
    this.log(LogLevel.WARN, message, meta);
  }

  info(message: any, meta?: any): void {
    this.log(LogLevel.INFO, message, meta);
  }

  debug(message: any, meta?: any): void {
    this.log(LogLevel.DEBUG, message, meta);
  }
}

export const logger = new Logger(process.env.LOG_LEVEL || 'info');