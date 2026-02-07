---
name: browser-verification
description: Automated browser testing with agent-browser and Playwright. Load for E2E, visual regression, and accessibility verification tasks.
---

# Browser Verification Skill

## Tools

### agent-browser (Quick Verification)
For Level 6 checks during development — fast, interactive, AI-native.

Core commands:
  agent-browser open <url>
  agent-browser snapshot -i --json    # Accessibility tree (AI-friendly)
  agent-browser click @e1             # Ref-based interaction
  agent-browser type @e3 "text"       # Form input
  agent-browser screenshot name.png   # Visual capture
  agent-browser --session <name>      # Isolated sessions per agent

Verification pattern:
  1. Open the app URL
  2. snapshot -i --json to get interactive elements
  3. Walk through user flow (click, type, assert)
  4. screenshot for evidence
  5. Compare snapshot against acceptance criteria

### Playwright MCP (Comprehensive Testing)
For Level 6-7 suites — cross-browser, visual regression, CI-ready.

Setup in settings.json mcpServers:
  "playwright": {
    "command": "npx",
    "args": ["@playwright/mcp@latest", "--headless"]
  }

Capabilities:
  - Cross-browser: Chromium, Firefox, WebKit
  - Visual regression: screenshot comparison against baselines
  - Accessibility: automated WCAG compliance via a11y snapshots
  - Network: intercept and mock API responses
  - Auth state: reuse login across tests

## E2E Test Generation Pattern

Given a user story:
  "As a user, I can register with email and password"

Generate Playwright test:
  1. Navigate to /register
  2. Fill email and password fields
  3. Submit form
  4. Assert redirect to /dashboard
  5. Assert welcome message visible

## Visual Regression Pattern

  1. Run app locally (npm run dev)
  2. Capture baseline screenshots of key pages
  3. After code changes, capture new screenshots
  4. Pixel-diff comparison
  5. Flag regressions above threshold (default: 0.1% pixel diff)

## Accessibility Audit Pattern

  1. Navigate to each route
  2. Run accessibility snapshot
  3. Check: all images have alt text, form inputs have labels,
     color contrast >= 4.5:1, keyboard navigation works
  4. Generate report with violations

## When to Use Which

  agent-browser: During development, quick "does it work?" checks
  Playwright tests: Before merge, comprehensive E2E suites
  Visual regression: After UI changes, catch unintended visual breaks
  Accessibility: Before every release, WCAG compliance gate
