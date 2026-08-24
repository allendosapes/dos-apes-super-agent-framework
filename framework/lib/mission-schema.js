"use strict";
//
// mission-schema.js — frozen constants and validation/migration helpers for
// mission frontmatter. Single source of truth for schema versioning.
//
// Exports:
//   CURRENT_SCHEMA_VERSION   — integer; bump when adding a migration
//   STATES                   — frozen array of valid state names
//   LEVEL_IDS                — frozen array of valid verification level IDs
//   CODEX_VERDICTS           — frozen array of valid codex.last_verdict values
//   validateFrontmatter(fm)  → { valid, errors }
//   migrateFrontmatter(fm)   → migrated frontmatter (idempotent; v1 → v2)
//
// Zero dependencies. No I/O.
//

// ─── Schema version ─────────────────────────────────────────────────────────
//
// Every mission carries an implicit (or explicit) schema_version field.
// Missions written before versioning are treated as version 1. Bump this
// constant in lockstep with adding a migration step in migrateFrontmatter.

const CURRENT_SCHEMA_VERSION = 2;

// ─── Enumerations ───────────────────────────────────────────────────────────

const STATES = Object.freeze(["todo", "doing", "review", "done", "canceled"]);

const LEVEL_IDS = Object.freeze([
  "L0",
  "L0.5",
  "L1",
  "L1.5",
  "L2",
  "L2.5",
  "L3",
  "L4",
  "L5",
  "L6",
  "L7",
  "L8",
]);

// Terminal verdicts emitted by the L8 (Codex adversarial review) loop. Stored
// on the mission's `codex.last_verdict` so the gate can reason about whether
// a review→done transition is allowed.
const CODEX_VERDICTS = Object.freeze([
  "none", // no L8 run yet
  "accepted", // reviewer signed off
  "partial-success", // accepted with caveats; non-blocking findings
  "findings-reported", // findings exist; resolution pending
  "exhausted", // hit max_rounds without convergence
  "no-progress", // loop terminated due to lack of forward progress
  "skipped", // explicitly skipped (e.g., not required for this mission)
]);

// The only reviewer verdict a human may adjudicate (M-0007).
//
// `partial-success` means the review RAN TO COMPLETION and left only low/medium
// findings. Every other non-accepted terminal means the review is unfinished —
// `exhausted` hit the budget with critical/high still open, `no-progress` stalled,
// `skipped` never ran, `findings-reported` reported without resolving. Unfinished
// is not the same as finished-with-acceptable-residue, and adjudication is only
// for the second.
const ADJUDICABLE_VERDICT = "partial-success";

const REQUIRED_FIELDS = Object.freeze([
  "id",
  "title",
  "state",
  "created",
  "updated",
]);
const MISSION_ID_REGEX = /^M-\d{4}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// Accepts the JS toISOString() form plus shorter variants without ms / TZ.
const ISO_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

// ─── Validation ─────────────────────────────────────────────────────────────

// Surface every problem at once instead of throwing on the first one — a
// reviewer reading the error list should see all the gaps in a single pass.
function validateFrontmatter(fm) {
  const errors = [];
  if (!fm || typeof fm !== "object" || Array.isArray(fm)) {
    return { valid: false, errors: ["frontmatter must be a plain object"] };
  }

  for (const key of REQUIRED_FIELDS) {
    if (fm[key] === undefined || fm[key] === null || fm[key] === "") {
      errors.push(`missing required field: ${key}`);
    }
  }

  if (fm.id !== undefined && fm.id !== null && fm.id !== "") {
    if (typeof fm.id !== "string" || !MISSION_ID_REGEX.test(fm.id)) {
      errors.push(
        `invalid id "${fm.id}" — must match M-NNNN (exactly four digits)`,
      );
    }
  }

  if (fm.state !== undefined && fm.state !== null && fm.state !== "") {
    if (!STATES.includes(fm.state)) {
      errors.push(
        `invalid state "${fm.state}" — must be one of: ${STATES.join(", ")}`,
      );
    }
  }

  for (const dateField of ["created", "updated"]) {
    const v = fm[dateField];
    if (v !== undefined && v !== null && v !== "") {
      if (typeof v !== "string" || !ISO_DATE_REGEX.test(v)) {
        errors.push(
          `${dateField} must be an ISO date (YYYY-MM-DD), got "${v}"`,
        );
      }
    }
  }

  if (fm.priority !== undefined && fm.priority !== null) {
    if (!Number.isInteger(fm.priority) || fm.priority < 1 || fm.priority > 5) {
      errors.push(
        `priority must be an integer between 1 and 5, got ${JSON.stringify(fm.priority)}`,
      );
    }
  }

  if (fm.depends_on !== undefined && fm.depends_on !== null) {
    if (!Array.isArray(fm.depends_on)) {
      errors.push("depends_on must be an array of mission IDs");
    } else {
      for (const dep of fm.depends_on) {
        if (typeof dep !== "string" || !MISSION_ID_REGEX.test(dep)) {
          errors.push(`invalid mission ID in depends_on: "${dep}"`);
        }
      }
    }
  }

  if (fm.verification !== undefined && fm.verification !== null) {
    if (typeof fm.verification !== "object" || Array.isArray(fm.verification)) {
      errors.push("verification must be an object");
    } else {
      validateLevelArray(
        fm.verification.required_levels,
        "verification.required_levels",
        errors,
      );
      validateLevelArray(
        fm.verification.optional_levels,
        "verification.optional_levels",
        errors,
      );
    }
  }

  if (fm.schema_version !== undefined && fm.schema_version !== null) {
    if (!Number.isInteger(fm.schema_version) || fm.schema_version < 1) {
      errors.push(
        `schema_version must be a positive integer, got ${JSON.stringify(fm.schema_version)}`,
      );
    }
  }

  if (fm.codex !== undefined && fm.codex !== null) {
    validateCodexBlock(fm.codex, errors);
  }

  if (fm.human_adjudication !== undefined && fm.human_adjudication !== null) {
    validateHumanAdjudication(fm.human_adjudication, fm.codex, errors);
  }

  return { valid: errors.length === 0, errors };
}

