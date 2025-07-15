// Circular reference example - file a.ts

import { funcB } from './b';

export function funcA(): void {
  console.log('Function A');
  funcB();
}
