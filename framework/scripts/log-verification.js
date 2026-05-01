#!/usr/bin/env node
//
// log-verification.js — append a verification run to the active mission's log.
//
// Usage:
//   node log-verification.js <level> <outcome> <summary> [details-json]
//
//   <level>     Pyramid level ID: L0, L0.5, L1, L1.5, L2, L2.5, L3, L4, L5, L6, L7
//   <outcome>   pass | fail | skip
//   <summary>   one-line human-readable result
//   [details]   optional JSON string with level-specific freeform fields
//
// Behavior:
//   - Reads the active mission ID from .planning/active-mission (single line).
//   - Locates the mission file under .planning/missions/<state>/M-NNNN-*.md.
//   - Appends a JSONL record to .planning/missions/<state>/M-NNNN/verification.jsonl.
//   - Graceful degradation: if the active-mission file is missing/unreadable,
//     the mission cannot be located, or the log cannot be written, this script
//     prints a warning to stderr and exits 0 — it never fails the caller.
//   - Always exits 0 except on argument-validation errors (exit 2), so a
//     calling verification script's outcome is preserved.
//
"use strict";

const fs = require("fs");
const path = require("path");

const PREFIX = "log-verification:";

const LEVEL_NAMES = {
  "L0":   "Build",
  "L0.5": "Auto Code Review",
  "L1":   "Static Analysis",
  "L1.5": "Documentation Drift",
  "L2":   "Unit Tests",
  "L2.5": "Coverage Gate",
  "L3":   "Integration Tests",
  "L4":   "UI Integration",
  "L5":   "Security Scan",
  "L6":   "E2E / Browser",
  "L7":   "Visual Regression",
};

const OUTCOMES = new Set(["pass", "fail", "skip"]);
const STATES = ["todo", "doing", "review", "done", "canceled"];

function warn(msg) {
  process.stderr.write(`${PREFIX} ${msg}\n`);
}

function usage() {
  process.stderr.write(
    "Usage: node log-verification.js <level> <outcome> <summary> [details-json]\n"
  );
  process.exit(2);
}

function findRepoRoot(start) {
  let dir = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readActiveMission(root) {
  const p = path.join(root, ".planning", "active-mission");
  if (!fs.existsSync(p)) return null;
  let text;
  try {
    text = fs.readFileSync(p, "utf8");
  } catch (err) {
    warn(`could not read ${p}: ${err.message}`);
    return null;
  }
  const id = text.trim().split(/\s+/)[0] || "";
  if (!/^M-\d{4}$/.test(id)) {
    warn(`.planning/active-mission contains invalid mission ID "${id}"`);
    return null;
  }
  return id;
}

function findMissionState(root, id) {
  for (const state of STATES) {
    const dir = path.join(root, ".planning", "missions", state);
    if (!fs.existsSync(dir)) continue;
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    if (entries.some((f) => f.startsWith(`${id}-`) && f.endsWith(".md"))) {
      return state;
    }
  }
  return null;
}

function appendRecord(root, state, id, record) {
  const dir = path.join(root, ".planning", "missions", state, id);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    warn(`could not create ${dir}: ${err.message}`);
    return false;
  }
  const file = path.join(dir, "verification.jsonl");
  try {
    fs.appendFileSync(file, JSON.stringify(record) + "\n");
    return true;
  } catch (err) {
    warn(`could not append to ${file}: ${err.message}`);
    return false;
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 3) usage();

  const [level, outcome, summary, detailsRaw] = argv;

  if (!Object.prototype.hasOwnProperty.call(LEVEL_NAMES, level)) {
    process.stderr.write(`${PREFIX} unknown level "${level}" (known: ${Object.keys(LEVEL_NAMES).join(", ")})\n`);
    process.exit(2);
  }
  if (!OUTCOMES.has(outcome)) {
    process.stderr.write(`${PREFIX} invalid outcome "${outcome}" (must be pass | fail | skip)\n`);
    process.exit(2);
  }
  if (typeof summary !== "string" || summary.length === 0) {
    process.stderr.write(`${PREFIX} summary must be a non-empty string\n`);
    process.exit(2);
  }

  let details = {};
  if (detailsRaw !== undefined) {
    try {
      details = JSON.parse(detailsRaw);
    } catch (err) {
      process.stderr.write(`${PREFIX} details argument is not valid JSON: ${err.message}\n`);
      process.exit(2);
    }
    if (details === null || typeof details !== "object" || Array.isArray(details)) {
      process.stderr.write(`${PREFIX} details must be a JSON object\n`);
      process.exit(2);
    }
  }

  // From here on, every failure is a graceful no-op.
  const root = findRepoRoot(process.cwd());
  if (!root) {
    warn("not inside a git repository — skipping log");
    return;
  }

  const id = readActiveMission(root);
  if (!id) {
    warn("no active mission — skipping log");
    return;
  }

  const state = findMissionState(root, id);
  if (!state) {
    warn(`active mission ${id} not found in .planning/missions/ — skipping log`);
    return;
  }

  const durationEnv = process.env.VERIFICATION_DURATION_MS;
  const duration_ms = durationEnv && /^\d+$/.test(durationEnv) ? Number(durationEnv) : null;

  const record = {
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    level,
    level_name: LEVEL_NAMES[level],
    outcome,
    duration_ms,
    details,
    summary,
  };

  appendRecord(root, state, id, record);
}

try {
  main();
} catch (err) {
  warn(err && err.message ? err.message : String(err));
  // graceful degradation
}
