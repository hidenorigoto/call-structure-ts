#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Validating call-structure-ts examples...\n');

const examplesDir = __dirname;
const results = [];

// List of examples to validate
const examples = [
  'simple-project',
  'async-patterns', 
  'circular-deps',
  'ddd-example',
  'express-api',
  'react-app',
  'nestjs-app',
  'performance-optimization'
];

// Helper function to run commands safely
function runCommand(command, cwd) {
  try {
    const output = execSync(command, { 
      cwd, 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return { success: true, output };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      output: error.stdout || error.stderr || ''
    };
  }
}

// Helper function to check if call-structure command exists
function checkCallStructureCommand() {
  const result = runCommand('call-structure --version', '.');
  if (!result.success) {
    console.log('⚠️  Warning: call-structure-ts not found. Install it with:');
    console.log('   npm install -g call-structure-ts\n');
    return false;
  }
  console.log(`✅ call-structure-ts found: ${result.output.trim()}\n`);
  return true;
}

// Validation functions
async function validateExample(exampleName) {
  const examplePath = path.join(examplesDir, exampleName);
  
  console.log(`📁 Validating ${exampleName}...`);
  
  const result = {
    name: exampleName,
    path: examplePath,
    exists: false,
    hasPackageJson: false,
    hasTsConfig: false,
    hasReadme: false,
    tsCompilation: null,
    structure: null,
    analysisTest: null
  };
  
  // Check if directory exists
  if (!fs.existsSync(examplePath)) {
    console.log(`  ❌ Directory does not exist`);
    return result;
  }
  result.exists = true;
  
  // Check for essential files
  const packageJsonPath = path.join(examplePath, 'package.json');
  result.hasPackageJson = fs.existsSync(packageJsonPath);
  
  const tsConfigPath = path.join(examplePath, 'tsconfig.json');
  result.hasTsConfig = fs.existsSync(tsConfigPath);
  
  const readmePath = path.join(examplePath, 'README.md');
  result.hasReadme = fs.existsSync(readmePath);
  
  console.log(`  📦 package.json: ${result.hasPackageJson ? '✅' : '❌'}`);
  console.log(`  🔧 tsconfig.json: ${result.hasTsConfig ? '✅' : '❌'}`);
  console.log(`  📖 README.md: ${result.hasReadme ? '✅' : '❌'}`);
  
  // Check TypeScript compilation (if tsconfig exists)
  if (result.hasTsConfig) {
    console.log(`  🔍 Checking TypeScript compilation...`);
    const tsResult = runCommand('npx tsc --noEmit', examplePath);
    result.tsCompilation = {
      success: tsResult.success,
      output: tsResult.output || tsResult.error
    };
    console.log(`  📝 TypeScript: ${tsResult.success ? '✅ Compiles' : '❌ Errors'}`);
    if (!tsResult.success && tsResult.output) {
      // Show first few error lines
      const errorLines = tsResult.output.split('\n').slice(0, 3);
      console.log(`     ${errorLines.join('\n     ')}`);
    }
  }
  
  // Check project structure
  const srcPath = path.join(examplePath, 'src');
  if (fs.existsSync(srcPath)) {
    const srcFiles = fs.readdirSync(srcPath, { recursive: true })
      .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'));
    result.structure = {
      srcExists: true,
      fileCount: srcFiles.length,
      files: srcFiles.slice(0, 10) // First 10 files
    };
    console.log(`  📁 Source files: ${srcFiles.length} files`);
  } else {
    result.structure = { srcExists: false };
    console.log(`  📁 Source directory: ❌ Not found`);
  }
  
  console.log('');
  return result;
}

// Test call-structure analysis (basic)
async function testCallStructureAnalysis(hasCallStructure) {
  if (!hasCallStructure) {
    console.log('⏭️  Skipping call-structure analysis tests (command not found)\n');
    return;
  }
  
  console.log('🔬 Testing call-structure analysis...\n');
  
  // Test simple project analysis
  const simpleProjectPath = path.join(examplesDir, 'simple-project');
  if (fs.existsSync(simpleProjectPath)) {
    console.log('Testing simple-project analysis...');
    
    // Look for entry points
    const mainTs = path.join(simpleProjectPath, 'src/main.ts');
    const indexTs = path.join(simpleProjectPath, 'src/index.ts');
    
    let entryPoint = null;
    if (fs.existsSync(mainTs)) {
      entryPoint = 'src/main.ts#main';
    } else if (fs.existsSync(indexTs)) {
      entryPoint = 'src/index.ts#main';
    }
    
    if (entryPoint) {
      const analysisResult = runCommand(
        `call-structure analyze --entry "${entryPoint}" --max-depth 5`,
        simpleProjectPath
      );
      
      if (analysisResult.success) {
        console.log('  ✅ Basic analysis works');
        try {
          const output = JSON.parse(analysisResult.output);
          console.log(`  📊 Found ${output.nodes?.length || 0} nodes, ${output.edges?.length || 0} edges`);
        } catch (e) {
          console.log('  📊 Analysis completed (non-JSON output)');
        }
      } else {
        console.log('  ❌ Analysis failed');
        console.log(`     ${analysisResult.error?.split('\n')[0]}`);
      }
    } else {
      console.log('  ⚠️  No suitable entry point found');
    }
  }
  
  console.log('');
}

// Test architecture specifications
async function testArchitectureSpecs(hasCallStructure) {
  if (!hasCallStructure) {
    console.log('⏭️  Skipping architecture specification tests\n');
    return;
  }
  
  console.log('🏗️  Testing architecture specifications...\n');
  
  const specsToTest = [
    { example: 'ddd-example', spec: 'architecture-rules.yaml' },
    { example: 'express-api', spec: 'test-spec.yaml' },
    { example: 'react-app', spec: 'component-patterns.yaml' },
    { example: 'nestjs-app', spec: 'nest-architecture.yaml' }
  ];
  
  for (const { example, spec } of specsToTest) {
    const examplePath = path.join(examplesDir, example);
    const specPath = path.join(examplePath, spec);
    
    if (fs.existsSync(specPath)) {
      console.log(`Testing ${example}/${spec}...`);
      
      const testResult = runCommand(
        `call-structure test --spec ${spec}`,
        examplePath
      );
      
      if (testResult.success) {
        console.log(`  ✅ Specification test passed`);
      } else {
        console.log(`  ❌ Specification test failed`);
        // Show first error line
        if (testResult.output || testResult.error) {
          const firstLine = (testResult.output || testResult.error).split('\n')[0];
          console.log(`     ${firstLine}`);
        }
      }
    } else {
      console.log(`⚠️  ${example}/${spec} not found`);
    }
  }
  
  console.log('');
}

// Generate summary report
function generateReport(results) {
  console.log('📋 Validation Summary\n');
  console.log('═'.repeat(60));
  
  const summary = {
    total: results.length,
    existing: 0,
    withPackageJson: 0,
    withTsConfig: 0,
    withReadme: 0,
    compiling: 0,
    withSrc: 0
  };
  
  for (const result of results) {
    if (result.exists) summary.existing++;
    if (result.hasPackageJson) summary.withPackageJson++;
    if (result.hasTsConfig) summary.withTsConfig++;
    if (result.hasReadme) summary.withReadme++;
    if (result.tsCompilation?.success) summary.compiling++;
    if (result.structure?.srcExists) summary.withSrc++;
  }
  
  console.log(`📁 Examples found: ${summary.existing}/${summary.total}`);
  console.log(`📦 With package.json: ${summary.withPackageJson}/${summary.existing}`);
  console.log(`🔧 With tsconfig.json: ${summary.withTsConfig}/${summary.existing}`);
  console.log(`📖 With README.md: ${summary.withReadme}/${summary.existing}`);
  console.log(`📝 TypeScript compiling: ${summary.compiling}/${summary.withTsConfig}`);
  console.log(`📁 With src directory: ${summary.withSrc}/${summary.existing}`);
  
  console.log('\n' + '═'.repeat(60));
  
  // Detailed results
  console.log('\n📊 Detailed Results:\n');
  
  for (const result of results) {
    if (!result.exists) continue;
    
    const status = result.tsCompilation?.success ? '✅' : 
                  result.tsCompilation === null ? '⚠️' : '❌';
    
    console.log(`${status} ${result.name}`);
    
    if (result.structure?.srcExists) {
      console.log(`   📁 ${result.structure.fileCount} source files`);
    }
    
    if (result.tsCompilation && !result.tsCompilation.success) {
      console.log(`   ❌ TypeScript errors detected`);
    }
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('\n✨ Validation completed!\n');
  
  // Recommendations
  console.log('🎯 Recommendations:\n');
  
  const failingCompilation = results.filter(r => 
    r.tsCompilation && !r.tsCompilation.success
  );
  
  if (failingCompilation.length > 0) {
    console.log(`📝 Fix TypeScript compilation in: ${failingCompilation.map(r => r.name).join(', ')}`);
  }
  
  const missingReadme = results.filter(r => 
    r.exists && !r.hasReadme
  );
  
  if (missingReadme.length > 0) {
    console.log(`📖 Add README.md to: ${missingReadme.map(r => r.name).join(', ')}`);
  }
  
  if (summary.compiling === summary.withTsConfig) {
    console.log('🎉 All TypeScript projects compile successfully!');
  }
}

// Main validation function
async function main() {
  console.log('Starting example validation...\n');
  
  // Check if call-structure command is available
  const hasCallStructure = checkCallStructureCommand();
  
  // Validate each example
  const results = [];
  for (const example of examples) {
    const result = await validateExample(example);
    results.push(result);
  }
  
  // Test call-structure functionality
  await testCallStructureAnalysis(hasCallStructure);
  await testArchitectureSpecs(hasCallStructure);
  
  // Generate report
  generateReport(results);
  
  // Save detailed results
  const reportPath = path.join(__dirname, 'validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    hasCallStructure,
    summary: results
  }, null, 2));
  
  console.log(`📄 Detailed report saved to: ${reportPath}`);
}

// Run the validation
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { validateExample, testCallStructureAnalysis, testArchitectureSpecs };