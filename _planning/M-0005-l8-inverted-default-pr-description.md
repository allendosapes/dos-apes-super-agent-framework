# M-0005: L8 inverted default — config load is now opt-in

> **PR description for `mission/M-0005-l8-inverted-default` → `main`.**
> File is slug-qualified because `_planning/M-0005-pr-description.md` belongs
> to the earlier "M-0005" numbering (codex-mission-native, 3.4.0, `32610d3`);
> the ID-reuse hazard is ledgered in `_planning/M-0003-scope-additions.md`.

## Problem

A PowerShell UTF-8 BOM on `.dos-apes/codex-review-config.json` containing an
explicit `{"enabled": false}` **turned L8 on**. `JSON.parse` throws on the
BOM, both L8 scripts fell back to a `DEFAULT_CONFIG` carrying
`enabled: true`, and the user's explicit *off* decision was silently
inverted. The BOM is this repo's best-documented Windows hazard — the README
warns about it for these exact files.

That was the sharpest case of a general inversion: `codex-review.js` and
`codex-review-loop.js` treated **missing**, **unparseable**, and
**non-object** configs as enabled, skipping only on a successfully-parsed
explicit `false` — while every documented surface (README L8 contract,
`apes-codex-review.md`, `cross-model-review.md`, the shipped template's
`enabled: false`, the installer's "(disabled by default)" line) and
`apes-verify`'s bash gate said opt-in, off by default. Net: `/apes-verify`
was opt-in; direct script/loop invocation was opt-out. A JSON array (`[]`)
also slipped the non-object guard entirely (`typeof [] === "object"`).

Second occurrence of the inverted-default class (first: M-0001, `5fb19a1`).

## Fix

Shared loader `framework/scripts/codex-config.js` (`loadCodexConfig`),
consumed by both scripts — codex-check.js untouched (its tolerant read is
deliberate). The matrix:

| Config state                    | Behavior                                                           |
|---------------------------------|--------------------------------------------------------------------|
| File absent                     | Disabled → `skipped`, reason `config-absent` (silent)              |
| Unparseable (bad JSON / BOM)    | Disabled → `skipped`, reason `config-unparseable`, one stderr warn |
| Parsed but not a plain object   | Disabled → `skipped`, reason `config-invalid`, one stderr warn (explicit `Array.isArray` check) |
| `enabled: false` / key missing  | Disabled → `skipped`, reason `disabled` (silent)                   |
| `enabled: true` (strict)        | Enabled — proceed to the codex-check capability gate               |

Structural, not just a value flip: **no `enabled` key exists in any defaults
object anymore.** Enablement comes only from a strict `enabled === true` on a
parsed plain object — the same predicate as `apes-verify`'s bash gate. All
skips exit 0; stdout stays a pure JSON envelope; enabled-check stays ahead of
the capability gate in both scripts. The loop's skip messages name the config
state, so a `codex.required: true` refusal surfaces the real cause plus the
remedy ("enable L8 or remove codex.required") instead of implying a Codex
outage.

**writeResult guard:** the loop's `result.json` write early-returns when
`.dos-apes/` doesn't exist — a config-absent skip no longer creates the
directory whose absence caused it.

## Tests

`framework/scripts/codex-config.test.js` — **20 tests**, house convention
(plain node, mkdtemp git sandboxes, subprocess-driven):

- Both scripts × eight config states (absent / garbage / BOM'd-explicit-false
  / primitive `true` / array `[]` / explicit false / missing key / explicit
  true): exact envelope reason or message, exit 0, stderr warning present
  only for the unparseable and invalid cases.
- **Three exec-boundary spies**: a stub `scripts/codex-check.js` (marker
  proves the capability gate was/wasn't consulted), a stub
  `scripts/codex-review.js` (marker proves the loop did/didn't shell out),
  and a poison `codex` on PATH (must never fire — asserted per case). The
  two enabled cases assert the markers **do** fire, pinning gate order.
- **Deliberate-bytes BOM fixture** (`Buffer.concat([EF BB BF, …])`,
  `fixtures/codex-config/`) with a self-check test asserting the bytes
  survive git — the regression stays pinned to the real Windows hazard.
- writeResult guard both directions; `codex.required` × config-absent hard
  failure (non-zero exit, message names `config-absent` + the remedy).

## Packaging fix (in this PR because the fix is broken without it)

`package.json` `files` is a **file-by-file** whitelist of
`framework/scripts/*`. Without a `framework/scripts/codex-config.js` entry
the tarball omits the helper and both installed scripts crash with
`MODULE_NOT_FOUND` — so the one-line `files` addition ships in the same PR
as the code that requires it. `npm pack --dry-run` verified: helper ships
(2.8 kB); test file and fixtures stay repo-only. Follow-up candidate mission
(require-graph-vs-whitelist integrity check) is parked in the incident file.

## Zero command/skill-file changes

No file under `framework/commands/` or `framework/skills/` is touched: no
collision with M-0003's surface, no allowed-tools guard pin changes
(guard suite green: 108 passed). The three prose sites whose skip-cause
enumerations are now incomplete are ledgered for M-0003, not edited here.

## Links

- Incident write-up: `_planning/incidents/2026-07-05-l8-inverted-default.md`
- M-0003 ledger entry: `_planning/M-0003-scope-additions.md` §"2026-07-05 —
  M-0005 fallout: skip-cause enumerations missing the three new config reasons"
- Mission file: `_planning/missions/doing/M-0005-l8-inverted-default.md`

## Commits

| SHA       | Subject                                                                          |
|-----------|----------------------------------------------------------------------------------|
| `73a1b13` | chore(M-0005): mission file (doing)                                              |
| `57e1d38` | fix(M-0005): opt-in default for L8 config load                                   |
| `01c48ed` | test(M-0005): config matrix + codex.required regression suite; ship codex-config.js |
| `c1c883a` | chore(M-0005): normalize mission filename to canonical slug                      |
| `d4dca15` | docs(M-0005): incident write-up, M-0003 ledger entry, mission workpad            |
| *(HEAD)*  | docs(M-0005): PR description                                                     |
