#!/usr/bin/env node
//
// mission-worktree.js — manage git worktrees for missions.
//
// Verbs:
//   create <M-NNNN>   create .worktrees/<id> on the mission's branch (off main)
//   sync   <M-NNNN>   rebase the worktree on origin/main; abort cleanly on conflict
//   remove <M-NNNN>   remove worktree (mission must be done|canceled, no dirty changes)
//   list              list mission worktrees with state and branch
//
// Pure Node built-ins. Never invokes a shell. All git calls go through
// execFileSync with arg arrays, so untrusted strings cannot be concatenated
// into a command line.
//
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const { MissionTracker, STATES } = require("../lib/mission-tracker.js");
const parser = require("../lib/mission-parser.js");

const PREFIX = "mission-worktree:";
const MIN_GIT = [2, 20, 0];

// ─── Output helpers ─────────────────────────────────────────────────────────

function fail(msg, code = 1) {
  process.stderr.write(`${PREFIX} ${msg}\n`);
  process.exit(code);
}

function info(msg) {
  process.stdout.write(`${PREFIX} ${msg}\n`);
}

// ─── Git wrappers ───────────────────────────────────────────────────────────

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function gitTry(args) {
  try {
    return { ok: true, stdout: git(args) };
  } catch (err) {
    const stderr = err.stderr ? String(err.stderr).trim() : err.message;
    return { ok: false, stderr };
  }
}

// ─── Validation ─────────────────────────────────────────────────────────────

function assertGitVersion() {
  const r = gitTry(["--version"]);
  if (!r.ok) fail("git is not installed or not on PATH");
  const m = r.stdout.match(/git version (\d+)\.(\d+)\.(\d+)/);
  if (!m) fail(`could not parse git version from "${r.stdout.trim()}"`);
  const have = [+m[1], +m[2], +m[3]];
  for (let i = 0; i < 3; i++) {
    if (have[i] > MIN_GIT[i]) return;
    if (have[i] < MIN_GIT[i]) {
      fail(`git ${have.join(".")} is too old; need ${MIN_GIT.join(".")} or newer`);
    }
  }
}

// Validator-only tracker — instantiated with a placeholder root since
// isValidId touches no filesystem. Keeps the regex source-of-truth in the
// library.
const _idValidator = new MissionTracker({ root: "." });

function parseMissionId(id) {
  if (!_idValidator.isValidId(id)) {
    fail(`invalid mission ID "${id}" — must match M-NNNN (four digits)`);
  }
  return id;
}

function repoRoot() {
  const r = gitTry(["rev-parse", "--show-toplevel"]);
  if (!r.ok) fail("not inside a git repository");
  return r.stdout.trim();
}

function trackerFor(root) {
  return new MissionTracker({
    root: path.join(root, ".planning", "missions"),
  });
}

function validateWorktreeRel(rel) {
  if (!rel) fail("worktree path is empty");
  if (path.isAbsolute(rel)) {
    fail(`worktree path must be relative, got "${rel}"`);
  }
  if (rel.startsWith("/") || rel.startsWith("\\")) {
    fail(`worktree path "${rel}" must not start with a slash`);
  }
  // Whitelist: alnum, dot, slash, hyphen, underscore. No spaces, no shell metas.
  if (!/^[A-Za-z0-9._/-]+$/.test(rel)) {
    fail(`worktree path "${rel}" contains forbidden characters (allowed: A-Z a-z 0-9 . _ / -)`);
  }
  if (rel.split("/").some((seg) => seg === "..")) {
    fail(`worktree path "${rel}" contains ".." traversal`);
  }
}

function resolveInsideRepo(root, rel) {
  const abs = path.resolve(root, rel);
  const normRoot = path.resolve(root) + path.sep;
  if (!(abs + path.sep).startsWith(normRoot)) {
    fail(`worktree path "${rel}" resolves outside the repository`);
  }
  return abs;
}

function validateBranchName(name) {
  if (!name) fail("branch name is empty");
  if (name.startsWith("-")) fail(`branch name "${name}" must not start with "-"`);
  const r = gitTry(["check-ref-format", "--branch", name]);
  if (!r.ok) fail(`invalid branch name "${name}": ${r.stderr}`);
}

