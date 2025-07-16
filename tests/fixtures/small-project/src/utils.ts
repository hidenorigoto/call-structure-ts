export function greet(name: string): string {
  return formatGreeting(name);
}

function formatGreeting(name: string): string {
  return `Hello, ${name}!`;
}

export function calculate(a: number, b: number): number {
  return add(a, b);
}

function add(x: number, y: number): number {
  return x + y;
}

export function processArray<T>(items: T[], processor: (item: T) => void): void {
  items.forEach(item => processor(item));
}
