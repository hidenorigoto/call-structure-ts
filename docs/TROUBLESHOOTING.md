# Troubleshooting Guide

This guide helps you resolve common issues when using Call Structure TS.

## 🚨 Common Issues

### Entry Point Not Found

**Error Messages:**

- `Entry point not found: src/main.ts#bootstrap`
- `Function 'bootstrap' not found in file 'src/main.ts'`
- `Cannot resolve entry point: src/main.ts#bootstrap`

**Possible Causes:**

1. **Incorrect file path**: Path is relative to project root
2. **Function not exported**: Function must be exported to be analyzable
3. **TypeScript compilation errors**: Prevents proper AST analysis
4. **Incorrect function name**: Case-sensitive function names

**Solutions:**

1. **Verify File Path**

   ```bash
   # Check if file exists
   ls -la src/main.ts

   # Verify from project root
   call-structure validate --entry "src/main.ts#bootstrap"
   ```

2. **Check Function Export**

   ```typescript
   // ✅ Good - exported function
   export function bootstrap() {
     // ...
   }

   // ❌ Bad - not exported
   function bootstrap() {
     // ...
   }
   ```

3. **Check TypeScript Compilation**

   ```bash
   # Compile TypeScript to check for errors
   npx tsc --noEmit

   # Or use specific tsconfig
   npx tsc --noEmit --project tsconfig.json
   ```

4. **Use Correct Function Name**
   ```bash
   # Case-sensitive
   call-structure analyze --entry "src/main.ts#bootstrap"  # ✅
   call-structure analyze --entry "src/main.ts#Bootstrap"  # ❌
   ```

### Performance Issues

**Symptoms:**

- Slow analysis (>30 seconds for medium projects)
- High memory usage (>2GB)
- Process hanging or crashing

**Solutions:**

1. **Enable Caching**

   ```bash
   call-structure analyze --entry "src/main.ts#main" --cache .cache
   ```

2. **Limit Analysis Depth**

   ```bash
   call-structure analyze --entry "src/main.ts#main" --max-depth 5
   ```

3. **Exclude Unnecessary Files**

   ```bash
   call-structure analyze --entry "src/main.ts#main" \
     --exclude "**/*.test.ts" \
     --exclude "**/*.spec.ts" \
     --exclude "**/node_modules/**"
   ```

4. **Use Parallel Processing**

   ```bash
   call-structure analyze --entry "src/main.ts#main" --parallel 4
   ```

5. **Increase Node.js Memory**
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" call-structure analyze --entry "src/main.ts#main"
   ```

### TypeScript Compilation Errors

**Error Messages:**

- `Cannot find module 'src/types'`
- `Module resolution failed`
- `Cannot resolve path mapping`

**Solutions:**

1. **Check tsconfig.json**

   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/*": ["src/*"],
         "@types/*": ["src/types/*"]
       }
     },
     "include": ["src/**/*"]
   }
   ```

2. **Specify tsconfig Path**

   ```bash
   call-structure analyze --entry "src/main.ts#main" --tsconfig ./tsconfig.json
   ```

3. **Install Missing Dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

4. **Check Path Mapping**
   ```bash
   # Verify path resolution
   npx tsc --showConfig
   ```

### Large Codebase Issues

**Symptoms:**

- Out of memory errors
- Analysis takes >10 minutes
- Process killed by OS

**Solutions:**

1. **Use Batch Processing**

   ```yaml
   # batch-config.yaml
   entry_points:
     - file: 'src/module1.ts'
       function: 'main'
     - file: 'src/module2.ts'
       function: 'init'
   ```

2. **Enable Incremental Analysis**

   ```bash
   call-structure analyze --entry "src/main.ts#main" --cache .cache --incremental
   ```

3. **Adjust Memory Limits**

   ```bash
   # For Node.js
   NODE_OPTIONS="--max-old-space-size=8192" call-structure analyze --entry "src/main.ts#main"

   # For system limits
   ulimit -v 8000000  # 8GB virtual memory
   ```

4. **Use Focused Analysis**
   ```bash
   # Analyze specific modules only
   call-structure analyze --entry "src/main.ts#main" \
     --include "src/core/**" \
     --include "src/services/**" \
     --exclude "src/legacy/**"
   ```

### Output Format Issues

**Error Messages:**

- `Unsupported output format: pdf`
- `Invalid JSON output`
- `Mermaid syntax error`

**Solutions:**

1. **Use Supported Formats**

   ```bash
   # Supported formats
   call-structure analyze --entry "src/main.ts#main" --format json
   call-structure analyze --entry "src/main.ts#main" --format yaml
   call-structure analyze --entry "src/main.ts#main" --format mermaid
   ```

