---
audience: claude-desktop
purpose: Guides Claude Desktop through interviewing a user about adding a feature to an existing Dos Apes project and producing a single well-formed mission file.
---

# Authoring feature missions

*This guide is one of three workflow sub-guides under [dos-apes-authoring.md](./dos-apes-authoring.md).*

## When this guide applies

The user wants to add a feature to an existing project that already has Dos Apes installed. Not for new projects (that's the PRD workflow — load `authoring-prd-missions.md` instead). Not for fixing a defect in existing behavior (that's the bugfix workflow — load `authoring-bugfix-missions.md`).

A feature mission is a single, atomic unit of work that adds a user-facing capability, an internal capability that supports a future user-facing one, or a non-trivial integration. It produces one mission file in `.planning/missions/todo/` and one resulting branch + PR in Claude Code.

## Core principle

Same as the PRD workflow: the artifact (a mission file) describes *what to build and why*, not *how to build it*. The user often arrives wanting to talk about libraries and patterns. Redirect those toward acceptance criteria — what does done look like, and what proves it?

Brownfield work has an additional principle: respect the existing codebase. The implementer will follow existing conventions, file layouts, and patterns. The mission's job is to define what's being added, not to dictate implementation against existing patterns. If a constraint matters — "must reuse the existing session middleware" — record it as a constraint. If a choice is the implementer's to make — "we'll use bcrypt for password hashing" — leave it out.

## The interview

The interview is a real conversation, not a checklist. By the time you write the mission, you should have substantive answers to all six questions. If you don't, ask.

### What's the goal?

A specific user-facing change, stated as a capability. "Add the ability to export a project as JSON so users can move data to other tools." Not "improve the export feature." If the user can't state the change as something a user can do that they couldn't do before, the goal isn't concrete enough yet.

### What's the smallest version that's still useful?

Brownfield feature scope creep is the killer. Push for the minimum that delivers value. "Single project export, JSON only, no compression, no scheduling" — clean MVP. "Export with format options, scheduled exports, S3 destination" — three missions, not one.

### What files are likely affected?

The user often knows. If they don't, that's a signal that they should run `/apes-map` in Claude Code first to analyze the codebase, then come back. The mission can then reference specific files in the Implementation notes section, which gives the implementer a starting point and prevents wandering.

### What dependencies exist?

Are there prior missions this depends on (the `depends_on` frontmatter field)? Are there existing features whose behavior this mission changes? Both belong in the mission — depends_on as frontmatter, behavior changes as Context.

### What does done look like?

Specific, observable acceptance criteria. Push hard on testability. "User can click Export, receive a JSON file containing all their projects" is testable. "Export feature works well" is not. Each acceptance criterion should be something a reviewer can run or observe and answer yes/no on.

### What's explicitly out of scope?

Features that sound related but aren't part of this mission. Critical for brownfield because surrounding code suggests expansions ("while we're touching the export, why not add CSV?"). Without explicit out-of-scope items, the implementer guesses, and the user is unhappy with what they get.

## Pushback patterns

### "Just like X but for our app"

Useful for inspiration, dangerous as spec. Ask which specific behaviors of X they want and which they don't. "Notion-style block editor" is not a mission; "users can drag to reorder paragraphs and turn a paragraph into a bullet by typing `-` at the start of a line" is.

### "Refactor while we're in there"

Feature missions and refactor missions are separate. If the user wants to refactor adjacent code while adding the feature, that's scope creep. Capture it as a follow-up mission and remove it from this one. The reviewer will appreciate a focused diff; mixing feature work with refactor work makes both harder to review.

### Vague acceptance criteria

Same pattern as PRD authoring. "Auth works." "Export is fast." "The UI is clean." These are hopes, not criteria. Push for specifics: "Users can sign in with email and Google OAuth." "Export of 10k records completes in under 5 seconds." "All form fields show validation errors inline within 200ms of blur."

### Implementation in the mission body

The user often wants to write "we'll use library X" in the mission body. Redirect: implementation is the implementer's call. The mission body is for *constraints* the implementer must respect, not *choices* the implementer would otherwise make. "Must work with existing session middleware" is a constraint. "Use jsonwebtoken specifically" is a choice — leave it out unless it's load-bearing.

### Mission too big

If the acceptance criteria list grows past 5–6 items, the mission probably should be 2 missions. Suggest splitting. A mission that takes 5 days of agent work and touches 30 files is harder to review than 3 missions that take 1.5 days each. Smaller missions also unblock parallel work.

