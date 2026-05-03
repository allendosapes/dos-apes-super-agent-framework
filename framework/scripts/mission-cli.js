#!/usr/bin/env node
//
// mission-cli.js — thin CLI wrapper around MissionTracker.
//
// =============================================================================
// HISTORY: this file was reconstructed during P6 (2026-05-03) after the
// original was lost when a chained `cd "" && rm -rf framework` ran in the
// project root. The 80-line header docstring (this block, through "create"
// flag docs) is the verbatim original — it was read into the agent's
// context shortly before the loss. Everything below the divider was
// rebuilt from the MissionTracker API surface and the calling sites in
// apes-{mission,build,evidence,status}.md, then verified against an 8-case
// failure-mode matrix (list invalid state, show missing/invalid id,
// can-transition FSM violation, move from terminal state, update id-immutable,
// update schema-invalid, unknown-verb). All eight passed.
//
// Three helpers were added during reconstruction that were not necessarily in
// the original; each has a documented load-bearing reason:
//   • sortMissions       — apes-mission.md says the CLI returns missions in
//                          priority/created order. Documented contract.
//   • coerceFieldValue   — apes-build.md uses `--field codex_findings_unresolved=true`
//                          and that value is documented as a YAML boolean.
//                          Without coercion it would serialize as the string
//                          "true" and silently change semantics.
//   • projectRelative    — emits repo-relative paths so the JSON output is
//                          portable across machines. Defensible; original may
//                          or may not have done this.
//
// See _planning/incidents/2026-05-03-framework-destruction.md for the full
// postmortem. If this reconstruction diverges from the original in any way
// that breaks a downstream consumer, the canonical source is the
// conversation transcript that completed P5.
// =============================================================================
//
// Every verb prints exactly one JSON object to stdout on success. Errors
// go to stderr (prefixed `mission-cli:`). Exit codes follow this pattern:
//
//   0 = ok
//   1 = invalid input (bad arg shape, bad ID format, missing required arg)
//   2 = mission not found
//   3 = state precondition failed (FSM violation, schema validation, etc.)
//
// Verbs:
//
//   list [--state <state>]          list missions; --state filters to one bucket
//   show <id>                       full mission record (frontmatter + body)
//   next-id                         next available mission ID
//   can-transition <id> <state>     0 if allowed, 3 if not, 2 if missing, 1 if bad input
//   move <id> <state>               transition the mission's state
//   workpad <id> "<note>"           append a timestamped workpad entry
//   update <id> --field <key>=<val> shallow-merge a single frontmatter field
//   deps <id>                       { id, unmet, cycle } — unmet deps + cycle paths
//   active                          { active: <id> | null } from .planning/active-mission
//   set-active <id>                 write .planning/active-mission
//   clear-active                    delete .planning/active-mission
//   create --title "<t>" [opts]     create a new mission in todo/
//                                   opts: --priority N --phase ID
//                                         --depends-on M-XXXX (repeatable)
//                                         --label X (repeatable)
//

"use strict";

const fs = require("fs");
const path = require("path");

const { MissionTracker } = require("../lib/mission-tracker.js");

const PREFIX = "mission-cli:";

const EXIT_OK = 0;
const EXIT_INVALID_INPUT = 1;
const EXIT_NOT_FOUND = 2;
const EXIT_PRECONDITION = 3;

const STATES = ["todo", "doing", "review", "done", "canceled"];
const MISSION_ID_REGEX = /^M-\d{4}$/;

