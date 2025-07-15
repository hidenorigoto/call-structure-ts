// Test fixture for integration tests

export function main(): void {
  console.log('Starting application');

  const controller = new UserController();
  controller.handleRequest();

  processData();
  asyncHandler().catch(console.error);
}

export function processData(): void {
  const data = fetchData();
  const transformed = transformData(data);
  saveData(transformed);
}

export async function asyncHandler(): Promise<void> {
  await delay(100);
  const result = await fetchRemoteData();
  console.log('Async result:', result);
}

function fetchData(): any[] {
  return [1, 2, 3, 4, 5];
}

function transformData(data: any[]): any[] {
  return data.map(x => x * 2);
}

function saveData(data: any[]): void {
  console.log('Saving data:', data);
}

async function fetchRemoteData(): Promise<string> {
  await delay(50);
  return 'remote data';
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Controller pattern
export class UserController {
  handleRequest(): void {
    const user = this.getUser('123');
    this.processUser(user);
  }

  private getUser(id: string): User {
    return { id, name: 'Test User' };
  }

  private processUser(user: User): void {
    console.log('Processing user:', user);
  }
}

// Handler pattern
export function userHandler(req: any, res: any): void {
  const user = { id: '1', name: 'Handler User' };
  res.json(user);
}

export const orderHandler = (req: any, res: any): void => {
  const order = { id: '1', items: [] };
  res.json(order);
};

// Test functions
export function testSetup(): void {
  console.log('Test setup');
}

export function testTeardown(): void {
  console.log('Test teardown');
}

interface User {
  id: string;
  name: string;
}

// Circular reference example
export function funcA(): void {
  funcB();
}

function funcB(): void {
  funcC();
}

function funcC(): void {
  funcA(); // Creates a cycle
}
