---
name: frontend
description: React components, hooks, state management, accessibility, responsive design, data-testid conventions, Figma integration. Load when building UI components or frontend features.
allowed-tools: Read, Edit, Write, Bash, Grep
---

# Frontend Skill

## Component Patterns

### Functional Components

Always use functional components with TypeScript:

```tsx
interface UserCardProps {
  user: User;
  onSelect?: (user: User) => void;
}

export function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <div
      data-testid="user-card"
      className="rounded-lg p-4 shadow"
      onClick={() => onSelect?.(user)}
    >
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
}
```

### Hook Patterns

```typescript
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession().then(setUser).finally(() => setLoading(false));
  }, []);

  return { user, loading, isAuthenticated: !!user };
}
```

## Accessibility Verification

Every frontend component must meet WCAG 2.1 AA standards. The `/apes-test-a11y` command audits component output.

### Required Patterns

- **Images:** Always include `alt` text. Decorative images use `alt=""`
- **Forms:** Every input has a `<label>` with matching `htmlFor`/`id`
- **Buttons:** Always have accessible text (visible or `aria-label`)
- **Color:** Contrast ratio >= 4.5:1 for normal text, >= 3:1 for large text
- **Keyboard:** All interactive elements reachable via Tab, activatable via Enter/Space
- **Focus:** Visible focus indicators on all interactive elements

### ARIA Usage

```tsx
// Correct: use semantic HTML first
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/home">Home</a></li>
  </ul>
</nav>

// Correct: ARIA for custom widgets
<div role="dialog" aria-labelledby="dialog-title" aria-modal="true">
  <h2 id="dialog-title">Confirm Action</h2>
</div>
```

## E2E Selector Conventions

Use `data-testid` attributes for E2E test selectors:

```tsx
<input data-testid="login-email" type="email" />
<button data-testid="login-submit">Sign In</button>
<div data-testid="dashboard-stats">...</div>
```

Naming convention: `[component]-[element]`

These selectors are used by Playwright E2E tests (`/apes-test-e2e`) and are decoupled from CSS classes or DOM structure.

## Responsive Design

### Breakpoint Testing

Test at standard breakpoints:

| Breakpoint | Width  | Device Type    |
|-----------|--------|----------------|
| sm        | 640px  | Mobile         |
| md        | 768px  | Tablet         |
| lg        | 1024px | Small Desktop  |
| xl        | 1280px | Desktop        |
| 2xl       | 1536px | Large Desktop  |

Visual regression tests (`/apes-test-visual`) capture screenshots at each breakpoint to catch layout breaks.

### Responsive Patterns

```tsx
// Mobile-first approach
<div className="flex flex-col md:flex-row gap-4">
  <aside className="w-full md:w-64">Sidebar</aside>
  <main className="flex-1">Content</main>
</div>
```

## Design Integration (Figma)

When a project has Figma designs, load the `design-integration` skill for the full workflow.

### Quick Reference

If Figma MCP is configured in settings.json:
1. Read design specs from Figma (spacing, colors, typography)
2. Extract design tokens into CSS custom properties or Tailwind config
3. Implement components matching spec
4. Capture screenshots via Playwright at each breakpoint
5. Compare against Figma exports for pixel-level accuracy

See `.claude/skills/design-integration.md` for full details.

## State Management

### Server State (React Query / SWR)

Use for data fetched from APIs:

```typescript
function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => fetch("/api/users").then((r) => r.json()),
  });
}
```

### Client State (Zustand / Context)

Use for UI-only state:

```typescript
const useStore = create<AppState>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
```

### When to Use Which

- **Server state:** Data from API, cache invalidation matters → React Query
- **Global UI state:** Theme, sidebar, modals → Zustand or Context
- **Local UI state:** Form inputs, toggles → useState
- **URL state:** Filters, pagination → URL search params

## Anti-Patterns

### Prop Drilling

```tsx
// BAD: Passing props through many levels
<App user={user}>
  <Layout user={user}>
    <Sidebar user={user}>
      <Avatar user={user} />

// GOOD: Use context or state management
const { user } = useAuth();
```

### useEffect for Derived State

```tsx
// BAD: useEffect to compute derived values
const [filteredItems, setFilteredItems] = useState([]);
useEffect(() => {
  setFilteredItems(items.filter(i => i.active));
}, [items]);

// GOOD: Compute during render
const filteredItems = useMemo(
  () => items.filter(i => i.active),
  [items]
);
```
