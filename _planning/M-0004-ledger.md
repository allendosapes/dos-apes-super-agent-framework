# M-0004 — Findings ledger

New discoveries made during M-0004 execution, appended with file:line
evidence per the charter's evidence rule (never fixed in-mission unless a
CPO ruling folds them into an AC). The M-0003 ledger
(`_planning/M-0003-scope-additions.md`) is FINAL per standing ruling and
takes no further entries.

---

### 2026-07-13 — YAML-subset parser swallows trailing inline comments into scalar values — PARKED per CPO ruling

`framework/lib/mission-parser.js` scalar handling: `required: false  # note`
parses as the string `"false  # note"`. Inline comments after values become
part of the value — silently for string-typed fields (the M-XXYA stub's
`id:` / `depends_on:` inline comments round-tripped as value content),
loudly only when schema type-checking rejects the type. Evidence:
`moveMissionState` refusal `codex.required must be a boolean, got
"false  # hook + CLI fixes…"` during M-0004 filing (Task 0b). Workaround:
comments on their own line. PARKED — no fix in-mission, not
release-blocking.

### 2026-07-13 — moveMissionState non-atomic: git mv before frontmatter validation — FOLDED INTO AC-3 per CPO ruling

`framework/lib/mission-tracker.js:328-339`: the `git mv` executes before
`_writeFile` validates the updated frontmatter; a validation failure
leaves the file already moved with a stale `state:` field (observed
during Task 0b: M-0004 sat in `doing/` with `state: todo` after the
inline-comment rejection above; completed manually). FOLDED INTO AC-3:
this failure shape — post-move frontmatter write/validation failure
leaving a moved file with stale state — becomes a REQUIRED reproduction
fixture in the AC-3 task, alongside the untracked-companions and
pre-existing-destination shapes.

### 2026-07-13 — M-0003 AC-4 helper scripts missing from the npm `files` whitelist — ABSORBED INTO M-0004 as AC-8 per CPO ruling (3.6.0-blocking)

`package.json:41-61` enumerates `framework/scripts/` entries individually;
the six AC-4 helpers (`json-field.js`, `mission-next.js`,
`mission-filter.js`, `mission-dashboard.js`, `metrics-summary.js`,
`codex-envelope.js`, all added in 593375c) are absent. They will not ship
in the tarball, so `npx dos-apes-super-agent` installs get command bodies
that invoke helpers that don't exist on disk (every AC-4 conversion site
breaks at runtime). Invisible to `npm test`: cli.test.js's packaging group
asserts the whitelist SHIPS, not that all production files are
WHITELISTED (no reverse check). Found during M-0004 AC-1/AC-2 while
editing `package.json`'s test chain. Candidate fix is a six-line
whitelist addition plus a reverse packaging assertion. RESOLUTION
(2026-07-13, same day): absorbed as M-0004 AC-8 per CPO ruling — six
whitelist entries added, reverse assertion landed in cli.test.js's
packaging group (proven red against the pre-fix whitelist, exactly the
six helpers; green post-fix).

### 2026-07-13 — mkdir allow-rule denial anomaly: CLOSED (environmental, root-caused, framework exonerated, no action)

Repro attempted 2026-07-13 (M-0004 Prompt 3 Task B, one bounded headless
attempt, same `--settings`-injection shape as the original AC-9 run).
Both `mkdir tmp-probe` and `mkdir -p tmp-probe2/nested` denied despite
the live `Bash(mkdir *)` allow. Denial text verbatim: "Claude requested
permissions to edit C:\Users\allen\.claude\jobs\977580c4\tmp\ac9-sample\
tmp-probe which is a sensitive file." Root cause: the AC-9 sample
project lives under `~/.claude/jobs/...`, and Claude Code's built-in
sensitive-path protection for the `.claude` subtree overrides permission
allow rules for fs-mutating commands there. Not an allow-rule defect;
`framework/settings.json` exonerated. NO FIX (nothing framework-side to
fix). Methodology consequence: the AC-6 dry-run sample project MUST be
scaffolded OUTSIDE `~/.claude` so environmental denials don't pollute
the denial log.

### 2026-07-13 — AC-6 disposition: PASS with method-limitation accounting

