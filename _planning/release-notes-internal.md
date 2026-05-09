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
