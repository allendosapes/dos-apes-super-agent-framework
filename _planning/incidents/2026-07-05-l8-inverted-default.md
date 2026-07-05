# Incident: L8 config-load default inverted vs the documented opt-in contract

**Date:** 2026-07-05 (defect shipped 2026-05 with 3.2.0; found 2026-07-04 at the M-0002 pre-L8 gate)
**Session:** M-0005 (l8-inverted-default), Tasks 1–5.
**Author:** Claude Opus 4.8 (1M context), as the agent that executed the mission.
**Severity:** Medium (feature activation against user intent; no data loss; masked in practice by the capability gate failing on unconfigured Codex CLIs).
**Status:** Fixed on `mission/M-0005-l8-inverted-default` (fix commit `57e1d38`, tests `01c48ed`). Second occurrence of the inverted-default class — see class rule below.

> Naming note: an earlier mission numbering also used "M-0005" (the codex
> review state mission, 3.4.0, referenced in
> `2026-05-03-local-main-ahead-of-origin.md`). This incident belongs to the
> current backlog's M-0005. The ID-reuse hazard is already ledgered in
> `_planning/M-0003-scope-additions.md` ("mission IDs must not be reused").

---

## Summary

Both L8 entry scripts — `framework/scripts/codex-review.js` and
`framework/scripts/codex-review-loop.js` — carried `enabled: true` in their
`DEFAULT_CONFIG` objects and fell back to those defaults whenever
`.dos-apes/codex-review-config.json` was **missing**, **unparseable**, or
**not a JSON object**. The only state that disabled L8 was an explicit,
successfully-parsed `enabled: false`. Every documented surface said the
opposite: the README L8 contract section ("Opt-in. Disabled by default."),
`apes-codex-review.md:10` ("opt-in, off by default"),
`cross-model-review.md:15` ("opt-in and disabled by default"), the shipped
config template (`enabled: false`), the installer's "(disabled by default)"
line, and `apes-verify`'s bash gate — which implements true opt-in
(`L8_ENABLED=0` unless the file exists and `enabled === true`). Net effect:
`/apes-verify` was opt-in while direct script/loop invocation was opt-out,
and the scripts activated L8 exactly when the config was absent or corrupt.

The sharpest manifestation, confirmed by observation during Task 1 recon: a
PowerShell UTF-8 BOM on a config containing an explicit `{"enabled": false}`
made `JSON.parse` throw, which routed to the enabled-defaults fallback — the
user's explicit *off* decision was silently inverted to *on*. The BOM is this
repo's best-known Windows hazard (README warns about it for these very
files), so the failure path was not hypothetical.

---

## Root cause

`DEFAULT_CONFIG.enabled: true` plus fall-through-to-defaults on every config
defect. "Fails open" — L8's real contract that a *Codex* problem never fails
the pyramid — was over-applied to *config* problems, where failing open means
"activate a feature nobody asked for."

Observed pre-fix behavior (Task 1, both scripts, scratch sandbox, no Codex
invoked; the capability-gate stub was the discriminator):

| Config state                      | Pre-fix behavior          |
|-----------------------------------|---------------------------|
| No `.dos-apes/` at all            | **enabled** (silent)      |
| Garbage JSON                      | **enabled** (stderr warn) |
| BOM + `{"enabled": false}`        | **enabled** — explicit false discarded |
| Bare `true` (primitive)           | **enabled** (silent)      |
| `[]` (array)                      | **enabled** (silent — passed the `typeof` guard, `typeof [] === "object"`) |
| Explicit `{"enabled": false}`     | disabled                  |
| Explicit `{"enabled": true}`      | enabled                   |

---

## The fix

Shipped fallback matrix, identical in both scripts via a shared helper
(`framework/scripts/codex-config.js`, `loadCodexConfig`):

| Config state                    | Behavior                                                           |
|---------------------------------|--------------------------------------------------------------------|
| File absent                     | Disabled → `skipped`, reason `config-absent` (silent)              |
| Unparseable (bad JSON / BOM)    | Disabled → `skipped`, reason `config-unparseable`, one stderr warn |
| Parsed but not a plain object   | Disabled → `skipped`, reason `config-invalid`, one stderr warn (explicit `Array.isArray` check — arrays no longer slip the `typeof` guard) |
| `enabled: false` / key missing  | Disabled → `skipped`, reason `disabled` (silent)                   |
| `enabled: true` (strict)        | Enabled — proceed to the codex-check capability gate               |

