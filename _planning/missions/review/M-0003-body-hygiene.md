---
id: M-0003
title: "Command/skill body hygiene: deny-break fix, git switch migration, node -e helpers, bare-form sweep"
priority: 1
labels:
  - body-hygiene
  - allowed-tools
depends_on: []
codex:
  required: false  # body-text migration; L1 drift-guard + full test suite are the gates, not adversarial review
verification:
  required_levels:
    - L0
    - L1
    - L2
    - L2.5
---

## Context

M-0002 scoped `allowed-tools` frontmatter across 18 command + 15 skill files
and established the L1 drift-guard (`allowed-tools-guard.test.js`, 108 checks)
as the freeze mechanism. M-0003 is the body pass: it rewrites the command/skill
*bodies* so their actual invocations stop prompting (or stop hard-blocking, in
one case), and updates the guard pins in lockstep. Frontmatter-first (M-0002,
done) → bodies (this mission) is strictly sequential over the same files.

This mission carries one shipped-broken command (a body instruction that
collides with an M-0001 deny rule) as a standalone must-fix, plus several
mechanical prompting-friction sweeps. Every body rewrite that alters an
invocation MUST update the guard's pins in the SAME commit — the guard reads
live framework files and will fail loudly otherwise; that failure is intended,
not a problem to route around.

Source ledger: `_planning/M-0003-scope-additions.md` (this AC absorbs its
"M-0003 scope" section in full). All line anchors below are from the ledger and
are **hypotheses until Task 1 recon re-verifies them against current `main`**
(the ledger already records two drifts: `:60-64`→`:58,81`, and 9→11 checkout
sites).

## Acceptance criteria

### AC-1 — MUST-FIX: deny-break (standalone, first commit)

- [ ] `apes-feature.md:249` (`git push origin --delete feature/[name]`,
      executable/fenced) is rewritten so the shipped `/apes-feature` cleanup no
      longer invokes remote branch deletion — local-delete only
      (`git branch -d`) or an explicit human-handoff step. Remote deletion stays
      human-only per M-0001's deny rule `Bash(git push origin --delete *)`; the
      deny stands, the body stops colliding with it.
