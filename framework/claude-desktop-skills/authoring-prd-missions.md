---
audience: claude-desktop
purpose: Guides Claude Desktop through interviewing a user about a new project and producing a well-formed PRD plus Phase 1 mission stubs.
---

# Authoring PRD missions

*This guide is one of three workflow sub-guides under [dos-apes-authoring.md](./dos-apes-authoring.md).*

This guide applies when the user wants to build something new from scratch — a fresh app, a new service, a meaningful greenfield effort. They've come to Claude Desktop to think it through before any code gets written.

This guide teaches you how to interview the user and produce two artifacts:

1. A PRD document (`PRD.md`) that captures the product
2. A set of phase-aligned mission stubs in `.planning/missions/todo/` that Claude Code will execute against

These artifacts are the input to Dos Apes. Your job ends when they're written; Claude Code's job begins when the user runs `/apes-build --prd PRD.md` or `/apes-build --mission M-0001`.

---

## Core principle

A PRD is a description of *what to build and why* — not a description of *how to build it*. The user often arrives wanting to talk about implementation ("we'll use Postgres and Redis"). Redirect those conversations toward user-facing capabilities ("when a user submits the form, what should happen?"). Implementation belongs in mission acceptance criteria and in code, not in the PRD.

You are also not a yes-and partner here. PRDs fail in two characteristic ways: too vague to execute against, or too prescriptive to leave room for engineering judgment. Push back on both. The user will appreciate it once they see the result.

---

## The interview

The interview is a real conversation, not a checklist run-through. By the time you produce the PRD, however, you should have substantive answers to all of the following. If you don't, ask.

### Who is this for?

Not "developers" or "small businesses." A specific person doing a specific thing. "Solo freelance designers tracking time across 3-8 active clients." "Engineering managers at 50-200 person companies who run weekly 1:1s." If the user can't name a specific person, the product probably doesn't have a clear user yet — surface that and offer to help them narrow it.

### What problem does it solve?

What is this person doing today, and why is it bad? "They use a spreadsheet and it's clunky" is a starting point but not enough. *What specifically* is clunky? *What does the friction cost them?* The answer here determines what the product actually needs to do.

### What does success look like for them?

Not metrics for the business — outcomes for the user. "They stop missing deadlines." "They can answer 'how am I doing this quarter?' in under 30 seconds." "They never have to copy data between two tools again." This anchors the rest of the PRD.

### What's the smallest version that's still useful?

Most users overscope their MVP. Ask: if you could only ship three features, which three? What's the one user flow that has to work for this to be worth shipping at all? Push hard here — every feature the MVP doesn't include is a feature you can build faster.

### What's explicitly out of scope?

This is as important as what's in scope. "No mobile app." "No team collaboration." "No analytics dashboard." "No payment integration." Out-of-scope items prevent the implementation from drifting and signal to Claude Code that it shouldn't propose adding them.

### What constraints exist?

Tech stack the user already knows or has chosen. Deploy target (cloud provider, on-prem, desktop app, mobile). Existing systems it has to integrate with. Compliance requirements. Budget for paid services. Timeline pressure. These constraints shape what's buildable and how.

### What does "done" mean for the MVP?

Specific, observable conditions. "User can sign up, create their first project, and complete a task." "Three test users can use it without help and accomplish their goal." "It deploys to production and serves 10 concurrent users without errors." If the user can't articulate done, you don't have an MVP — you have a vague aspiration.

---

## Pushback patterns

These are the most common things you'll need to push back on. Don't be combative — be the friend who tells them their fly is down before the meeting.

### "Make it scalable"

Translate to specifics or mark as a non-requirement. "Do you mean it should handle 10,000 users on day one, or that the architecture should not preclude scaling later?" The first is a real requirement (and probably wrong for an MVP). The second is just good engineering and doesn't belong in the PRD.

### "Use the latest tech"

Ask why. Often the answer is "because it sounds good." A boring tech stack the user already knows is almost always the right choice for an MVP. Surface this gently: "You mentioned you've used Next.js before. Is there a reason you're considering something different here?"

### "Like [popular product] but for [niche]"

Useful as inspiration, dangerous as a spec. The user often hasn't done the work of figuring out what specifically from the inspiration they want. Ask: "Which three features of [product] are essential? Which ones do you specifically NOT want?" The answers reveal whether they've thought about it.

### Premature database schemas, API designs, or component hierarchies

If the user starts dictating implementation details ("we'll have a users table, a projects table, and a tasks table"), redirect: "Let's nail down the user-facing capabilities first. The database structure will fall out of those naturally once Claude Code starts implementing." Implementation specificity in a PRD is a leash that prevents the implementer from making good decisions.

### Vague acceptance criteria

"It should be fast." "The UI should be intuitive." "Users should love it." These aren't acceptance criteria; they're hopes. Push for specifics: "Fast in what sense? Page loads under 2 seconds? Search returns under 500ms? Be concrete enough that we'd know if we missed it."

### Scope expansion mid-conversation

Users will add features as they talk. Catch this: "That's a great idea — should we add it to the MVP or capture it as a future enhancement?" Most of the time, it's the latter.

---

## Phase breakdown

After the interview, before writing the PRD, propose a phase breakdown. Dos Apes builds in phases, and a PRD that maps cleanly to phases produces better missions.

A typical breakdown for a small-to-medium MVP:

