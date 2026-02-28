---
description: Show all Dos Apes commands and usage
---

```
                       .:+*-.                                         .:+*-.
                      .*@@@@@%*:                                  ..+%@@@@@%:
                      +@@@@@@@@@%+.                             .-#@@@@@@@@@%.
                    .=%@@@@@@@@@@@@+.                         .-%@@@@@@@@@@@@#.
                   .*@@@@@@@@@@@@@@@@=.                     .:%@@@@@@@@@@@@@@@@-
                  .-:=*%%%#*-..=%@@@@@%:.                  .*@@@@@@*...+*#%%#+:-.
                 ..-%=....:-+=..:%@@@@@@@%+:..        ..-%@@@@@@@@#..-+-:....-#*..
             ..=@@%.=@#-+%@@-  .:@@@@@@@@@@@@%:.   ..#@@@@@@@@@@@@#.  .@@%*-*%%.+@@*..
           .-@@@@@@@-*=.:=.   .*@@@@@@@@@@@@@@@#. .+@@@@@@@@@@@@@@@%:.  .:=.:*.*@@@@@@*.
          .%@@@@@@@=.......  :#%@@@@@@@@@@@@@@@@%.-@@@@@@@@@@@@@@@@@%=. .......:@@@@@@@@=
         .%@@@@@@@%:.          .%@@@@@@@@@@@@@@@%:#@@@@@@@@@@@@@@@@-          ..%@@@@@@@@:
         =@@@@@@@@#::::=###*-..-@@@@@@@@@@@@@@@@%:*@@@@@@@@@@@@@@@@*. :*###*-:::-@@@@@@@@%.
         *@@@@@@@@@#.        .=%@@@@@@@@@@@@@@@@#.-@@@@@@@@@@@@@@@@@#.        .=@@@@@@@@@%:
        .%@@@@@@@@@@%+.    .+%@*%@@@@@@@@@@@@@@%: .#@@@@@@@@@@@@@@%*%@*..  ..-%@@@@@@@@@@@=
        .%@@@@@@@@@@@@@@@@@@@%:%@@@@@@@@@@@@@@@= ...%@@@@@@@@@@@@@@@*#@@@@@@@@@@@@@@@@@@@@=
        .%@@@@@@@@@@@@@@@@@@@-@@@@@@@@@@@@@@@@*..#=.-%@@@@@@@@@@@@@@@=+@@@@@@@@@@@@@@@@@@@=
         #@@@@@@@@@@@@@@@@@%.#@@@@@@@@@@@@@@@# .#@%-.=@@@@@@@@@@@@@@@@=*@@@@@@@@@@@@@@@@@@-
         +@@@@@@@@@@@@@@@@@-*@@@@@@@@@@@@@@@%:.*@@@@-.+@@@@@@@@@@@@@@@%.*@@@@@@@@@@@@@@@@%:
         =@@@@@@@@@@@@@@@@=:%@@@@@@@@@@@@@@%:.*@@@@@%..#@@@@@@@@@@@@@@@+:@@@@@@@@@@@@@@@@%.
         :%@@@@@@@@@@@@@@#.=@@@@@@@@@@@@@@@=.=@@@@@@@@:.#@@@@@@@@@@@@@@@.-@@@@@@@@@@@@@@@+
         .%@@@@@@@@@@@@@@-.%@@@@@@@@@@@@@@=.=@@@@@@@@@#.:@@@@@@@@@@@@@@@=.#@@@@@@@@@@@@@@:
          =@@@@@@@@@@@@@+ -@@@@@@@@@@@@@@*.-%@@@@@@@@@@%.:%@@@@@@@@@@@@@*.:@@@@@@@@@@@@@#.
          .%@@@@@@@@@@@%..#@@@@@@@@@@@@@+..%@@@@@@@@@@@@=.:@@@@@@@@@@@@@%..-@@@@@@@@@@@@=
           +@@@@@@@@@@@. .#@@@@@@@@@@@@#. :@@@@@@@@@@@@@*. -%@@@@@@@@@@@@: .#@@@@@@@@@@@.
           :%@@@@@@@@@=  :%@@@@@@@@@@@*.  .*@@@@@@@@@@@%-  .:%@@@@@@@@@@@+. .%@@@@@@@@@=
           .+@@@@@@@@%.  :%@@@@@@@@@@+.    .*@@@@@@@@@%:     :%@@@@@@@@@@#.  -@@@@@@@@#.
            .#@@@@@@@=.  :@@@@@@@@@@+.      .*@@@@@@@@-       .%@@@@@@@@@#. .:%@@@@@@@=.
             =@@@@@@@@@=.:%@@@@@@@@@#.       :@@@@@@@*.      .+@@@@@@@@@@#.:%@@@@@@@@#.
             .:#%@@@@@@@-.:#@@@@@@@@@-       .%@@@@@@-       .%@@@@@@@@%+ .%@@@@@@@%+.
```

