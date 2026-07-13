"use strict";
//
// mission-tracker.js — central API for mission file operations.
// Backed by mission-parser.js (frontmatter / body) and mission-schema.js
// (validation, FSM, schema versioning).
//
// =============================================================================
// API SURFACE — canonical reference for callsites
// =============================================================================
//
//   const t = new MissionTracker({ root: '.planning/missions' });
//
//   // Identity
//   t.generateNextId()                          → 'M-NNNN'
//   t.isValidId(id)                             → boolean
//   t.findMissionById(id)                       → { state, path, frontmatter, body } | null
//   t.findMissionByIdInState(id, state)         → same shape, scoped to one state
//
//   // Listing
//   t.listMissionsByState(state)                → [{ id, title, frontmatter, path }]
//   t.listAllMissions()                         → { todo, doing, review, done, canceled } each an array
//
//   // State transitions
//   t.canTransition(id, targetState)            → { allowed: bool, reason: string }
//   t.moveMissionState(id, targetState)         → newPath
//   t.validateStateTransition(curr, target)     → throws on invalid (pure function on state names)
//
//   // Mutations
//   t.readMission(id)                           → { frontmatter, body, path, state }   (throws if missing)
//   t.writeMission(id, { frontmatter, body })   → newPath
//   t.updateFrontmatter(id, partial)            → newPath  (shallow merge; bumps `updated`)
//   t.appendWorkpadEntry(id, note)              → newPath  (timestamped append; bumps `updated`)
//
//   // Codex (L8) state block — see mission-schema.js for field semantics.
//   t.getCodexState(id)                         → object | null
//   t.setCodexState(id, partial)                → newPath  (shallow merge into block; creates if absent)
//   t.clearCodexState(id)                       → newPath  (removes the block entirely)
//
//   // Dependencies
//   t.getDependencies(id)                       → [mission IDs]
//   t.resolveUnmetDependencies(id)              → [mission IDs not in done/]
//   t.detectCycles(id, options)                 → [[cycle path], ...]  ([] if none)
//
//   // Active mission (.planning/active-mission, sibling of root)
//   t.getActiveMission()                        → 'M-NNNN' | null
//   t.setActiveMission(id)                      → path written
//   t.clearActiveMission()                      → void
//
//   // Verification log
//   t.getVerificationLogPath(id)                → path to <state>/<id>/verification.jsonl
//
//   // Authoring
//   t.createMission(options)                    → { id, file }
//
// =============================================================================
// PRINCIPLES
// =============================================================================
//
//   - All filesystem operations are synchronous. The framework's hook scripts
//     run synchronously and the tracker must compose with them.
//   - Every write validates via mission-schema.validateFrontmatter before
//     touching disk. Invalid writes throw with a clear error.
//   - `id` is immutable once a mission exists. updateFrontmatter rejects
//     attempts to change it.
//   - moveMissionState uses `git mv` when inside a git repo, falls back to
//     fs.renameSync otherwise. The companion per-mission directory
//     (`<root>/<state>/<id>/`) is moved alongside the .md file when present so
//     verification logs follow the mission. The frontmatter `state` and
//     `updated` fields are bumped to match the new directory in the same call.
//   - The library mutates the working tree but never creates commits, branches,
//     tags, or worktrees. Commit boundaries are the caller's decision.
//   - Zero npm dependencies. Pure Node built-ins.
//

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const parser = require("./mission-parser.js");
const schema = require("./mission-schema.js");

const STATES = schema.STATES;
const MISSION_ID_REGEX = /^M-\d{4}$/;

// ─── State machine ──────────────────────────────────────────────────────────
//
// Allowed transitions. Source: framework/skills/missions.md "State machine".
//   todo     → doing | canceled
//   doing    → review | canceled
//   review   → done | doing | canceled
//   done     → (terminal)
//   canceled → (terminal)

const TRANSITIONS = Object.freeze({
  todo:     Object.freeze(["doing", "canceled"]),
  doing:    Object.freeze(["review", "canceled"]),
  review:   Object.freeze(["done", "doing", "canceled"]),
  done:     Object.freeze([]),
  canceled: Object.freeze([]),
});

// ─── Internal helpers ───────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatTimestamp(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function buildSlug(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function findGitRoot(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// ─── MissionTracker ─────────────────────────────────────────────────────────

