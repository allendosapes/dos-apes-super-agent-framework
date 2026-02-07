---
description: Automated accessibility audit
allowed-tools: Bash, Read
---

# Accessibility Audit

## Usage

```bash
/apes-test-a11y              # Full accessibility audit
```

## Steps

Navigate to each route in the app. For each page:

1. Run Playwright accessibility snapshot
2. Check WCAG 2.1 AA compliance
3. Report violations grouped by severity

## Run

```bash
npx playwright test --project=accessibility
```

## Checks

- All images have `alt` text
- Form inputs have associated `<label>` elements
- Color contrast >= 4.5:1 for normal text, >= 3:1 for large text
- Keyboard navigation works for all interactive elements
- Focus indicators are visible
- Headings follow logical hierarchy (h1 > h2 > h3)
- ARIA attributes used correctly
- No empty links or buttons
- Page has a `<main>` landmark

## Severity Levels

- **Critical:** Blocks access entirely (missing alt text on functional images, no keyboard access)
- **Serious:** Major barrier (low contrast, missing form labels)
- **Moderate:** Degraded experience (heading hierarchy issues, redundant ARIA)
- **Minor:** Best practice (missing landmark roles)
