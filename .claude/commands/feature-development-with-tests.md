---
name: feature-development-with-tests
description: Workflow command scaffold for feature-development-with-tests in wigolo.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /feature-development-with-tests

Use this workflow when working on **feature-development-with-tests** in `wigolo`.

## Goal

Implements a new feature or significant enhancement, along with corresponding unit and/or integration tests.

## Common Files

- `src/**/*.ts`
- `src/types.ts`
- `tests/unit/**/*.test.ts`
- `tests/integration/**/*.test.ts`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Implement feature logic in one or more src/ files.
- Update or create src/types.ts if new types or fields are introduced.
- Add or update relevant tests in tests/unit/ and/or tests/integration/.
- Optionally update documentation or related files.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.