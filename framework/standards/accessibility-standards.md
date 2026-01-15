# Accessibility Standards

Standards for WCAG 2.1 AA compliance and inclusive design.

## Minimum Requirements

| Criterion | Level | Requirement |
|-----------|-------|-------------|
| Color Contrast | AA | 4.5:1 for normal text, 3:1 for large text |
| Keyboard Navigation | AA | All interactive elements keyboard accessible |
| Focus Indicators | AA | Visible focus states on all elements |
| Touch Targets | AA | Minimum 44x44px for interactive elements |
| Screen Reader | AA | All content accessible via screen reader |

## Semantic HTML

### Use Correct Elements
```html
<!-- Good: Semantic elements -->
<header>
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="/">Home</a></li>
    </ul>
  </nav>
</header>

<main>
  <article>
    <h1>Page Title</h1>
    <section aria-labelledby="section-1">
      <h2 id="section-1">Section Title</h2>
      <p>Content...</p>
    </section>
  </article>
</main>

<footer>
  <!-- Footer content -->
</footer>

<!-- Bad: Div soup -->
<div class="header">
  <div class="nav">...</div>
</div>
```

### Heading Hierarchy
```html
<!-- Good: Logical order -->
<h1>Main Title</h1>
  <h2>Section</h2>
    <h3>Subsection</h3>
  <h2>Another Section</h2>

<!-- Bad: Skipping levels -->
<h1>Main Title</h1>
  <h4>Subsection</h4>  <!-- Skipped h2, h3 -->
```

## Keyboard Navigation

### Focus Management
```tsx
// Ensure all interactive elements are focusable
<button onClick={handleClick}>Click me</button>  // Good: native button
<div onClick={handleClick}>Click me</div>        // Bad: not keyboard accessible

// If using div, add proper attributes
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  Click me
</div>
```

### Skip Links
```html
<!-- First element in body -->
<a href="#main-content" class="skip-link">
  Skip to main content
</a>

<nav>...</nav>

<main id="main-content">
  <!-- Main content -->
</main>
```

### Focus Trapping (Modals)
```tsx
function Modal({ isOpen, onClose, children }) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements?.[0] as HTMLElement;
    const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement;

    // Focus first element
    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();

      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" ref={modalRef}>
      {children}
    </div>
  );
}
```

## Color and Contrast

### Minimum Ratios
- Normal text (<18pt): 4.5:1
- Large text (>=18pt or 14pt bold): 3:1
- UI components: 3:1

### Don't Rely on Color Alone
```tsx
// Bad: Color only indicates state
<span style={{ color: 'red' }}>Error</span>

// Good: Icon + color + text
<span style={{ color: 'red' }}>
  <ErrorIcon aria-hidden="true" />
  Error: Password is required
</span>

// Form error states
<input
  aria-invalid="true"
  aria-describedby="email-error"
/>
<span id="email-error" role="alert">
  Please enter a valid email address
</span>
```

## Forms

### Labels and Instructions
```tsx
// Always associate labels
<label htmlFor="email">Email address</label>
<input id="email" type="email" required aria-required="true" />

// Or use aria-label for icon buttons
<button aria-label="Search">
  <SearchIcon aria-hidden="true" />
</button>

// Provide helpful descriptions
<input
  id="password"
  type="password"
  aria-describedby="password-hint"
/>
<span id="password-hint">
  Must be at least 8 characters
</span>
```

### Error Handling
```tsx
<form aria-describedby="form-errors">
  {errors.length > 0 && (
    <div id="form-errors" role="alert" aria-live="polite">
      <p>Please fix the following errors:</p>
      <ul>
        {errors.map(error => (
          <li key={error.field}>{error.message}</li>
        ))}
      </ul>
    </div>
  )}

  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    aria-invalid={!!errors.email}
    aria-describedby={errors.email ? 'email-error' : undefined}
  />
  {errors.email && (
    <span id="email-error" role="alert">{errors.email}</span>
  )}
</form>
```

## Images and Media

### Alternative Text
```tsx
// Informative images
<img src="chart.png" alt="Sales increased 25% in Q4" />

// Decorative images
<img src="decoration.png" alt="" role="presentation" />

// Complex images
<figure>
  <img src="flowchart.png" alt="User registration process" />
  <figcaption>
    <details>
      <summary>Detailed description</summary>
      <p>Step 1: User enters email. Step 2: ...</p>
    </details>
  </figcaption>
</figure>
```

### Video/Audio
```html
<video controls>
  <source src="video.mp4" type="video/mp4" />
  <track kind="captions" src="captions.vtt" srclang="en" label="English" />
  <track kind="descriptions" src="descriptions.vtt" srclang="en" label="Audio Description" />
</video>
```

## ARIA

### When to Use ARIA
1. Only when native HTML isn't sufficient
2. After using semantic HTML
3. Test with actual screen readers

### Common Patterns
```tsx
// Live regions for dynamic content
<div aria-live="polite" aria-atomic="true">
  {notification}
</div>

// Custom widgets
<div
  role="tablist"
  aria-label="Account settings"
>
  <button
    role="tab"
    aria-selected={activeTab === 'profile'}
    aria-controls="profile-panel"
  >
    Profile
  </button>
</div>

<div
  id="profile-panel"
  role="tabpanel"
  aria-labelledby="profile-tab"
  hidden={activeTab !== 'profile'}
>
  {/* Tab content */}
</div>

// Loading states
<button
  disabled={loading}
  aria-busy={loading}
>
  {loading ? 'Saving...' : 'Save'}
</button>
```

## Testing

### Automated Testing
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('component has no accessibility violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Manual Testing Checklist
- [ ] Navigate with keyboard only (Tab, Shift+Tab, Enter, Esc)
- [ ] Test with screen reader (VoiceOver, NVDA)
- [ ] Test at 200% zoom
- [ ] Test with high contrast mode
- [ ] Check color contrast ratios
- [ ] Verify focus is visible

## Checklist

Before launch:
- [ ] All images have alt text
- [ ] Color contrast meets WCAG AA
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible
- [ ] Form labels associated correctly
- [ ] Error messages announced
- [ ] Skip links present
- [ ] Heading hierarchy logical
- [ ] Touch targets 44x44px minimum
- [ ] Automated tests passing
