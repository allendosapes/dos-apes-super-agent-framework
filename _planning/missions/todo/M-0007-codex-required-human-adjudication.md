---
id: M-0007
title: "codex.required: reconcile, enforce, and provide a governed human-adjudication path"
priority: 1
labels:
  - bugfix
  - l8
  - governance
depends_on: []
codex:
  required: false # L8 does not review its own gate — circular; smoke via fixture states instead
verification:
  required_levels:
    - L0
    - L1
    - L2
    - L2.5
---

## Problem

`codex.required: true` conflates two different requirements, documents them
inconsistently, and enforces neither at the point that matters. Discovered by
dogfooding in the Dos Apes Coding Troop repository, where it currently blocks
closeout of an approved mission. Handed over as **BP-003** in that repository's
`.planning/FRAMEWORK_BACKPORTS.md`.

Three distinct defects, which must be fixed together.

### A — the two skills state different rules

- `framework/skills/missions.md`, codex block table:
  _"When `true`, the mission cannot transition to `done` without
  `last_verdict: accepted`."_
- `framework/skills/cross-model-review.md`, §"required: true gate": describes
  something narrower — a **`skipped`** terminal becomes an error, the loop exits
  non-zero, and the build flow refuses to advance the mission to **`review/`**.

Those are different gates on different transitions. A reader has no way to tell
which is authoritative.

### B — the documented `review → done` gate is unenforced

`MissionTracker.validateStateTransition()` and `canTransition()` check mission
existence, target validity and the state FSM. **Neither consults the codex
block.** `moveMission()` does not either.

Verified against a real mission carrying `codex.required: true` and
`last_verdict: partial-success`:

```
$ node scripts/mission-cli.js can-transition M-0004 done
{"id":"M-0004","target":"done","allowed":true,"reason":"ok","current_state":"review"}
```

So `codex.required: true` currently provides **no completion guarantee at all**.
The only thing enforcing it is an agent reading `missions.md` and choosing to
honour it.

### C — there is no governed human-adjudication path

Even once B is enforced, there is no legitimate exit for the case that actually
occurs:

- the configured review budget (`max_rounds`) is exhausted,
- **all critical/high findings are resolved**,
- only **disclosed low/medium caveats** remain, and
- **a human reviewer explicitly accepts** those residual risks.

The Coding Troop mission hit exactly this. Four L8 rounds ran. The round-4
reviewer returned _"accepted-with-caveats"_ and stated that no remaining
unresolved critical/high issue undermined the boundary — while correctly leaving
four named caveats rather than pretending they had disappeared. `partial-success`
is the honest verdict, and `partial-success` would block `done`.

**Every workaround available today is falsification:**

| Workaround                            | Why it is wrong                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| Rewrite `last_verdict` to `accepted`  | Fabricates an external reviewer's conclusion — the exact failure L8 exists to prevent |
| Run another round for cleaner wording | The budget was spent; re-rolling until the wording improves is not review             |
| Bypass the transition                 | Defeats the control rather than governing it                                          |

A gate whose only escapes are falsification is defective, not strict.

**Order matters: C is a prerequisite for B.** Enforcing the gate before an
adjudication path exists would convert a documentation-only rule into a real gate
with no legitimate exit, and would harden the trap rather than fix it.

## Acceptance

- `framework/skills/missions.md` and `framework/skills/cross-model-review.md`
  state the **same** rule for what `codex.required: true` gates, on which
  transitions, and with which exits.
- A **top-level** `human_adjudication` block exists — a sibling of `codex`, not a
  field inside it — is schema-validated, and is **additive**: recording it never
  mutates `last_verdict`, `unresolved_findings`, `last_review_path`, or any other
  reviewer-reported field.
- The adjudication record carries at minimum: actor, ISO-8601 timestamp, the
  verdict being adjudicated, the count and severity distribution of remaining
  findings, an explicit assertion that no critical or high findings remain, the
  accepted residual obligations, and a reference to where those obligations are
  recorded.
  - **Severity distribution shape.** Expressed as flat sibling counts
    `remaining_low` and `remaining_medium`, not a nested object: the frontmatter
    serializer supports one level of nesting and `human_adjudication` already
    occupies it. Both are **required**, and `remaining_low + remaining_medium`
    must equal `remaining_findings`.
- **The invariants are enforced in the schema, not only in the setter**, so a
  hand-edited mission file cannot bypass them:
  - only `partial-success` is adjudicable;
  - `adjudicated_verdict` must equal the current `codex.last_verdict`;
  - `remaining_findings` must equal the current `codex.unresolved_findings`;
  - `codex.last_run_at` and `codex.last_review_path` must both be present, so the
    adjudication corresponds to a review that actually completed and whose
    findings are locatable;
  - the severity distribution must balance against the total.
- **Stale adjudication fails closed.** If the review is re-run and returns a
  different verdict or a different finding count, the existing adjudication stops
  validating and stops unblocking `review → done`. The remedy is to re-adjudicate
  against the current review, never to edit the verdict to match the record.
- `MissionTracker` exposes a governed way to write that record. It derives the
  total from the reviewer's own count and refuses a caller-supplied total that
  contradicts it, refuses a non-`partial-success` verdict, and refuses to write
  without the severity distribution.
- `canTransition()` and `moveMission()` both enforce the `review → done`
  precondition, so the CLI and any programmatic caller behave identically:
  `codex.required !== true` **OR** `last_verdict === 'accepted'` **OR** a valid
  `human_adjudication` record is present.
- A mission with `codex.required: true`, `last_verdict: partial-success` and
  **no** adjudication is **refused** the `review → done` transition, with a
  message naming the two legitimate remedies.
- The same mission **with** a valid adjudication is **allowed**, and
  `last_verdict` still reads `partial-success` afterwards.
- Adjudication is refused when `last_verdict` is `exhausted` or `no-progress`
  with unresolved critical/high findings — accepting residual risk is not the
  same as accepting unfinished review.
- Residual findings remain in the evidence packet after adjudication. A packet
  whose caveats vanish on adjudication has reintroduced the defect in a
  friendlier form.
- Regression tests cover: refusal without adjudication, allowance with it,
  `last_verdict` immutability across adjudication, refusal of a contradictory
  adjudication, and both skills agreeing.

## Notes

The product being built with this Framework has already ratified this exact
distinction, which is why the adjudication record must never overwrite the
reviewer verdict:

- **D-053** — human authority is a durable control-plane record; an agent _"must
  not create an approval, refusal, waiver, or human-attributed authority
  record"_.
- **ADR-011 §A3** — approvals, refusals, waivers and confirmations remain
  semantically distinct and _"must not collapse into a generic user-replied
  event"_.
- **ADR-011 §A4** — a waiver _"never converts an unmet requirement into a passed
  requirement"_.

Treat `human_adjudication` the way a governed approval is treated: a human
authority record, not a field an agent may set because a gate is inconvenient.

`codex.required: false` on this mission is deliberate and follows the M-0005
precedent — L8 reviewing its own gate is circular. Smoke via fixture states
instead.

## Workpad

<!-- Append timestamped entries; do not delete prior entries. -->
