#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting performance profiling...\n');

// Test configurations
const configs = [
  {
    name: 'Basic Analysis',
    command: 'call-structure analyze --entry src/index.ts --output results/basic.json',
    env: {},
  },
  {
    name: 'Cached Analysis',
    command: 'call-structure analyze --entry src/index.ts --output results/cached.json --use-cache',
    env: {},
  },
  {
    name: 'Parallel Analysis',
    command: 'call-structure analyze --entry src/index.ts --output results/parallel.json --parallel',
    env: { WORKERS: '4' },
  },
  {
    name: 'Deep Analysis',
    command: 'call-structure analyze --entry src/index.ts --output results/deep.json --depth 20',
    env: {},
  },
  {
    name: 'Batch Analysis',
    command: 'call-structure batch --config performance-config.yaml --output results/batch.json',
    env: {},
  },
];

// Create results directory
const resultsDir = path.join(__dirname, '..', 'results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// Profile each configuration
const results = [];

for (const config of configs) {
  console.log(`Running: ${config.name}`);
  console.log(`Command: ${config.command}`);
  
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  
  try {
    // Run the command with environment variables
    const env = { ...process.env, ...config.env };
    execSync(config.command, {
      cwd: path.join(__dirname, '..'),
      env,
      stdio: 'inherit',
    });
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    
    const result = {
      name: config.name,
      success: true,
      duration: endTime - startTime,
      memoryDelta: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
      },
    };
    
    results.push(result);
    console.log(`✓ Completed in ${result.duration}ms\n`);
    
  } catch (error) {
    results.push({
      name: config.name,
      success: false,
      error: error.message,
    });
    console.error(`✗ Failed: ${error.message}\n`);
  }
}

// Generate report
console.log('\n=== Performance Profile Report ===\n');

for (const result of results) {
  console.log(`${result.name}:`);
  if (result.success) {
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Memory Used: ${(result.memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  } else {
    console.log(`  Failed: ${result.error}`);
  }
  console.log('');
}

// Save report
const reportPath = path.join(resultsDir, 'profile-report.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`Report saved to: ${reportPath}`);

// Performance recommendations
console.log('\n=== Recommendations ===\n');

const fastestResult = results
  .filter(r => r.success)
  .sort((a, b) => a.duration - b.duration)[0];

if (fastestResult) {
  console.log(`Fastest configuration: ${fastestResult.name} (${fastestResult.duration}ms)`);
}

const mostMemoryEfficient = results
  .filter(r => r.success)
  .sort((a, b) => a.memoryDelta.heapUsed - b.memoryDelta.heapUsed)[0];

if (mostMemoryEfficient) {
  console.log(`Most memory efficient: ${mostMemoryEfficient.name} (${(mostMemoryEfficient.memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB)`);
}

// Check if caching helps
const basicResult = results.find(r => r.name === 'Basic Analysis');
const cachedResult = results.find(r => r.name === 'Cached Analysis');

if (basicResult?.success && cachedResult?.success) {
  const speedup = ((basicResult.duration - cachedResult.duration) / basicResult.duration * 100).toFixed(1);
  console.log(`\nCaching speedup: ${speedup}%`);
}

// Check if parallel helps
const parallelResult = results.find(r => r.name === 'Parallel Analysis');

if (basicResult?.success && parallelResult?.success) {
  const speedup = ((basicResult.duration - parallelResult.duration) / basicResult.duration * 100).toFixed(1);
  console.log(`Parallel processing speedup: ${speedup}%`);
}