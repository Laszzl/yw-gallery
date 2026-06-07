---
name: yw-no-build-frontend
description: Use when editing YW Gallery Next frontend code. Preserves the no-build HTML/CSS/JS architecture, script order, IIFE modules, and window.YW namespace.
---

# YW No-Build Frontend

Use this skill for all YW Gallery Next HTML, CSS, and JavaScript implementation.

## Architecture Guardrails

- Do not add frameworks, bundlers, package managers, transpilers, or required npm dependencies.
- Keep `index.html` as static structure and ordered script loading.
- Keep `styles.css` as the only CSS entry point, using ordered `@import` statements.
- Keep `app.js` as a thin initializer.
- Use `window.YW` plus IIFE modules: `(function (YW) { ... })(window.YW);`.
- Add new module files only when the behavior has a clear independent responsibility.
- Load new scripts before dependents and keep `app.js` last.

## Code Shape

- Put state repair and serialization in `js/state.js`.
- Put import validation in `js/validators.js`.
- Put storage policy in `js/storage.js`.
- Put derived display structures in `js/view-models.js`.
- Put stable DOM lookup in `js/dom.js`.
- Put rendering in `js/render.js`.
- Put long-lived event binding in `js/events.js`.

