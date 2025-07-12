# GitHub Actions Workflows

## PR Quality Checks (`pr-checks.yml`)

This workflow runs automatically on every pull request to the `main` branch and performs the following quality checks:

### Jobs

**1. Code Quality & Tests**
- Runs on Ubuntu with Node.js 18.x and 20.x (matrix)
- ESLint code quality checks (`npm run lint`)
- TypeScript type checking (`npm run type-check`)
- Jest test suite (`npm test`)
- Coverage report generation and upload (Node 20.x only)

**2. Build Check**
- Verifies the project builds successfully (`npm run build`)
- Checks that build artifacts are created correctly

### Status Checks

Each step shows as a separate status check in the PR:
- `quality-checks (18.x)` - Quality checks on Node 18
- `quality-checks (20.x)` - Quality checks on Node 20  
- `build-check` - Build verification

### Branch Protection Integration

These can be configured as required status checks in GitHub branch protection rules:
- Navigate to Settings → Branches → Add rule for `main`
- Add required status checks: `quality-checks` and `build-check`

### Current Status

⚠️ **Note**: The current codebase has ESLint errors that need to be resolved. The workflow will fail until these are fixed:
- Unused imports/variables
- Missing return types
- Usage of `any` type
- Use of `require()` instead of `import`

These should be addressed in future PRs to maintain code quality standards.