// ─── Helpers ────────────────────────────────────────────────────────────────

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function die(code, message) {
  process.stderr.write(`${PREFIX} ${message}\n`);
  process.exit(code);
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

let _trackerCache = null;
function tracker() {
  if (_trackerCache) return _trackerCache;
  const root = findRepoRoot(process.cwd());
  if (!root) die(EXIT_INVALID_INPUT, "not inside a git repository");
  _trackerCache = new MissionTracker({
    root: path.join(root, ".planning", "missions"),
  });
  return _trackerCache;
}

function requireValidId(id) {
  if (typeof id !== "string" || !MISSION_ID_REGEX.test(id)) {
    die(EXIT_INVALID_INPUT, `invalid mission ID "${id}" — must match M-NNNN`);
  }
}

function requireValidState(state) {
  if (!STATES.includes(state)) {
    die(EXIT_INVALID_INPUT,
      `invalid state "${state}" — must be one of: ${STATES.join(", ")}`);
  }
}

// Serialize a mission record for JSON output. Strips internal absolute paths
// down to repo-relative form so the output is portable across machines.
function projectRelative(p) {
  const root = findRepoRoot(process.cwd());
  if (!root) return p;
  const rel = path.relative(root, p);
  return rel.split(path.sep).join("/");
}

// Parse a flat array of CLI args into { positional, flags, repeated }.
//   --key value         → flags.key = "value"
//   --key=value         → flags.key = "value"
//   --flag (no value)   → flags.flag = true
//   repeated --key v    → repeated.key = [v1, v2, ...]
function parseArgs(argv) {
  const positional = [];
  const flags = {};
  const repeated = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      let key, value;
      if (eq !== -1) {
        key = a.slice(2, eq);
        value = a.slice(eq + 1);
      } else {
        key = a.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          value = next;
          i++;
        } else {
          value = true;
        }
      }
      if (Object.prototype.hasOwnProperty.call(flags, key)) {
        if (!repeated[key]) repeated[key] = [flags[key]];
        repeated[key].push(value);
        flags[key] = value;
      } else {
        flags[key] = value;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags, repeated };
}

// ─── Verbs ──────────────────────────────────────────────────────────────────

