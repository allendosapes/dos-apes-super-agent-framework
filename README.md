# Dos Apes Super Agent Framework

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

## We ain't monkeying around with code!

**Feed it a PRD. Walk away. Come back to a shipped product.**

Dos Apes is a unified AI coding framework that combines the best of [GSD](https://github.com/glittercowboy/get-shit-done), [VibeKanban](https://vibekanban.com), [Ralph Wiggum](https://awesomeclaude.ai/ralph-wiggum), and [Claude Code best practices](https://github.com/ChrisWiles/claude-code-showcase) into one autonomous building system.

```bash
npx dos-apes
```

---

## The Vision

```
Human: "Build me a course management platform"
       ↓
Dos Apes: [Plans] → [Codes] → [Tests] → [Iterates] → [Ships]
       ↓
Human: "Here's your product" 🦍🦍
```

**This is not a helper. It's a builder.**

---

## Quick Start

### Install

```bash
npx dos-apes
```

### Build a Product

```bash
# Full autonomous build
/apes-build --prd requirements.md --ralph

/apes-build --prd claude/templates/next-gen-courseware-prd.md --ralph
# Or describe what you want
/apes-build --idea "Build a task management app with projects, tasks, and team collaboration"
```

### Add to Existing Project

```bash
# Map your codebase
/apes-map

# Add a feature
/apes-feature "Add real-time notifications"

# Fix a bug
/apes-fix "Users can't upload files over 5MB"
```

---

## What Happens When You Run Build

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  /apes-build --prd requirements.md --ralph                      │
│                                                                 │
│  1. INGEST                                                      │
│     Parse PRD → PROJECT.md, ROADMAP.md, STATE.md                │
│                                                                 │
│  2. PLAN                                                        │
│     [Technical Architect] designs Phase 1                       │
│     Creates PLAN.md with tasks                                  │
│                                                                 │
│  3. GIT SETUP                                                   │
│     git checkout -b feat/phase-1-foundation                     │
│                                                                 │
│  4. EXECUTE (for each task)                                     │
│     [Orchestrator] → [Backend/Frontend Developer]               │
│     [Developer] implements task                                 │
│     [Developer] → [QA Engineer]                                 │
│     [QA] verifies: build, types, lint, tests, UI integration    │
│     [QA] → [Orchestrator]                                       │
│     [Orchestrator] commits: git commit -m "feat: ..."           │
│                                                                 │
│  5. PHASE COMPLETE                                              │
│     git checkout main && git merge --squash                     │
│     git push origin main                                        │
│                                                                 │
│  6. ITERATE                                                     │
│     More phases? → Back to PLAN                                 │
│     All done? → SHIP                                            │
│                                                                 │
│  7. OUTPUT                                                      │
│     <promise>PRODUCT_COMPLETE</promise>                         │
│     🦍🦍 We ain't monkeying around with code!                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 🤖 Multi-Agent Orchestration (12 Agents)

Work is delegated to specialized agents, each with their own rules:

| Agent | Model | Responsibility |
|-------|-------|---------------|
| **Orchestrator** | Sonnet | Git, state, coordination, handoffs |
| **Product Manager** | Sonnet | PRD, user stories, MoSCoW prioritization |
| **Technical Architect** | Opus | System design, ADRs, tech decisions |
| **UI/UX Designer** | Sonnet | User flows, wireframes, accessibility |
| **Frontend Developer** | Opus | Components, pages, **UI integration mandatory** |
| **Backend Developer** | Opus | APIs, services, database |
| **Security Engineer** | Opus | Threat modeling, OWASP compliance |
| **QA Engineer** | Sonnet | Test execution, bug reports, UAT |
| **Test Automation** | Sonnet | Unit/integration/E2E test creation |
| **DevOps Engineer** | Sonnet | CI/CD, deployment, infrastructure |
| **Code Reviewer** | Opus | Code quality, standards compliance |
| **Tech Writer** | Sonnet | README, API docs, user guides |

Agent handoffs are explicit:
```
[ORCHESTRATOR → BACKEND DEVELOPER]
Task: Create user authentication service
Context: PostgreSQL database, JWT tokens
Files: src/services/authService.ts

[BACKEND DEVELOPER] Implementing...
[BACKEND DEVELOPER → QA ENGINEER] Ready for verification
[QA ENGINEER] ✅ All checks passed
[QA ENGINEER → ORCHESTRATOR] Approved
[ORCHESTRATOR] Committed: feat(auth): add user authentication
```

### 🔄 Ralph Loop (Autonomous Iteration)

The `--ralph` flag enables autonomous iteration until complete:

```
WHILE not complete:
    find next task
    delegate to agent
    verify with QA
    if fail: analyze, fix, retry
    if pass: commit, continue
    
OUTPUT <promise>PRODUCT_COMPLETE</promise>
```

Stop hooks prevent exit until the product ships. Failures trigger retries with failure context. The AI keeps going until it works.

### 🌳 Git Workflow

Proper branching strategy built in:

| Situation | Git Action |
|-----------|------------|
| Start phase | `git checkout -b feat/phase-N` |
| Complete task | `git commit -m "feat: ..."` |
| Complete phase | `git merge --squash` to main |
| Parallel work | Git worktrees |
| Stay current | `git rebase origin/main` |

### 📊 State Management

All state persists in `.planning/`:

```
.planning/
├── PROJECT.md      # Vision, requirements (immutable)
├── ROADMAP.md      # All phases (status updated)
├── STATE.md        # Current position (constantly updated)
├── PLAN.md         # Current phase tasks
├── ISSUES.md       # Deferred problems
└── MEMORY.md       # Learnings, patterns
```

Resume anytime:
```bash
/apes-resume
```

### 🚦 Quality Gates (Blocking)

Six gates ensure quality at each phase:

| Gate | Checkpoint | Must Have |
|------|------------|-----------|
| **G1** | Requirements | PRD, user stories, MVP definition |
| **G2** | Design | Architecture, wireframes, threat model |
| **G3** | Implementation Ready | Tech stack, dev env, security model |
| **G4** | Code Complete | All features, unit tests passing |
| **G5** | Test Complete | All tests pass, 80%+ coverage, no criticals |
| **G6** | Release Ready | Docs, security review, deployment ready |

Gates are **blocking** - work cannot proceed until criteria are met.

### 🧠 Context Engineering

Smart context management for peak AI quality:

| Context Usage | Quality | Action |
|--------------|---------|--------|
| 0-30% | Peak | Continue in current session |
| 30-50% | Good | Plan handoff after current task |
| 50-70% | Degrading | Spawn subagent for remaining work |
| 70%+ | Poor | Must handoff immediately |

### ✅ Verification Stack

Every task verified before commit:

```
Level 0: Build        npm run build
Level 1: Types        npm run typecheck
Level 2: Lint         npm run lint
Level 3: Tests        npm test
Level 4: UI Integration   grep -rn "[Component]" src/
Level 5: Browser      Manual verification
```

**UI Integration is mandatory.** Creating a component isn't done until it's integrated, routed, and navigable.

---

## Commands

### Build Commands

| Command | Purpose |
|---------|---------|
| `/apes-build --prd [file]` | Full autonomous build from PRD |
| `/apes-build --idea "[text]"` | Build from description |
| `/apes-init --prd [file]` | Initialize without auto-execute |
| `/apes-plan [phase]` | Plan a specific phase |
| `/apes-execute [phase]` | Execute a phase |

### Brownfield Commands

| Command | Purpose |
|---------|---------|
| `/apes-map` | Analyze existing codebase |
| `/apes-feature "[desc]"` | Add feature |
| `/apes-fix "[desc]"` | Fix bug |
| `/apes-refactor "[desc]"` | Refactor code |

### State Commands

| Command | Purpose |
|---------|---------|
| `/apes-status` | Show current position |
| `/apes-verify` | Run verification suite |
| `/apes-resume` | Continue from last state |
| `/apes-handoff` | Create handoff document |

### Flags

| Flag | Effect |
|------|--------|
| `--ralph` | Autonomous loop until complete |
| `--max-iterations N` | Limit iterations (default: 500) |
| `--parallel` | Use git worktrees |

---

## Autonomy Levels

Choose your comfort level:

| Level | Command | You Review |
|-------|---------|------------|
| Task | `/apes-execute --task 1` | Each task |
| Phase | `/apes-execute 1 --ralph` | Each phase |
| Product | `/apes-build --ralph` | Final product |

---

## Example: Build a SaaS Product

```bash
$ claude
> /apes-build --prd ./docs/product-requirements.md --ralph --max-iterations 500

[ORCHESTRATOR] Loading PRD...
[ORCHESTRATOR] Creating PROJECT.md...
[ORCHESTRATOR] Creating ROADMAP.md (4 phases identified)...
[ORCHESTRATOR] Initializing STATE.md...

═══ PHASE 1: Foundation ═══

[ORCHESTRATOR] git checkout -b feat/phase-1-foundation
[TECHNICAL ARCHITECT] Designing foundation architecture...
[ORCHESTRATOR] PLAN.md created (5 tasks)

Task 1/5: Project scaffolding
[ORCHESTRATOR → BACKEND DEVELOPER]
[BACKEND DEVELOPER] Initializing Vite + React + TypeScript...
[BACKEND DEVELOPER → QA ENGINEER]
[QA ENGINEER] Build: ✅ Types: ✅ Lint: ✅ Tests: ✅
[ORCHESTRATOR] Committed: chore(init): project scaffolding

Task 2/5: Database schema
[ORCHESTRATOR → BACKEND DEVELOPER]
...

═══ PHASE 1 COMPLETE ═══
[ORCHESTRATOR] git checkout main && git merge --squash
[ORCHESTRATOR] Pushed to main

═══ PHASE 2: Core Features ═══
...

═══ PHASE 3: User Experience ═══
...

═══ PHASE 4: Polish & Launch ═══
...

═══════════════════════════════════════════════════════════════
🦍🦍 PRODUCT COMPLETE 🦍🦍
═══════════════════════════════════════════════════════════════

Phases: 4/4
Tasks: 18/18
Commits: 23
Time: ~4 hours

Dos Apes: We ain't monkeying around with code!
<promise>PRODUCT_COMPLETE</promise>
```

---

## Philosophy

### Done Means Done

```
Creating a component ≠ done
Component in a file ≠ done  
Component imported ≠ done

Done = integrated + routed + navigable + tested + browser-verified
```

### Fail Fast, Fix Fast

Ralph loops embrace failure:
- First attempt often fails
- Failure provides information
- Loop fixes and retries
- Eventually converges

### Trust But Verify

Every task verified. Every phase verified. Stop hooks prevent premature exit.

### Parallel > Sequential

Git worktrees enable multiple agents working simultaneously without conflicts.

---

## Credits & Attribution

Built on the shoulders of giants:

- **[GSD](https://github.com/glittercowboy/get-shit-done)** - Spec-driven development, phase planning, subagent isolation
- **[VibeKanban](https://vibekanban.com)** - Git worktree orchestration, parallel execution
- **[Ralph Wiggum](https://awesomeclaude.ai/ralph-wiggum)** - Iterative loops, stop hooks, persistence
- **[Claude Code Showcase](https://github.com/ChrisWiles/claude-code-showcase)** - Hooks, skills, agents patterns
- **Boris Cherny's Workflow** - Verification-first philosophy

---

## License

MIT License - Use freely, contribute back.

---

## Setup & Installation

See [SETUP.md](./SETUP.md) for detailed setup instructions including:
- Prerequisites (Claude Code CLI, Git, Node.js)
- Installation for new and existing projects
- Directory structure explanation
- Troubleshooting guide

## Publishing to GitHub

See [GITHUB.md](./GITHUB.md) for detailed instructions on:
- Creating the repository
- Pushing the code
- Publishing to npm
- Setting up CI/CD

**Quick version:**
```bash
cd dos-apes
git init
git add .
git commit -m "feat: initial release of Dos Apes"
git remote add origin https://github.com/YOUR-ORG/dos-apes.git
git push -u origin main
```

---

## Templates Included

The framework includes comprehensive templates:

| Template | Purpose |
|----------|---------|
| `PRD-TEMPLATE.md` | Product requirements document structure |
| `user-story-template.md` | Detailed user stories with acceptance criteria |
| `adr-template.md` | Architecture Decision Records |
| `test-plan-template.md` | Comprehensive test planning |
| `security-review-template.md` | OWASP-based security checklist |
| `PLAN-TEMPLATE.md` | Phase task planning (GSD XML format) |
| `SUMMARY-TEMPLATE.md` | Plan summaries with frontmatter dependencies |
| `STATE-TEMPLATE.md` | Execution state tracking |
| `CLAUDE-TEMPLATE.md` | Project context file for Claude |

## Standards Library

Quality standards for consistent development:

| Standard | Coverage |
|----------|----------|
| `coding-standards.md` | Naming, TypeScript, error handling |
| `security-guidelines.md` | OWASP Top 10, auth, input validation |
| `testing-standards.md` | 80% coverage, unit/integration/E2E |
| `api-standards.md` | REST design, pagination, errors |
| `accessibility-standards.md` | WCAG 2.1 AA compliance |
| `git-workflow.md` | Branching, commits, PRs |
| `frontend-design.md` | Components, state, hooks |

Find them in `framework/templates/` and `framework/standards/`.

---

## 🦍🦍 Dos Apes: We ain't monkeying around with code!
