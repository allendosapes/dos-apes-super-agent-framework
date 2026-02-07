---
name: design-integration
description: Figma-to-code validation loop. Load when implementing UI from designs.
---

# Design Integration Skill

## Figma MCP Setup

Add to settings.json mcpServers:

```json
"figma": {
  "command": "npx",
  "args": ["figma-mcp-server"],
  "env": { "FIGMA_TOKEN": "${FIGMA_TOKEN}" }
}
```

## Workflow

1. Read design specs from Figma (spacing, colors, typography, breakpoints)
2. Implement components matching spec exactly
3. Capture screenshots via Playwright at each breakpoint
4. Compare screenshots against Figma exports
5. Flag pixel-level deviations

## Design Token Extraction

Extract from Figma and generate:

### Colors (CSS Custom Properties)

```css
:root {
  --color-primary: #3B82F6;
  --color-primary-hover: #2563EB;
  --color-secondary: #10B981;
  --color-background: #FFFFFF;
  --color-surface: #F9FAFB;
  --color-text: #111827;
  --color-text-muted: #6B7280;
  --color-border: #E5E7EB;
  --color-error: #EF4444;
  --color-warning: #F59E0B;
  --color-success: #10B981;
}
```

### Typography Scale

```css
:root {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
}
```

### Spacing Scale

```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
}
```

### Tailwind Config (Alternative)

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#3B82F6', hover: '#2563EB' },
        // ... extracted from Figma
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
};
```

## Breakpoint Verification

Capture screenshots at each breakpoint and compare:

| Breakpoint | Width  | Figma Frame     |
|-----------|--------|-----------------|
| Mobile    | 375px  | Mobile frame    |
| Tablet    | 768px  | Tablet frame    |
| Desktop   | 1280px | Desktop frame   |

## Pixel-Level Comparison

After implementation:
1. Run app at each breakpoint
2. Capture Playwright screenshots
3. Overlay against Figma exports
4. Flag deviations > 2px spacing or > 1px borders
5. Check color accuracy (delta-E < 2)

## When to Use

- Starting UI implementation from Figma designs
- Verifying component accuracy against mockups
- Extracting design tokens for a new project
- Responsive layout verification