// ─── Mission file lookup ────────────────────────────────────────────────────
//
// Wrapper around tracker.findMissionById that preserves this script's
// exit-with-message contract: callers pass `{ quiet: true }` to opt into the
// null-on-missing behavior used by cmdList; everything else fails loudly.

function findMissionFile(id, { quiet = false } = {}) {
  const root = repoRoot();
  const tracker = trackerFor(root);
  let mission;
  try {
    mission = tracker.findMissionById(id);
  } catch (err) {
    fail(err.message);
  }
  if (!mission) {
    if (quiet) return null;
    fail(`mission ${id} not found in .planning/missions/{${STATES.join(",")}}/`);
  }
  return {
    path: mission.path,
    state: mission.state,
    root,
    frontmatter: mission.frontmatter,
  };
}

function readMissionMeta(filePath) {
  // Thin shim for callers that already have a file path. Inside this script
  // every callsite has the parsed frontmatter from findMissionFile already,
  // but the helper is preserved for backward compat with anything that may
  // have imported it.
  const text = fs.readFileSync(filePath, "utf8");
  const { frontmatter } = parser.parseFrontmatter(text);
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    fail(`mission file ${filePath} has no frontmatter`);
  }
  return {
    id: frontmatter.id || null,
    title: frontmatter.title || null,
    branch: (frontmatter.workspace && frontmatter.workspace.branch) || null,
    worktree: (frontmatter.workspace && frontmatter.workspace.worktree) || null,
  };
}

