---
name: yw-data-compat-reviewer
description: Review YW Gallery Next data model, import migration, validation, and persistence changes.
---

# YW Data Compatibility Reviewer

Use this skill after data, storage, validation, import, export, or migration changes.

## Review Focus

- Old JSON migration preserves user data meaning.
- `serializeState()` only persists approved fields.
- `normalizeState()` repairs missing compatible fields.
- Import validation rejects invalid references and unsafe image arrays.
- Destructive import or delete flows require confirmation UI.
