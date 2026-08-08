# Release notes — internal

Notes that don't belong in the public CHANGELOG but are worth keeping
alongside it for future-you's sanity.

## 3.4.0 — squash-commit conflation with 3.3.0 work

M-0002 (3.3.0) was published from local main without pushing to origin.
M-0005's PR therefore included M-0002 + M-0005 content, squash-merged as
commit `32610d3` with the subject "M-0005". Public CHANGELOG entries at
3.3.0 and 3.4.0 accurately describe each version's contents; git history
on origin/main conflates the two missions into one commit. Functional
impact: none. Audit trail impact: minor.

Recurrence prevention: see `_planning/incidents/2026-05-03-local-main-ahead-of-origin.md`
for the P0 sync-check that future mission playbooks should adopt.

3.4.0 publish deferred to a fresh session per CPO call. Tag will point at
HEAD-of-main at publish time, not at the M-0005 squash commit.

## 3.4.0 published 2026-05-08

- Channel: beta
- gitHead: 27bfc3f8edd71fae83a1eaa1e0439817e59d6ad6 (matches main HEAD)
- latest dist-tag: still 3.0.0 (unchanged)
- Provenance: not generated (local publish; --provenance unsupported without GitHub Actions OIDC)
- Token used: temporary granular access token, revoked/expiring per its set lifetime

M-0005 fully closed.

## 3.5.0 merged to main 2026-05-08

3.5.0 merged to main, awaiting publish in fresh session per dual-publish
convention. M-0006 (Claude Desktop authoring instructions) shipped.

- Squash commit on main: `4ecc0a9` ("M-0006: Claude Desktop authoring instructions (3.5.0) (#8)")
- PR: #8
- L8 Codex review: skipped — framework repo doesn't yet have an L8 config
  set up against itself. Manual review only. Future mission queued to set
  up L8 for self-review.
- Smoke test: passed (Allen ran the eight-item checklist manually,
  including the three Claude Desktop workflow round-trips).
- Branch hygiene: P0 sync-check (CLAUDE.md hazard #4) ran clean — local
  main was at v3.4.0 + the post-publish docs commit (`943e768`),
  in-sync with origin before branch creation.
- Publish: deferred to a fresh session per dual-publish convention. Tag
  will point at HEAD-of-main at publish time.

## 3.6.0 — branch-retention sunset (pending)

On publish, the retained mission branches — `mission/M-0001-least-privilege-permissions`,
`mission/M-0002-allowed-tools-frontmatter`, `mission/M-0005-l8-inverted-default` — may be
deleted from origin and `delete_branch_on_merge` reconsidered. They exist only to keep their
workpad/incident-cited SHAs browsable until this release ships (see CLAUDE.md, Maintainer-Gated
Workflow). Delete them only after 3.6.0 is published, not before.

## 3.6.0 release prep (pending publish)

Prepared on `release/3.6.0-prep`, branched from main at `f665968`. Nothing
published yet; this records the prepared state, not a publish outcome.

- Channel: beta (`npm publish --tag beta`)
- latest dist-tag: stays 3.0.0, unchanged. Promotion is a separate decision
  gated on M-0006 (installer permission migration), not on this release.
- Version: 3.5.1 → 3.6.0 in `package.json`
- Missions shipping: M-0001, M-0002, M-0003, M-0004
- gitHead: to be recorded at publish time. Tag points at HEAD-of-main at
  publish, not at a prep-branch commit, per the 3.4.0/3.5.0 convention.
- Provenance: expect not generated (local publish; `--provenance` unsupported
  without GitHub Actions OIDC).
- Publish deferred to a fresh session per the dual-publish convention.

**Measured at prep HEAD (not carried forward from any earlier mission):** full
`npm test` 352 passed / 0 failed; allowed-tools-guard 108 passed / 0 failed,
pin table at 53 entries (46 `util` + 7 `policy`), `node-e`/`bare-form`/`env`
classes empty. This **supersedes the 336/0 figure** in M-0003's closeout
workpad, which measured a tree 16 tests smaller: `guard-main-branch.test.js`
was not yet in `test:lib` (+10), and the `mission-tracker` (+5) and `cli` (+1)
suites have grown since. M-0004's own AC-7 entry independently records 352/0,
matching this measurement.

**AC-9 differential is analytic, not empirical.** No pre-M-0003 re-run was
performed, so no before/after differential exists. Do not let the public
CHANGELOG's measured test figures and this attribution be read as one claim —
they are deliberately worded as two.

## 3.6.0 — GitHub org transfer (2026-08-08)

The repo moved from `allendosapes/` to `dos-apes/` before this release. RP-2
repointed 16 forward-facing URLs across 10 files (npm metadata, CLI output,
the generated CLAUDE.md footer, Claude Desktop skill deep links, six
templates). Archival references in `_planning/` and CLAUDE.md hazard entry 11
were deliberately left on the old namespace — entry 11 is a rule *about* the
`allendosapes` account, and rewriting it would invert it into advice that
destroys the redirect. Any future URL sweep must treat the hazard log as
archival.