2. **Validate Output**

   ```bash
   # Test JSON validity
   call-structure analyze --entry "src/main.ts#main" --format json | jq .

   # Test YAML validity
   call-structure analyze --entry "src/main.ts#main" --format yaml | yaml-validator
   ```

3. **Fix Mermaid Syntax**
   ```bash
   # Generate and validate Mermaid
   call-structure analyze --entry "src/main.ts#main" --format mermaid --output graph.mmd
   # Test at: https://mermaid.live
   ```

### Interactive Mode Issues

**Problems:**

- Interactive mode not starting
- Autocomplete not working
- Terminal display issues

**Solutions:**

1. **Check Terminal Compatibility**

   ```bash
   # Test terminal support
   echo $TERM

   # Use different terminal
   call-structure interactive --no-color
   ```

2. **Update Terminal Settings**

   ```bash
   # For bash/zsh
   export TERM=xterm-256color

   # For fish
   set -x TERM xterm-256color
   ```

3. **Disable Interactive Features**
   ```bash
   # Use non-interactive mode
   call-structure analyze --entry "src/main.ts#main" --no-progress
   ```

### Configuration Issues

**Error Messages:**

- `Configuration file not found`
- `Invalid configuration format`
- `Configuration parse error`

**Solutions:**

1. **Check Configuration File**

   ```bash
   # Verify file exists
   ls -la .call-structure.yaml

   # Validate YAML syntax
   yaml-validator .call-structure.yaml
   ```

2. **Use Correct Format**

   ```yaml
   # .call-structure.yaml
   projectRoot: '.'
   maxDepth: 10
   exclude:
     - '**/*.test.ts'
   ```

3. **Specify Configuration Path**
   ```bash
   call-structure analyze --entry "src/main.ts#main" --config ./config/call-structure.yaml
   ```

## 🔍 Debugging

### Enable Debug Mode

```bash
call-structure analyze --entry "src/main.ts#main" --debug
```

### Increase Logging Verbosity

```bash
call-structure analyze --entry "src/main.ts#main" --verbose
```

### Check System Information

```bash
# Node.js version
node --version

# npm version
npm --version

# Tool version
call-structure --version

# System info
uname -a
```

### Generate Debug Report

```bash
# Create debug report
call-structure analyze --entry "src/main.ts#main" --debug --verbose > debug.log 2>&1
```

## 🛠️ Advanced Troubleshooting

### Memory Analysis

```bash
# Monitor memory usage
NODE_OPTIONS="--inspect" call-structure analyze --entry "src/main.ts#main"
# Open chrome://inspect in Chrome
```

### Performance Profiling

```bash
# Profile performance
NODE_OPTIONS="--prof" call-structure analyze --entry "src/main.ts#main"
node --prof-process isolate-*.log > profile.txt
```

### AST Debugging

```typescript
// Create minimal test case
import { CallGraphAnalyzer } from 'call-structure-ts';

const analyzer = new CallGraphAnalyzer('./tsconfig.json');
const result = await analyzer.analyzeFromEntryPoint('src/simple.ts#test');
console.log(JSON.stringify(result, null, 2));
```

### Custom Logging

```typescript
// Enable custom logging
import { logger, LogLevel } from 'call-structure-ts';

logger.setLevel(LogLevel.DEBUG);
logger.debug('Custom debug message');
```

## 📋 Issue Reporting

When reporting issues, include:

### Environment Information

```bash
# Create environment report
cat > environment.txt << EOF
Node.js: $(node --version)
npm: $(npm --version)
OS: $(uname -a)
Tool: $(call-structure --version)
EOF
```

### Minimal Reproduction

```bash
# Create minimal test project
mkdir test-project
cd test-project
npm init -y
npm install typescript @types/node
npx tsc --init

# Create simple test file
cat > src/test.ts << 'EOF'
export function main() {
  console.log('Hello, world!');
}
EOF

# Test with tool
call-structure analyze --entry "src/test.ts#main"
```

### Command Output

```bash
# Capture full output
call-structure analyze --entry "src/main.ts#main" --debug --verbose > output.log 2>&1
```

## 🔗 Resources

- [GitHub Issues](https://github.com/hidenorigoto/call-structure-ts/issues)
- [GitHub Discussions](https://github.com/hidenorigoto/call-structure-ts/discussions)
- [Architecture Documentation](ARCHITECTURE.md)
- [Performance Guide](performance.md)
- [API Documentation](API.md)

## 🆘 Getting Help

1. **Search existing issues**: Check if your problem is already reported
2. **Check documentation**: Review all available documentation
3. **Create minimal reproduction**: Simplify your use case
4. **Report the issue**: Include all relevant information

Remember: The more information you provide, the faster we can help resolve your issue!