The structural fix, not just the value flip: **no `enabled` key exists in any
defaults object anymore.** Enablement cannot be inherited, merged, or
defaulted — it comes only from a strict `enabled === true` on a parsed plain
object, matching `apes-verify`'s bash gate. All skips exit 0; stdout stays a
pure JSON envelope; warnings go to stderr only, and only for the unparseable
and invalid states. The loop's skip messages name the config state, so a
`codex.required: true` refusal (`RequiredSkipError`, exit 1) surfaces the
real cause plus the remedy ("enable L8 or remove codex.required") instead of
implying a Codex outage. A companion guard stops `writeResult` from creating
`.dos-apes/` as a side effect of a skip — a config-absent skip must not
create the directory whose absence caused it.

Regression suite: `codex-config.test.js`, 20 tests — both scripts × eight
config states with exec-boundary spies (stubbed capability gate, stubbed
single-shot review, poison `codex` on PATH), the BOM fixture committed as
deliberate bytes with a self-check test, both directions of the writeResult
guard, and the `codex.required` × config-absent hard-failure path.

---

## The class: inverted defaults (second occurrence)

First occurrence: M-0001's root cause (`5fb19a1`) — same shape, a default
that contradicted the documented contract, biting exactly in the
degraded/unconfigured state where no one is looking.

**Class rule: defaults must match documented contracts; absence of config is
never consent.** When a feature is documented as opt-in, every failure to
read the opt-in signal — missing file, parse error, wrong shape — must
resolve to *off*. "Fails open" applies to runtime dependencies (Codex
offline), never to the consent signal itself. Any `DEFAULT_*` object that
contains the enablement key for an opt-in feature is the bug, regardless of
its current value: the key's presence means some code path can activate the
feature without an explicit user decision.

---

## Follow-up findings

### (a) Packaging gap — whitelist verified in the wrong direction

`package.json` `files` is a **file-by-file** whitelist of
`framework/scripts/*` (not a directory grant, despite CLAUDE.md's summary
reading that way). The new `codex-config.js` helper was not on it; the
installed layout would have crashed both scripts with `MODULE_NOT_FOUND`.
Caught in Task 3 only because writing the fixtures forced a read of the
actual `files` array — the Task 2 report had claimed "ships automatically"
from the CLAUDE.md summary (hazard #5 in miniature: the summary was a lead,
not a fact). The packaging test verifies *listed files ship*, not *required
files are listed* — a require()-graph-vs-whitelist integrity check would
catch this class deterministically. **Candidate mission; park with the
guard-integrity thread.**

### (b) Process near-miss — narrated approval is not an executed action

Between Tasks 3 and 4, reviewer approval arrived phrased as past-tense
narration ("Task 3 is approved and committed") while no commit existed —
HEAD was still the M-0002 merge and all work sat staged-but-uncommitted.
Past-tense narration does not execute anything; only an imperative plus the
gated workflow's explicit commit approval does. The session **flagged the
drift instead of self-committing to make the narration true**, and the
reconciliation was then ordered explicitly (three commits, `73a1b13` →
`01c48ed`). Flag-don't-fix is the pattern to reinforce: when the stated
world and the observed world disagree, surface the disagreement — never
edit the world to match the statement.

---

## What the agent should remember

1. **Opt-in means the consent signal fails closed.** Every defect in reading
   the signal resolves to off. Check where the *degraded* path lands, not
   just the happy path.
2. **`typeof x === "object"` admits arrays.** A JSON config guard needs
   `Array.isArray` too, or `[]` merges as a valid config.
3. **A BOM can invert an explicit user decision** when parse-failure falls
   back to permissive defaults. Fixture the BOM as deliberate bytes so the
   regression stays pinned.
4. **Read the actual whitelist before claiming something ships.** Summaries
   of `package.json` are hypotheses; the `files` array is the fact.
