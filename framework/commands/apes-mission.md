---
description: Create, list, show, transition, and update missions (the atomic unit of work)
---

# Mission Command

Single entry point for all mission operations. Before doing anything, load
the missions skill — it owns the canonical format, state machine, dependency
rules, and workpad conventions:

```
Read .claude/skills/missions.md
```

The command body below summarizes the FSM and ID-allocation rules so each
subcommand can act without re-reading the skill mid-flight, but the skill
remains authoritative if anything here looks inconsistent.

## Subcommands

```
/apes-mission new     "<title>" [--phase <id>] [--priority N] [--depends-on M-XXXX] [--label <label>]
/apes-mission list    [--state <state>] [--phase <id>] [--label <label>]
/apes-mission show    <M-NNNN>
/apes-mission move    <M-NNNN> <new-state>
/apes-mission workpad <M-NNNN> "<note>"
```

Parse `$ARGUMENTS`: the first whitespace-delimited token is the subcommand.
The rest is the subcommand's argv. Multi-word values (titles, notes) come
quoted; preserve quoting when shelling out.

If no subcommand is given, print this usage block and stop.

---

## `new` — create a mission

```
/apes-mission new "<title>" [--phase <id>] [--priority N] [--depends-on M-XXXX] [--label <label>]
```

Steps:

1. **Allocate the next ID.** Scan every `.planning/missions/<state>/` for
   files matching `M-NNNN-*.md`, parse the `NNNN`, take `max + 1`. If no
   missions exist, start at `M-0001`. Pad to four digits.

   ```bash
   NEXT=$(node -e '
     const fs = require("fs"), path = require("path");
     const states = ["todo","doing","review","done","canceled"];
     let max = 0;
     for (const s of states) {
       const dir = path.join(".planning/missions", s);
       if (!fs.existsSync(dir)) continue;
       for (const f of fs.readdirSync(dir)) {
         const m = f.match(/^M-(\d{4})-/);
         if (m) max = Math.max(max, parseInt(m[1], 10));
       }
     }
     console.log("M-" + String(max + 1).padStart(4, "0"));
   ')
   ```

2. **Build the slug** from the title: lowercase, ASCII only, non-word
   sequences → `-`, trim leading/trailing `-`, cap at 60 chars. Result
   becomes the filename suffix and the default branch slug.
3. **Copy the template** from `framework/templates/mission-template.md`
   (or `docs/templates/mission-template.md` after `npx dos-apes` install).
4. **Substitute frontmatter values.** Use Edit, not sed, so the template
   structure is preserved:
   - `id` ← allocated ID
   - `title` ← `$1`
   - `state` ← `todo`
   - `created` ← today (`new Date().toISOString().slice(0,10)`)
   - `updated` ← today
   - `priority` ← `--priority` value or remove (defaults to 3)
   - `phase` ← `--phase` value or remove
   - `depends_on` ← `[M-XXXX]` repeated for each `--depends-on` flag, or remove
   - `labels` ← list from `--label` flags, or remove
   - `workspace.branch` ← `feat/m-NNNN-<slug>`
   - `workspace.worktree` ← `.worktrees/M-NNNN`
   Leave `acceptance` and `verification.required_levels` for the human/agent
   to fill in — empty arrays are fine; they will be populated before the
   first state transition.
5. **Write to** `.planning/missions/todo/M-NNNN-<slug>.md`.
6. **Print** the created path and remind the user to fill in acceptance
   criteria and required verification levels before moving to `doing`.

Examples:

```
/apes-mission new "Add POST /todos endpoint"
/apes-mission new "Fix session refresh race" --priority 1 --label backend
/apes-mission new "Migrate auth to JWT" --phase q2-foundation --depends-on M-0007 --depends-on M-0012
```

---

## `list` — list missions with filters

```
/apes-mission list [--state <state>] [--phase <id>] [--label <label>]
```

Default behavior (no filters): list every mission grouped by state in this
order — `doing`, `review`, `todo`, `done`, `canceled` — with one line per
mission: `<id>  <state>  <priority>  <title>`.

With `--state X`: only that state. With `--phase X` or `--label X`: filter
across all states by frontmatter match. Multiple filters are AND-combined.

Within a group, sort by `priority` ascending (1 first), then `created`
ascending.

Implementation: a small Node one-liner that reads each mission file,
extracts the relevant frontmatter scalars and arrays via regex, applies
filters, and prints. (For deeper queries, recommend the user pipe to
`/apes-status` instead.)

---

## `show` — display a mission

```
/apes-mission show <M-NNNN>
```

Find the mission file across all five state directories and `cat` it. If
multiple matches exist (should not happen — IDs are unique), print all and
flag the duplication as a bug.

```bash
find .planning/missions -name "$ID-*.md" -print -exec cat {} \;
```

If the mission has a per-mission directory at `.planning/missions/<state>/<id>/`,
list its contents (verification log, screenshots, evidence packet) so the
reader sees the full record.

---

## `move` — transition state

```
/apes-mission move <M-NNNN> <new-state>
```

