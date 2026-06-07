---
name: yw-implementation-runner
description: Use when Claude Code implements a YW Gallery Next slice from a Codex brief. Enforces small scoped changes, explicit assumptions, no over-abstraction, and verifiable completion.
---

# YW Implementation Runner

Use this skill whenever Claude Code receives a Codex implementation brief for YW Gallery Next.

## Operating Rules

- Read `AGENTS.md` / `CLAUDE.md` first and treat them as binding project rules.
- State any assumption only when the brief leaves a material gap.
- Make the smallest complete change that satisfies the brief.
- Do not broaden scope, redesign unrelated UI, rename files, or refactor modules unless the brief explicitly asks.
- Avoid speculative abstractions. Add helpers only when they remove real duplication or match an existing project pattern.
- Keep all source browser-runnable with no build step.
- Verification is part of implementation. Run the commands named in the brief and report exact pass/fail evidence.

## Stop Conditions

Stop and report back instead of improvising when:

- The brief conflicts with `AGENTS.md` / `CLAUDE.md`.
- The requested data change would alter existing user-data meaning without a migration plan.
- A required file or fixture is missing and no safe local equivalent exists.
- Verification cannot run and there is no lower-risk substitute.

