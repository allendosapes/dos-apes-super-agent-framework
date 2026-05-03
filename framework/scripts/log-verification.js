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

const { MissionTracker } = require("../lib/mission-tracker.js");

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
  "L8":   "Adversarial Review",
};

const OUTCOMES = new Set(["pass", "fail", "skip"]);

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

function appendRecord(file, record) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  } catch (err) {
    warn(`could not create ${path.dirname(file)}: ${err.message}`);
    return false;
  }
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

  const tracker = new MissionTracker({
    root: path.join(root, ".planning", "missions"),
  });

  const id = tracker.getActiveMission();
  if (!id) {
    warn("no active mission — skipping log");
    return;
  }

  const mission = tracker.findMissionById(id);
  if (!mission) {
    warn(`active mission ${id} not found in .planning/missions/ — skipping log`);
    return;
  }

  const logFile = tracker.getVerificationLogPath(id);

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

  appendRecord(logFile, record);
}

try {
  main();
} catch (err) {
  warn(err && err.message ? err.message : String(err));
  // graceful degradation
}