# Dos Apes Super Agent Framework

_We ain't monkeying around with code!_

---

## FULL AUTONOMOUS BUILD

The main event. Feed it a PRD, walk away:

```bash
/apes-build --prd requirements.md --ralph
```

This will:

1. Parse your PRD → Create PROJECT.md, ROADMAP.md
2. Plan phases → Break into tasks
3. Execute with Agent Teams → architect, builder, tester, reviewer
4. Git workflow → Branch per phase, squash merge to main
5. Verify everything → 8-level pyramid (build, types, lint, tests, coverage, security, E2E, visual)
6. Iterate until complete → Ralph loop handles failures
7. Ship → `<promise>PRODUCT_COMPLETE</promise>`

---

## Commands

### Build Commands

| Command        | Purpose                                               |
| -------------- | ----------------------------------------------------- |
| `/apes-build`  | **Full autonomous build from PRD to shipped product (greenfield or brownfield)** |

### Brownfield Commands

| Command                 | Purpose                         |
| ----------------------- | ------------------------------- |
| `/apes-map`             | Analyze existing codebase       |
| `/apes-feature "desc"`  | Add a single-phase feature (for multi-phase PRDs, use `/apes-build`) |
| `/apes-fix "desc"`      | Fix a bug                       |
| `/apes-refactor "desc"` | Refactor existing code          |

### Testing Commands

| Command               | Purpose                                 |
| --------------------- | --------------------------------------- |
| `/apes-verify`        | Run full verification pyramid (L0-L7)   |
| `/apes-test-e2e`      | Generate and run E2E tests from stories |
| `/apes-test-visual`   | Visual regression screenshot testing    |
| `/apes-test-a11y`     | Automated accessibility audit           |
| `/apes-security-scan` | Full security audit pipeline            |

### State & Metrics Commands

| Command         | Purpose                                    |
| --------------- | ------------------------------------------ |
| `/apes-board`   | Kanban board view with critical path       |
| `/apes-status`  | Show current position (quick summary)      |
| `/apes-metrics` | Show session and project metrics           |

### Maintenance Commands

| Command         | Purpose                                    |
| --------------- | ------------------------------------------ |
| `/apes-gc`      | Codebase garbage collection sweep          |
| `/apes-gc --fix`| GC with auto-fix for safe issues           |

---

## Flags

| Flag                 | Effect                                     |
| -------------------- | ------------------------------------------ |
| `--ralph`            | Enable autonomous loop until complete      |
| `--max-iterations N` | Limit iterations (default: 50, build: 500) |
| `--prd [file]`       | Path to PRD document                       |
| `--idea "[text]"`    | Describe what to build                     |

---

## Verification Pyramid

```
L7: Visual Regression     ← Screenshot diff
L6: E2E / Browser         ← Playwright + agent-browser
L5: Security Scan         ← npm audit + gitleaks
L4: UI Integration        ← Components used?
L3: Integration Tests     ← E2E/API tests
L2.5: Coverage Gate       ← 80% threshold
L2: Unit Tests            ← Function tests
L1: Static Analysis       ← Types + Lint
L0.5: Auto Code Review    ← Stop hook (automatic)
L0: Build                 ← Compiles?
```

---

## Git Workflow

- **Phase start:** Branch from main (protected by hooks)
- **During phase:** Commit per task with git tag
- **Phase complete:** Squash merge to main
- **Rollback:** `git reset --hard phase-N/task-M-complete`

---

## Examples

### Build New Product

```bash
/apes-build --prd ./docs/requirements.md --ralph --max-iterations 500
```

### Add Feature to Existing (single-phase)

```bash
/apes-map
/apes-feature "Add dark mode with system preference detection"
```

### Add Complex Feature with PRD (multi-phase)

```bash
/apes-build --prd ./docs/notifications-prd.md --ralph
```

### Fix a Bug

```bash
/apes-fix "Login fails with special characters in email"
```

### Run Security Audit

```bash
/apes-security-scan
```

---

## Documentation

- `commands/*.md` - Command details
- `skills/*.md` - Domain knowledge
- `scripts/*.sh` - Hook scripts
- `ci/*.yml` - CI workflow templates

Full docs: https://github.com/allendosapes/dos-apes-super-agent-framework

---

🦍🦍 _Dos Apes: We ain't monkeying around with code!_
