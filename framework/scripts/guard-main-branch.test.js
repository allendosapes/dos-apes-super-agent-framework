"use strict";
//
// guard-main-branch.test.js — fixture tests for the PreToolUse Edit/Write
// guard (M-0004 AC-1). Drives the real script through bash with hook-shaped
// stdin JSON against real git fixtures (primary checkout on main + a linked
// worktree on a mission branch) and asserts on exit codes: 2 = blocked,
// 0 = allowed.
//
// The load-bearing property under test: the guard resolves the branch of
// the TARGET path's containing checkout, not the session cwd — writes into
// .worktrees/<id> must pass while cwd sits on main (the M-0003 AC-9 defect).
//
// Run:  node framework/scripts/guard-main-branch.test.js
//

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync, execFileSync } = require("child_process");

const SCRIPT = path.join(__dirname, "guard-main-branch.sh");

// Bail gracefully where bash is unavailable (the guard itself only ever runs
// under bash / Git Bash, so there is nothing to test on such a machine).
const probe = spawnSync("bash", ["--version"], { encoding: "utf8" });
if (probe.error) {
  process.stdout.write("bash not found on PATH — guard tests skipped\n");
  process.exit(0);
}

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (err) {
    failed++;
    failures.push({ name, err });
    process.stdout.write(`  ✗ ${name}\n`);
  }
}

// runGuard(cwd, stdin) → exit code (null → treated as failure)
function runGuard(cwd, stdin) {
  const r = spawnSync("bash", [SCRIPT], {
    cwd,
    input: stdin,
    encoding: "utf8",
  });
  return r.status;
}

function payloadFor(filePath) {
  return JSON.stringify({ tool_name: "Write", tool_input: { file_path: filePath, content: "x" } });
}

function git(cwd, args) {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

// ── fixtures ─────────────────────────────────────────────────────────────────
// base/
//   repo/                 primary checkout, branch main
//   repo/.worktrees/M-0001  linked worktree, branch feat/m-0001
//   repo/.worktrees/DETACHED linked worktree, detached HEAD
//   plain/                not a git repo

const base = fs.mkdtempSync(path.join(os.tmpdir(), "guard-main-branch-"));
const repo = path.join(base, "repo");
const wt = path.join(repo, ".worktrees", "M-0001");
const wtDetached = path.join(repo, ".worktrees", "DETACHED");
const plain = path.join(base, "plain");

fs.mkdirSync(repo, { recursive: true });
fs.mkdirSync(plain, { recursive: true });
git(repo, ["init", "-q", "-b", "main"]);
git(repo, ["config", "user.email", "guard@test.local"]);
git(repo, ["config", "user.name", "Guard Test"]);
fs.writeFileSync(path.join(repo, "README.md"), "fixture\n");
git(repo, ["add", "-A"]);
git(repo, ["commit", "-qm", "init"]);
git(repo, ["worktree", "add", "-q", wt, "-b", "feat/m-0001"]);
git(repo, ["worktree", "add", "-q", "--detach", wtDetached]);

// ── the tests ────────────────────────────────────────────────────────────────

process.stdout.write("\nguard-main-branch — target-path branch resolution\n");

test("(a) write into mission worktree while cwd is on main → allowed", () => {
  const code = runGuard(repo, payloadFor(path.join(wt, "src", "hello.js")));
  assert.strictEqual(code, 0);
});

test("(a2) nested not-yet-existing dirs inside the worktree → allowed (walk-up)", () => {
  const code = runGuard(repo, payloadFor(path.join(wt, "deep", "new", "dir", "file.md")));
  assert.strictEqual(code, 0);
});

test("(b) write to a main-checked-out path → blocked", () => {
  const code = runGuard(repo, payloadFor(path.join(repo, "src", "index.ts")));
  assert.strictEqual(code, 2);
});

test("(b2) main-checkout write blocked even when cwd is the mission worktree", () => {
  // the inverse direction: target-path signal must also override a
  // feature-branch cwd — otherwise the guard is still cwd-keyed.
  const code = runGuard(wt, payloadFor(path.join(repo, "src", "index.ts")));
  assert.strictEqual(code, 2);
});

test("(c) fail-open: target outside any git repo → allowed", () => {
  const code = runGuard(repo, payloadFor(path.join(plain, "notes.txt")));
  assert.strictEqual(code, 0);
});

test("(c2) fail-open: detached-HEAD worktree target → allowed (no branch name)", () => {
  const code = runGuard(repo, payloadFor(path.join(wtDetached, "file.md")));
  assert.strictEqual(code, 0);
});

test("(c3) legacy fallback: garbage stdin + cwd on main → blocked (pre-M-0004 behavior preserved)", () => {
  const code = runGuard(repo, "this is not json");
  assert.strictEqual(code, 2);
});

test("(c4) legacy fallback: garbage stdin + cwd on mission branch → allowed", () => {
  const code = runGuard(wt, "this is not json");
  assert.strictEqual(code, 0);
});

test("(c5) legacy fallback: valid JSON without file_path + cwd on main → blocked", () => {
  const code = runGuard(repo, JSON.stringify({ tool_name: "Write", tool_input: {} }));
  assert.strictEqual(code, 2);
});

if (process.platform === "win32") {
  test("(w) Windows backslash target path resolves correctly (worktree write allowed)", () => {
    const winPath = path.join(wt, "src", "hello.js").replace(/\//g, "\\");
    const code = runGuard(repo, payloadFor(winPath));
    assert.strictEqual(code, 0);
  });
}

// ── cleanup + summary ────────────────────────────────────────────────────────

try {
  fs.rmSync(base, { recursive: true, force: true });
} catch (_) {
  // Windows can hold handles briefly; a leaked tmpdir is not a failure.
}

process.stdout.write(`\nguard-main-branch: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  for (const f of failures) {
    process.stdout.write(`\n✗ ${f.name}\n  ${f.err && f.err.message}\n`);
  }
  process.exit(1);
}
