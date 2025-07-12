export async function complexAsyncFlow(): Promise<number> {
  const data = await fetchData();
  const processed = await processInParallel(data);
  return aggregateResults(processed);
}

async function fetchData(): Promise<any[]> {
  return Promise.resolve([1, 2, 3]);
}

async function processInParallel(items: any[]): Promise<any[]> {
  return Promise.all(items.map(item => processItem(item)));
}

async function processItem(item: any): Promise<any> {
  return item * 2;
}

function aggregateResults(results: any[]): number {
  return results.reduce((a, b) => a + b, 0);
}

export async function sequentialProcessing(): Promise<number[]> {
  const results: number[] = [];
  const data = await fetchData();
  
  for (const item of data) {
    const processed = await processItem(item);
    results.push(processed);
  }
  
  return results;
}

export async function mixedAsyncPatterns(): Promise<void> {
  // Promise.all for parallel execution
  const [data1, data2] = await Promise.all([
    fetchData(),
    fetchAlternateData()
  ]);
  
  // Sequential processing with await
  const processed1 = await processInParallel(data1);
  const processed2 = await processInParallel(data2);
  
  // Promise.race for timeout/racing
  const result = await Promise.race([
    aggregateResults(processed1),
    timeoutAfter(5000)
  ]);
  
  console.log('Mixed async result:', result);
}

async function fetchAlternateData(): Promise<number[]> {
  return new Promise(resolve => {
    setTimeout(() => resolve([4, 5, 6]), 100);
  });
}

async function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout')), ms);
  });
}

export class AsyncProcessor {
  private queue: (() => Promise<any>)[] = [];
  
  async addToQueue(processor: () => Promise<any>): Promise<void> {
    this.queue.push(processor);
    await this.processNext();
  }
  
  private async processNext(): Promise<void> {
    if (this.queue.length > 0) {
      const nextProcessor = this.queue.shift()!;
      await nextProcessor();
      await this.processNext(); // Recursive async call
    }
  }
}