function defaultBranch(id, title) {
  const slug = (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `feat/${id.toLowerCase()}${slug ? "-" + slug : ""}`;
}

function defaultWorktree(id) {
  return `.worktrees/${id}`;
}

function pickBaseRef() {
  if (gitTry(["show-ref", "--verify", "--quiet", "refs/remotes/origin/main"]).ok) {
    return "origin/main";
  }
  if (gitTry(["show-ref", "--verify", "--quiet", "refs/heads/main"]).ok) {
    return "main";
  }
  fail("no 'main' branch found locally or in origin — set up main before creating mission worktrees");
}

// ─── Verbs ──────────────────────────────────────────────────────────────────

function cmdCreate(id) {
  parseMissionId(id);
  const { path: missionPath, root } = findMissionFile(id);
  const meta = readMissionMeta(missionPath);

  const branch = meta.branch || defaultBranch(id, meta.title);
  const worktreeRel = meta.worktree || defaultWorktree(id);

  validateBranchName(branch);
  validateWorktreeRel(worktreeRel);
  const worktreeAbs = resolveInsideRepo(root, worktreeRel);

  if (fs.existsSync(worktreeAbs)) {
    fail(`worktree path already exists: ${worktreeRel}`);
  }

  const branchExists = gitTry([
    "show-ref", "--verify", "--quiet", `refs/heads/${branch}`,
  ]).ok;

  const base = pickBaseRef();

  const result = branchExists
    ? gitTry(["worktree", "add", worktreeAbs, branch])
    : gitTry(["worktree", "add", "-b", branch, worktreeAbs, base]);

  if (!result.ok) fail(`git worktree add failed: ${result.stderr}`);

  info(`created ${worktreeRel} on ${branch}${branchExists ? "" : ` (base: ${base})`}`);
}

function cmdSync(id) {
  parseMissionId(id);
  const { path: missionPath, root } = findMissionFile(id);
  const meta = readMissionMeta(missionPath);

  const worktreeRel = meta.worktree || defaultWorktree(id);
  validateWorktreeRel(worktreeRel);
  const worktreeAbs = resolveInsideRepo(root, worktreeRel);

  if (!fs.existsSync(worktreeAbs)) {
    fail(`worktree does not exist: ${worktreeRel} (run \`create\` first)`);
  }

  const status = gitTry(["-C", worktreeAbs, "status", "--porcelain"]);
  if (!status.ok) fail(`could not read worktree status: ${status.stderr}`);
  if (status.stdout.trim()) {
    fail(`uncommitted changes in ${worktreeRel} — commit or stash before sync`);
  }

  const fetch = gitTry(["-C", worktreeAbs, "fetch", "origin", "main"]);
  if (!fetch.ok) fail(`fetch failed: ${fetch.stderr}`);

  const rebase = gitTry(["-C", worktreeAbs, "rebase", "origin/main"]);
  if (!rebase.ok) {
    gitTry(["-C", worktreeAbs, "rebase", "--abort"]);
    fail(`rebase failed and was aborted (worktree restored to pre-rebase state): ${rebase.stderr}`);
  }
  info(`synced ${worktreeRel} on origin/main`);
}

function cmdRemove(id) {
  parseMissionId(id);
  const { path: missionPath, state, root } = findMissionFile(id);
  if (state !== "done" && state !== "canceled") {
    fail(`refusing to remove worktree for ${id} — mission is in "${state}", must be done or canceled`);
  }
  const meta = readMissionMeta(missionPath);
  const worktreeRel = meta.worktree || defaultWorktree(id);
  validateWorktreeRel(worktreeRel);
  const worktreeAbs = resolveInsideRepo(root, worktreeRel);

  if (!fs.existsSync(worktreeAbs)) {
    gitTry(["worktree", "prune"]);
    info(`worktree ${worktreeRel} already absent — pruned registry`);
    return;
  }

  const status = gitTry(["-C", worktreeAbs, "status", "--porcelain"]);
  if (!status.ok) fail(`could not read worktree status: ${status.stderr}`);
  if (status.stdout.trim()) {
    fail(`uncommitted changes in ${worktreeRel} — commit, stash, or discard before remove`);
  }

  const result = gitTry(["worktree", "remove", worktreeAbs]);
  if (!result.ok) fail(`git worktree remove failed: ${result.stderr}`);
  info(`removed ${worktreeRel}`);
}

function cmdList() {
  const root = repoRoot();
  const out = gitTry(["worktree", "list", "--porcelain"]);
  if (!out.ok) fail(`git worktree list failed: ${out.stderr}`);

  const blocks = out.stdout.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  const rows = [];
  for (const block of blocks) {
    const wtMatch = block.match(/^worktree (.+)$/m);
    if (!wtMatch) continue;
    const wt = wtMatch[1];
    const brMatch = block.match(/^branch refs\/heads\/(.+)$/m);
    const branch = brMatch ? brMatch[1] : "(detached)";

    const rel = path.relative(root, wt);
    const segs = rel.split(/[\\/]/);
    if (segs[0] !== ".worktrees" || !segs[1]) continue;

    const id = segs[1];
    let state = "(unknown)";
    if (/^M-\d{4}$/.test(id)) {
      const m = findMissionFile(id, { quiet: true });
      if (m) state = m.state;
    }
    rows.push({ id, state, branch, path: rel.replace(/\\/g, "/") });
  }

  if (rows.length === 0) {
    info("no mission worktrees");
    return;
  }
  const idW = Math.max(2, ...rows.map((r) => r.id.length));
  const stW = Math.max(5, ...rows.map((r) => r.state.length));
  const brW = Math.max(6, ...rows.map((r) => r.branch.length));
  process.stdout.write(`${"ID".padEnd(idW)}  ${"STATE".padEnd(stW)}  ${"BRANCH".padEnd(brW)}  PATH\n`);
  for (const r of rows) {
    process.stdout.write(`${r.id.padEnd(idW)}  ${r.state.padEnd(stW)}  ${r.branch.padEnd(brW)}  ${r.path}\n`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function usage() {
  process.stderr.write(
    "Usage:\n" +
    "  node mission-worktree.js create <M-NNNN>\n" +
    "  node mission-worktree.js sync   <M-NNNN>\n" +
    "  node mission-worktree.js remove <M-NNNN>\n" +
    "  node mission-worktree.js list\n"
  );
  process.exit(2);
}

function main() {
  const [, , verb, id] = process.argv;
  if (!verb) usage();

  assertGitVersion();

  switch (verb) {
    case "create":
      if (!id) usage();
      cmdCreate(id);
      break;
    case "sync":
      if (!id) usage();
      cmdSync(id);
      break;
    case "remove":
      if (!id) usage();
      cmdRemove(id);
      break;
    case "list":
      cmdList();
      break;
    default:
      usage();
  }
}

try {
  main();
} catch (err) {
  fail(err && err.message ? err.message : String(err));
}