Headless `/apes-build` re-run (Task 3a probe method, Git Bash, sample
scaffolded outside `~/.claude` per CLAUDE.md hazard 10). Against the
**12-denial adjusted M-0003 baseline** (14 raw minus the 2 environmental
mkdir denials, closed 2026-07-13 as Claude Code sensitive-path
built-ins):

- **Worktree-write criterion: 3 → 0, live.** `src/hello.js` written into
  `.worktrees/M-0001` with the session cwd on main — zero Write denials
  (AC-1 fix verified in production shape).
- **Improvisation-cascade criterion: ~6 → 0, live.** No heredoc, printf
  redirect, inline `node -e` file-write, or `git hash-object` fallback
  attempts.
- **The 2 EnterWorktree denials are harness-interactive approval points
  unanswerable headless** — three-probe diagnostic, verdict (A): path-form
  EnterWorktree fires a built-in confirmation ("Enter the worktree at
  …? This moves the session's working directory and write access there,
  and loads project configuration (CLAUDE.md, settings) from that
  location.") that NO allow spelling silences ("EnterWorktree",
  "EnterWorktree(*)", "EnterWorktree(path:*)" all tested) in trusted and
  untrusted workspaces alike; name-form does not fire it. The AC-2 grant
  is correct for real interactive installs, where the dialog is a
  one-click intended approval.
- Wrong-worktree drift (verification logged from
  `.claude/worktrees/m0001-build`) and the max-turns exhaustion are
  attributed downstream of the unanswerable dialog, not to framework
  policy or the AC-1/AC-3 fixes.
- **AC-3 live-fire transferred to closeout-by-tooling:** this mission's
  own doing → review transition (tracked file + evidence companion +
  pre-existing destination) is executed via `moveMissionState` and
  recorded in the workpad as the AC-3 live verification.
- Evidence: `ac6-result.json` (this mission's evidence directory);
  residual acceptable denials in the log: 3 cd-prefixed chains (parked
  class), 1 `rm` (intended ask rule).

### 2026-07-13 — PARKED TO DENY-AUDIT THREAD: acceptance-assert execution gap (improvisation cascade)

The AC-6 agent had no rule-covered way to execute the mission's
acceptance assert (`require('./src/hello.js').hello() === 'hello'`):
improvised `node -e` (prompted — the exact idiom M-0003 swept from
bodies returns through the QA phase's back door), wrote and ran its own
`scripts/acceptance-m0001.js` (prompted twice; user-project scripts are
uncovered by design), then `rm` of the temp script (intended ask).
Evidence: ac6-result.json denials 5-8. The QA phase needs a sanctioned
acceptance-execution mechanism; policy-side, so it rides the deny-audit
thread, not M-0004.

### 2026-07-13 — PARKED TO DENY-AUDIT THREAD: `git -C` rule-invisibility (third specimen of the class)

`git -C .worktrees/M-0001 status --short` (ac6-result.json denial 10)
escapes `Bash(git status *)` — the `-C` spelling defeats prefix matching
for every `git <subcommand> *` rule, joining env-prefix (`FOO=1 cmd`)
and `$(...)` substitution as the third rule-invisibility specimen.
Class-level treatment belongs to the deny-audit thread.

### 2026-07-13 — PARKED (future intake): EnterWorktree requires Windows-native paths

Git Bash `$PWD` yields `/tmp/...`-style paths that EnterWorktree
normalizes to `C:\tmp\...` — a nonexistent location (diagnostic probe 1;
probes 2-3 with `cygpath -m` paths behaved correctly). Any body or skill
that instructs passing a worktree path to EnterWorktree on Windows
should pass Windows-native form. No shipped body currently interpolates
a bash-computed path into EnterWorktree; parked as intake for whenever
one does.

### 2026-07-13 — Ledger finalized at M-0004 closeout

Dispositions: parser inline-comment swallowing — PARKED (stands);
moveMissionState non-atomicity — FOLDED INTO AC-3, fixed in 691e397 with
the required reproduction fixture; packaging whitelist gap — ABSORBED as
AC-8, fixed in fd33401 (red-then-green); mkdir anomaly — CLOSED
(environmental); AC-6 — PASS with method-limitation accounting (above);
acceptance-assert gap and `git -C` invisibility — PARKED TO DENY-AUDIT;
EnterWorktree Windows-native paths — PARKED (future intake).
