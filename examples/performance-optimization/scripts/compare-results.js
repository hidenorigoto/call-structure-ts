#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load result files
const resultsDir = path.join(__dirname, '..', 'results');

if (!fs.existsSync(resultsDir)) {
  console.error('No results directory found. Run profile-analysis.js first.');
  process.exit(1);
}

console.log('=== Call Structure Analysis Comparison ===\n');

// Find all JSON result files
const resultFiles = fs.readdirSync(resultsDir)
  .filter(file => file.endsWith('.json') && file !== 'profile-report.json');

if (resultFiles.length === 0) {
  console.error('No result files found.');
  process.exit(1);
}

// Load and compare results
const results = {};

for (const file of resultFiles) {
  const filePath = path.join(resultsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  try {
    const data = JSON.parse(content);
    const name = file.replace('.json', '');
    results[name] = data;
    
    console.log(`Loaded: ${name}`);
    console.log(`  - Total calls: ${countCalls(data)}`);
    console.log(`  - Max depth: ${getMaxDepth(data)}`);
    console.log(`  - Unique functions: ${countUniqueFunctions(data)}`);
    console.log('');
  } catch (error) {
    console.error(`Failed to parse ${file}: ${error.message}`);
  }
}

// Detailed comparison
console.log('\n=== Detailed Comparison ===\n');

// Compare call counts
console.log('Call Counts:');
for (const [name, data] of Object.entries(results)) {
  const calls = countCalls(data);
  console.log(`  ${name}: ${calls} calls`);
}

console.log('\nMax Call Depth:');
for (const [name, data] of Object.entries(results)) {
  const depth = getMaxDepth(data);
  console.log(`  ${name}: ${depth} levels`);
}

console.log('\nFile Coverage:');
for (const [name, data] of Object.entries(results)) {
  const files = getFileCoverage(data);
  console.log(`  ${name}: ${files.size} files`);
}

// Find differences
console.log('\n=== Differences Analysis ===\n');

const allResults = Object.values(results);
if (allResults.length > 1) {
  // Compare basic vs cached
  const basic = results['basic'];
  const cached = results['cached'];
  
  if (basic && cached) {
    const basicCalls = countCalls(basic);
    const cachedCalls = countCalls(cached);
    
    if (basicCalls !== cachedCalls) {
      console.log(`Warning: Different call counts between basic (${basicCalls}) and cached (${cachedCalls})`);
    } else {
      console.log('✓ Basic and cached analyses produced identical results');
    }
  }
  
  // Check for missing calls
  const allFunctions = new Set();
  for (const data of allResults) {
    const functions = getAllFunctions(data);
    functions.forEach(f => allFunctions.add(f));
  }
  
  console.log(`\nTotal unique functions across all analyses: ${allFunctions.size}`);
  
  // Check which analysis found the most functions
  let maxFunctions = 0;
  let mostComplete = '';
  
  for (const [name, data] of Object.entries(results)) {
    const count = countUniqueFunctions(data);
    if (count > maxFunctions) {
      maxFunctions = count;
      mostComplete = name;
    }
  }
  
  console.log(`Most complete analysis: ${mostComplete} (${maxFunctions} functions)`);
}

// Helper functions
function countCalls(data) {
  let count = 0;
  
  function traverse(node) {
    if (!node) return;
    
    count++;
    
    if (node.calls) {
      for (const call of node.calls) {
        traverse(call);
      }
    }
    
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  
  if (Array.isArray(data)) {
    data.forEach(traverse);
  } else {
    traverse(data);
  }
  
  return count;
}

function getMaxDepth(data, currentDepth = 0) {
  let maxDepth = currentDepth;
  
  function traverse(node, depth) {
    if (!node) return;
    
    maxDepth = Math.max(maxDepth, depth);
    
    if (node.calls) {
      for (const call of node.calls) {
        traverse(call, depth + 1);
      }
    }
    
    if (node.children) {
      for (const child of node.children) {
        traverse(child, depth + 1);
      }
    }
  }
  
  if (Array.isArray(data)) {
    data.forEach(node => traverse(node, 0));
  } else {
    traverse(data, 0);
  }
  
  return maxDepth;
}

function countUniqueFunctions(data) {
  const functions = getAllFunctions(data);
  return functions.size;
}

function getAllFunctions(data) {
  const functions = new Set();
  
  function traverse(node) {
    if (!node) return;
    
    if (node.name) {
      functions.add(node.name);
    }
    
    if (node.function) {
      functions.add(node.function);
    }
    
    if (node.calls) {
      for (const call of node.calls) {
        traverse(call);
      }
    }
    
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  
  if (Array.isArray(data)) {
    data.forEach(traverse);
  } else {
    traverse(data);
  }
  
  return functions;
}

function getFileCoverage(data) {
  const files = new Set();
  
  function traverse(node) {
    if (!node) return;
    
    if (node.file) {
      files.add(node.file);
    }
    
    if (node.location?.file) {
      files.add(node.location.file);
    }
    
    if (node.calls) {
      for (const call of node.calls) {
        traverse(call);
      }
    }
    
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  
  if (Array.isArray(data)) {
    data.forEach(traverse);
  } else {
    traverse(data);
  }
  
  return files;
}

// Generate comparison report
const comparisonReport = {
  timestamp: new Date().toISOString(),
  results: Object.entries(results).map(([name, data]) => ({
    name,
    metrics: {
      totalCalls: countCalls(data),
      maxDepth: getMaxDepth(data),
      uniqueFunctions: countUniqueFunctions(data),
      fileCoverage: getFileCoverage(data).size,
    },
  })),
};

const reportPath = path.join(resultsDir, 'comparison-report.json');
fs.writeFileSync(reportPath, JSON.stringify(comparisonReport, null, 2));
console.log(`\nComparison report saved to: ${reportPath}`);