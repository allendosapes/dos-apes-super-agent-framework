# M-0003 — Scope additions (findings ledger)

Findings from other missions that land in M-0003's scope, appended as they
are discovered. Fold into M-0003's acceptance criteria when it files to
doing. Non-M-0003 items live in the closeout section at the bottom and are
extracted when this ledger closes.

---

## M-0003 scope

### 2026-07-04 — `.claude/scripts/check-*.sh` fallback: live or dead?

Determine whether the `.claude/scripts/check-*.sh` fallback in
`apes-verify.md` / `apes-security-scan.md` is live or dead; delete if dead,
decide grant if live. Until resolved, the fallback path matches no allow rule
and prompts — accepted (M-0002 Task 0, FLAG C).

### 2026-07-04 — `node -e` pipelines defeating zero-prompt smoke

`apes-mission.md:123` and `apes-status.md:80` pipe `mission-cli list` into
`node -e`, which no permission rule can match. Cross-referenced to M-0002's
amended acceptance criterion 4: these two pipelines are excluded from the
zero-prompt smoke at mission level and are M-0003 remediation scope.
M-0003's acceptance criteria already name `apes-status.md:80`; fold
`apes-mission.md:123` in when M-0003 files to doing. Additional site found in
M-0002 Task 5: `cross-model-review.md:175-176` (`mission-cli show | node -e`
pipeline) — same remediation class. Full site inventory at M-0002 closeout
(M-0003 AC must absorb all): `apes-mission.md:123`, `apes-status.md:80`,
`missions.md:298-299`, `apes-metrics.md:25`, `apes-codex-review.md:58,81`
(draft AC's ":60-64" drifted — the two config-flip `node -e` blocks now sit
at :58 and :81), `cross-model-review.md:175-176`, plus the scattered
`… | node -e 'let s=""…'` JSON-extraction one-liners in apes-build/evidence/
mission/verify pinned in the Task 6 guard under cls "node-e".

### 2026-07-04 — Plain `git checkout` sites → `git switch` migration + candidate ask rule

Handoff item, ledgered at M-0002 closeout. **Count discrepancy flagged, not
reconciled:** the handoff said nine sites; closeout enumeration finds **11**:
`apes-build.md:523,796,845,1022,1076,1227` (the :1227 form is `git checkout .`
— a working-tree discard), `apes-build.md:1249`, `apes-feature.md:227`,
`apes-fix.md:206`, `apes-refactor.md:180`, `skills/devops.md:233` (rollback
via `$(git describe …)`). All prompt today (plain checkout deliberately
unlisted in M-0001). M-0003 decides per site: migrate to `git switch` (+
candidate ask/allow rule) or leave prompting; the discard forms (`checkout .`)
should stay prompting or harden to ask.

### 2026-07-04 — Env-prefix, trap, and chain-decomposition sites (M-0003 AC restatement)

Already in M-0003's draft AC; restated here so the ledger is the single
absorb-list at filing: env-prefix `COVERAGE_THRESHOLD=90 bash scripts/…`
(`skills/testing.md:176` → argument form) plus the `STAGING_URL=… npx
playwright` variant found in Task 6 (`skills/devops.md:243`); `trap '…' EXIT`
(`apes-build.md:362`); chain decompositions with `git reset --hard` staying
ask (`apes-build.md:895,1242`).

### 2026-07-04 — Deferred read-only utility grants ride M-0003's rewrites (T3 ruling)

Per the M-0002 Task 3 gate ruling: bare `cat`/`ls`/`echo`/`head`/`sed`/
`grep`-class utility invocations across command bodies stay un-granted;
M-0003 owns migration-caused frontmatter deltas and adds any needed grants
in the same commits as the block decompositions that make them meaningful.
The full accepted surface is pinned in `allowed-tools-guard.test.js`
(`KNOWN_PROMPTING`, cls "util") — M-0003 shrinks pins and grants together.

### 2026-07-04 — apes-codex-review `Edit` restoration rides the config-flip migration

Per the M-0002 Task 3 gate ruling: `Edit` was dropped from apes-codex-review
as aspirational (config flips are inline `node -e` today). When M-0003
migrates the `--enable`/`--disable` flips (now `apes-codex-review.md:58,81`)
to Edit-based or script-based form, the same commit restores the
corresponding grant and updates the guard's pins.

### 2026-07-04 — **FUNCTIONAL BREAK / must-fix M-0003 AC:** command bodies instruct a denied operation (`git push origin --delete`)

`apes-feature.md:249` runs `git push origin --delete feature/[name]` as routine branch
cleanup, and `apes-build.md:415` carves out an exception for it ("except cleaning up
merged feature branches") — both conflict with M-0001's deny rule
`Bash(git push origin --delete *)` (remote branch deletion is human-only). Deny-level
means these sites **hard-block, not prompt** — the shipped `/apes-feature` cleanup step
fails outright, and the guard hook backstops any respelling. The deny stands. This is a
**must-fix acceptance criterion for M-0003**: rewrite the cleanup steps to local-delete
only (or a human-handoff step). Re-confirms the 3.6.0 ship-together constraint: the
release-level zero-friction claim cannot hold while shipped bodies collide with the
shipped policy. Found during M-0002 Task 2 body re-verification.

### 2026-07-04 — Bare-form gaps surfaced by the Task 6 faithful matcher

The guard's rule matcher replicates the space-star quirk (`Bash(x *)` does not
match bare `x`), and immediately surfaced real prompting sites the M-0001
policy pairs don't cover: bare `git status` (apes-build:1092,
apes-feature:236, apes-refactor:188), bare `git stash` (apes-fix:64),
argument-less `bash scripts/check-structure.sh` (apes-gc:89), and bare
`git tag <name>` (orchestration examples — which also bypasses the
`git tag -a *` ask rule and lands on the default prompt). The npm rules got
exact+star pairs in M-0001; the git rules mostly didn't. Body-side fixes
(add args / rewrite) are M-0003 sweep candidates. Policy-side exact-form
pairs go to the **deny-audit follow-up thread** — M-0004 inherits policy, it
doesn't author it; the pairs ride M-0004's migration only if the deny-audit
lands in 3.6.0. Pinned in the guard as cls "bare-form" until resolved.
[Re-ledger ruling at the Task 6 correction gate.]

