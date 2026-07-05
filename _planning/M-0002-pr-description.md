# M-0002 — Scope `allowed-tools` frontmatter across all commands and skills

Closes the second mission of the 3.6.0 least-privilege series. Every shipped
command (18/18) and skill (15/15) now declares a scoped `allowed-tools` grant
derived from full-body invocation evidence; a repo-only drift guard freezes
the contract and constitutes the mission's L1.

## Required callouts

1. **agent-browser policy relaxation (L8 attention required).**
   `browser-verification.md` gains `Bash(agent-browser:*)` — a deliberate,
   skill-scoped relaxation of M-0001's "printed suggestion" stance. The
   baseline settings.json is unchanged; the grant activates only while the
   skill is active. Narrowest possible surface; flagged for adversarial
   review attention.
2. **Deny-level functional break, deferred to M-0003.** `git push origin
   --delete` collides with M-0001's remote-branch-deletion deny at one
   executable site (`apes-feature.md:249`, fenced cleanup step) plus one
   prose policy bullet (`apes-build.md:415`). Those body steps hard-block —
   not prompt — until M-0003 rewrites them. Independently re-confirms the
   3.6.0 ship-together constraint: M-0001+M-0002 without M-0003 is a broken
   cleanup path, not just a noisy one. Must-fix AC queued in
   `_planning/M-0003-scope-additions.md`.
3. **Zero-prompt smoke exception (AC 4 as amended).** `/apes-mission list`
   and `/apes-status` still prompt at the two known `node -e` pipelines
   (`apes-mission.md:123`, `apes-status.md:80`) — M-0003 remediation scope.
   The unqualified zero-prompt criterion holds at the 3.6.0 release level,
   not per-mission.

## What changed

- **Task 1** — apes-map reconciled with the final M-0001 policy (reference
  patterns are not grandfathered): `+Bash(ls:*)`, `−cat/wc/tail`
  (declared-but-unused). Canonical style: single-line, `Bash(x:*)` no-space.
- **Tasks 2–5** — per-file grants for the build family (+apes-gc, absent
  from §2.4), mission-ops, verification + read-only commands, and all
  fifteen skills. Every row re-derived from a full body read; the analysis
  table's "body invokes" column was treated as hypothesis after three
  extraction defects were found (column-0 fence anchoring, unfenced
  indentation-style code, and a whole-file token scan that matched
  frontmatter declarations against themselves).
- **Task 6** — `framework/scripts/allowed-tools-guard.test.js` (+2 pinned
  fence-format fixtures): three-layer drift guard (frontmatter syntax;
  declaration→usage with a Read/Grep/Glob floor and cited pin tables;
  usage→coverage against a faithful model of the permission matcher,
  including the space-star bare-form quirk). Wired into `npm test`; the
  packaging guard asserts fixtures never ship. **This test is the mission's
  L1 mechanism** (no linter exists in this zero-dep repo) and rides L0.

## Mission-file amendments (approved at gates)

- AC "apes-map unchanged" → "reconciled with final M-0001 policy".
- AC 4 reworded with the two named `node -e` exceptions + release-level
  clause.
- L1 mechanized by the drift guard; `log-verification.js` no-ops in this
  repo (`_planning/` vs `.planning/` dogfooding gap) — verification evidence
  lives in the workpad and this PR.

## Verification

- **L0:** `npm test` green **re-run at push HEAD** — parser 31, tracker 51,
  codex suites 48, forbidden-commands guard 54, **allowed-tools guard 108**,
  CLI 24 (includes the new `no fixtures/ ships` packaging assertion).
- **L1:** the allowed-tools guard itself — 33 files, all three layers, pin
  inventory 1 expected-deny / 77 known-prompting / 2 prose / 2 task-tool
  prose, zero stale pins.

## Findings shipped to the ledger (`_planning/M-0003-scope-additions.md`)

- Bare-form gaps: bare `git status`/`git stash`/`git tag <name>`/
  argument-less `check-structure.sh` unmatched by their space-star rules
  (bare `git tag` also bypasses the `-a` ask rule). Body fixes → M-0003;
  policy pairs → deny-audit follow-up thread (M-0004 inherits policy, does
  not author it).
- Plain `git checkout` → `git switch` migration: **11 sites** (resolves the
  handoff's count of nine).
- **L8 enablement default inverted vs docs** (candidate bugfix mission):
  both codex scripts treat missing/unparseable config as `enabled: true`,
  while five surfaces — three doc sites, the shipped template's
  `enabled: false`, the installer's "(disabled by default)" line — document
  opt-in. `/apes-verify` is opt-in; direct script invocation is opt-out.
- Full `node -e` site inventory, env-prefix/trap/chain sites, deferred
  utility grants, and the apes-codex-review `Edit` restoration rider.

## Superseded-rulings audit trail

Every evidence-based reversal (apes-map trim, codex-review Edit drop,
apes-help/metrics lean, cross-model-review codex-script trim,
evidence-packets log-verification trim, product TaskUpdate trim) is recorded
with rationale in the mission workpad and `_planning/M-0002-closeout-tracker.md`
§3. Pattern: pre-evidence ruling or §2.4 row, overturned by full body read.

## Handoff notes

- **M-0003** must absorb the full ledger into its AC before its todo→doing
  move; its playbook drafts only after that absorb (ledger is now final).
- **M-0004**: its fingerprint table keys off M-0001's final policy **plus**
  the 33 files scoped here — confirm whether frontmatter state affects its
  migration scope before drafting.