class MissionTracker {
  constructor({ root = ".planning/missions" } = {}) {
    if (typeof root !== "string" || !root) {
      throw new Error("MissionTracker: `root` must be a non-empty string");
    }
    this.root = root;
    // Cache: undefined = not checked, null = no git repo, string = git root path.
    this._gitRootCache = undefined;
  }

  // ── Identity ───────────────────────────────────────────────────────────

  generateNextId() {
    let max = 0;
    for (const state of STATES) {
      const dir = path.join(this.root, state);
      if (!fs.existsSync(dir)) continue;
      let entries;
      try { entries = fs.readdirSync(dir); }
      catch (_) { continue; }
      for (const f of entries) {
        const m = f.match(/^M-(\d{4})-/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      }
    }
    return "M-" + String(max + 1).padStart(4, "0");
  }

  isValidId(id) {
    return typeof id === "string" && MISSION_ID_REGEX.test(id);
  }

  findMissionById(id) {
    if (!this.isValidId(id)) return null;
    let hit = null;
    for (const state of STATES) {
      const found = this._locateInState(id, state);
      if (found) {
        if (hit) {
          throw new Error(
            `mission ${id} appears in both ${hit.state}/ and ${state}/ — fix by hand`
          );
        }
        hit = found;
      }
    }
    return hit;
  }

  findMissionByIdInState(id, state) {
    if (!this.isValidId(id)) return null;
    if (!STATES.includes(state)) {
      throw new Error(`invalid state "${state}"; must be one of: ${STATES.join(", ")}`);
    }
    return this._locateInState(id, state);
  }

  _locateInState(id, state) {
    const dir = path.join(this.root, state);
    if (!fs.existsSync(dir)) return null;
    let entries;
    try { entries = fs.readdirSync(dir); }
    catch (_) { return null; }
    const matches = entries.filter(
      (f) => f.startsWith(`${id}-`) && f.endsWith(".md")
    );
    if (matches.length > 1) {
      throw new Error(
        `multiple mission files for ${id} in ${state}/: ${matches.join(", ")}`
      );
    }
    if (matches.length === 0) return null;

    const filePath = path.join(dir, matches[0]);
    const text = fs.readFileSync(filePath, "utf8");
    const { frontmatter, body } = parser.parseFrontmatter(text);
    return { state, path: filePath, frontmatter, body };
  }

  // ── Listing ────────────────────────────────────────────────────────────

  listMissionsByState(state) {
    if (!STATES.includes(state)) {
      throw new Error(`invalid state "${state}"; must be one of: ${STATES.join(", ")}`);
    }
    const dir = path.join(this.root, state);
    if (!fs.existsSync(dir)) return [];
    let entries;
    try { entries = fs.readdirSync(dir); }
    catch (_) { return []; }

    const out = [];
    for (const f of entries) {
      if (!/^M-\d{4}-.*\.md$/.test(f)) continue;
      const filePath = path.join(dir, f);
      let text;
      try { text = fs.readFileSync(filePath, "utf8"); }
      catch (_) { continue; }
      let parsed;
      try { parsed = parser.parseFrontmatter(text); }
      catch (_) { continue; }
      out.push({
        id: parsed.frontmatter.id || f.match(/^M-\d{4}/)[0],
        title: parsed.frontmatter.title || "(no title)",
        frontmatter: parsed.frontmatter,
        path: filePath,
      });
    }
    return out;
  }

  listAllMissions() {
    const out = {};
    for (const state of STATES) {
      out[state] = this.listMissionsByState(state);
    }
    return out;
  }

  // ── State transitions ──────────────────────────────────────────────────

  validateStateTransition(currentState, targetState) {
    if (!STATES.includes(currentState)) {
      throw new Error(`invalid current state "${currentState}"; must be one of: ${STATES.join(", ")}`);
    }
    if (!STATES.includes(targetState)) {
      throw new Error(`invalid target state "${targetState}"; must be one of: ${STATES.join(", ")}`);
    }
    if (!TRANSITIONS[currentState].includes(targetState)) {
      const allowed = TRANSITIONS[currentState];
      const allowedStr = allowed.length ? allowed.join(", ") : "(terminal)";
      throw new Error(
        `transition ${currentState} → ${targetState} is not allowed ` +
        `(allowed from ${currentState}: ${allowedStr})`
      );
    }
  }

  canTransition(id, targetState) {
    const m = this.findMissionById(id);
    if (!m) {
      return { allowed: false, reason: `mission ${id} not found` };
    }
    if (!STATES.includes(targetState)) {
      return {
        allowed: false,
        reason: `invalid target state "${targetState}"; must be one of: ${STATES.join(", ")}`,
      };
    }
    if (!TRANSITIONS[m.state].includes(targetState)) {
      const allowed = TRANSITIONS[m.state];
      const allowedStr = allowed.length ? allowed.join(", ") : "(terminal)";
      return {
        allowed: false,
        reason: `${m.state} → ${targetState} is not allowed ` +
                `(allowed from ${m.state}: ${allowedStr})`,
      };
    }
    return { allowed: true, reason: "ok" };
  }

  // Any tracked content at or under p (file or directory)? Untracked
  // sources make `git mv` refuse ("not under version control" for files,
  // "source directory is empty" for directories of untracked files — the
  // M-0003 closeout failure); those move via plain rename instead.
  _isTrackedPath(gitRoot, p) {
    try {
      const out = execFileSync("git", ["-C", gitRoot, "ls-files", "--", p], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return out.trim().length > 0;
    } catch (_) {
      return false;
    }
  }

  // M-0004 AC-3. Ordering + rollback guarantees ("atomic-in-effect"):
  //   1. FSM check, post-move frontmatter validation, destination and
  //      collision pre-checks all run BEFORE any filesystem effect — a
  //      failure there moves nothing (the M-0004 Task 0 fixture: git mv
  //      used to precede validation, stranding a moved file with a stale
  //      `state:` field).
  //   2. Moves execute per-path (git mv for tracked, rename for untracked;
  //      a pre-existing destination dir is tolerated by entry-merge), each
  //      completed step recorded.
  //   3. Any failure during moves or the final frontmatter write rolls the
  //      completed steps back in reverse. If the rollback itself fails,
  //      the error reports the exact partial state path-by-path.
  moveMissionState(id, targetState) {
    const check = this.canTransition(id, targetState);
    if (!check.allowed) {
      throw new Error(`moveMissionState: ${check.reason}`);
    }
    const m = this.findMissionById(id);
    const fileBase = path.basename(m.path);
    const destFile = path.join(this.root, targetState, fileBase);
    const destDir = path.join(this.root, targetState);

    // Pre-validate the post-move frontmatter: zero filesystem effects on
    // failure (same message shape _writeFile would produce at write time).
    const newFm = { ...m.frontmatter, state: targetState, updated: todayIso() };
    const validation = schema.validateFrontmatter(newFm);
    if (!validation.valid) {
      throw new Error(
        `mission-tracker: refusing to write invalid frontmatter to ${destFile}:\n  - ` +
        validation.errors.join("\n  - ") +
        `\n  (nothing moved — validation runs before any filesystem effect)`
      );
    }
    if (fs.existsSync(destFile)) {
      throw new Error(`moveMissionState: destination already exists: ${destFile} — nothing moved`);
    }

    const companionSrc = path.join(this.root, m.state, id);
    const companionDst = path.join(this.root, targetState, id);
    const hasCompanion = fs.existsSync(companionSrc);
    const gitRoot = this._gitRoot();

    // Plan the companion strategy up front. A pre-existing destination dir
    // (the evidence generator pre-creates review/<id>/) is tolerated by
    // merging entries into it; entry collisions abort before any move.
    let mergeEntries = null; // null = whole-dir move; array = per-entry merge
    if (hasCompanion && fs.existsSync(companionDst)) {
      mergeEntries = fs.readdirSync(companionSrc);
      for (const e of mergeEntries) {
        if (fs.existsSync(path.join(companionDst, e))) {
          throw new Error(
            `moveMissionState: companion entry collides with pre-existing destination: ` +
            `${path.join(companionDst, e)} — nothing moved`
          );
        }
      }
    }

    fs.mkdirSync(destDir, { recursive: true });

    const done = []; // completed steps, for reverse rollback
    const moveOne = (src, dst) => {
      if (gitRoot && this._isTrackedPath(gitRoot, src)) {
        execFileSync("git", ["-C", gitRoot, "mv", src, dst], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        done.push({ src, dst, how: "git-mv" });
      } else {
        fs.renameSync(src, dst);
        done.push({ src, dst, how: "rename" });
      }
    };
    const rollback = () => {
      const problems = [];
      for (const step of done.reverse()) {
        try {
          if (step.how === "rmdir") {
            fs.mkdirSync(step.src, { recursive: true });
          } else if (step.how === "git-mv") {
            execFileSync("git", ["-C", gitRoot, "mv", step.dst, step.src], {
              stdio: ["ignore", "pipe", "pipe"],
            });
          } else {
            fs.renameSync(step.dst, step.src);
          }
        } catch (e) {
          problems.push(`${step.dst || step.src}: not restored (${e.message.split("\n")[0]})`);
        }
      }
      return problems;
    };

    try {
      moveOne(m.path, destFile);
      if (hasCompanion) {
        if (mergeEntries === null) {
          moveOne(companionSrc, companionDst);
        } else {
          for (const e of mergeEntries) {
            moveOne(path.join(companionSrc, e), path.join(companionDst, e));
          }
          fs.rmdirSync(companionSrc); // empty after the merge
          done.push({ src: companionSrc, dst: null, how: "rmdir" });
        }
      }
      this._writeFile(destFile, { frontmatter: newFm, body: m.body });
    } catch (err) {
      const msg = err && err.stderr ? String(err.stderr).trim() : (err && err.message) || String(err);
      const problems = rollback();
      if (problems.length) {
        throw new Error(
          `moveMissionState: failed (${msg}) AND rollback was incomplete — partial state, fix by hand:\n  ` +
          problems.join("\n  ")
        );
      }
      throw new Error(`moveMissionState: failed — all completed steps rolled back. Cause: ${msg}`);
    }
    return destFile;
  }

  // ── Mutations ──────────────────────────────────────────────────────────

  readMission(id) {
    const m = this.findMissionById(id);
    if (!m) throw new Error(`readMission: mission ${id} not found`);
    // Migrate in memory only. The disk file stays untouched until the caller
    // performs an actual mutation (updateFrontmatter / writeMission /
    // appendWorkpadEntry), which is when the migrated form gets persisted.
    // This preserves the no-surprise-mutation principle from M-0002 while
    // ensuring every consumer of readMission sees a current-version object.
    const migrated = schema.migrateFrontmatter(m.frontmatter);
    return { ...m, frontmatter: migrated };
  }

  writeMission(id, { frontmatter, body }) {
    const m = this.findMissionById(id);
    if (!m) throw new Error(`writeMission: mission ${id} not found`);
    if (frontmatter == null || typeof frontmatter !== "object") {
      throw new Error("writeMission: frontmatter must be an object");
    }
    if (typeof body !== "string") {
      throw new Error("writeMission: body must be a string");
    }
    if (frontmatter.id !== m.frontmatter.id) {
      throw new Error(
        `writeMission: refusing to change id (mission IDs are immutable; was "${m.frontmatter.id}", got "${frontmatter.id}")`
      );
    }
    this._writeFile(m.path, { frontmatter, body });
    return m.path;
  }

  updateFrontmatter(id, partial) {
    if (partial == null || typeof partial !== "object" || Array.isArray(partial)) {
      throw new Error("updateFrontmatter: partial must be a plain object");
    }
    if (Object.prototype.hasOwnProperty.call(partial, "id")) {
      throw new Error("updateFrontmatter: cannot change `id` (mission IDs are immutable)");
    }
    const m = this.readMission(id);
    const merged = { ...m.frontmatter, ...partial };
    if (merged.updated === undefined || merged.updated === null) {
      merged.updated = todayIso();
    } else if (partial.updated === undefined) {
      // Caller didn't override; bump to today.
      merged.updated = todayIso();
    }
    this._writeFile(m.path, { frontmatter: merged, body: m.body });
    return m.path;
  }

  appendWorkpadEntry(id, note) {
    if (typeof note !== "string") {
      throw new Error("appendWorkpadEntry: note must be a string");
    }
    const m = this.readMission(id);
    const stamp = formatTimestamp(new Date());
    const trimmedNote = note.replace(/^\n+|\n+$/g, "");
    const entry = `\n### ${stamp}\n${trimmedNote}\n`;

    let newBody;
    if (parser.extractBodySection(m.body, "Workpad") === null) {
      // No section yet — append one to the end of the body.
      newBody = m.body.replace(/\s*$/, "") + "\n\n## Workpad\n" + entry;
    } else {
      newBody = parser.appendBodySection(m.body, "Workpad", entry);
    }

    const newFm = { ...m.frontmatter, updated: todayIso() };
    this._writeFile(m.path, { frontmatter: newFm, body: newBody });
    return m.path;
  }

  // ── Codex (L8) state block ────────────────────────────────────────────
  //
  // The block is optional and is added the first time L8 runs against a
  // mission (or up-front for missions that opt in via `required: true`).
  // All three helpers route through the existing validation gate so an
  // invalid update can never reach disk.

  getCodexState(id) {
    const m = this.readMission(id);
    const codex = m.frontmatter.codex;
    if (codex === undefined || codex === null) return null;
    return { ...codex };
  }

  setCodexState(id, partialUpdate) {
    if (partialUpdate == null || typeof partialUpdate !== "object" || Array.isArray(partialUpdate)) {
      throw new Error("setCodexState: partialUpdate must be a plain object");
    }
    const m = this.readMission(id);
    const existing = (m.frontmatter.codex && typeof m.frontmatter.codex === "object" && !Array.isArray(m.frontmatter.codex))
      ? m.frontmatter.codex
      : {};
    const merged = { ...existing, ...partialUpdate };
    // Routes through updateFrontmatter so validation runs and `updated` bumps.
    return this.updateFrontmatter(id, { codex: merged });
  }

  clearCodexState(id) {
    const m = this.readMission(id);
    if (m.frontmatter.codex === undefined) return m.path;
    const newFm = { ...m.frontmatter, updated: todayIso() };
    delete newFm.codex;
    this._writeFile(m.path, { frontmatter: newFm, body: m.body });
    return m.path;
  }

  // ── Dependencies ───────────────────────────────────────────────────────

  getDependencies(id) {
    const m = this.findMissionById(id);
    if (!m) return [];
    const deps = m.frontmatter.depends_on;
    return Array.isArray(deps) ? deps.slice() : [];
  }

  resolveUnmetDependencies(id) {
    const deps = this.getDependencies(id);
    if (deps.length === 0) return [];
    const done = new Set(this.listMissionsByState("done").map((m) => m.id));
    return deps.filter((d) => !done.has(d));
  }

  // Depth-first cycle detection starting from `id`. Returns an array of cycle
  // paths; each path is an array of mission IDs where the first and last
  // entry are the same node (the loop closure point). Returns [] when no
  // cycle is reachable.
  detectCycles(id, _options = {}) {
    const cycles = [];
    const visited = new Set();
    const stack = [];
    const stackSet = new Set();

    const dfs = (current) => {
      if (stackSet.has(current)) {
        const cycleStart = stack.indexOf(current);
        cycles.push([...stack.slice(cycleStart), current]);
        return;
      }
      if (visited.has(current)) return;
      visited.add(current);
      stack.push(current);
      stackSet.add(current);

      const deps = this.getDependencies(current);
      for (const dep of deps) dfs(dep);

      stack.pop();
      stackSet.delete(current);
    };

    dfs(id);
    return cycles;
  }

  // ── Active mission ─────────────────────────────────────────────────────

  getActiveMission() {
    const p = this._activeMissionPath();
    if (!fs.existsSync(p)) return null;
    let text;
    try { text = fs.readFileSync(p, "utf8"); }
    catch (_) { return null; }
    const id = text.trim().split(/\s+/)[0] || "";
    return this.isValidId(id) ? id : null;
  }

  setActiveMission(id) {
    if (!this.isValidId(id)) {
      throw new Error(`setActiveMission: invalid mission ID "${id}"`);
    }
    const p = this._activeMissionPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, id + "\n");
    return p;
  }

  clearActiveMission() {
    const p = this._activeMissionPath();
    try {
      fs.unlinkSync(p);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }

  // ── Verification log ───────────────────────────────────────────────────

  getVerificationLogPath(id) {
    const m = this.findMissionById(id);
    if (!m) throw new Error(`getVerificationLogPath: mission ${id} not found`);
    return path.join(this.root, m.state, id, "verification.jsonl");
  }

  // ── Authoring ──────────────────────────────────────────────────────────

  // Create a new mission file with valid frontmatter and the four canonical
  // body sections. Writes to <root>/todo/M-NNNN-<slug>.md. Slug is derived
  // from `title`. Returns { id, file }. Does NOT stage the file or commit.
  //
  // options:
  //   title      (required) one-line imperative summary
  //   priority   (optional) integer 1–5; omitted from frontmatter when absent
  //   phase      (optional) phase ID string from ROADMAP.md
  //   dependsOn  (optional) array of mission IDs (validated)
  //   labels     (optional) array of free-form strings
  createMission(options) {
    const opts = options || {};
    const title = typeof opts.title === "string" ? opts.title.trim() : "";
    if (!title) throw new Error("createMission: title is required");

    if (opts.priority !== undefined) {
      if (!Number.isInteger(opts.priority) || opts.priority < 1 || opts.priority > 5) {
        throw new Error("createMission: priority must be an integer 1–5");
      }
    }
    if (opts.dependsOn !== undefined) {
      if (!Array.isArray(opts.dependsOn)) {
        throw new Error("createMission: dependsOn must be an array");
      }
      for (const dep of opts.dependsOn) {
        if (!this.isValidId(dep)) {
          throw new Error(`createMission: invalid dependency id "${dep}"`);
        }
      }
    }
    if (opts.labels !== undefined && !Array.isArray(opts.labels)) {
      throw new Error("createMission: labels must be an array");
    }

    const id = this.generateNextId();
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    const filename = `${id}-${slug}.md`;
    const file = path.join(this.root, "todo", filename);

    if (fs.existsSync(file)) {
      throw new Error(`createMission: file already exists at ${file}`);
    }

    const today = todayIso();
    const branch = `feat/${id.toLowerCase()}${slug ? "-" + slug : ""}`;
    const worktree = `.worktrees/${id}`;

    const frontmatter = {
      id,
      schema_version: schema.CURRENT_SCHEMA_VERSION,
      title,
      state: "todo",
      created: today,
      updated: today,
    };
    if (opts.priority !== undefined) frontmatter.priority = opts.priority;
    if (opts.phase) frontmatter.phase = String(opts.phase);
    if (Array.isArray(opts.dependsOn) && opts.dependsOn.length > 0) {
      frontmatter.depends_on = opts.dependsOn.slice();
    }
    if (Array.isArray(opts.labels) && opts.labels.length > 0) {
      frontmatter.labels = opts.labels.map((l) => String(l));
    }
    frontmatter.workspace = { branch, worktree };

    const body = [
      "## Context",
      "",
      "[Describe the problem this mission solves and the surrounding context.]",
      "",
      "## Implementation notes",
      "",
      "[Tech choices, libraries, patterns to follow.]",
      "",
      "## Out of scope",
      "",
      "[Explicit non-goals.]",
      "",
      "## Workpad",
      "",
      "<!-- Append timestamped entries; do not delete prior entries. -->",
      "",
    ].join("\n");

    fs.mkdirSync(path.dirname(file), { recursive: true });
    this._writeFile(file, { frontmatter, body });
    return { id, file };
  }

  // ── Internal write path ────────────────────────────────────────────────

  _writeFile(filePath, { frontmatter, body }) {
    const validation = schema.validateFrontmatter(frontmatter);
    if (!validation.valid) {
      throw new Error(
        `mission-tracker: refusing to write invalid frontmatter to ${filePath}:\n  - ` +
        validation.errors.join("\n  - ")
      );
    }
    const fmText = parser.serializeFrontmatter(frontmatter);
    const text = `---\n${fmText}\n---\n\n${body || ""}`;
    fs.writeFileSync(filePath, text);
  }

  _activeMissionPath() {
    return path.join(path.dirname(this.root), "active-mission");
  }

  _gitRoot() {
    if (this._gitRootCache !== undefined) return this._gitRootCache;
    this._gitRootCache = findGitRoot(this.root) || null;
    return this._gitRootCache;
  }
}

module.exports = {
  MissionTracker,
  // Re-export for tests and callers that want the constants directly.
  STATES,
  TRANSITIONS,
};