function validateLevelArray(value, fieldName, errors) {
  if (value === undefined || value === null) return;
  if (!Array.isArray(value)) {
    errors.push(`${fieldName} must be an array`);
    return;
  }
  for (const lvl of value) {
    if (!LEVEL_IDS.includes(lvl)) {
      errors.push(
        `invalid level in ${fieldName}: "${lvl}" (valid: ${LEVEL_IDS.join(", ")})`,
      );
    }
  }
}

// Codex (L8) state block — added by L8 the first time it runs, or written
// up-front when a mission opts in via `required: true` / a custom max_rounds.
// All fields are optional; absence is normal for missions that haven't yet
// engaged the adversarial loop.
function validateCodexBlock(codex, errors) {
  if (typeof codex !== "object" || Array.isArray(codex)) {
    errors.push("codex must be an object");
    return;
  }

  if (codex.required !== undefined && typeof codex.required !== "boolean") {
    errors.push(
      `codex.required must be a boolean, got ${JSON.stringify(codex.required)}`,
    );
  }

  if (codex.max_rounds !== undefined) {
    if (!Number.isInteger(codex.max_rounds) || codex.max_rounds < 1) {
      errors.push(
        `codex.max_rounds must be a positive integer, got ${JSON.stringify(codex.max_rounds)}`,
      );
    }
  }

  if (codex.last_verdict !== undefined) {
    if (!CODEX_VERDICTS.includes(codex.last_verdict)) {
      errors.push(
        `invalid codex.last_verdict "${codex.last_verdict}" — must be one of: ${CODEX_VERDICTS.join(", ")}`,
      );
    }
  }

  if (codex.last_review_path !== undefined && codex.last_review_path !== null) {
    if (
      typeof codex.last_review_path !== "string" ||
      codex.last_review_path === ""
    ) {
      errors.push("codex.last_review_path must be a non-empty string when set");
    }
  }

  if (codex.unresolved_findings !== undefined) {
    if (
      !Number.isInteger(codex.unresolved_findings) ||
      codex.unresolved_findings < 0
    ) {
      errors.push(
        `codex.unresolved_findings must be a non-negative integer, got ${JSON.stringify(codex.unresolved_findings)}`,
      );
    }
  }

  if (codex.last_run_at !== undefined && codex.last_run_at !== null) {
    if (
      typeof codex.last_run_at !== "string" ||
      !ISO_DATETIME_REGEX.test(codex.last_run_at)
    ) {
      errors.push(
        `codex.last_run_at must be an ISO 8601 datetime string, got ${JSON.stringify(codex.last_run_at)}`,
      );
    }
  }
}

