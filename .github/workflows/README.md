# GitHub Actions Workflows

This repository uses GitHub Actions for continuous integration, deployment, and security scanning. Here's an overview of all workflows:

## 🔄 CI/CD Workflows

### 1. PR Quality Checks (`pr-checks.yml`)

Runs automatically on every pull request to the `main` branch:

**Jobs:**

- **Code Quality & Tests**: Runs on Node.js 22.x and 24.x
  - ESLint code quality checks
  - TypeScript type checking
  - Jest test suite with coverage
  - Coverage report generation and PR comments
- **Build Check**: Verifies successful build and artifact creation

**Status Checks:**

- `quality-checks (22.x)` - Quality checks on Node 22
- `quality-checks (24.x)` - Quality checks on Node 24 (LTS)
- `build-check` - Build verification

### 2. Main CI (`ci.yml`)

Runs on pushes to `main` branch:

**Jobs:**

- **Test & Build**: Full test suite, build, and CLI smoke tests
- **Security Scan**: npm audit and dependency security checks

**Features:**

- Matrix testing on Node.js 22.x and 24.x
- Coverage upload to Codecov
- CLI installation and smoke testing
- Build artifact upload

### 3. Release (`release.yml`)

Triggered by version tags (e.g., `v1.0.0`) or manual dispatch:

**Process:**

- Full test suite and quality checks
- Package building and testing
- Version updating and npm publishing
- GitHub release creation with artifacts
- Automatic release notes generation

**Usage:**

```bash
# Create a release
git tag v1.0.0
git push origin v1.0.0
```

### 4. Documentation Deployment (`docs.yml`)

Automatically deploys documentation to GitHub Pages:

**Triggers:**

- Changes to `docs/`, `src/`, `README.md`, or `CONTRIBUTING.md`
- Manual workflow dispatch

**Features:**

- Converts Markdown to HTML
- Creates documentation site structure
- Deploys to GitHub Pages
- Generates examples index

## 🔒 Security Workflows

### 5. CodeQL Security Scan (`codeql.yml`)

Comprehensive security analysis:

**Schedule:**

- Weekly scans on Mondays at 6 AM UTC
- On pushes to main and pull requests

**Features:**

- CodeQL static analysis
- Dependency review for PRs
- Security advisories check
- SARIF results upload

### 6. Dependabot (`dependabot.yml`)

Automated dependency management:

**Configuration:**

- Weekly updates on Mondays
- Groups related dependencies
- Automatic PR creation
- Security vulnerability alerts

**Dependency Groups:**

- TypeScript and types
- Testing frameworks
- Linting and formatting tools
- Build and development tools
- GitHub Actions

## 📊 Workflow Status

### Branch Protection Requirements

Configure these as required status checks:

- `quality-checks (22.x)`
- `quality-checks (24.x)`
- `build-check`
- `CodeQL`

### Secrets Required

The following secrets must be configured in repository settings:

- `NPM_TOKEN` - For npm publishing
- `CODECOV_TOKEN` - For code coverage reporting

### GitHub Pages

Enable GitHub Pages in repository settings:

- Source: GitHub Actions
- Documentation will be available at: `https://hidenorigoto.github.io/call-structure-ts/`

## 🛠️ Workflow Management

### Manual Triggers

All workflows support manual triggering via GitHub Actions UI:

- Go to Actions → Select workflow → Run workflow

### Debugging

- Check workflow logs in Actions tab
- Review artifact uploads for build results
- Monitor security scan results in Security tab

### Maintenance

- Workflows are automatically updated by Dependabot
- Security scans run weekly to catch new vulnerabilities
- Documentation deployment happens automatically on content changes
