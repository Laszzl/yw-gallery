---
name: yw-data-safety
description: Use when editing YW Gallery Next data, storage, import/export, migration, deletion, or image persistence behavior. Protects local user data meaning.
---

# YW Data Safety

Use this skill for all data model, persistence, import/export, and destructive-operation changes.

## Data Invariants

- Preserve user-data meaning from old exported JSON through migration import.
- Do not rename or remove persisted fields without updating migration, validation, serialization, and docs.
- Persist only approved state fields through `serializeState()`.
- Normalize loaded data before rendering or saving.
- Reject invalid imports before replacing current data.

## Storage Policy

- Static-server usage should prefer IndexedDB when valid data exists.
- `file://` usage should prefer localStorage when valid data exists.
- localStorage remains the fallback and compatibility path.
- IndexedDB failure must not destroy valid localStorage data.

## Destructive Changes

- Import overwrite, delete, and clear flows require confirmation UI.
- Do not silently discard images, people, groups, categories, items, or order state.
- If a migration cannot preserve meaning, stop and report the conflict.

