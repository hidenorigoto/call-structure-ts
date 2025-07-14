# Git Hooks Setup

This project uses Husky to enforce code quality standards through Git hooks. All hooks are automatically installed when you run `npm install`.

## Pre-commit Hook

Runs before each commit to ensure code quality:

1. **Lint-staged** - Runs ESLint and Prettier on staged files only
   - Automatically fixes linting issues when possible
   - Formats code according to project standards
2. **Type Check** - Runs TypeScript compiler checks on the entire project
   - Ensures no type errors exist
3. **Tests** - Runs the full test suite
   - All tests must pass before committing

## Commit-msg Hook

Enforces conventional commit message format using commitlint:

### Valid commit types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

### Commit message rules:

- Subject must be between 10 and 72 characters
- Body lines must not exceed 100 characters
- Format: `<type>(<optional scope>): <subject>`

### Examples:

```bash
# Good
git commit -m "feat: add support for multiple entry points"
git commit -m "fix: resolve import path resolution issue"
git commit -m "test: add unit tests for CallGraphAnalyzer"

# Bad - will be rejected
git commit -m "updated code"  # Too short, no type
git commit -m "feat: fix"     # Subject too short
```

## Pre-push Hook

Runs comprehensive checks before pushing to remote:

- Full lint check
- Type checking
- Complete test suite

## Bypassing Hooks (Not Recommended)

In emergency situations, you can bypass hooks:

```bash
# Bypass pre-commit and commit-msg hooks
git commit --no-verify -m "emergency: critical hotfix"

# Bypass pre-push hook
git push --no-verify
```

⚠️ **Warning**: Only bypass hooks in genuine emergencies. Always fix any issues before the next regular commit.

## Troubleshooting

### Hook not running

```bash
# Reinstall husky
rm -rf .husky
npm run prepare
```

### Permission denied error

```bash
# Make hooks executable
chmod +x .husky/*
```

### Commitlint not working

```bash
# Verify commitlint config
npx commitlint --from HEAD~1 --to HEAD --verbose
```

## Benefits

1. **Consistent Code Quality** - Enforces coding standards automatically
2. **Prevents Breaking Changes** - Tests must pass before code is committed
3. **Clean Git History** - Conventional commits make history readable
4. **Early Error Detection** - Catches issues before they reach CI/CD
5. **Team Collaboration** - Everyone follows the same standards
