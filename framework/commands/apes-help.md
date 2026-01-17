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

*We ain't monkeying around with code!*

---

## 🚀 FULL AUTONOMOUS BUILD

The main event. Feed it a PRD, walk away:

```bash
/apes-build --prd requirements.md --ralph
```

This will:
1. Parse your PRD → Create PROJECT.md, ROADMAP.md
2. Plan phases → Break into tasks
3. Execute with agent handoffs → Backend, Frontend, QA, etc.
4. Git workflow → Branch per phase, squash merge to main
5. Verify everything → Build, types, lint, tests, UI integration
6. Iterate until complete → Ralph loop handles failures
7. Ship → `<promise>PRODUCT_COMPLETE</promise>`

---

## Commands

### 🏗️ Build Commands

| Command | Purpose |
|---------|---------|
| `/apes-build` | **Full autonomous build from PRD to shipped product** |
| `/apes-init` | Initialize project from PRD (without auto-execute) |
| `/apes-plan [phase]` | Create detailed task plan for a phase |
| `/apes-execute [phase]` | Execute phase with agent orchestration |

### 🔧 Brownfield Commands

| Command | Purpose |
|---------|---------|
| `/apes-map` | Analyze existing codebase |
| `/apes-feature "desc"` | Add feature to existing project |
| `/apes-fix "desc"` | Fix a bug |
| `/apes-refactor "desc"` | Refactor existing code |

### 📊 State Commands

| Command | Purpose |
|---------|---------|
| `/apes-status` | Show current position |
| `/apes-verify` | Run full verification suite |
| `/apes-resume` | Continue from last position |
| `/apes-handoff` | Create handoff for session break |

---

## Flags

| Flag | Effect |
|------|--------|
| `--ralph` | Enable autonomous loop until complete |
| `--max-iterations N` | Limit iterations (default: 50, build: 500) |
| `--parallel` | Use git worktrees for parallel execution |
| `--prd [file]` | Path to PRD document |
| `--idea "[text]"` | Describe what to build |

---

## Autonomy Levels

| Level | Command | Human Involvement |
|-------|---------|-------------------|
| **Task** | `/apes-execute --task 1` | Review each task |
| **Phase** | `/apes-execute 1 --ralph` | Review each phase |
| **Product** | `/apes-build --ralph` | Review final product |

---

## Agents

Work is delegated to specialized agents:

| Agent | Handles |
|-------|---------|
| **Orchestrator** | Git, state, coordination |
| **Backend Developer** | APIs, services, database |
| **Frontend Developer** | Components, UI integration |
| **QA Engineer** | Testing, verification |
| **DevOps Engineer** | CI/CD, deployment |
| **Technical Architect** | Design, data models |
| **Security Engineer** | Auth, security review |

---

## Git Workflow

- **Phase start:** Branch from main
- **During phase:** Commit per task
- **Phase complete:** Squash merge to main
- **Parallel work:** Git worktrees

---

## Examples

### Build New Product
```bash
/apes-build --prd ./docs/requirements.md --ralph --max-iterations 500
```

### Add Feature to Existing
```bash
/apes-map
/apes-feature "Add dark mode with system preference detection"
/apes-execute --ralph
```

### Fix a Bug
```bash
/apes-fix "Login fails with special characters in email"
```

### Continue After Break
```bash
/apes-resume
```

---

## Documentation

- `ORCHESTRATOR.md` - Core orchestration engine
- `agents/*.md` - Agent definitions
- `commands/*.md` - Command details

Full docs: https://github.com/dos-apes/dos-apes

---

🦍🦍 *Dos Apes: We ain't monkeying around with code!*
