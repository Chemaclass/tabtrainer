---
name: app-pure
description: Keep src/app free of the page, and tested.
globs: src/app/**
---

`src/app/` runs in Node under Vitest. Never use `document` or `window`, and never import from `src/ui/`, `src/render/`, `src/build/` or `src/main.ts`. ESLint fails the build if you do. DOM code belongs in `src/ui/`.

Each change needs a test in `tests/app/`.
