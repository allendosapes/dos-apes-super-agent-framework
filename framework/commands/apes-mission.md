---
description: Create, list, show, transition, and update missions (the atomic unit of work)
allowed-tools: Read, Grep, Glob, Bash(node scripts/mission-cli.js:*), Bash(node scripts/evidence-packet.js:*), Bash(node scripts/mission-worktree.js:*), Bash(git commit:*)
---

# Mission Command

Single entry point for all mission operations. Every subcommand below shells
out to `scripts/mission-cli.js` — a thin wrapper around the `MissionTracker`
library at `lib/mission-tracker.js`. The CLI owns the FSM, schema validation,
ID generation, dependency resolution, and workpad format. **Do not
re-implement any of that in prose.** If something is missing, extend the CLI.

For the lifecycle rules, frontmatter spec, and workpad protocol, load the
authoritative skill once at the top of the session:

```
Read .claude/skills/missions.md
```

## CLI reference

```
node scripts/mission-cli.js create     --title "<title>" [--priority N] [--phase ID] [--depends-on M-XXXX]... [--label X]...
node scripts/mission-cli.js list       [--state <state>]
node scripts/mission-cli.js show       <M-NNNN>
node scripts/mission-cli.js move       <M-NNNN> <new-state>
node scripts/mission-cli.js workpad    <M-NNNN> "<note>"
node scripts/mission-cli.js update     <M-NNNN> --field <key>=<value>
node scripts/mission-cli.js deps       <M-NNNN>
node scripts/mission-cli.js can-transition <M-NNNN> <new-state>
node scripts/mission-cli.js next-id
node scripts/mission-cli.js active
node scripts/mission-cli.js set-active <M-NNNN>
node scripts/mission-cli.js clear-active
```

Every verb prints a single JSON object to stdout on success. Errors go to
stderr (prefixed `mission-cli:`). Exit codes: `0` ok, `1` invalid input,
`2` mission not found, `3` state precondition failed.

## Subcommand surface

```
/apes-mission new     "<title>" [--phase <id>] [--priority N] [--depends-on M-XXXX] [--label <label>]
/apes-mission list    [--state <state>] [--phase <id>] [--label <label>]
/apes-mission show    <M-NNNN>
/apes-mission move    <M-NNNN> <new-state>
/apes-mission workpad <M-NNNN> "<note>"
```

Parse `$ARGUMENTS` as the subcommand name followed by its argv. Multi-word
values (titles, notes) come quoted; preserve the quoting when shelling out.

If no subcommand is given, print this usage block and stop.

---

## `new` — create a mission

```
/apes-mission new "<title>" [--phase <id>] [--priority N] [--depends-on M-XXXX] [--label <label>]
```

Forward every flag straight through to `mission-cli.js create`. The CLI
allocates the next ID, builds the slug, writes the file to `todo/`, and
sets `workspace.branch` and `workspace.worktree` to their defaults.

```bash
node scripts/mission-cli.js create \
  --title "$TITLE" \
  ${PRIORITY:+--priority $PRIORITY} \
  ${PHASE:+--phase $PHASE} \
  ${DEPENDS_ON:+--depends-on $DEPENDS_ON} \
  ${LABEL:+--label $LABEL}
```

(Repeat `--depends-on` and `--label` once per supplied value.)

The CLI prints `{"ok":true,"id":"M-NNNN","path":"..."}`. Surface the new
mission's ID and path to the user, and remind them to fill in
`acceptance` and `verification.required_levels` before transitioning to
`doing`.

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

The CLI handles `--state`. Phase and label filters are applied client-side
because the CLI is intentionally minimal there.

Default behavior (no filters):

```bash
node scripts/mission-cli.js list
```

Output is a JSON object `{ counts, missions: { todo: [...], doing: [...], ... } }`.
Render the missions grouped by state in the order `doing`, `review`,
`todo`, `done`, `canceled`, one line per mission: `<id>  <state>  <priority>  <title>`.

With `--state X`:

```bash
node scripts/mission-cli.js list --state "$STATE"
```

With `--phase X` or `--label X` (client-side filter):

```bash
node scripts/mission-cli.js list | node scripts/mission-filter.js --phase "$PHASE" --label "$LABEL"
```

Within a state, sort by `priority` ascending then `created` ascending. The
CLI's `list` already returns missions in priority/created order per state.

---

## `show` — display a mission

```
/apes-mission show <M-NNNN>
```

```bash
node scripts/mission-cli.js show "$ID"
```

