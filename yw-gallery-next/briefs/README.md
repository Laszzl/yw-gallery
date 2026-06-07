# Briefs

Codex writes one implementation brief per feature slice before calling Claude Code.

## Naming

- Use `M<milestone>-<short-name>.md`.
- Example: `M1-app-shell.md`.

## Required Sections

- Objective and non-goals.
- Files in scope.
- Files out of scope.
- Required behavior.
- Data and storage impact.
- UI and responsive impact.
- Tests to add or update.
- Verification commands.
- Forbidden changes.

## Claude Code Command

Run from the project directory:

```sh
claude -p --permission-mode acceptEdits --output-format text "$(cat briefs/M1-app-shell.md)"
```

