---
name: cross-model-review
description: How to consume a structured external-model review (Codex L8) and address its findings inside a feedback loop. Load when the codex-review.js output is on disk, when /apes-codex-review is invoked, or when iterating on findings.
allowed-tools: Read, Edit, Grep, Glob, Bash(node scripts/mission-cli.js:*)
---

# Cross-Model Review Skill

## Overview

The pattern: a **second model** (the reviewer) reads the diff produced by the **first model** (the implementer) and emits structured findings. The implementer then addresses those findings in a bounded loop. Two different models catching each other's blind spots is more robust than one model reviewing its own work.

Codex CLI is the current reviewer. The skill is **model-agnostic by design** — every contract here (verdict shape, severity scale, schema) lives in `.dos-apes/codex-review-schema.json` and the prompt template in `.dos-apes/codex-review-prompt.md`. Swapping reviewers means swapping those files, not this skill.

This is **L8** of the verification pyramid (see `testing.md`). It is opt-in and disabled by default — see `.dos-apes/codex-review-config.README.md`.

## When this skill is loaded

Load this skill in any of three situations:

1. **Inside the feedback loop.** After `scripts/codex-review.js` writes a findings file (default: `.dos-apes/codex-reviews/<stamp>.json`), the loop driver hands the file to an agent and loads this skill so the agent knows how to triage and fix.
2. **When `/apes-codex-review` is invoked manually.** The user can run a one-shot review against the current branch; this skill explains how to act on the result.
3. **When iterating on prior findings.** Picking up a stale `codex-reviews/*.json` and continuing the loop on a later session — same protocol applies.

If the findings file is missing, malformed, or `{ "skipped": true }`, **stop**. There is nothing to act on. Surface the skip reason and exit cleanly.

## Findings format

Findings conform to `.dos-apes/codex-review-schema.json`. Read that file as the authoritative contract — what follows is a quick reference, not a redefinition.

### Top-level fields

| Field        | Type     | Meaning                                                                |
|--------------|----------|------------------------------------------------------------------------|
| `verdict`    | enum     | `accept` / `revise` / `reject` — see verdict semantics below.          |
| `confidence` | number   | 0.0–1.0 — reviewer's confidence in the verdict.                        |
| `summary`    | string   | One-sentence justification.                                            |
| `findings`   | array    | Zero or more finding objects (may be empty for clean accepts).         |

### Verdict semantics

| Verdict  | Meaning                                                                                   | Default loop behavior                                            |
|----------|-------------------------------------------------------------------------------------------|------------------------------------------------------------------|
| `accept` | Ship as-is or with low/medium nits the author may ignore.                                 | **Stop the loop** (terminal: clean — see "When to stop").       |
| `revise` | At least one high/critical finding must be addressed before merge.                        | Address eligible findings, re-run review.                        |
| `reject` | Change is fundamentally wrong (wrong approach, wrong scope, breaks invariants).           | Address eligible findings if tractable, otherwise escalate.      |

### Finding fields

| Field           | Type            | Meaning                                                                  |
|-----------------|-----------------|--------------------------------------------------------------------------|
| `severity`      | enum            | `critical` / `high` / `medium` / `low` — see severity reference below.   |
| `category`      | enum            | `correctness` / `performance` / `security` / `maintainability` / `dx` / `testing` |
| `file`          | string          | Repo-relative path. Must be inside the diff.                             |
| `line_range`    | `{start, end}`  | 1-indexed, inclusive. Must fall within the diff's hunks.                 |
| `explanation`   | string          | What's wrong and why.                                                    |
| `suggested_fix` | string (opt.)   | Reviewer's proposed remediation. Treat as input, not a directive.        |

### Severity reference

| Severity   | Definition                                                                                          |
|------------|-----------------------------------------------------------------------------------------------------|
| `critical` | Bug that will fail in production, data-loss risk, or security vulnerability.                        |
| `high`     | Likely bug, significant performance regression, or missing error handling on a critical path.       |
| `medium`   | Code smell with concrete impact, missing test for added behavior, or unclear API.                   |
| `low`      | Minor improvement, documentation gap, or naming suggestion.                                         |

## Triage protocol

The triage rules are **unambiguous by severity**. Do not invent your own thresholds.

### Eligibility table

| Severity   | Verdict `accept` | Verdict `revise` | Verdict `reject` |
|------------|------------------|------------------|------------------|
| `critical` | Address          | Address          | Address          |
| `high`     | Address          | Address          | Address          |
| `medium`   | **Skip**         | Address          | Address          |
| `low`      | **Skip**         | **Skip**         | **Skip**         |

`low` findings are **never** addressed inside the loop — they're left for human review. This is intentional: the loop optimizes for closing real defects, not polishing.

### Order of operations

