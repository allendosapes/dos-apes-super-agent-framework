---
id: M-0005
title: "L8 inverted-default: scripts enable review on missing/unparseable config"
priority: 1
labels:
  - bugfix
  - l8
depends_on: []
codex:
  required: false  # L8 does not review its own fix — circular; smoke via fixture states instead
verification:
  required_levels:
    - L0
    - L1
    - L2
    - L2.5
---

## Problem

Both `scripts/codex-review.js` and `scripts/codex-review-loop.js` default
`enabled: true` when `.dos-apes/codex-review-config.json` is **missing**,
**unparseable**, or **not an object** — they skip only on an explicit
`enabled: false`. This contradicts:

1. The README L8 contract section ("opt-in and disabled by default")
2. Two further doc sites stating off-by-default (locate and cite at execution)
3. `apes-verify`'s bash gate, which implements real opt-in

Consequence: a fresh install with no L8 config gets adversarial review it never
asked for — or, more likely, confusing skip/auth-failure noise from an
unconfigured Codex CLI.

**Same inverted-default class as M-0001's root cause (`5fb19a1`).** Second
occurrence of the class; the incident write-up must say so explicitly.

## Decision (ratified 2026-07-05)

The scripts flip to match the docs — the docs are the contract, and apes-verify
already implements it. Fallback matrix, identical in both scripts:

| Config state                    | Behavior                                                          |
|---------------------------------|-------------------------------------------------------------------|
| File absent                     | Disabled → `skipped` envelope, reason `config-absent`             |
| File unparseable (bad JSON/BOM) | Disabled → `skipped`, reason `config-unparseable`, stderr warning |
| Parsed but not an object        | Disabled → `skipped`, reason `config-invalid`, stderr warning     |
| `enabled: false` (explicit)     | Disabled → `skipped`, reason `disabled`                           |
| `enabled: true` (explicit)      | Enabled — proceed to codex-check capability gate                  |

Rationale for unparseable → disabled-with-warning rather than enabled: "fails
open" means a *Codex* problem never fails the pyramid; it has never meant "a
*config* problem silently activates the feature." A BOM'd config (the known
Windows hazard) must not turn L8 on.

## Acceptance criteria

- [ ] **AC-1:** `codex-review.js` implements the fallback matrix. No path
      reaches Codex invocation without an explicit `enabled: true` from a
      parsed object config.
- [ ] **AC-2:** `codex-review-loop.js` implements the identical matrix — same
      reasons, same envelope shape, same stderr warnings. No drift between the
      two scripts (shared helper in `scripts/` only if it's a simplification;
      never in `lib/`).
- [ ] **AC-3:** Regression tests cover both scripts × five config states
      (absent / unparseable / non-object / explicit false / explicit true),
      asserting envelope status + reason, no Codex invocation attempted in the
      four disabled states, and stderr warnings present only for
      unparseable/invalid. The unparseable fixture is a deliberately BOM'd JSON
      file created as bytes.
- [ ] **AC-4:** `codex.required: true` interaction verified: with required set
      and config absent/disabled/unparseable, the loop still refuses to
      terminate `skipped`, and the surfaced error names the config state and
      the remedy ("enable L8 or remove codex.required") rather than implying a
      Codex outage.
- [ ] **AC-5:** The three doc sites re-read and confirmed accurate post-fix.
      Expected zero doc edits; any doc site living in a command file that needs
      changes is ledgered for M-0003, not edited here.
- [ ] **AC-6:** Root-cause write-up in `_planning/incidents/` naming the
      inverted-default class, cross-referencing M-0001 / `5fb19a1`, and stating
      the class rule: defaults must match documented contracts; absence of
      config is never consent.

## Scope

**In:** `scripts/codex-review.js`, `scripts/codex-review-loop.js`, their tests
and fixtures, `_planning/incidents/` write-up.

**Out:** command files and skills (zero collision with M-0003's surface),
`codex-check.js` capability gating, allowed-tools policy or guard pins. Any
unexpected guard trip is a stop-and-present event, not an inline fix.

## Verification notes

L8 smoke: drive each script's config-load path against every fixture state
manually; `codex.required` stays unset/false on this mission — requiring the
feature under repair to review its own fix is circular. Enabled-check stays
ahead of capability-check; stdout stays pure JSON envelope (warnings to stderr
only).

## References

2026-07-04 session handoff, "Two candidate bugfix missions" §1; M-0001 root
cause `5fb19a1`; README L8 contract section.

## Workpad

### 2026-07-05 14:30

**Tasks 1–5 executed (gated, one STOP per task).**

- **T1 recon:** repo-root `scripts/codex-review.js` / `codex-check.js` are
  dogfooding shims forwarding to `framework/scripts/` — fix target is
  framework/ only. Seven config states driven by observation in a non-git
  scratch sandbox (capability-gate stub as discriminator): absent, garbage,
  BOM'd-`enabled:false`, bare `true`, `[]`, explicit false, explicit true —
  all but explicit-false behaved as enabled. Sharpest: the BOM inverted an
  explicit `enabled: false` to on. Extra: `[]` passes the `typeof` guard
  (`typeof [] === "object"`); loop's `terminal()` wrote `result.json` even
  on skip. Three doc sites cited (README:347-349, apes-codex-review.md:10,
  cross-model-review.md:15); apes-verify:242-248 is the true opt-in gate.
- **T2 fix (rulings):** shared `codex-config.js` helper (`loadCodexConfig`);
  **no `enabled` key in any DEFAULT_CONFIG** — strict `enabled === true` on
  a parsed plain object is the only enable path (ruling 1); explicit
  `Array.isArray` in the invalid guard; `writeResult` writes only when
  `.dos-apes/` already exists (ruling 2); loop skip messages name the config
  state; `RequiredSkipError` carries the remedy wording.
- **T3 tests:** `codex-config.test.js` — both scripts × 8 states (matrix
  grew from 5 after recon: array + missing-key + BOM split out), envelope +
  warning + exit assertions, three exec-boundary spies (check stub, review
  stub, poison `codex` on PATH), BOM fixture as deliberate bytes with
  self-check, writeResult guard both directions. Riders: `readConfig` zero
  hits; envelope parsers are reason-agnostic (3 incomplete prose sites
  ledgered to M-0003). **Packaging fix:** `files` is a per-file whitelist —
  `codex-config.js` added or installed scripts would MODULE_NOT_FOUND.
- **T4 (AC-4):** codex.required × 4 disabled states observed — exit 1,
  refusal names config state verbatim (payload.message passes through
  unmodified) + "enable L8 or remove codex.required"; control (required:
  false) skips clean at exit 0. Zero code changes; one test added (20 total).
- **T5 (AC-5/AC-6):** three doc sites re-read post-fix — zero edits needed,
  docs were the contract. Skip-cause prose enumerations ledgered as M-0005
  fallout in `_planning/M-0003-scope-additions.md`. Incident write-up at
  `_planning/incidents/2026-07-05-l8-inverted-default.md` (inverted-default
  class, 2nd occurrence after M-0001/`5fb19a1`; follow-ups: whitelist
  integrity check candidate mission; narrated-approval near-miss).
- **Commit trail:** reconciled on `mission/M-0005-l8-inverted-default` —
  `73a1b13` mission file, `57e1d38` fix, `01c48ed` tests, `c1c883a` filename
  normalization (`-final` suffix dropped).
