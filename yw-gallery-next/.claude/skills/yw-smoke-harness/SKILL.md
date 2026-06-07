---
name: yw-smoke-harness
description: Use when adding or changing YW Gallery Next behavior that needs validation. Keeps smoke tests framework-free and tied to normalize, serialize, import, storage, and ViewModel contracts.
---

# YW Smoke Harness

Use this skill whenever a YW Gallery Next change affects state, storage, import/export, rendering inputs, or core workflows.

## Test Rules

- Keep tests browser-runnable with no framework and no build step.
- Put smoke logic in `tests/smoke-runner.js`.
- Keep `tests/smoke.html` as the browser entry point.
- Prefer fixed fixtures for empty, basic, rich, legacy, image/no-image, and invalid import data.
- Add tests before or alongside behavior changes.

## Required Coverage Areas

- `normalizeState()` compatible defaults and cleanup.
- `serializeState()` whitelist.
- Import validation and rejection paths.
- Old JSON migration import.
- IndexedDB/localStorage loading precedence.
- ViewModel shape for rendered pages.

