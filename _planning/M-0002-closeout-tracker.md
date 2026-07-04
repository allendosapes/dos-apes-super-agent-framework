# M-0002 Closeout Tracker (living — feeds Task 7)

Running list so Task 7 assembles the PR description, evidence packet, and M-0003 handoff
from a record, not from memory. Update at every gate. Suggested repo location:
`_planning/M-0002-closeout-tracker.md` (committable on the mission branch).

Status: current through **Task 5 approved** (Task 6 design gate pending).

---

## 1. PR-description callouts (explicit, required)

- [ ] **agent-browser policy relaxation** (Task 5, FLAG J) — `Bash(agent-browser:*)` granted on
  `browser-verification.md` only. Deliberate, skill-scoped relaxation of M-0001's
  "printed suggestion" stance; baseline unchanged. Workpad note exists. **Requires L8 attention.**
- [ ] **Deny-level functional break, deferred to M-0003** (Task 2, Q4) — `git push origin
  --delete` collides with M-0001's remote-branch-deletion deny at one **executable site**
  (`apes-feature.md:249`, fenced cleanup step — carries the guard's mechanical deny pin)
  plus one **prose policy bullet** (`apes-build.md:415`, the autonomy-policy carve-out —
  not extractable code; covered by the ledger entry only). [Wording corrected at the
  Task 6 correction gate; 6920f34 predated the distinction.] Those body steps hard-block until M-0003 rewrites them.
  Independently re-confirms the 3.6.0 ship-together constraint (M-0001+M-0002 without
  M-0003 = broken cleanup path, not just noisy). Must-fix AC queued for M-0003.
- [ ] **Zero-prompt smoke exception** (AC 4 as amended) — `/apes-mission list` and `/apes-status`
  prompt at the two known `node -e` pipelines (`apes-mission.md:123`, `apes-status.md:80`);
  M-0003 remediation scope. Unqualified zero-prompt holds at 3.6.0 release level only.

## 2. Mission-file amendments made (cite in PR + evidence)

- [x] AC "apes-map unchanged" → "reconciled with final M-0001 policy" (Task 1 commit).
- [x] AC 4 reworded with the two named `node -e` exceptions + release-level clause (Task 1).
- [x] L1 mechanized by the O1 drift-guard test; `log-verification.js` no-op caveat
  (`_planning/` vs `.planning/`, P3 dogfooding gap) recorded — evidence via workpad/PR text.

## 3. Superseded rulings / evidence-based deviations (audit trail for reviewers)

Pattern throughout: pre-evidence ruling or §2.4 row, overturned by full body read. Evidence governs.

- [x] T1 — apes-map trimmed `cat/wc/tail` (declared-but-unused; Task 0 "keep" superseded).
- [x] T3 — apes-codex-review dropped **Edit** (aspirational/R4; M-0003 restores it with the
  config-flip migration in the same commit).
- [x] T3 — apes-mission dropped Edit/Write (body's own rule: "all filesystem changes pass
  through the CLI" — quoted in workpad).
- [x] T4 — apes-help/apes-metrics went lean, superseding the Task 0 shared-row ruling.
- [x] T4 — verify gained npm-run quartet + `codex-review.js` + TaskUpdate; §2.4's
  command-assignment boundary loses to invocation evidence.
- [x] T5 — cross-model-review dropped all three codex scripts (loop driver runs them, not the
  loader; reference ≠ invocation) — reverses the decision-block-approved row.
- [x] T5 — evidence-packets dropped `log-verification.js` (body assigns the call to the
  check-script; line 86 names the gap an orchestration bug).
- [x] T2/T4/T5 — Task tools added on evidence: build (all three), feature/fix/refactor
  (TaskCreate), status/board (TaskList). **FLAG H revised at the Task 6 correction gate:**
  the guard's first falsifiable run caught drift introduced by this mission's own Task 5
  evidence defect — the whole-file token scan matched frontmatter declarations against
  themselves. Final state: orchestration keeps all three (TaskCreate/TaskUpdate tokens in
  body; TaskList prose-pinned, :272); product keeps TaskCreate (prose-pinned, :127) and
  TaskList (token :169) but **TaskUpdate is trimmed** — its only basis was the
  self-matching scan; restore only with a real citation in the same commit as the evidence.
  gc pending the line-45 reference-vs-invocation verification result — record outcome here:
  **invocation** — SWEEP 1's "phase status matches actual task completion (via TaskList)" is
  performed by the sweep's own executor calling TaskList, unlike architecture.md's
  check-structure.sh (hook-executed → reference). `TaskList` added to apes-gc at the Task 2
  gate (commit 2b9aee3).

## 4. Task 6 design inputs (settle at design gate, before code)

- [ ] "Covering declaration" = frontmatter grant ∪ shipped `settings.json` allow-list.
- [ ] Ask-level body sites = covered-by-policy, never flagged (orchestration's `git tag`
  examples prompt by design).
- [ ] Deny-level sites = expected-failure whitelist entries citing ledger lines
  (the two `push --delete` sites), removed by M-0003.
- [ ] `Read, Grep, Glob` floor never flagged as unused (prose-only files' minimal form).
- [ ] Extraction handles all three formatting classes; **pinned fixtures:**
  (1) indented fence inside numbered list (Task 2's column-0 parser bug),
  (2) unfenced indentation-style code (browser-verification, found Task 5).
- [ ] Test ships in repo test layout, excluded from tarball per M-0001 `.npmignore` rules;
  runs under `npm test` (rides L0, constitutes L1).

## 5. Ledger cross-check (all must exist in `_planning/M-0003-scope-additions.md` at closeout)

M-0003 scope:
- [ ] FLAG C — `.claude/scripts/check-*.sh` fallback: live-or-dead determination.
- [ ] `node -e` pipelines: `apes-mission.md:123`, `apes-status.md:80`, `missions.md:298-299`,
  `apes-metrics.md:25`, `apes-codex-review.md:60-64`, **new: `cross-model-review.md:175`** (Task 5).
- [ ] `push origin --delete` deny conflict — marked functional break, must-fix AC.
- [ ] Nine `git checkout` sites → `git switch` migration + candidate ask rule (from handoff).
- [ ] Env-prefix (`skills/testing.md:176`), `trap` (`apes-build.md:362`),
  chain decompositions (`apes-build.md:895,1242` — reset stays ask).
- [ ] Read-only utility grants deferred with their block decompositions (T3 ruling):
  M-0003 adds grants alongside rewrites it makes meaningful.
- [ ] apes-codex-review Edit restoration rides the config-flip migration commit.

Non-M-0003 section (extract at closeout):
- [ ] Mission-ID-reuse process note → CLAUDE.md convention line and/or MissionTracker guard.
- [ ] L5 evidence gap — security-scan never logs outcomes to the verification log
  (candidate follow-up mission).
- [ ] Column-0 fence-parser bug — recorded as Task 6 fixture requirement (see §4).
- [ ] R/Grep/Glob floor convention — Task 6 design input (see §4).

## 6. M-0003 handoff obligations (Task 7 output)

- [ ] M-0003 AC must absorb the full ledger before its todo→doing move — including
  `apes-mission.md:123` (its draft AC lists only `apes-status.md:80`).
- [ ] M-0003 playbook drafted **after** ledger finalization (two confirmed AC deltas already;
  don't draft against a moving target).
- [ ] Note for M-0004: its fingerprint table keys off M-0001's final policy **plus** M-0002's
  frontmatter state — confirm whether the 33 scoped files affect its migration scope.

## 7. Process notes (for CLAUDE.md / MEMORY.md candidates)

- [ ] "Body invokes" columns in analysis tables are hypotheses; full-read re-verification
  per file is mandatory (three extraction bugs found this mission).
- [ ] Reference ≠ invocation as a standing grant test.
- [ ] Declared-but-unused = future guard failure; never grant ahead of body evidence (R4).