- [ ] `apes-build.md:415` prose exception ("except cleaning up merged feature
      branches") is rewritten to remove the carve-out for remote deletion.
- [ ] Post-fix, no shipped command body instructs a denied operation. Verify by
      grep across `framework/` for `git push origin --delete`.
- [ ] Lands as its own commit ahead of the sweeps — if the mission stalls, the
      one genuinely-broken command is already mergeable.

### AC-2 — Recon and anchor verification (no edits)

- [ ] Every line anchor in this AC re-verified against current `main` by
      full-file read (hazard #5: ledger cites are hypotheses). Produce a
      corrected anchor map; the 11 checkout sites and the `apes-codex-review`
      `:58,81` anchors get explicit confirmation.
- [ ] **`.claude/scripts/check-*.sh` fallback — live or dead:** trace the
      fallback path in `apes-verify.md` / `apes-security-scan.md`. If dead,
      remove it (and drop any pin/grant it implied). If live, it becomes a grant
      decision folded into the relevant sweep commit. Ruling is evidence-driven;
      recon settles it.
- [ ] Full inventory confirmed for each sweep class below; any site the ledger
      missed is added, any drifted anchor corrected, before edits begin.
- [ ] **`$(...)` command-substitution inventory:** substitution falls outside
      prefix matching as a *class* (the same invisibility as `node -e`
      pipelines), so it is not covered by any star rule. Inventory every
      `$(...)` site across the 18 command + 15 skill files — not just the known
      `devops.md:233` rollback (`$(git describe …)`). Each becomes a remediation
      item in AC-4's class (name the operation, scope the grant) or is ruled
      benign with a stated reason. (Provenance: analysis report §2.1-B, §2.3.)
- [ ] **PowerShell `npm test` path failure:** `guard-forbidden-commands.test.js`
      passes a Windows path to `/bin/bash`; backslash-stripping yields
      `C:Usersallen…`, exit 127, before the guard suite runs — so the full suite
      only passes under Git Bash today. Pre-existing (surfaced at Task 1). Recon
      determines whether M-0003 fixes it (its AC-9 dry-run needs a known-good
      runner) or parks it as a separate candidate. Not a body-hygiene edit;
      ruled at the recon gate.

### AC-3 — `git checkout` → `git switch` migration (11 sites)

- [ ] Branch-switch forms migrated to `git switch`:
      `apes-build.md:523,796,845,1022,1076,1249`, `apes-feature.md:227`,
      `apes-fix.md:206`, `apes-refactor.md:180`, `skills/devops.md:233`
      (rollback via `$(git describe …)`). Exact set confirmed in Task 1.
- [ ] `Bash(git switch *)` added as an **ask** rule (not allow — mid-work branch
      switching warrants confirmation). Guard pins updated in the same commit.
- [ ] Working-tree **discard** forms (`git checkout .`, `apes-build.md:1227`)
      are left **prompting** — not migrated, not granted. A destructive discard
      correctly stops for a prompt; this is intended, and the guard pins it as
      known-prompting.

### AC-4 — `node -e` pipelines → named helper scripts

- [ ] The `mission-cli | node -e` and `mission-cli show | node -e` pipelines,
      which no permission rule can match, are replaced with named helper scripts
      under scoped allows. Full site set (confirm in Task 1):
      `apes-mission.md:123`, `apes-status.md:80`, `missions.md:298-299`,
      `apes-metrics.md:25`, `cross-model-review.md:175-176`,
      `apes-codex-review.md:58,81`, plus the scattered JSON-extraction
      one-liners in apes-build / apes-evidence / apes-mission / apes-verify
      pinned in the guard under cls `node-e`.
- [ ] `apes-codex-review.md:58,81` config-flip blocks (`--enable`/`--disable`):
      when migrated to Edit-based or script-based form, the same commit restores
      the `Edit` grant dropped as aspirational in M-0002 and updates the guard
      pins (T3 ruling).
- [ ] Guard `node-e` pins shrink as sites are converted; every conversion
      updates pins in-commit.
- [ ] **`$(...)` substitution sites** from the AC-2 inventory are remediated by
      the same pattern: either named-helper/script form under a scoped allow, or
      a stated benign ruling. Same class of invisibility as `node-e`; same
      remediation discipline (grant + guard pin in the converting commit).

### AC-5 — Bare-form and argument sweeps (body-side only)

- [ ] Bare invocations that fall through the space-star rules are given
      arguments or rewritten: bare `git status` (`apes-build.md:1092`,
      `apes-feature.md:236`, `apes-refactor.md:188`) → `git status --short`
      (or equivalent covered form); bare `git stash` (`apes-fix.md:64`);
      argument-less `bash scripts/check-structure.sh` (`apes-gc.md:89`).
- [ ] Bare `git tag <n>` in orchestration examples rewritten to the annotated
      `git tag -a` form (already covered by the existing `git tag -a *` ask
      rule — no new policy needed; the fix is body-side).
- [ ] Env-prefix forms converted to argument form:
      `COVERAGE_THRESHOLD=90 bash scripts/…` (`skills/testing.md:176`),
      `STAGING_URL=… npx playwright` (`skills/devops.md:243`).
- [ ] `trap '…' EXIT` idiom (`apes-build.md:362`) and chain decompositions
      (`apes-build.md:895,1242`) handled per ledger: decompose the chains;
      `git reset --hard` stays an **ask**, not decomposed into an allow.
- [ ] Policy-side exact-form pairs are **NOT authored here** — they go to the
      deny-audit follow-up thread. M-0003 fixes bodies; M-0004 inherits policy.
      Guard keeps its `bare-form` pins until that thread lands.

### AC-6 — Deferred utility grants (ride coupled commits)

- [ ] Read-only utility grants (`cat`/`ls`/`echo`/`head`/`sed`/`grep`-class)
      are added only alongside the block decompositions that make them
      meaningful — same commit, per the T3 ruling. Guard `util` pins and grants
      shrink together. No standalone "grant utilities" commit.

### AC-7 — Prose completeness (M-0005 fallout, no guard impact)

- [ ] Three skip-cause enumerations updated to name the new L8 config reasons
      (`config-absent`, `config-unparseable`, `config-invalid`):
      `apes-verify.md:354`, `cross-model-review.md:230`, `missions.md:273`.
      Pure prose; no invocation change, no guard pins touched.

### AC-8 — Guard integrity and final state

- [ ] `allowed-tools-guard.test.js` passes at final HEAD with pins reflecting
      the post-sweep reality — no stale pins, no un-pinned new prompting surface.
      Every commit that altered an invocation already updated its pins (strict
      freeze); this AC confirms the end state, it is not a batch pin-fix.
- [ ] Full `npm test` green at final HEAD (parser, tracker, codex suites,
      forbidden-commands, allowed-tools guard, CLI). Any guard failure mid-sweep
      is a stop-and-present, never an inline pin loosen.
- [ ] **Mixed-chain audit is subsumed, not dropped.** The M-0002 Task 6 guard's
      layer-C chain-segment classification (splits `&&`-chains into segments,
      classifies each) *is* the no-mixed-chain audit — a live, every-run form of
      what would otherwise be a one-time PR grep. No separate audit script or
      grep-procedure deliverable is required. (Recorded so the requirement is
      not re-derived as an oversight; superseded stub AC-5.)

### AC-9 — In-use verification (outcome, not static audit)

- [ ] AC-1 through AC-8 verify by static audit (grep, guard pins, full-file
      read). This AC verifies the mission's *outcome in real use*: a
      `/apes-build` dry-run against a sample mission produces **zero prompts
      outside the intended ask points** (the `git switch` ask, `git reset --hard`
      ask, `git tag -a` ask, and the deliberately-prompting discard forms). This
      is the only criterion that catches a prompting site the recon inventory
      missed entirely — proof of the fix, not proof of the diff.
- [ ] Run under a **known-good test runner** (Git Bash today; the PowerShell
      path failure from AC-2 must be resolved or explicitly excluded first — the
      dry-run cannot validate zero-prompts on a runner that exits 127 before the
      command runs). State which runner was used and why.
- [ ] Any prompt observed outside the intended ask points is a finding, not a
      pass: trace it to a missed site, add it to the relevant sweep, re-run.

## Scope

**In:** bodies of the 18 command + 15 skill files; `allowed-tools-guard.test.js`
pins; the `Bash(git switch *)` ask rule (the one new policy line this mission
authors, because it's the direct enabler of AC-3's migration); named helper
scripts under `framework/scripts/` for the `node-e` conversions.

**Out:** policy exact-form pairs (deny-audit thread); M-0004's fingerprint
table; any frontmatter change not caused by a body migration; the parked
non-M-0003 candidates in the ledger's closeout section (L8-default already
fixed in M-0005; flow-style YAML dogfooding; npx local-tgz; L5 logging; ID-reuse
guard).

## Sequencing

M-0002 → M-0003 strictly sequential (same files, frontmatter-then-bodies).
M-0004 remains last — its fingerprint table needs the final policy AND the
scoped files; its `depends_on` renumbers to `M-0003` at its own filing (the
template placeholder `M-XXXX` = this mission). Within M-0003: AC-1 deny-break
first and standalone; AC-2 recon before any edit; then AC-3–AC-7 as
class-grouped commits each carrying their own guard-pin update; AC-8 confirms
end state; AC-9 runs the in-use dry-run last, after the static gates pass.

## References

`_planning/M-0003-scope-additions.md` (source ledger); M-0001 deny rule
`Bash(git push origin --delete *)`; M-0002 guard `allowed-tools-guard.test.js`
(cls `node-e` / `bare-form` / `util`); T3 ruling (M-0002 Task 3 gate); analysis
report §2.1-B (four prompting idioms with file:line) and §2.3 (hygiene list) —
provenance for the substitution and bare-form classes, carried from the
superseded `M-0003-compound-command-hygiene` stub.

## Workpad

### 2026-07-09 14:50

Task 2 recon (AC-2) complete at 61a0116 — read-only, full report at
m0003-task2-recon.md (uploaded at the gate). Corrected anchor map, key deltas:

1. apes-status node-e drifted :80→:81 (fence opens :80, command at :81).
2. apes-build:1227 `git checkout .` discard is guard-invisible prose inside a
   fence (F-1) — AC-3's "pin as known-prompting" cannot be satisfied as
   written; site needs restructure (companion :1226 hides a bare-`git status`
   chain the same way).
3. apes-build:895/:1242 are standalone `[ask]` sites, not chains (F-3) — the
   ledger's decomposition item is stale and dropped.
4. `Bash(git switch -c *)` allow already exists in settings.json (F-2) —
   ask-vs-allow precedence must be verified in the product before authoring
   the `Bash(git switch *)` ask rule, or `-c` sites may gain prompts.
5. `.claude/scripts/check-*.sh` fallback ruled DEAD — no installer version
   ever wrote that path (git -S history empty). Three sites
   (apes-verify:127-128, :184-185 guarded; apes-security-scan:40 unguarded);
   removal drops the guard's two `fallback` pins in the same commit.
6. Six uncovered-and-guard-invisible `$(...)` inners the ledger lacked:
   `basename` ×5 (apes-build:826,865-867; apes-verify:153 — rewrite candidate
   `${PWD##*/}`), `seq` ×1 (observability:136, benign illustrative prose).
7. Bare `git tag` is three sites (orchestration:284,285,286), not one.
8. Restoring `Edit` to apes-codex-review requires an `EDIT_WRITE_EXPECTED`
   row in the guard in the same commit, or layer B fails.
9. PowerShell `npm test` runner parked (WSL-bash path failure, exit 127; see
   ledger closeout entry 2026-07-09). Git Bash is AC-9's known-good runner.

All other anchors confirmed exactly as cited; `$(...)` inventory complete at
29 sites (9 → AC-4, 11 benign under live allows, 6 → AC-6 util class, 6 → the
new class-D blind spots above). No mixed chains at HEAD outside the prose
site in delta 2.

### 2026-07-12 — Reconciliation: unplanned checkpoint merge mid-mission

1. Task 3b merged to `main` EARLY via unplanned checkpoint PR #19 (squash
   commit 95d66bc, 2026-07-12), carrying commits f4a0270 (AC-2 dead-fallback
   removal) and 42639b1 (AC-3 `git checkout` → `git switch` migration + the
   one authored ask rule, exact-match `Bash(git switch main)` per the F-2
   precedence ruling). Task 3b is COMPLETE; do not revisit. The cited SHAs
   resolve on branch `mission/M-0003-body-hygiene`, retained on origin per
   the branch-retention policy.
2. Remaining scope — housekeeping ledger updates, AC-4 (`node -e`
   conversions, `$(...)` sweep), and closeout — continues on
   `mission/M-0003-body-hygiene-ac4`, cut from `main` after the checkpoint
   merge.
3. The closeout evidence packet will reference TWO PRs: checkpoint PR #19
   (Task 3b) and the eventual PR from `mission/M-0003-body-hygiene-ac4`
   (remainder). Both merged mission branches stay on origin until 3.6.0
   ships.
