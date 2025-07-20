export class Logger {
  constructor(private readonly context: string) {}

  info(message: string, meta?: any): void {
    console.log(`[${this.context}] INFO: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  error(message: string, error?: any): void {
    console.error(`[${this.context}] ERROR: ${message}`, error);
  }

  warn(message: string, meta?: any): void {
    console.warn(`[${this.context}] WARN: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  debug(message: string, meta?: any): void {
    console.debug(`[${this.context}] DEBUG: ${message}`, meta ? JSON.stringify(meta) : '');
  }

  profile(id: string): void {
    console.time(`[${this.context}] PROFILE: ${id}`);
    // End with console.timeEnd(`[${this.context}] PROFILE: ${id}`)
  }
}