1. Filter the `findings` array to only those eligible per the table above.
2. Sort eligible findings by `(severity_rank, file, line_range.start)` — critical before high before medium, then by repo-relative path, then by line number ascending.
3. Address them in that order. Stop at the first one that can't be addressed (see "Critical finding cannot be addressed" below).

### Rejecting a finding (when Codex is wrong)

If a finding is **incorrect** — Codex misread the code, the cited line range is outside the diff, or the suggested fix would break a documented invariant — **document the rejection in the iteration notes**. Do not silently skip. The notes go in:

- The mission workpad if a mission is active (see "Composition with missions"); or
- A short comment on the iteration's commit message body when running standalone.

Format:

```
Rejected: <file>:<line> [severity] — reason
```

Rejected findings still count against the loop's iteration budget but do not extend it.

## Fix protocol

When implementing a fix:

1. **Make the minimal change** that addresses the finding. If the finding cites lines 42–48, your edit should touch lines 42–48 (and only adjacent lines if the fix mechanically requires it).
2. **Do not refactor surrounding code.** No "while I'm here" cleanups, no rename-for-consistency, no moving code to a different file.
3. **Do not modify files outside the diff scope.** If the finding cites a file you didn't change in the original diff, that's a finding bug — reject it (see above).
4. **If the fix would break tests**, do not blindly fix. Either:
   - The finding is wrong → reject with a note pointing at the test that would break.
   - The test is wrong → surface that in the iteration notes; treat it as a separate decision the user must approve.
5. **Run the existing verification pyramid** (L0–L2.5 minimum) after the fix and before the next review iteration. A fix that breaks a build is worse than the original finding.
6. **Commit each iteration's fixes** with this message format:

   ```
   fix(codex-review): address iteration N findings
   ```

   Where `N` is the loop iteration number (1, 2, 3, …). Body lists the addressed findings by `<file>:<line> [severity]`.

## Anti-patterns

These are explicit DO-NOTs. Each is a signal that the loop is being misused.

| Anti-pattern                                                       | Why it's wrong                                                              |
|--------------------------------------------------------------------|-----------------------------------------------------------------------------|
| Over-correcting on `low` style suggestions                         | Polish dilutes signal, eats iteration budget, and trains the loop to drift. |
| Bundling unrelated changes into the fix commit                     | Loses the link between findings and fixes; bloats the diff Codex re-reviews.|
| Modifying files outside the original diff's scope                  | The reviewer cited `<file>` in the diff. Touching unrelated files is scope creep. |
| Arguing with `low`-severity findings in commit messages or notes   | If it's `low`, you skipped it. No further commentary needed.                |
| Silently skipping a finding without a rejection note               | Looks like the loop addressed it; future iterations will surface it again.  |
| Inflating severity to force the next iteration to act              | The loop's `loop_on_severity` config exists exactly to prevent this game.   |
| Renaming/restructuring the diff so Codex sees fewer findings       | Hides defects; corrupts the cross-model contract.                           |

## Composition with missions

Mission integration is **optional**. When no mission is active, skip this section — everything in "Triage" and "Fix" still applies.

When a mission **is** active (`.planning/active-mission` is set and the mission file is locatable):

1. **Per-iteration workpad entry.** After each loop iteration, append a short entry to the mission's workpad summarizing:
   - Iteration number.
   - Findings addressed (file:line + severity).
   - Findings rejected with reasons.
   - Verdict on the next-iteration review.

   The loop driver (`scripts/codex-review-loop.js`) writes a terminal-state workpad entry on its own for `partial-success`, `exhausted`, and `no-progress` (per M-0005 P3). Skip duplicate per-iteration entries when the loop is in charge — write them yourself only for the standalone (non-loop) flow.

