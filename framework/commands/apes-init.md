---
description: Initialize new project from PRD
allowed-tools: Read, Write, Bash(mkdir:*), Bash(cat:*)
---

# Initialize Project

## Arguments

- `--prd [file]` - Path to PRD document (required for greenfield)
- `--name [name]` - Project name (optional, extracted from PRD)

## Process

### Step 1: Read PRD

If PRD provided:
```bash
cat $PRD_PATH
```

If no PRD, gather requirements interactively:
- What are you building?
- Who is it for?
- What are the core features?
- What's the tech stack?
- What are the constraints?

### Step 2: Create .planning Directory

```bash
mkdir -p .planning/codebase
```

### Step 3: Create PROJECT.md

Extract from PRD and create `.planning/PROJECT.md`:

```markdown
# [Project Name]

## Vision
[One sentence describing what this is and why it matters]

## North Star Metric
[The primary metric that defines success]

## Target Users
- **Primary:** [Main user persona]
- **Secondary:** [Other users]

## Core Requirements

### Must Have (P0)
- [ ] [Requirement 1]
- [ ] [Requirement 2]

### Should Have (P1)
- [ ] [Requirement 1]

### Nice to Have (P2)
- [ ] [Requirement 1]

## Technical Stack
- **Frontend:** [Framework, language]
- **Backend:** [Framework, language]
- **Database:** [Type, specific DB]
- **Hosting:** [Platform]
- **Other:** [Additional services]

## Constraints
- [Technical constraint 1]
- [Business constraint 1]
- [Timeline constraint]

## Success Criteria
- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]

## Out of Scope
- [Explicitly not doing 1]
- [Explicitly not doing 2]
```

### Step 4: Create ROADMAP.md

Break project into phases:

```markdown
# Roadmap

## Overview
Total Phases: [N]
Estimated Complexity: [Low/Medium/High]

---

## Phase 1: [Foundation]
**Goal:** [What this achieves]
**Deliverable:** [Concrete outcome users can see/use]
**Complexity:** [Low/Medium/High]

### Tasks
- [ ] 1.1: [Task description]
- [ ] 1.2: [Task description]
- [ ] 1.3: [Task description]

### Dependencies
- None (first phase)

---

## Phase 2: [Core Feature]
**Goal:** [What this achieves]
**Deliverable:** [Concrete outcome]
**Complexity:** [Low/Medium/High]

### Tasks
- [ ] 2.1: [Task description]
- [ ] 2.2: [Task description]

### Dependencies
- Phase 1 complete

---

## Phase 3: [Next Feature]
...

---

## Milestones

| Milestone | Phase | Description |
|-----------|-------|-------------|
| MVP | 2 | Minimum viable product |
| Beta | 3 | Feature complete for testing |
| Launch | 4 | Production ready |
```

### Step 5: Create STATE.md

```markdown
# State

## Current Position
- **Phase:** 1 - [Name]
- **Task:** Not started
- **Status:** initialized

## Progress

| Phase | Name | Status | Tasks |
|-------|------|--------|-------|
| 1 | [Name] | 🔄 Pending | 0/3 |
| 2 | [Name] | ⏳ Waiting | 0/2 |
| 3 | [Name] | ⏳ Waiting | 0/3 |

## Blockers
None

## Decisions
- [Date]: Initialized project from PRD

## Session Log
- [Timestamp]: Project initialized

## Next Action
Run `/apes-plan 1` to create Phase 1 task plan
```

### Step 6: Create CLAUDE.md (if not exists)

```markdown
# [Project Name]

## Stack
[From PROJECT.md]

## Commands
- `npm run dev` - Start development server
- `npm test` - Run tests
- `npm run build` - Build for production
- `npm run lint` - Run linter
- `npm run typecheck` - Check types

## Structure
[Will be populated as project develops]

## Conventions
- TypeScript strict mode
- Functional components
- Tests co-located with code
- Conventional commits

## Critical Rules
[From constraints in PROJECT.md]
```

### Step 7: Initialize Git (if needed)

```bash
git init
git add .planning/ CLAUDE.md
git commit -m "chore: initialize project planning"
```

## Output

Report:
1. Project name
2. Phases identified
3. Estimated total tasks
4. Recommended first steps

```
✅ Project Initialized: [Name]

📋 Phases: [N]
📝 Total Tasks: [N]

Next Steps:
1. Review .planning/ROADMAP.md
2. Run /apes-plan 1 to create Phase 1 plan
3. Run /apes-execute 1 to start building
```

Output <promise>PROJECT_INITIALIZED</promise> when complete.
