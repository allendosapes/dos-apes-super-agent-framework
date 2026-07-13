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