// Human adjudication of a non-`accepted` reviewer verdict (M-0007).
//
// TOP-LEVEL, deliberately — a sibling of `codex`, not a field inside it.
//
// Two reasons, and the second is the better one. Mechanically, the frontmatter
// serializer supports one level of nesting, so a block inside `codex` cannot be
// written at all. Semantically, this is not a reviewer field: `codex` holds what
// the machine reviewer reported, and human authority does not belong in the same
// object. Keeping them apart is the whole point of the fix, so the serializer
// constraint pushed the design somewhere better than it started.
//
// This block is ADDITIVE and never replaces a reviewer-reported field. It
// exists because `codex.required: true` previously had exactly three exits when
// the review budget was spent with only low/medium findings left — rewrite the
// verdict, re-roll the review, or bypass the transition — and all three falsify
// the record.
//
// The reviewer's conclusion and the human's disposition are different facts and
// are recorded separately. `last_verdict` stays whatever the reviewer said.
// The adjudication is validated AGAINST THE CURRENT CODEX STATE, not in
// isolation. That cross-check is the whole hardening: without it a record
// written when the verdict was `partial-success` stays schema-valid after the
// review is re-run and returns something worse, and would keep authorizing
// completion. Stale adjudication is the failure mode this guards.
//
// Because `validateFrontmatter` runs on every write AND is re-run by the
// `review → done` gate, these invariants cannot be bypassed by editing the file
// by hand — which is the point. The governed setter is a convenience, not the
// enforcement boundary.
function validateHumanAdjudication(adj, codex, errors) {
  if (typeof adj !== "object" || Array.isArray(adj)) {
    errors.push("human_adjudication must be an object");
    return;
  }

  for (const key of ["actor", "adjudicated_verdict", "rationale_ref"]) {
    if (typeof adj[key] !== "string" || adj[key] === "") {
      errors.push(`human_adjudication.${key} must be a non-empty string`);
    }
  }

  if (typeof adj.at !== "string" || !ISO_DATETIME_REGEX.test(adj.at)) {
    errors.push(
      `human_adjudication.at must be an ISO 8601 datetime string, got ${JSON.stringify(adj.at)}`,
    );
  }

  // ── Only `partial-success` is adjudicable ──────────────────────────────
  //
  // Adjudication accepts disclosed low/medium residual risk after a review that
  // RAN TO COMPLETION. It is not a way to close out `exhausted` (budget hit with
  // critical/high still open), `no-progress` (the fix loop stalled), `skipped`
  // (no review happened), or `findings-reported` (report-only, nothing resolved).
  // Each of those means the review is unfinished, and unfinished is not the same
  // as finished-with-acceptable-residue.
  if (
    adj.adjudicated_verdict !== undefined &&
    adj.adjudicated_verdict !== ADJUDICABLE_VERDICT
  ) {
    errors.push(
      `human_adjudication.adjudicated_verdict must be "${ADJUDICABLE_VERDICT}", got ` +
        `${JSON.stringify(adj.adjudicated_verdict)} — adjudication accepts disclosed low/medium ` +
        `residual risk after a completed review, and is not a way to close an unfinished one`,
    );
  }

  if (adj.no_critical_or_high_remaining !== true) {
    errors.push(
      "human_adjudication.no_critical_or_high_remaining must be exactly true — " +
        "adjudication accepts disclosed low/medium residual risk, never unresolved critical or high findings",
    );
  }

  if (
    !Array.isArray(adj.accepted_obligations) ||
    adj.accepted_obligations.length === 0
  ) {
    errors.push(
      "human_adjudication.accepted_obligations must be a non-empty array — " +
        "accepting residual risk requires naming what is being accepted",
    );
  } else if (
    !adj.accepted_obligations.every((o) => typeof o === "string" && o !== "")
  ) {
    errors.push(
      "human_adjudication.accepted_obligations entries must be non-empty strings",
    );
  }

  // ── Severity distribution ──────────────────────────────────────────────
  //
  // M-0007 requires the record to carry the severity distribution of the
  // remaining findings, not just a total. It is expressed as flat sibling counts
  // rather than a nested object because the frontmatter serializer supports one
  // level of nesting and `human_adjudication` already occupies it.
  //
  // Requiring low + medium to account for the WHOLE total is what makes
  // `no_critical_or_high_remaining` mechanical rather than a self-assertion: the
  // total is cross-checked against the reviewer's own count below, so any
  // critical or high finding would leave the distribution unable to balance.
  const counts = {};
  for (const key of [
    "remaining_findings",
    "remaining_low",
    "remaining_medium",
  ]) {
    const v = adj[key];
    if (!Number.isInteger(v) || v < 0) {
      errors.push(
        `human_adjudication.${key} must be a non-negative integer, got ${JSON.stringify(v)}`,
      );
    } else {
      counts[key] = v;
    }
  }

  if (
    counts.remaining_findings !== undefined &&
    counts.remaining_low !== undefined &&
    counts.remaining_medium !== undefined &&
    counts.remaining_low + counts.remaining_medium !== counts.remaining_findings
  ) {
    errors.push(
      `human_adjudication severity distribution does not account for every remaining finding: ` +
        `remaining_low (${counts.remaining_low}) + remaining_medium (${counts.remaining_medium}) ` +
        `!== remaining_findings (${counts.remaining_findings}). Findings that are neither low nor ` +
        `medium cannot be adjudicated.`,
    );
  }

  // ── Cross-checks against the live codex block ──────────────────────────

  if (!codex || typeof codex !== "object" || Array.isArray(codex)) {
    errors.push(
      "human_adjudication requires a codex block — there is no reviewer verdict to adjudicate",
    );
    return;
  }

  // A completed review must actually have happened. Both fields are written by
  // the review loop on terminal, so their absence means no review reached a
  // terminal state for this mission.
  if (typeof codex.last_run_at !== "string" || codex.last_run_at === "") {
    errors.push(
      "human_adjudication requires codex.last_run_at — adjudication presupposes a review that ran",
    );
  }
  if (
    typeof codex.last_review_path !== "string" ||
    codex.last_review_path === ""
  ) {
    errors.push(
      "human_adjudication requires codex.last_review_path — the findings being accepted must be locatable",
    );
  }

  // THE staleness check. If the review is re-run and returns a different
  // verdict, the existing adjudication stops validating and stops unblocking
  // completion, rather than silently outliving the state it was written for.
  if (codex.last_verdict !== adj.adjudicated_verdict) {
    errors.push(
      `human_adjudication is stale: it adjudicates "${adj.adjudicated_verdict}" but the current ` +
        `codex.last_verdict is "${codex.last_verdict}". Re-adjudicate against the current review, ` +
        `or remove the adjudication — never edit the verdict to match it.`,
    );
  }

  // Same staleness argument applied to the count: a re-run that resolves or adds
  // findings must invalidate an adjudication written against the old number.
  if (
    counts.remaining_findings !== undefined &&
    Number.isInteger(codex.unresolved_findings) &&
    codex.unresolved_findings !== counts.remaining_findings
  ) {
    errors.push(
      `human_adjudication is stale: it accepts ${counts.remaining_findings} remaining finding(s) but ` +
        `codex.unresolved_findings is ${codex.unresolved_findings}`,
    );
  }
}