## Non-M-0003 process notes (extract at closeout)

### 2026-07-04 — Task 6 design input: `Read, Grep, Glob` floor convention

Guard convention ruled at the M-0002 Task 4 gate: `Read, Grep, Glob` is the
permitted floor for prose-only files — the drift guard never flags those three
as declarations-without-usage. Everything above the floor requires body
evidence. (Basis: apes-help/apes-metrics reversal — pre-evidence shared-row
ruling superseded by body evidence.)

### 2026-07-04 — Candidate bugfix mission: L8 enablement default inverted vs docs

`codex-review.js` (`DEFAULT_CONFIG.enabled: true` :73; `readConfig()` returns
enabled-defaults when the config file is **missing, unparseable, or
non-object** :125-140; skip only on explicit `enabled === false` :657) and
`codex-review-loop.js` (same pattern, :62/:568) both treat absent config as
**enabled** — while apes-codex-review.md, cross-model-review.md, and
apes-verify.md all document L8 as "opt-in, off by default," and apes-verify's
bash gate implements true opt-in (`L8_ENABLED=0` unless the file exists and
is `true`). Net: `/apes-verify` is opt-in; direct script/loop invocation is
opt-out. Same inverted-default class as M-0001's root cause, plus a
command-vs-script layer disagreement. Candidate fix: flip the script default
to `enabled: false` (docs win), or rewrite the three doc sites (behavior
wins) — decide once, apply to both scripts and the parse-failure fallback.
Weight of evidence at the pre-L8 gate: the shipped template
(`framework/templates/codex-review-config.json`) says `enabled: false` and
the installer prints "(disabled by default)" (`bin/cli.js:1067`) — five
surfaces say opt-in, only the two scripts' fallback says enabled. The
inverted default bites exactly when the config is missing or corrupted.
Found at the M-0002 pre-L8 gate.

### 2026-07-04 — Dogfooding blocker: backlog mission files use flow-style YAML the shipped parser rejects

`framework/lib/mission-parser.js` rejects flow-style sequences **by
documented design** (YAML-subset parser; header: "no flow style except
literal `[]`"), but every mission file in this repo's `_planning/missions/`
uses them (`labels: [security, dx, …]`, `depends_on: [M-0001]`,
`required_levels: [L0, L1]`) — including M-0001's closed file, and in the
exact form the shipped template's line 16 shows as the rejected
counter-example. **Regression check (done at this gate): not a regression** —
3.5.1's "flow-style fix" was diagnostics/docs only (actionable error + template
guidance; CHANGELOG:155-172); the parser never accepted non-empty flow
sequences. Installed projects are safe: `mission-cli create` serializes block
style and hand-editors get the actionable error. Invisible in this repo only
because the tracker reads `.planning/`, never `_planning/`. Disposition:
**dogfooding-alignment content work** — convert this repo's mission files to
block style before pointing the tracker at them; no parser change warranted.
Found at the M-0002 L8-record gate while validating a frontmatter edit.

### 2026-07-04 — Candidate follow-up mission: L5 outcomes never logged

`apes-security-scan.md` runs the L5 pipeline (npm audit, check-secrets,
semgrep) but never invokes `log-verification.js` — security-scan outcomes
leave no trace in any mission's `verification.jsonl`, so an evidence packet
can't prove L5 ran via this command (only `/apes-verify`'s L5 step logs...
actually apes-verify logs only L8 explicitly; the check-scripts self-log).
Candidate mission: make L5 (and any level executed by a command rather than
a self-logging check-script) append its outcome. Found during M-0002 Task 4.

### 2026-07-04 — Task 6 requirement: indented-fence regression fixture

The M-0002 Task 0 scoping-table gaps were caused by a fence parser anchored at column 0
— fenced code blocks indented inside numbered lists (e.g. apes-feature.md's git
workflow steps) were silently skipped. Task 6's drift-guard extraction heuristic MUST
parse indented fences, and its test fixtures MUST include an indented-fence case so the
bug class cannot recur. **Extended in Task 5:** a third formatting class exists —
unfenced indentation-style code blocks (`browser-verification.md`, e.g. the
`agent-browser` command list at :14-19 and `npx playwright` at :107-110). The guard's
fixtures must include an unfenced-indented case as well.

### 2026-07-04 — Process: mission IDs must not be reused

M-0002 was found to collide with the closed MissionTracker mission of the
same ID (legacy inventory renamed to `M-0002-mission-tracker-inventory.md`
to disambiguate). Candidate fixes: a convention line in CLAUDE.md, and/or a
future MissionTracker guard that refuses `next-id` values ever seen in git
history. Neither is scheduled yet.
