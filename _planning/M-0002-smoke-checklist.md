# M-0002 — AC-4 smoke checklist (scratch install, interactive)

Run by Allen after the L8 loop reaches terminal. Tests the amended AC 4:
zero prompts during `/apes-mission list` and `/apes-status` **except** the two
known `node -e` pipelines. Any other prompt is a finding — record it here and
stop; do not tune settings mid-smoke.

Tarball: `..\dos-apes-super-agent-3.5.1.tgz` (packed at Task 7 closeout,
commit 3fdb3c5; repack if the branch moves).

## Setup (scratch, outside the repo)

```powershell
mkdir $env:TEMP\m0002-smoke && cd $env:TEMP\m0002-smoke
git init
npx C:\Users\allen\projects\dos-apes-super-agent-3.5.1.tgz --local --greenfield --yes
```

Expected install: `.claude/commands` (18), `.claude/skills` (15+README),
`.claude/settings.json`, `scripts/`, `lib/`, `.planning/` scaffold, CLAUDE.md.

Then open Claude Code in that directory. Accept the **one** workspace-trust
prompt (by design — frontmatter grants activate only after trust; see the
mission's References note).

## Smoke A — `/apes-mission list`

1. Run `/apes-mission list` on the empty scaffold.
2. **Expected prompts: exactly one**, at the `mission-cli list | node -e '…'`
   client-side filter pipeline (installed `apes-mission.md:123`) — and only
   if the model takes the `--phase/--label` path; the plain
   `node scripts/mission-cli.js list` call must pass silently (baseline
   allow + frontmatter grant).
3. PASS = zero prompts, or the single known pipeline prompt. Anything else →
   record the exact command string the permission dialog shows.

## Smoke B — `/apes-status`

1. Run `/apes-status`.
2. Expected prompt sites (known, AC-4 exceptions / pinned classes):
   - `node scripts/mission-cli.js list | node -e '…'` renderer
     (installed `apes-status.md:80`).
   - The `cat .planning/ROADMAP.md | grep …` progress pipeline and
     `git worktree list | wc -l` count (util-class pins; composite halves
     unmatched).
   Strictly per amended AC 4 only the two `node -e` sites are excused —
   treat any *other* prompt (including the util pipelines) as a finding to
   ledger, then decide accept/extend at the gate.
3. `git branch --show-current`, `git status --short`, `TaskList`, and the
   npm-run quartet must pass silently (grants + baseline).

## Smoke C — spot-check a frontmatter grant (1 minute)

1. Ask Claude (with the testing skill loaded or via `/apes-verify --quick`)
   to run `npm run build` in the scratch project — silent pass expected.
2. Ask it to run `npm run deploy` — MUST prompt (policy).

## Recording

- PASS/FAIL per smoke + any unexpected prompt strings → workpad entry on the
  mission file, then tracker §1 zero-prompt callout gets its evidence line.
- Findings beyond the excused sites: add to `_planning/M-0003-scope-additions.md`
  (same classes as the guard's KNOWN_PROMPTING pins) — do not fix in M-0002.
