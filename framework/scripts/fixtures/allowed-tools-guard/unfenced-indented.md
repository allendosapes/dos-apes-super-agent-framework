---
name: fixture-unfenced-indented
description: Extractor fixture — unfenced indentation-style command lines
  (the browser-verification.md class found in Task 5).
allowed-tools: Read, Grep, Glob
---

# Fixture: unfenced indented code

Core commands:
  agent-browser open http://localhost:3000
  agent-browser snapshot -i --json    # trailing comment must be stripped
  npx playwright test --project=chromium

Numbered prose steps (excluded — first token is not an executable):
  1. Start dev server (npm run dev)
  2. Open root URL

Prose shapes that must be excluded:
- the script never calls log-verification.js on its own (bullet)
| col | node scripts/x.js | (table row)