## Producing the mission file

Run from the project root, in Claude Code:

```
/apes-mission new "<title>" [--phase <id>] [--priority N] [--depends-on M-NNNN] [--label <label>]
```

This allocates the next mission ID, generates the slug, writes the file to `.planning/missions/todo/`, and sets default workspace fields. If the user prefers the underlying CLI (e.g., for scripting), the equivalent is `node scripts/mission-cli.js create --title "<title>" [flags]`.

Then populate the body sections by editing the file directly. The four standard sections are Context, Implementation notes, Out of scope, and Workpad. Only the Workpad section has a CLI helper (`/apes-mission workpad <id> "<note>"`); the others are plain file edits.

Here's what good body sections look like for a feature mission titled "Add Stripe checkout for monthly subscription tier":

```markdown
## Context
The app currently has user accounts but no billing integration. Subscription tier work depends on this mission landing first. The PaymentMethod model already exists from M-0023 (account creation work) and should be reused.

## Implementation notes
Stripe Checkout (hosted) is preferred over Stripe Elements (custom UI) for this MVP — keeps PCI surface area minimal. Webhook endpoint must reuse the existing webhook router from `src/webhooks/`. New env vars: STRIPE_PUBLIC_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.

## Out of scope
- Annual billing tier (separate mission)
- Failed payment retry logic (separate mission)
- Admin dashboard for payment management (separate mission)
- Refund flow (separate mission)

## Workpad
<!-- Updated by agent during execution. Append timestamped entries; do not delete prior entries. -->
```

The Context section answers "why does this exist and what comes before it." The Implementation notes section captures load-bearing constraints (preferences, integration points, env vars) without dictating choices the implementer should make. The Out of scope section explicitly excludes adjacent work that the surrounding code might tempt the implementer toward.

## Frontmatter to set explicitly

Beyond the fields the CLI auto-populates (`id`, `title`, `state`, `created`, `updated`, `workspace`, `schema_version`), set these as appropriate:

- **`priority`** — integer 1–5; 1 is highest. Default to 3 unless the mission is foundational (use 2) or genuinely urgent (use 1).
- **`phase`** — phase ID from `ROADMAP.md` if the project uses phases. Optional.
- **`depends_on`** — list of mission IDs that must be in `done/` before this one can transition out of `todo`. Be honest about real dependencies; over-declaring blocks parallel work, under-declaring causes broken builds.
- **`labels`** — free-form tags for filtering. Lowercase, kebab-case.
- **`acceptance`** — the testable criteria from the interview. One entry per criterion; each entry is a single sentence.
- **`verification.required_levels`** — gates the mission must pass before review → done. Sensible defaults: `[L0, L1, L2, L3]` for most features. Add `L5` for security-relevant features (auth, payments, anything that touches user data). Add `L6` and `L7` for UI-affecting features.

The full schema (every field, every constraint) lives at `.claude/skills/missions.md` in the user's framework install. Don't try to memorize it; cross-reference when needed.

## Anti-patterns to avoid

**Skipping the "out of scope" question.** Brownfield missions drift more than greenfield because surrounding code suggests expansions. Without explicit out-of-scope items, the implementer guesses, and the user is unhappy with what they get.

**Writing missions that span multiple unrelated changes.** "Add OAuth and refactor the user model" is two missions. Split them. The acceptance-criteria-count test (above) catches most of these; trust it.

**Filing the mission without verifying the dependency graph.** After creation, run `node scripts/mission-cli.js deps <id>` to confirm declared dependencies are real, reachable, and don't form a cycle. The CLI returns `{ id, unmet, cycle }` — `unmet` should be empty for missions that can start now; `cycle` should always be empty.

## When you're done

The handoff to Claude Code:

1. The mission file exists in `.planning/missions/todo/` with valid frontmatter (CLI validates on creation; subsequent edits should be re-validated by reading the file back, or by `/apes-mission show <id>`).
2. `node scripts/mission-cli.js deps <id>` returns no unmet deps and no cycles.
3. The user runs `/apes-build --mission <id>` in Claude Code.

Your job is done. If the user comes back wanting to expand scope mid-execution, capture the additions as a follow-up mission rather than amending the in-flight one. Mid-flight scope changes invalidate the agent team's plan and produce worse output than a clean second mission.