2. **Critical-finding escalation.** If a `critical` finding cannot be addressed inside the loop (e.g. it requires an architectural change, a schema migration, or a decision outside the mission's scope):

   - The loop terminates with `exhausted` or `no-progress` (see [Terminal states](#when-to-stop-the-loop)).
   - `/apes-build` sets `codex_findings_unresolved: true` on the mission frontmatter as a backward-compat signal (M-0004 era field; new tooling should read `codex.last_verdict` and `codex.unresolved_findings` from the codex block).
   - Leave the finding in place for human triage — do not delete the findings file.

3. **Verification log.** A separate L8 entry is appended to `verification.jsonl` by `scripts/codex-review.js` itself. This skill does **not** write that log directly.

## Mission state surface

Since M-0005, every L8 run that targets a mission persists its outcome
into the mission's `codex` frontmatter block — the same surface
`/apes-status` reads, the same surface `/apes-build` branches on, the
same surface `/apes-codex-review` reports against. This replaces the
older "parse loop stdout" pattern with a durable, human-readable record
on the mission file itself.

### Where the state lives

The codex block is a one-level-nested object under the mission's
frontmatter, validated by `framework/lib/mission-schema.js` (schema
version 2). Read it via the mission CLI:

```bash
node scripts/mission-cli.js show M-0042 \
  | node -e 'let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).frontmatter.codex || null))'
```

Or in-process via `MissionTracker.getCodexState(id)` — see
`missions.md` "Codex review state" for the field reference.

### Who writes which field

| Field                  | Writer                                          | When                                                                       |
|------------------------|-------------------------------------------------|----------------------------------------------------------------------------|
| `required`             | Author / setCodexState                          | Set explicitly when a mission must run L8 before review → done.            |
| `max_rounds`           | Author / setCodexState                          | Per-mission override of the global `max_iterations` config.                |
| `last_verdict`         | `codex-review.js`, `codex-review-loop.js`       | Single-shot writes accept/revise/reject (mapped); loop writes its terminal state. |
| `last_review_path`     | `codex-review.js`, `codex-review-loop.js`       | Relative path to the most recent `review.json` (single-shot or final loop iteration). |
| `unresolved_findings`  | `codex-review.js`, `codex-review-loop.js`       | Count of high/critical findings still open. `accepted` resets to 0.        |
| `last_run_at`          | `codex-review.js`, `codex-review-loop.js`       | ISO 8601 timestamp; loop bumps it at each iteration start AND on terminal. |

All writes go through `MissionTracker.setCodexState` — never edit the
codex block by hand or via `mission-cli update --field codex.X=Y`.

### How callers consume it

- **`/apes-build`** reads `codex.last_verdict` after the loop returns
  and branches on it (Step 4.5 in `apes-build.md`). It still sets the
  legacy top-level `codex_findings_unresolved: true` flag for
  `exhausted` / `no-progress` so M-0004-era dashboards keep working.
- **`/apes-status`** surfaces `codex.last_verdict` and
  `codex.unresolved_findings` on missions in `doing/` and `review/`.
  Missions without a codex block render exactly as before.
- **`/apes-codex-review`** (and any future custom command) should
  prefer the codex block over re-running the review when state
  freshness allows.

### required: true gate

Setting `codex.required: true` makes a `skipped` terminal an error: the
loop exits non-zero rather than allow a required L8 review to be
silently bypassed when Codex happens to be unavailable. The build flow
catches the non-zero exit and refuses to advance the mission to
`review/`. See `apes-build.md` Step 4.5 for the hard-stop behavior.

## When to stop the loop

The loop terminates in **exactly one** of six states. Each maps to a
specific `codex.last_verdict` value, a specific workpad treatment, and
a specific build-flow action.

| Terminal state      | `codex.last_verdict` | Trigger                                                              | Workpad entry?                          |
|---------------------|----------------------|----------------------------------------------------------------------|-----------------------------------------|
| **accepted**        | `accepted`           | Reviewer signed off (verdict `accept` or empty findings).            | No — clean accept doesn't merit a note. |
| **partial-success** | `partial-success`    | Only low/medium findings remain (none loop-eligible).                | Yes — summary of low/medium findings.   |
| **findings-reported** | `findings-reported` | `--no-fix` was set; loop reports without attempting a fix.           | No — user explicitly opted into report-only. |
| **exhausted**       | `exhausted`          | Hit `max_iterations` cap with open high/critical findings.           | Yes — list unresolved + final review path. |
| **no-progress**     | `no-progress`        | Fix step ran but HEAD did not advance.                               | Yes — note + final review path.         |
| **skipped**         | `skipped`            | Codex unavailable / disabled / no diff to review.                    | No — skip is uninteresting (unless `required: true`, in which case the loop errors instead). |

In every case, the original Codex review files
(`.dos-apes/codex-reviews/*.json`) are preserved as the audit trail.
The mission state (todo/doing/review/done/canceled) is **never**
changed by the loop — that's the caller's responsibility.

## Cross-references

- `testing.md` — L8's place in the verification pyramid, evidence packets.
- `missions.md` — mission lifecycle, workpad protocol, frontmatter fields, "Codex review state" section.
- `framework/lib/mission-schema.js` — `CODEX_VERDICTS` enum + validation for the codex block.
- `framework/lib/mission-tracker.js` — `getCodexState` / `setCodexState` / `clearCodexState` API.
- `.dos-apes/codex-review-config.README.md` — config field reference and capability cache.
- `.dos-apes/codex-review-schema.json` — authoritative findings schema.
- `.dos-apes/codex-review-prompt.md` — reviewer prompt + placeholder contract.
- `scripts/codex-review.js` — the single-shot review primitive this skill consumes.
- `scripts/codex-review-loop.js` — the loop driver that maps terminal states onto the codex block.
- `scripts/codex-check.js` — prerequisite check (CLI, auth, capability cache).
