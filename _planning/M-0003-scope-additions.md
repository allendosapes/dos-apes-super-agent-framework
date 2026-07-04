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
pipeline) — same remediation class.

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

## Non-M-0003 process notes (extract at closeout)

### 2026-07-04 — Task 6 design input: `Read, Grep, Glob` floor convention

Guard convention ruled at the M-0002 Task 4 gate: `Read, Grep, Glob` is the
permitted floor for prose-only files — the drift guard never flags those three
as declarations-without-usage. Everything above the floor requires body
evidence. (Basis: apes-help/apes-metrics reversal — pre-evidence shared-row
ruling superseded by body evidence.)

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
