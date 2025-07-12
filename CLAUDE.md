# Project Instructions

## Development Workflow
- This project requires Issue/PR based development
- Work must be done in feature/working branches, not directly on main
- All changes must be made through Pull Requests
- Create issues for new features or bugs before implementing

## Branch Strategy
- Create a new branch for each issue/feature: `git checkout -b feature/issue-123-description`
- Keep main branch protected and stable
- Use descriptive branch names that reference the issue number

## Pre-commit Requirements
Before committing any changes, you MUST run and ensure all pass:
- `npm run lint` - ESLint code quality checks
- `npm run type-check` - TypeScript type checking
- `npm test` - Run all tests and ensure they pass

## Commit Process
1. Run quality checks: `npm run lint && npm run type-check && npm test`
2. Fix any issues found by the checks
3. Stage changes: `git add .`
4. Commit with descriptive message: `git commit -m "description"`
5. Push branch: `git push -u origin branch-name`
6. Create Pull Request for review