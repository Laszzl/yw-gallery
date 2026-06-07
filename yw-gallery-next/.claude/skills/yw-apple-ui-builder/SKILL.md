---
name: yw-apple-ui-builder
description: Use when building or reviewing YW Gallery Next UI. Enforces Chinese Apple-style product UI across Mac, iPad, iPhone, dark mode, reduced motion, and reduced transparency.
---

# YW Apple UI Builder

Use this skill for YW Gallery Next UI, layout, and interaction work.

## Product UI Direction

- Build the usable app surface first; do not create a marketing landing page.
- Use Chinese UI copy that helps orientation and action.
- Keep the interface quiet, direct, and app-like.
- Use system fonts, clear hierarchy, restrained color, and purposeful spacing.
- Avoid generic card mosaics, decorative gradients, and visual filler.

## Device Rules

- Mac can use hover, focus, keyboard, and desktop-only enhancements.
- iPad and iPhone core workflows must work with touch.
- Mobile must not depend on hover, right click, or HTML5 drag-and-drop.
- iPhone layouts must respect safe-area and avoid horizontal overflow.
- Buttons, fields, and modal controls must remain readable and tappable.

## System Preferences

- Add motion only when it clarifies hierarchy or state, and respect `prefers-reduced-motion`.
- Add blur/transparency only when readability remains strong, and respect `prefers-reduced-transparency`.
- Dark mode must preserve contrast through tokens or explicit overrides.