`<new-state>` ∈ `{todo, doing, review, done, canceled}`. The transition is
performed by `git mv` between state directories. The frontmatter `state`
field and `updated` field MUST be updated in the same commit.

### Allowed transitions

| From    | To       | Notes                                                          |
|---------|----------|----------------------------------------------------------------|
| todo    | doing    | Start work                                                     |
| doing   | review   | Submit for review                                              |
| review  | done     | Approved                                                       |
| review  | doing    | Rejected revision (only valid rejection target)                |
| any     | canceled | Abandon (workpad must record reason)                           |

No other transitions exist. In particular: `done` is terminal, and you
cannot skip `review`.

### Preconditions

Validate before performing the `git mv`. If any check fails, exit non-zero
with a clear message and do NOT touch the filesystem.

**`todo` → `doing`:**
- Every ID in `depends_on` must be in `.planning/missions/done/`. List any
  unmet dependencies and refuse.
- A workspace can be created via `node scripts/mission-worktree.js create <id>`
  (do this in the same operation; see `.claude/skills/worktrees.md`).

**`doing` → `review`:**
- Every level in `verification.required_levels` must have a `pass` entry as
  the latest record in `.planning/missions/doing/<id>/verification.jsonl`.
  Use the same logic as `evidence-packet.js`: read the JSONL, take the
  latest entry per level, require all required levels to be `pass`.
- An evidence packet at `.planning/missions/review/<id>/evidence/summary.md`
  is expected. If missing, prompt the user to run `/apes-evidence <id>`
  first; do not perform the transition without one.

**`review` → `done`:**
- Evidence packet must exist at
  `.planning/missions/review/<id>/evidence/summary.md`.
- All acceptance criteria in frontmatter should appear as `- [x]` lines in
  the workpad. Warn loudly on any unchecked criterion but allow the
  transition (a human reviewer is signing off; the warning is for them).

**`review` → `doing` (rejected revision):**
- Always allowed.
- Append a workpad entry recording the rejection reason before the move.

**Any state → `canceled`:**
- Forbidden from `done` (done is terminal — write a follow-up mission
  instead).
- Append a workpad entry with the cancellation reason and date before the
  move.

### Performing the move

After validation:

```bash
SRC=".planning/missions/<from>/<id>-<slug>.md"
DST=".planning/missions/<to>/<id>-<slug>.md"
git mv "$SRC" "$DST"
```

Also `git mv` the per-mission directory if it exists:

```bash
if [ -d ".planning/missions/<from>/<id>" ]; then
  git mv ".planning/missions/<from>/<id>" ".planning/missions/<to>/<id>"
fi
```

Then update the frontmatter:
- `state: <new-state>`
- `updated: <today>`

Commit the move + frontmatter edit together:

```bash
git commit -m "mission(<id>): <from> → <to>"
```

Print a summary: old path, new path, commit SHA.

---

## `workpad` — append a workpad entry

```
/apes-mission workpad <M-NNNN> "<note>"
```

Append to the `## Workpad` section of the mission file. Format:

```
### YYYY-MM-DD HH:MM — <agent-role>
- <note line 1>
- <note line 2>
```

Rules (from `.claude/skills/missions.md`):

- Append only — never edit or delete prior entries.
- Use 24-hour UTC time.
- One block per `workpad` invocation. If the agent has multiple things to
  record, pass them as a multi-line note (newlines preserved).

Steps:

1. Find the mission file across all states.
2. Read it; locate the `## Workpad` heading.
3. After the heading and any existing entries (i.e., at end of file), append
   the new block.
4. Bump the `updated` frontmatter field to today.
5. Commit the change with `mission(<id>): workpad`.

If `<agent-role>` is not obvious from context, use `agent`. The skill
documents conventional roles: `architect`, `builder`, `tester`, `reviewer`,
`debugger`.

---

## Examples — full lifecycle

```
# 1. Create a new mission in todo/
/apes-mission new "Add POST /todos endpoint" --priority 2 --label backend

# 2. List what's in flight
/apes-mission list --state doing

# 3. Inspect a specific mission
/apes-mission show M-0001

# 4. Start work — transitions todo → doing and creates the worktree
/apes-mission move M-0001 doing

# 5. Record progress mid-implementation
/apes-mission workpad M-0001 "Scaffolded route in src/routes/todos.ts; validation via Zod"

# 6. After tests pass and evidence packet is generated, submit for review
/apes-evidence M-0001
/apes-mission move M-0001 review

# 7. Approve and land
/apes-mission move M-0001 done

# OR — reject and send back
/apes-mission workpad M-0001 "Rejected: validation handler missing 400 response for empty body"
/apes-mission move M-0001 doing
```

## Notes

- All filesystem changes go through `git mv` / `git commit` so the audit
  trail is reconstructable from `git log --follow` on a mission's path.
- Never modify `id` after creation. If a title needs a substantive change,
  the slug (and thus the filename) may change — update both the file name
  via `git mv` and the `title` frontmatter, but `id` stays.
- For dependency cycles or other graph-level questions, prefer reading the
  full set with `list` and inspecting visually; this command does not ship
  a graph solver.
