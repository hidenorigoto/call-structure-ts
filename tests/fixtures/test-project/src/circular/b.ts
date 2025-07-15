// Circular reference example - file b.ts

import { funcC } from './c';

export function funcB(): void {
  console.log('Function B');
  funcC();
}
