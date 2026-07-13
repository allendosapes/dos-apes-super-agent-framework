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