- **Phase 1 — Foundation.** Project setup, auth, the data model's core entities, the simplest possible deploy.
- **Phase 2 — Core flows.** The two or three user flows that *are* the product. Without these, there's no MVP.
- **Phase 3 — Polish.** The rough edges that prevent shipping. Error handling, empty states, basic UX, deploy to production.

Larger products may have more phases. Smaller may collapse into two. What matters is each phase has a clear deliverable, each phase can be built and verified independently, and phases stack such that abandoning the project after Phase N still leaves Phase N usable.

Run the phase breakdown by the user before writing the PRD. They'll often realize Phase 2 has too much in it, or that something they thought was Phase 3 actually has to be in Phase 1.

---

## Producing the PRD

Once the interview and phase breakdown are agreed, write `PRD.md` at the project root. Use this structure:

```markdown
# [Product Name] — PRD

## Vision
[One paragraph. The product in plain English: who it's for, what it does, why it matters.]

## Target user
[A specific person doing a specific thing. Optionally, a paragraph describing their day and where this product fits in.]

## Problem
[What's broken about the user's current situation. Concrete. Costs and frictions described in the user's terms, not the product's.]

## Success criteria
[Observable user outcomes. Not business metrics.]

## In scope (MVP)
[The features that make this an MVP. Each as a one-liner. If you have more than ~7, the MVP is too big.]

## Explicitly out of scope
[Features and concerns that are NOT part of the MVP. As important as the in-scope list.]

## Constraints
- **Tech stack:** [what's chosen and why, or "implementer's choice with these guardrails:"]
- **Deploy target:** [where it runs]
- **Integrations:** [what it has to talk to]
- **Compliance / regulatory:** [if any]
- **Timeline:** [if there's real pressure]

## Phases

### Phase 1 — Foundation
**Deliverable:** [What exists at the end of Phase 1]
**Missions:**
- M-0001: [Title]
- M-0002: [Title]
- ...

### Phase 2 — Core flows
**Deliverable:** [What exists at the end of Phase 2]
**Missions:**
- M-0010: [Title]
- ...

### Phase 3 — Polish
**Deliverable:** [What exists at the end of Phase 3]
**Missions:**
- M-0020: [Title]
- ...

## Open questions
[Things the user wasn't sure about. Captured here so they get answered before implementation starts, not assumed away.]
```

Keep the PRD short. A good MVP PRD fits in 2-3 pages. If yours is longer, you've probably included implementation details that don't belong here, or scoped too much for an MVP.

---

## Producing the mission stubs

After the PRD, create the mission stubs in `.planning/missions/todo/`. One file per mission, named `M-NNNN-<slug>.md`.

Each mission stub uses the standard mission frontmatter schema (see `.claude/skills/missions.md` in the user's framework install for the canonical reference). At minimum:

```markdown
---
id: M-0001
title: Project scaffolding and CI
state: todo
priority: 2
created: <today as ISO date>
updated: <today as ISO date>
phase: phase-1-foundation
depends_on: []
labels: [foundation]
acceptance:
  - npm install completes without errors
  - npm test runs (even if tests are placeholders)
  - GitHub Actions runs on push
verification:
  required_levels: [L0, L1, L2]
schema_version: 2
---

## Context
[Why this mission exists, what came before, any constraints from the PRD that apply specifically.]

## Implementation notes
[Any tech choices from the PRD that apply, but no prescriptive implementation. The implementer will decide.]

## Out of scope
[What this mission explicitly does NOT do. Useful when the title might suggest more.]

## Workpad
<!-- Updated by agent during execution. Append timestamped entries; do not delete prior entries. -->
```

Don't try to write every mission for every phase before any code is written. Write Phase 1 in detail, sketch Phase 2 with one-line stubs, leave Phase 3 mostly empty. The shape of Phase 1's outputs will inform Phase 2's design — write the later phases properly when you get there.

---

## Anti-patterns to avoid

**Writing the PRD without doing the interview.** Tempting because it's faster. Produces PRDs that read well but don't survive contact with implementation. The interview is the work; the document is just the artifact.

**Adding implementation details to the PRD.** "We'll use JWT for auth." That's a Phase 1 mission decision, not a PRD decision. The PRD says "users can sign in"; the mission says "implement JWT-based auth."

**Letting the user dictate the phase breakdown without pushback.** Users almost always overscope Phase 1. Push back if Phase 1 contains anything that isn't foundational — auth, data model core, deploy. Features go in Phase 2.

**Producing a 12-page PRD for a weekend project.** PRD weight should match project weight. A weekend tool needs maybe a one-page PRD. A funded startup MVP needs more, but still rarely more than 3-4 pages.

**Skipping "out of scope."** This is the section users want to skip and is often the most valuable. Without explicit out-of-scope items, the implementer will make scope decisions based on guesses, and the user will be unhappy with what they get.

**Writing all the mission stubs upfront in detail.** Just write Phase 1 in detail and sketch the rest. The early missions will teach you what the later ones need to look like.

---

## When you're done

The handoff to Claude Code looks like:

1. `PRD.md` exists at the project root and the user has read it and approved it.
2. `.planning/missions/todo/` contains one detailed mission per Phase 1 task and one-line stubs for later phases.
3. The user has run `npx dos-apes-super-agent` if Dos Apes isn't already installed in this project.
4. The user runs `/apes-build --prd PRD.md` or works through Phase 1 mission-by-mission with `/apes-build --mission M-0001`.

Your job is done. If the user comes back with questions about implementation details or wants to add scope, redirect them: PRD changes happen here in Claude Desktop; mission execution happens in Claude Code; conflate them and bad things happen.
