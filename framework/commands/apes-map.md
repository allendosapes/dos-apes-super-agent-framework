---
description: Analyze existing codebase and create understanding documents
allowed-tools: Read, Grep, Glob, Bash(find:*), Bash(cat:*), Bash(wc:*), Bash(head:*), Bash(tail:*)
---

# Map Codebase

Analyze this existing codebase to understand its patterns, structure, and conventions.

## Process

### Step 1: Discover Structure

```bash
# Find all source directories
find . -type d -name "src" -o -name "lib" -o -name "app" 2>/dev/null | head -20

# Find package files
ls -la package.json pyproject.toml Cargo.toml go.mod pom.xml 2>/dev/null

# Find config files
ls -la *.config.* .*.json .*.yaml .*.yml tsconfig.json 2>/dev/null
```

### Step 2: Analyze Stack

Create `.planning/codebase/STACK.md`:

```markdown
# Stack Analysis

## Languages

[Detected languages and versions]

## Frameworks

[Frontend: React/Vue/Angular/etc]
[Backend: Express/FastAPI/etc]
[Database: PostgreSQL/MongoDB/etc]

## Key Dependencies

[Major libraries from package.json/etc]

## Build Tools

[Vite/Webpack/etc]

## Test Framework

[Jest/Vitest/pytest/etc]
```

### Step 3: Analyze Architecture

Create `.planning/codebase/ARCHITECTURE.md`:

```markdown
# Architecture Analysis

## Pattern

[Monolith/Microservices/Serverless/etc]

## Layers

[API/Service/Repository/etc]

## Data Flow

[How data moves through the system]

## Key Abstractions

[Main patterns used: hooks, services, etc]
```

### Step 4: Analyze Structure

Create `.planning/codebase/STRUCTURE.md`:

```markdown
# Directory Structure

## Source Layout

[Tree of main directories with descriptions]

## Key Directories

- src/components/ - [purpose]
- src/pages/ - [purpose]
- src/api/ - [purpose]
- src/hooks/ - [purpose]
- src/services/ - [purpose]
- src/utils/ - [purpose]

## Configuration

[Where configs live]

## Tests

[Where tests live, naming convention]
```

### Step 5: Analyze Conventions

Create `.planning/codebase/CONVENTIONS.md`:

```markdown
# Code Conventions

## Naming

- Files: [PascalCase/kebab-case/etc]
- Components: [pattern]
- Functions: [pattern]
- Variables: [pattern]

## File Organization

- Imports order
- Export patterns
- Co-location patterns

## Styling

- CSS approach: [Tailwind/CSS Modules/etc]
- Formatting: [Prettier config]

## TypeScript

- Strict mode: [yes/no]
- Type patterns: [interfaces vs types]
```

### Step 6: Analyze Testing

Create `.planning/codebase/TESTING.md`:

```markdown
# Testing Analysis

## Test Framework

[Jest/Vitest/pytest/etc]

## Test Structure

- Unit tests: [location]
- Integration tests: [location]
- E2E tests: [location]

## Test Commands

- All tests: [command]
- Unit only: [command]
- Watch mode: [command]
- Coverage: [command]

## Coverage Status

[Current coverage if available]

## Test Patterns

- Mocking: [approach]
- Fixtures: [location]
- Factories: [if used]

## Known Gaps

[Areas with low/no coverage]
```

### Step 7: Analyze Integrations

Create `.planning/codebase/INTEGRATIONS.md`:

```markdown
# External Integrations

## APIs

- [API 1]: [purpose, auth method]
- [API 2]: [purpose, auth method]

## Services

- Database: [type, connection method]
- Cache: [type if any]
- Queue: [type if any]

## Third-Party Libraries

- Auth: [provider/library]
- Payments: [provider if any]
- Email: [provider if any]
- Storage: [provider if any]

## Environment Variables

[Key env vars needed from .env.example]
```

### Step 8: Identify Concerns

Create `.planning/codebase/CONCERNS.md`:

```markdown
# Technical Concerns

## Tech Debt

[Identified issues]

## Fragile Areas

[Code that's complex or prone to bugs]

## Missing Tests

[Areas with low coverage]

## Deprecated Patterns

[Old code that should be modernized]

## Security Considerations

[Any security-related notes]
```

### Step 9: Update CLAUDE.md

If CLAUDE.md exists, merge findings. If not, create it:

```markdown
# [Project Name]

## Stack

[From STACK.md]

## Commands

[Discovered from package.json/etc]

## Structure

[Key directories]

## Conventions

[From CONVENTIONS.md]

## Critical Rules

[Discovered patterns that must be followed]
```

### Step 10: Update STATE.md

```markdown
## Codebase Analysis

- Mapped: [timestamp]
- Files analyzed: [count]
- Key insights: [list]
```

## Output

### 7 Documents Created

| Document        | Purpose                             |
| --------------- | ----------------------------------- |
| STACK.md        | Languages, frameworks, dependencies |
| ARCHITECTURE.md | Patterns, layers, data flow         |
| STRUCTURE.md    | Directory layout, key files         |
| CONVENTIONS.md  | Code style, naming patterns         |
| TESTING.md      | Test framework, patterns, gaps      |
| INTEGRATIONS.md | External services, APIs             |
| CONCERNS.md     | Tech debt, known issues             |

### Auto-Context Loading

These documents enable automatic context loading for `/apes-feature` and `/apes-fix`:

```
Feature Request: "Add user notifications"
  ↓
Keyword matching: notifications → INTEGRATIONS.md
  ↓
Auto-load: INTEGRATIONS.md (for email/push providers)
           ARCHITECTURE.md (for service layer)
           CONVENTIONS.md (for patterns)
```

Report:

1. Stack summary
2. Architecture overview
3. Key patterns discovered
4. Testing status
5. Integrations identified
6. Concerns flagged
7. Recommended CLAUDE.md updates

Output <promise>CODEBASE_MAPPED</promise> when complete.
