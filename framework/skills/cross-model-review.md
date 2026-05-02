---
name: cross-model-review
description: How to consume a structured external-model review (Codex L8) and address its findings inside a feedback loop. Load when the codex-review.js output is on disk, when /apes-codex-review is invoked, or when iterating on findings.
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
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

   This is the mission's record of what the cross-model loop did to its diff. Format follows the project's mission-workpad convention (see `missions.md`).

2. **Critical-finding escalation.** If a `critical` finding cannot be addressed inside the loop (e.g. it requires an architectural change, a schema migration, or a decision outside the mission's scope):

   - Mark the mission frontmatter with `codex_findings_unresolved: true`.
   - Stop the loop with the **blocked** terminal state (see below).
   - Leave the finding in place for human triage — do not delete the findings file.

3. **Verification log.** A separate L8 entry is appended to `verification.jsonl` by `scripts/codex-review.js` itself (when the missions framework is wired). This skill does **not** write that log directly.

> **Note:** This skill does not modify the missions framework. The wiring that lets `log-verification.js` accept `L8` lands separately. Until that wires up, the verification log entry may be skipped — that's expected and is not a failure of this skill.

## When to stop the loop

The loop terminates on **exactly one** of these three conditions. Each maps to a distinct terminal state.

| #   | Condition                                          | Terminal state | What it means                                                                          |
|-----|----------------------------------------------------|----------------|----------------------------------------------------------------------------------------|
| 1   | Latest verdict is `accept`                         | **clean**      | Reviewer signed off. Findings file is the final record. Proceed to merge.              |
| 2   | `max_iterations` reached (default 3)               | **capped**     | Loop budget exhausted with at least one open high/critical. Surface to user; do not auto-merge. |
| 3   | `critical` finding cannot be addressed             | **blocked**    | An open critical finding requires action outside the loop's scope. Escalate.           |

### Terminal-state actions

| State    | Commit          | Mission                                              | User-visible signal                                                  |
|----------|-----------------|------------------------------------------------------|----------------------------------------------------------------------|
| clean    | Final fix commit | Workpad: "L8 clean after N iteration(s)"             | Quiet success. Branch is mergeable from L8's perspective.            |
| capped   | Last fix commit | Workpad: lists open findings; no `unresolved` flag  | Warn: "L8 capped at N iterations; M findings still open." Human decides. |
| blocked  | Last fix commit | `codex_findings_unresolved: true` in frontmatter     | Block merge. Surface the unaddressable critical finding by file:line.|

In all three cases, the original Codex findings file (`.dos-apes/codex-reviews/*.json`) is preserved — it's the audit trail.

## Cross-references

- `testing.md` — L8's place in the verification pyramid, evidence packets.
- `missions.md` — mission lifecycle, workpad protocol, frontmatter fields.
- `.dos-apes/codex-review-config.README.md` — config field reference and capability cache.
- `.dos-apes/codex-review-schema.json` — authoritative findings schema.
- `.dos-apes/codex-review-prompt.md` — reviewer prompt + placeholder contract.
- `scripts/codex-review.js` — the single-shot review primitive this skill consumes.
- `scripts/codex-check.js` — prerequisite check (CLI, auth, capability cache).
