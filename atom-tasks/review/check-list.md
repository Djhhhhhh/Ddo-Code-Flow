# Review check-list (placeholder)

> This is a starter set. Users are expected to replace these items with
> project-specific review concerns by editing this file directly.

## Code quality
- [ ] All new functions and classes have at least one usage in the codebase or tests.
- [ ] No commented-out blocks of dead code.
- [ ] No `TODO` markers left without an owner or follow-up task reference.

## Tests
- [ ] Every test-plan checklist item has at least one corresponding code path covered.
- [ ] Tests do not depend on machine-local state (e.g., absolute paths, network).

## Documentation
- [ ] Public API additions are reflected in README.md or the relevant docs file.
- [ ] The spec / plan / test-plan trio in the run directory is consistent with shipped code.

## Safety
- [ ] No secrets, tokens, or credentials introduced in source.
- [ ] No destructive shell commands (`rm -rf`, `sudo`, etc.) added to scripts.
