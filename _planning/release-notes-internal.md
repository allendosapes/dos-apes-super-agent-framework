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
