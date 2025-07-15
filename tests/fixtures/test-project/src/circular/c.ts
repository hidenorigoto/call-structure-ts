// Circular reference example - file c.ts

import { funcA } from './a';

export function funcC(): void {
  console.log('Function C');
  funcA(); // Creates circular dependency
}