// ─── Migration ──────────────────────────────────────────────────────────────
//
// Today this is effectively a no-op: we're at v1 and there are no prior
// versions to migrate from. The shape exists so M-0005 and M-0006 can add
// migration steps without rewriting the call sites.
//
// Contract:
//   - Missing schema_version  → assume v1, set the field, return.
//   - schema_version === CURRENT_SCHEMA_VERSION → return as-is.
//   - schema_version > CURRENT_SCHEMA_VERSION  → throw (caller's tooling
//     is older than the mission file).
//   - schema_version < CURRENT_SCHEMA_VERSION  → step through the
//     migrations array (none today) until the version matches.
//
// Migrations is an ordered list of `{ from, to, migrate(fm) }` records.
// When a v2 ships, append `{ from: 1, to: 2, migrate: ... }`. The loop
// here picks them up automatically.

const MIGRATIONS = Object.freeze([
  // v1 → v2: introduce the Codex (L8) state block. We do NOT add the block
  // itself — missions without Codex stay clean. The block appears only when
  // L8 first runs, or when the mission explicitly opts in. Bumping `updated`
  // marks the file shape as having changed; the deferred-write principle in
  // mission-tracker means the disk file only catches up on the next mutation.
  {
    from: 1,
    to: 2,
    migrate(fm) {
      const today = new Date().toISOString().slice(0, 10);
      return { ...fm, schema_version: 2, updated: today };
    },
  },
]);

function migrateFrontmatter(fm) {
  if (!fm || typeof fm !== "object" || Array.isArray(fm)) {
    throw new Error("migrateFrontmatter: frontmatter must be a plain object");
  }
  let working = { ...fm };

  if (working.schema_version === undefined || working.schema_version === null) {
    working.schema_version = 1;
  } else if (!Number.isInteger(working.schema_version)) {
    throw new Error(
      `migrateFrontmatter: schema_version must be an integer, got ${JSON.stringify(working.schema_version)}`,
    );
  }

  if (working.schema_version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `migrateFrontmatter: schema_version ${working.schema_version} is newer than this parser supports ` +
        `(CURRENT_SCHEMA_VERSION=${CURRENT_SCHEMA_VERSION}); upgrade your tooling`,
    );
  }

  while (working.schema_version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === working.schema_version);
    if (!step) {
      throw new Error(
        `migrateFrontmatter: no migration registered for schema_version ${working.schema_version} → next`,
      );
    }
    working = step.migrate(working);
    if (working.schema_version !== step.to) {
      throw new Error(
        `migrateFrontmatter: migration ${step.from} → ${step.to} did not set schema_version correctly`,
      );
    }
  }

  return working;
}

module.exports = {
  CURRENT_SCHEMA_VERSION,
  STATES,
  LEVEL_IDS,
  CODEX_VERDICTS,
  ADJUDICABLE_VERDICT,
  validateFrontmatter,
  migrateFrontmatter,
};
