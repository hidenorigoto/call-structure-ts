// Simple test file for analyzer tests
export function main(): void {
  helper();
  asyncHelper();
}

function helper(): string {
  return 'helper result';
}

async function asyncHelper(): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return 'async helper result';
}