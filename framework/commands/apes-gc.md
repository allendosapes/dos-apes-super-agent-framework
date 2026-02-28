---
description: Codebase garbage collection — find and fix inconsistencies, stale docs, dead code, architectural drift
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

# Garbage Collection

**Periodic cleanup sweep for agent-generated codebases. Find drift, staleness, and dead code before they compound.**

```bash
/apes-gc              # Report only
/apes-gc --fix        # Report + auto-fix what's safe
```

## Arguments

- `--fix` - Auto-fix safe issues (unused imports, formatting, simple doc refs)

## Team Composition

| Teammate | Skills Loaded | Role |
|----------|--------------|------|
| reviewer | `skills/review.md` + `skills/observability.md` | Sweep and fix |

---

## SWEEP 1: Documentation Freshness

Check that documentation tracks source code:

```bash
# Compare source vs doc modification dates
# Flag docs older than their source by >7 days
find src -name "*.ts" -newer docs/ -mtime +7 2>/dev/null

# Check CLAUDE.md reflects current state
# - Are listed commands still in package.json?
# - Does the tech stack section match actual dependencies?
# - Are the listed conventions still followed?
```

Checks:
- CLAUDE.md `## Commands` section matches actual `package.json` scripts
- CLAUDE.md `## Tech Stack` matches installed dependencies
- `.planning/ROADMAP.md` phase status matches actual task completion (via TaskList)
- README.md code examples parse without syntax errors
- ADRs in `docs/architecture/` reference files that still exist

Severity:
- CLAUDE.md out of sync → **Critical** (agents read this every session)
- README examples broken → **Warning**
- ADR references stale files → **Info**

## SWEEP 2: Dead Code Detection

```bash
# Find exported functions/components with zero imports across the codebase
# For each export in src/**/*.ts(x):
#   grep for its name in all other files
#   If zero matches → flag as potentially dead

# Find orphaned files (zero imports)
# For each file in src/**/*.ts(x):
#   Search for its path or name in import statements
#   If zero matches and not an entry point → flag

# Find unused dependencies
# Compare package.json dependencies vs actual import statements
```

Checks:
- Exported symbols with zero consumers
- Files with zero importers (excluding entry points: index.ts, main.ts, app.ts, page.tsx)
- `package.json` dependencies not found in any import statement
- `devDependencies` not found in any config, test, or script file

Severity:
- Unused dependencies → **Warning** (bloats install, potential supply chain risk)
- Orphaned files → **Warning**
- Unused exports → **Info** (may be public API surface)

**Important:** Flag but don't auto-delete. Dead code detection has false positives (dynamic imports, re-exports, public APIs). Human review recommended.

## SWEEP 3: Architectural Drift

```bash
# Run boundary checker if rules exist
if [ -f ".planning/ARCHITECTURE_RULES.md" ]; then
  bash scripts/check-structure.sh
fi
```

Checks:
- Import direction violations (via `scripts/check-structure.sh`)
- Files in wrong directories (e.g., a React component in `src/services/`)
- New `package.json` dependencies not referenced in any ADR
- Mixed responsibility in single files (e.g., HTTP handling + business logic in one file)

Severity:
- Boundary violations → **Critical** (structure enforcement exists for a reason)
- Files in wrong directories → **Warning**
- Undocumented new dependencies → **Info**

## SWEEP 4: Test Freshness

```bash
# Find source files modified after their test file
# For each src/foo.ts, check if src/foo.test.ts exists and compare dates
find src -name "*.ts" -not -name "*.test.*" -not -name "*.spec.*" | while read f; do
  test_file="${f%.ts}.test.ts"
  [ -f "$test_file" ] || test_file="${f%.tsx}.test.tsx"
  if [ -f "$test_file" ]; then
    if [ "$f" -nt "$test_file" ]; then
      echo "STALE TEST: $test_file (source modified after test)"
    fi
  else
    echo "MISSING TEST: $f (no co-located test file)"
  fi
done
```

Checks:
- Source files modified since their test was last touched
- Test files that import removed or renamed modules (broken imports)
- Source file count vs test file count ratio (flag if ratio drops below 0.5)
- Test `describe`/`it` names that don't match current function signatures

Severity:
- Tests with broken imports → **Critical** (tests can't even run)
- Source modified after test → **Warning** (test may not cover new behavior)
- Missing test files → **Info** (not all files need tests)

## SWEEP 5: Pattern Consistency

```bash
# Check for mixed patterns across the codebase
# - Default exports vs named exports
# - Arrow functions vs function declarations for components
# - Relative imports vs alias imports (@/)
# - console.log/debugger statements in production code
grep -rn "console\.log\|console\.debug\|debugger" src/ --include="*.ts" --include="*.tsx" \
  | grep -v "test\.\|spec\.\|__test__" || true
```

Checks:
- Mixed export styles (some files default, some named) — which is dominant?
- `console.log` / `console.debug` / `debugger` in non-test source files
- Mixed import alias styles (`@/` vs relative `../`)
- Inconsistent naming (some `camelCase`, some `PascalCase` for same category)

Severity:
- `debugger` statements → **Critical** (breaks production)
- `console.log` in source → **Warning**
- Mixed patterns → **Info** (cosmetic but compounds over time)

## OUTPUT REPORT

After all sweeps, produce a consolidated report:

```
═══ GARBAGE COLLECTION REPORT ═══
Sweep completed: [timestamp]

🔴 Critical (fix now):
- CLAUDE.md commands section lists "npm run e2e" but package.json has no e2e script
- src/services/api.ts imports from src/components (boundary violation)
- tests/auth.test.ts imports "./services/oldAuth" which no longer exists
- debugger statement in src/hooks/useAuth.ts:42

🟡 Warning (fix soon):
- 3 unused dependencies: lodash, moment, classnames
- src/utils/legacy.ts has zero importers (orphaned)
- 5 source files modified after their test files

🟢 Info (consider fixing):
- 12 exported functions have zero consumers
- Mixed import styles: 80% @/ alias, 20% relative
- README "Quick Start" example uses old API format

Summary: 4 critical, 9 warnings, 15 info items
Auto-fixable: 6 items (unused imports, formatting, debugger removal)
═══════════════════════════════════════════════════════════════════
```

## AUTO-FIX MODE (--fix)

When `--fix` is passed, automatically resolve safe issues:

- Remove unused imports from source files
- Remove `console.log` / `debugger` statements from non-test source
- Run `prettier --write` on files that drifted from formatting config
- Update simple doc references (file paths that moved to known new locations)

**Do NOT auto-fix:**
- Dead code deletion (false positive risk)
- Architectural boundary violations (requires design decision)
- Broken test imports (may need test rewrite, not just path fix)
- Missing tests (requires writing new tests)

After auto-fixing, stage and commit:

```bash
git add -A
git commit -m "chore: garbage collection sweep — [N] auto-fixes applied"
```

## SCHEDULING

Run `/apes-gc` at these natural points:
- After completing a phase (before merge to main)
- After merging a large feature branch
- Weekly during active development
- Before any release tag

---

## Output

```
<promise>GC_COMPLETE</promise>
```
