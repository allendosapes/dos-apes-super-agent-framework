# Phase [XX] Plan [NN]: [Plan Name]

> Dos Apes executable plan. This is a prompt, not a document.

---

phase: XX-phase-name
plan: NN
type: execute
wave: N # Execution wave (1, 2, 3...). Pre-computed at plan time.
depends_on: [] # Plan IDs this plan requires (e.g., ["01-01"])
files_modified: [] # Files this plan modifies
autonomous: true # false if plan has checkpoints
gate: G4 # Quality gate this plan works toward

---

<objective>
**What:** [What this plan accomplishes]

**Why:** [Why this matters for the product]

**Output:** [Concrete deliverables]
</objective>

<execution_context>
@.claude/ORCHESTRATOR.md
@.claude/agents/[relevant-agent].md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

<!-- Only include prior SUMMARYs if genuinely needed -->
<!-- @.planning/phases/XX-name/XX-YY-SUMMARY.md -->

<!-- Include source files needed for context -->
<!-- @src/relevant/file.ts -->
</context>

<tasks>

<task type="auto">
  <name>Task 1: [Action-oriented name]</name>
  <files>
    - Create: `path/to/new/file.ts`
    - Modify: `path/to/existing/file.ts`
  </files>
  <action>
    [Specific implementation instructions]

    Technology: [what to use]
    Pattern: [how to structure]
    Avoid: [what NOT to do and WHY]

  </action>
  <verify>
    ```bash
    npm run typecheck
    npm test -- [test-file]
    ```
  </verify>
  <done>
    - [ ] [Measurable criterion 1]
    - [ ] [Measurable criterion 2]
  </done>
</task>

<task type="auto">
  <name>Task 2: [Action-oriented name]</name>
  <files>
    - Create: `path/to/file.tsx`
    - Modify: `path/to/App.tsx` (integration)
  </files>
  <action>
    [Specific implementation instructions]
  </action>
  <verify>
    ```bash
    npm run build
    # UI Integration check:
    grep -rn "[ComponentName]" src/ --include="*.tsx" | grep -v "src/components/[ComponentName]"
    ```
  </verify>
  <done>
    - [ ] Component created and exported
    - [ ] Integrated into page/route
    - [ ] Build passes
  </done>
</task>

<!-- OPTIONAL: Checkpoint task for human verification -->
<!--
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>[What Claude automated]</what-built>
  <how-to-verify>
    1. Run: npm run dev
    2. Visit: http://localhost:3000/[route]
    3. Verify: [What to check]
    4. Check: [Another verification point]
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>
-->

<!-- OPTIONAL: Decision checkpoint -->
<!--
<task type="checkpoint:decision" gate="blocking">
  <decision>[What needs deciding]</decision>
  <context>[Why this matters]</context>
  <options>
    <option id="option-a"><name>[Name]</name><pros>[pros]</pros><cons>[cons]</cons></option>
    <option id="option-b"><name>[Name]</name><pros>[pros]</pros><cons>[cons]</cons></option>
  </options>
  <resume-signal>[How to indicate choice]</resume-signal>
</task>
-->

</tasks>

<verification>
Before declaring plan complete:

- [ ] `npm run build` succeeds without errors
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes all tests
- [ ] All new UI components integrated (not just created)
- [ ] All new routes accessible and navigable
      </verification>

<success_criteria>

- All tasks completed
- All verification checks pass
- No errors or warnings introduced
- [Feature-specific criterion]
- [Feature-specific criterion]
  </success_criteria>

<output>
After completion, create `.planning/phases/XX-phase-name/XX-NN-SUMMARY.md` using the summary template.

Include:

- Frontmatter with dependency graph
- Performance metrics
- Task commits
- Deviations (if any)
- Issues encountered (if any)
  </output>

---

## Task Sizing Guide

**Good task size:** 15-60 minutes of Claude work.

| Too Small            | Just Right                     | Too Big                    |
| -------------------- | ------------------------------ | -------------------------- |
| Add import statement | Create login endpoint with JWT | Implement full auth system |
| Fix typo             | Add form validation with Zod   | Build entire feature       |
| Update config value  | Create API route with tests    | Refactor entire codebase   |

**Max tasks per plan:** 2-3 (to stay in peak context quality zone)

## Task Types

| Type                      | Use When                     | Claude Does                                          |
| ------------------------- | ---------------------------- | ---------------------------------------------------- |
| `auto`                    | Default - Claude can do it   | Executes autonomously                                |
| `checkpoint:human-verify` | Visual/UX check needed       | Builds, stops, waits for approval                    |
| `checkpoint:decision`     | Implementation choice needed | Presents options, waits for decision                 |
| `checkpoint:human-action` | RARE - No CLI/API exists     | Automates everything possible, stops for manual step |

---

_Managed by [Dos Apes Super Agent Framework](https://github.com/dos-apes/dos-apes)_
