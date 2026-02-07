---
description: Visual regression testing via Playwright screenshots
allowed-tools: Bash, Read
---

# Visual Regression Test

## Usage

```bash
/apes-test-visual              # Compare against baselines
/apes-test-visual --update     # Update baselines
```

## Steps

1. Ensure app is running (npm run dev)
2. Capture screenshots of key pages
3. Compare against baselines in tests/visual-baselines/
4. Report pixel diff percentages
5. Flag any page with > 0.1% diff

First run creates baselines. Subsequent runs compare.

## Run

```bash
npx playwright test --project=visual-regression
```

## Update Baselines

When UI changes are intentional:

```bash
npx playwright test --update-snapshots
```

## Configuration

Add to playwright.config.ts:

```typescript
{
  name: "visual-regression",
  use: {
    viewport: { width: 1280, height: 720 },
  },
  snapshotDir: "tests/visual-baselines",
}
```
