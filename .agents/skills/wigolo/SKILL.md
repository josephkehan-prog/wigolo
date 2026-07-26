```markdown
# wigolo Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill provides a comprehensive guide to contributing to the `wigolo` codebase, a TypeScript/React project. It covers established coding conventions, commit patterns, and the most common development workflows, including feature development, bugfixing, refactoring, CI/CD management, dependency handling, release processes, SSRF guard hardening, and branch management. The guide is designed to help new and existing contributors maintain consistency and quality across the project.

## Coding Conventions

### File Naming
- Use **camelCase** for file and folder names.
  - Example: `userProfile.ts`, `fetchHelpers.ts`

### Import Style
- Use **relative imports** for internal modules.
  ```typescript
  import { fetchData } from './fetchHelpers';
  import { UserType } from '../types';
  ```

### Export Style
- Use **named exports** rather than default exports.
  ```typescript
  // Good
  export function fetchData() { ... }
  export type UserType = { ... };

  // Avoid
  // export default function fetchData() { ... }
  ```

### Commit Patterns
- Prefix commit messages with one of: `fix`, `docs`, `feat`, `test`, `ci`
- Keep commit messages concise (~68 characters on average)
  - Example: `feat: add user profile component and update types`

## Workflows

### Feature Development with Tests
**Trigger:** When developing a new feature or significant enhancement  
**Command:** `/new-feature`

1. Implement feature logic in one or more `src/` files.
2. Update or create `src/types.ts` if new types or fields are introduced.
3. Add or update relevant tests in `tests/unit/` and/or `tests/integration/`.
4. Optionally update documentation or related files.

**Example:**
```typescript
// src/userProfile.ts
export function getUserProfile(id: string) { ... }

// src/types.ts
export type UserProfile = { id: string; name: string; };

// tests/unit/userProfile.test.ts
import { getUserProfile } from '../../src/userProfile';
```

---

### Bugfix with Regression Test
**Trigger:** When fixing a bug  
**Command:** `/bugfix`

1. Update the relevant `src/` file(s) to fix the bug.
2. Add or update a test in `tests/unit/` or `tests/integration/` to cover the bug scenario.
3. Commit both code and test changes together.

**Example:**
```typescript
// src/fetchHelpers.ts
export function fetchData(url: string) {
  if (!url) throw new Error('URL required');
  // ...
}

// tests/unit/fetchHelpers.test.ts
import { fetchData } from '../../src/fetchHelpers';
test('throws on empty url', () => {
  expect(() => fetchData('')).toThrow();
});
```

---

### Refactor with Test Updates
**Trigger:** When restructuring code for maintainability or performance  
**Command:** `/refactor`

1. Refactor logic in `src/` files.
2. Update or refactor related tests in `tests/unit/` and/or `tests/integration/`.
3. Ensure all tests pass after the refactor.

---

### CI Pipeline Update
**Trigger:** When changing CI coverage, adding platforms, or fixing CI failures  
**Command:** `/update-ci`

1. Edit `.github/workflows/ci.yml` to add, remove, or modify jobs.
2. Optionally update related documentation or test assertions.
3. Commit and push to trigger CI runs.

---

### Dependency Update or Revert
**Trigger:** When a dependency needs to be updated or reverted for compatibility  
**Command:** `/update-dep`

1. Edit `package.json` and `package-lock.json` to bump or revert a dependency version.
2. Test the build on supported Node versions.
3. Commit both files together.

---

### Release Version Bump
**Trigger:** When preparing a new release  
**Command:** `/release`

1. Update version numbers in `package.json`, `package-lock.json`, and all relevant `pyproject.toml` files.
2. Commit all version bumps together.

---

### SSRF Guard Hardening with Tests
**Trigger:** When strengthening SSRF protections or fixing SSRF-related issues  
**Command:** `/harden-ssrf`

1. Update SSRF guard logic in `src/fetch/`, `src/watch/`, or related files.
2. Add or update tests in `tests/unit/fetch/`, `tests/watch/` to cover new SSRF scenarios.
3. Commit both logic and test changes together.

---

### Merge Main into Feature Branch
**Trigger:** When a feature branch needs to be rebased or updated with the latest main changes  
**Command:** `/merge-main`

1. Merge `main` into the feature branch.
2. Resolve any merge conflicts.
3. Commit the merged and resolved files.

---

## Testing Patterns

- **Framework:** [vitest](https://vitest.dev/)
- **Test file pattern:** `*.test.ts`
- **Test locations:** `tests/unit/`, `tests/integration/`, `tests/unit/fetch/`, `tests/watch/`
- **Example test:**
  ```typescript
  // tests/unit/example.test.ts
  import { someFunction } from '../../src/someModule';

  test('returns correct value', () => {
    expect(someFunction(2)).toBe(4);
  });
  ```

## Commands

| Command        | Purpose                                                      |
|----------------|--------------------------------------------------------------|
| /new-feature   | Start a new feature with corresponding tests                 |
| /bugfix        | Fix a bug and add/update a regression test                   |
| /refactor      | Refactor code and update related tests                       |
| /update-ci     | Update the CI pipeline configuration                         |
| /update-dep    | Update or revert a dependency in package.json                |
| /release       | Bump versions for a new release                              |
| /harden-ssrf   | Harden SSRF protections and add/update targeted tests        |
| /merge-main    | Merge main branch into a feature branch and resolve conflicts|
```
