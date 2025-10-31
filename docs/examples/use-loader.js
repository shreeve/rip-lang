// Example of importing .rip files directly with Bun loader
// Run with: bun --preload ./bunloader.ts examples/use-loader.js

import * as math from './math.rip';

console.log('Testing Rip loader:');
console.log('add(5, 3) =', math.add(5, 3));
console.log('multiply(4, 7) =', math.multiply(4, 7));
console.log('factorial(5) =', math.factorial(5));
