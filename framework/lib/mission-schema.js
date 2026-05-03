"use strict";
//
// mission-schema.js — frozen constants and validation/migration helpers for
// mission frontmatter. Single source of truth for schema versioning.
//
// Exports:
//   CURRENT_SCHEMA_VERSION   — integer; bump when adding a migration
//   STATES                   — frozen array of valid state names
//   LEVEL_IDS                — frozen array of valid verification level IDs
//   validateFrontmatter(fm)  → { valid, errors }
//   migrateFrontmatter(fm)   → migrated frontmatter (stub today; M-0005 / M-0006 add migrations)
//
// Zero dependencies. No I/O.
//

// ─── Schema version ─────────────────────────────────────────────────────────
//
// Every mission carries an implicit (or explicit) schema_version field.
// Missions written before versioning are treated as version 1. Bump this
// constant in lockstep with adding a migration step in migrateFrontmatter.

const CURRENT_SCHEMA_VERSION = 1;

// ─── Enumerations ───────────────────────────────────────────────────────────

const STATES = Object.freeze(["todo", "doing", "review", "done", "canceled"]);

const LEVEL_IDS = Object.freeze([
  "L0", "L0.5", "L1", "L1.5", "L2", "L2.5",
  "L3", "L4", "L5", "L6", "L7", "L8",
]);

const REQUIRED_FIELDS = Object.freeze(["id", "title", "state", "created", "updated"]);
const MISSION_ID_REGEX = /^M-\d{4}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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
      errors.push(`invalid id "${fm.id}" — must match M-NNNN (exactly four digits)`);
    }
  }

  if (fm.state !== undefined && fm.state !== null && fm.state !== "") {
    if (!STATES.includes(fm.state)) {
      errors.push(`invalid state "${fm.state}" — must be one of: ${STATES.join(", ")}`);
    }
  }

  for (const dateField of ["created", "updated"]) {
    const v = fm[dateField];
    if (v !== undefined && v !== null && v !== "") {
      if (typeof v !== "string" || !ISO_DATE_REGEX.test(v)) {
        errors.push(`${dateField} must be an ISO date (YYYY-MM-DD), got "${v}"`);
      }
    }
  }

  if (fm.priority !== undefined && fm.priority !== null) {
    if (!Number.isInteger(fm.priority) || fm.priority < 1 || fm.priority > 5) {
      errors.push(`priority must be an integer between 1 and 5, got ${JSON.stringify(fm.priority)}`);
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
      validateLevelArray(fm.verification.required_levels, "verification.required_levels", errors);
      validateLevelArray(fm.verification.optional_levels, "verification.optional_levels", errors);
    }
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
      errors.push(`invalid level in ${fieldName}: "${lvl}" (valid: ${LEVEL_IDS.join(", ")})`);
    }
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
  // Example shape (do not uncomment — kept here as documentation):
  // {
  //   from: 1,
  //   to: 2,
  //   migrate(fm) {
  //     // shallow-clone, then transform
  //     return { ...fm, schema_version: 2, /* ...new fields... */ };
  //   },
  // },
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
      `migrateFrontmatter: schema_version must be an integer, got ${JSON.stringify(working.schema_version)}`
    );
  }

  if (working.schema_version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `migrateFrontmatter: schema_version ${working.schema_version} is newer than this parser supports ` +
      `(CURRENT_SCHEMA_VERSION=${CURRENT_SCHEMA_VERSION}); upgrade your tooling`
    );
  }

  while (working.schema_version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === working.schema_version);
    if (!step) {
      throw new Error(
        `migrateFrontmatter: no migration registered for schema_version ${working.schema_version} → next`
      );
    }
    working = step.migrate(working);
    if (working.schema_version !== step.to) {
      throw new Error(
        `migrateFrontmatter: migration ${step.from} → ${step.to} did not set schema_version correctly`
      );
    }
  }

  return working;
}

module.exports = {
  CURRENT_SCHEMA_VERSION,
  STATES,
  LEVEL_IDS,
  validateFrontmatter,
  migrateFrontmatter,
};