// Sort key documented in apes-mission.md: priority ascending, then created
// ascending. Missions without an explicit priority default to 3.
function sortMissions(arr) {
  return arr.slice().sort((a, b) => {
    const ap = Number.isInteger(a.frontmatter.priority) ? a.frontmatter.priority : 3;
    const bp = Number.isInteger(b.frontmatter.priority) ? b.frontmatter.priority : 3;
    if (ap !== bp) return ap - bp;
    const ac = a.frontmatter.created || "";
    const bc = b.frontmatter.created || "";
    if (ac !== bc) return ac < bc ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function cmdList(args) {
  const { flags } = parseArgs(args);
  const t = tracker();
  if (flags.state !== undefined) {
    requireValidState(flags.state);
    const missions = sortMissions(t.listMissionsByState(flags.state)).map((m) => ({
      id: m.id,
      title: m.title,
      state: flags.state,
      path: projectRelative(m.path),
      frontmatter: m.frontmatter,
    }));
    emit({ state: flags.state, count: missions.length, missions });
    return EXIT_OK;
  }
  const all = t.listAllMissions();
  const out = {};
  let total = 0;
  for (const state of STATES) {
    out[state] = sortMissions(all[state]).map((m) => ({
      id: m.id,
      title: m.title,
      state,
      path: projectRelative(m.path),
      frontmatter: m.frontmatter,
    }));
    total += out[state].length;
  }
  emit({ count: total, missions: out });
  return EXIT_OK;
}

function cmdShow(args) {
  const { positional } = parseArgs(args);
  const id = positional[0];
  if (!id) die(EXIT_INVALID_INPUT, "show: mission ID is required");
  requireValidId(id);
  const m = tracker().findMissionById(id);
  if (!m) die(EXIT_NOT_FOUND, `show: mission ${id} not found`);
  emit({
    id: m.frontmatter.id,
    title: m.frontmatter.title,
    state: m.state,
    path: projectRelative(m.path),
    frontmatter: m.frontmatter,
    body: m.body,
  });
  return EXIT_OK;
}

function cmdNextId() {
  const id = tracker().generateNextId();
  emit({ next_id: id });
  return EXIT_OK;
}

function cmdCanTransition(args) {
  const { positional } = parseArgs(args);
  const [id, target] = positional;
  if (!id || !target) {
    die(EXIT_INVALID_INPUT, "can-transition: mission ID and target state are required");
  }
  requireValidId(id);
  requireValidState(target);
  const t = tracker();
  const m = t.findMissionById(id);
  if (!m) {
    emit({ id, target, allowed: false, reason: `mission ${id} not found` });
    process.exit(EXIT_NOT_FOUND);
  }
  const result = t.canTransition(id, target);
  emit({ id, target, ...result, current_state: m.state });
  return result.allowed ? EXIT_OK : EXIT_PRECONDITION;
}

function cmdMove(args) {
  const { positional } = parseArgs(args);
  const [id, target] = positional;
  if (!id || !target) {
    die(EXIT_INVALID_INPUT, "move: mission ID and target state are required");
  }
  requireValidId(id);
  requireValidState(target);
  const t = tracker();
  const m = t.findMissionById(id);
  if (!m) die(EXIT_NOT_FOUND, `move: mission ${id} not found`);
  const check = t.canTransition(id, target);
  if (!check.allowed) {
    process.stderr.write(`${PREFIX} move: ${check.reason}\n`);
    process.exit(EXIT_PRECONDITION);
  }
  let newPath;
  try {
    newPath = t.moveMissionState(id, target);
  } catch (err) {
    die(EXIT_PRECONDITION, `move: ${err.message}`);
  }
  emit({
    id,
    from: m.state,
    to: target,
    path: projectRelative(newPath),
  });
  return EXIT_OK;
}

function cmdWorkpad(args) {
  const { positional } = parseArgs(args);
  const [id, ...rest] = positional;
  if (!id) die(EXIT_INVALID_INPUT, "workpad: mission ID is required");
  requireValidId(id);
  const note = rest.join(" ").trim();
  if (!note) die(EXIT_INVALID_INPUT, "workpad: note text is required");
  const t = tracker();
  const m = t.findMissionById(id);
  if (!m) die(EXIT_NOT_FOUND, `workpad: mission ${id} not found`);
  let newPath;
  try {
    newPath = t.appendWorkpadEntry(id, note);
  } catch (err) {
    die(EXIT_PRECONDITION, `workpad: ${err.message}`);
  }
  emit({ id, path: projectRelative(newPath) });
  return EXIT_OK;
}

function coerceFieldValue(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+$/.test(raw)) {
    const n = parseInt(raw, 10);
    if (Number.isSafeInteger(n)) return n;
  }
  if (/^-?\d+\.\d+$/.test(raw)) {
    const f = parseFloat(raw);
    if (Number.isFinite(f)) return f;
  }
  if ((raw.startsWith("[") && raw.endsWith("]")) ||
      (raw.startsWith("{") && raw.endsWith("}"))) {
    try { return JSON.parse(raw); }
    catch (_) { /* fall through to string */ }
  }
  return raw;
}

function cmdUpdate(args) {
  const { positional, flags, repeated } = parseArgs(args);
  const id = positional[0];
  if (!id) die(EXIT_INVALID_INPUT, "update: mission ID is required");
  requireValidId(id);

  const fieldEntries = repeated.field
    ? repeated.field
    : (flags.field !== undefined ? [flags.field] : []);
  if (fieldEntries.length === 0) {
    die(EXIT_INVALID_INPUT, "update: at least one --field <key>=<value> is required");
  }

  const partial = {};
  for (const entry of fieldEntries) {
    if (typeof entry !== "string" || !entry.includes("=")) {
      die(EXIT_INVALID_INPUT,
        `update: --field expects key=value form, got "${entry}"`);
    }
    const eq = entry.indexOf("=");
    const key = entry.slice(0, eq).trim();
    const rawValue = entry.slice(eq + 1);
    if (!key) die(EXIT_INVALID_INPUT, `update: empty field name in "${entry}"`);
    if (key === "id") {
      die(EXIT_INVALID_INPUT, "update: cannot change `id` (mission IDs are immutable)");
    }
    partial[key] = coerceFieldValue(rawValue);
  }

  const t = tracker();
  const m = t.findMissionById(id);
  if (!m) die(EXIT_NOT_FOUND, `update: mission ${id} not found`);
  let newPath;
  try {
    newPath = t.updateFrontmatter(id, partial);
  } catch (err) {
    die(EXIT_PRECONDITION, `update: ${err.message}`);
  }
  emit({ id, path: projectRelative(newPath), updated_fields: Object.keys(partial) });
  return EXIT_OK;
}

function cmdDeps(args) {
  const { positional } = parseArgs(args);
  const id = positional[0];
  if (!id) die(EXIT_INVALID_INPUT, "deps: mission ID is required");
  requireValidId(id);
  const t = tracker();
  const m = t.findMissionById(id);
  if (!m) die(EXIT_NOT_FOUND, `deps: mission ${id} not found`);
  const all = t.getDependencies(id);
  const unmet = t.resolveUnmetDependencies(id);
  let cycles = [];
  try { cycles = t.detectCycles(id); }
  catch (_) { cycles = []; }
  emit({ id, dependencies: all, unmet, cycles });
  return EXIT_OK;
}

function cmdActive() {
  const id = tracker().getActiveMission();
  emit({ active: id });
  return EXIT_OK;
}

function cmdSetActive(args) {
  const { positional } = parseArgs(args);
  const id = positional[0];
  if (!id) die(EXIT_INVALID_INPUT, "set-active: mission ID is required");
  requireValidId(id);
  const t = tracker();
  const m = t.findMissionById(id);
  if (!m) die(EXIT_NOT_FOUND, `set-active: mission ${id} not found`);
  let p;
  try { p = t.setActiveMission(id); }
  catch (err) { die(EXIT_PRECONDITION, `set-active: ${err.message}`); }
  emit({ active: id, path: projectRelative(p) });
  return EXIT_OK;
}

function cmdClearActive() {
  tracker().clearActiveMission();
  emit({ active: null });
  return EXIT_OK;
}

function cmdCreate(args) {
  const { flags, repeated } = parseArgs(args);
  if (typeof flags.title !== "string" || !flags.title.trim()) {
    die(EXIT_INVALID_INPUT, "create: --title is required");
  }
  const options = { title: flags.title };

  if (flags.priority !== undefined) {
    const p = parseInt(flags.priority, 10);
    if (!Number.isInteger(p) || p < 1 || p > 5) {
      die(EXIT_INVALID_INPUT,
        `create: --priority must be an integer 1–5, got "${flags.priority}"`);
    }
    options.priority = p;
  }

  if (flags.phase !== undefined) {
    if (typeof flags.phase !== "string" || !flags.phase.trim()) {
      die(EXIT_INVALID_INPUT, "create: --phase must be a non-empty string");
    }
    options.phase = flags.phase;
  }

  const depsList = repeated["depends-on"]
    ? repeated["depends-on"]
    : (flags["depends-on"] !== undefined ? [flags["depends-on"]] : []);
  if (depsList.length > 0) {
    for (const d of depsList) {
      if (typeof d !== "string" || !MISSION_ID_REGEX.test(d)) {
        die(EXIT_INVALID_INPUT, `create: invalid --depends-on value "${d}"`);
      }
    }
    options.dependsOn = depsList;
  }

  const labelList = repeated.label
    ? repeated.label
    : (flags.label !== undefined ? [flags.label] : []);
  if (labelList.length > 0) {
    options.labels = labelList.map(String);
  }

  const t = tracker();
  let result;
  try {
    result = t.createMission(options);
  } catch (err) {
    die(EXIT_PRECONDITION, `create: ${err.message}`);
  }
  emit({ id: result.id, path: projectRelative(result.file) });
  return EXIT_OK;
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

const VERBS = {
  "list":            cmdList,
  "show":            cmdShow,
  "next-id":         cmdNextId,
  "can-transition":  cmdCanTransition,
  "move":            cmdMove,
  "workpad":         cmdWorkpad,
  "update":          cmdUpdate,
  "deps":            cmdDeps,
  "active":          cmdActive,
  "set-active":      cmdSetActive,
  "clear-active":    cmdClearActive,
  "create":          cmdCreate,
};

function usage() {
  const lines = [
    "mission-cli — JSON-shaped wrapper around MissionTracker",
    "",
    "Verbs:",
    "  list [--state <state>]          list missions",
    "  show <id>                       full mission record",
    "  next-id                         next available mission ID",
    "  can-transition <id> <state>     check FSM transition",
    "  move <id> <state>               transition mission state (git mv)",
    "  workpad <id> \"<note>\"           append timestamped workpad entry",
    "  update <id> --field key=value   shallow-merge frontmatter field(s)",
    "  deps <id>                       dependencies, unmet deps, cycles",
    "  active                          read .planning/active-mission",
    "  set-active <id>                 write .planning/active-mission",
    "  clear-active                    delete .planning/active-mission",
    "  create --title \"<t>\" [opts]     create new mission in todo/",
    "",
    "Exit codes:",
    "  0 ok   1 invalid input   2 not found   3 precondition failed",
  ];
  process.stderr.write(lines.join("\n") + "\n");
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    usage();
    process.exit(argv.length === 0 ? EXIT_INVALID_INPUT : EXIT_OK);
  }
  const verb = argv[0];
  const handler = VERBS[verb];
  if (!handler) {
    process.stderr.write(`${PREFIX} unknown verb "${verb}"\n`);
    usage();
    process.exit(EXIT_INVALID_INPUT);
  }
  try {
    const code = handler(argv.slice(1));
    process.exit(code);
  } catch (err) {
    die(EXIT_PRECONDITION, err.message || String(err));
  }
}

main();
