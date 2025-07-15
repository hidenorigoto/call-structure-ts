declare module 'fastq' {
  export interface Queue<T = any> {
    push(item: T): void;
    unshift(item: T): void;
    pause(): void;
    resume(): void;
    idle(): boolean;
    length(): number;
    kill(): void;
    error(handler: (err: Error, task: T) => void): void;
    drain(): Promise<void>;
  }

  export interface QueueAsPromised<T = any> extends Queue<T> {
    push(item: T): Promise<void>;
    unshift(item: T): Promise<void>;
  }

  export interface Options {
    concurrency?: number;
    autostart?: boolean;
    Promise?: PromiseConstructor;
  }

  export function promise<T>(
    worker: (task: T) => Promise<void>,
    concurrency?: number
  ): QueueAsPromised<T>;

  export default function fastq<T>(
    worker: (task: T, cb: (err?: Error) => void) => void,
    concurrency?: number
  ): Queue<T>;
}