The JSON includes `frontmatter`, `body`, `path`, and `state`. Pretty-print
the path and state, then echo the file contents (or render the JSON
verbatim) so the reader sees the full record.

If the mission has a per-mission directory at
`.planning/missions/<state>/<id>/`, list its contents — verification log,
screenshots, evidence packet — so the reader sees the full audit trail:

```bash
STATE=$(node scripts/mission-cli.js show "$ID" | node scripts/json-field.js state)
ls ".planning/missions/$STATE/$ID/" 2>/dev/null || true
```

---

## `move` — transition state

```
/apes-mission move <M-NNNN> <new-state>
```

The CLI enforces the FSM and writes the frontmatter `state` and `updated`
fields atomically with the file move. Allowed transitions:

| From    | To                     | Notes                                     |
|---------|------------------------|-------------------------------------------|
| todo    | doing, canceled        | Start work or abandon before starting     |
| doing   | review, canceled       | Submit for review or abandon mid-flight   |
| review  | done, doing, canceled  | Approve, reject (back to doing), abandon  |
| done    | (terminal)             | Done is immutable                         |
| canceled| (terminal)             | Canceled never reopens                    |

### Preconditions to check before invoking `move`

The CLI enforces FSM legality but **does not** validate semantic
preconditions. The command body is responsible for those:

**`todo` → `doing`:**

- Every entry in `depends_on` must be in `done/`. Use `deps`:
  ```bash
  UNMET=$(node scripts/mission-cli.js deps "$ID" | node scripts/json-field.js unmet)
  if [ -n "$UNMET" ]; then
    echo "blocked by: $UNMET" >&2
    exit 1
  fi
  ```
- Create the worktree:
  ```bash
  node scripts/mission-worktree.js create "$ID"
  ```

**`doing` → `review`:**

- Every level in `verification.required_levels` must have a `pass` entry
  as the latest record in the verification log. The evidence-packet
  generator enforces this when invoked, so prefer:
  ```bash
  node scripts/evidence-packet.js generate "$ID"
  ```
  Refusal here means the mission is not ready.

**`review` → `done`:**

- Evidence packet must exist at
  `.planning/missions/review/$ID/evidence/summary.md`.
- Acceptance criteria in frontmatter should appear as `- [x]` lines in
  the workpad. Warn loudly on any unchecked criterion but allow the
  transition (a human reviewer is signing off; the warning is for them).

**`review` → `doing` (rejected revision):**

- Always FSM-allowed.
- Append a workpad entry recording the rejection reason **before** the
  move:
  ```bash
  node scripts/mission-cli.js workpad "$ID" "Rejected: $REASON"
  ```

**Any state → `canceled`:**

- Forbidden from `done` (the FSM enforces this — exit 3).
- Append a workpad entry with the cancellation reason **before** the
  move.

### Performing the move

```bash
node scripts/mission-cli.js move "$ID" "$NEW_STATE"
```

Exit code 3 means an FSM violation; report the CLI's stderr message and
do not proceed. Exit 0 means the file is now in the new directory and the
frontmatter `state` and `updated` fields are bumped.

The command writes (but does not commit) the rename. Commit when the
caller is ready:

```bash
git commit -m "mission(${ID}): ${FROM} → ${NEW_STATE}"
```

The worktree directory follows the .md file automatically when present
(the tracker library moves both atomically).

---

## `workpad` — append a workpad entry

```
/apes-mission workpad <M-NNNN> "<note>"
```

```bash
node scripts/mission-cli.js workpad "$ID" "$NOTE"
```

The CLI writes the canonical heading `### YYYY-MM-DD HH:MM` (24-hour UTC)
followed by the note text, preserves prior entries, and bumps the
mission's `updated` field. The full workpad protocol lives in the
missions skill.

---

## Examples — full lifecycle

```bash
# 1. Create a new mission in todo/
/apes-mission new "Add POST /todos endpoint" --priority 2 --label backend

# 2. List what's in flight
/apes-mission list --state doing

# 3. Inspect a specific mission
/apes-mission show M-0001

# 4. Start work — transitions todo → doing and creates the worktree
/apes-mission move M-0001 doing
node scripts/mission-worktree.js create M-0001

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

- All filesystem changes pass through the CLI, which calls
  `MissionTracker`. The library uses `git mv` when inside a git repo so
  `git log --follow` reconstructs the audit trail; commit boundaries are
  the caller's call.
- Never modify `id` after creation. The CLI rejects this with exit 1.
- For dependency cycle detection, use `mission-cli.js deps <id>` — its
  JSON includes a `cycle` array (empty if no cycles).
