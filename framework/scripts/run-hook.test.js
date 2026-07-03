"use strict";
//
// run-hook.test.js — fixture tests for the Windows hook runner's Git Bash
// discovery and fail-closed behavior (M-0001 Task 4b). Windows-only: the
// runner is a .cmd batch file, so there is nothing to test elsewhere.
// Hand-rolled runner, zero-dep, per house style.
//
// Run:  node framework/scripts/run-hook.test.js
//

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

if (process.platform !== "win32") {
  process.stdout.write("not Windows — run-hook.cmd tests skipped\n");
  process.exit(0);
}

const RUNNER = path.join(__dirname, "run-hook.cmd");
const SYSTEM32 = path.join(process.env.SystemRoot || "C:\\Windows", "System32");

// A minimal env in which NONE of the runner's probe paths resolve:
// ProgramFiles / ProgramFiles(x86) / LocalAppData / USERPROFILE are absent
// (batch expands them literally, so `if exist` fails), PATH holds only
// System32 (where.exe finds at most the WSL shim, which the runner must
// skip), and CLAUDE_CODE_GIT_BASH_PATH is unset.
function bareEnv(extra = {}) {
  return {
    SystemRoot: process.env.SystemRoot,
    ComSpec: process.env.ComSpec,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    PATH: SYSTEM32,
    ...extra,
  };
}

function runCmd(args, env) {
  return spawnSync("cmd.exe", ["/d", "/c", RUNNER, ...args], {
    env,
    encoding: "utf8",
  });
}

// Locate a real Git Bash for the positive-path tests (skip them if absent).
function findRealBash() {
  const candidates = [
    path.join(process.env.ProgramFiles || "", "Git", "bin", "bash.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Git", "bin", "bash.exe"),
    path.join(process.env.LocalAppData || "", "Programs", "Git", "bin", "bash.exe"),
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}
const REAL_BASH = findRealBash();

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

function group(name, fn) {
  process.stdout.write(`\n${name}\n`);
  fn();
}

// ─── Discovery failure ───────────────────────────────────────────────────────

group("discovery failure", () => {
  test("guard-* script fails closed with exit 2 and clear stderr", () => {
    const res = runCmd(["scripts/guard-forbidden-commands.sh"], bareEnv());
    assert.strictEqual(res.status, 2, `expected 2, got ${res.status}\nstderr: ${res.stderr}`);
    assert.ok(res.stderr.includes("failing closed"), `stderr: ${res.stderr}`);
    assert.ok(res.stderr.includes("CLAUDE_CODE_GIT_BASH_PATH"), `stderr: ${res.stderr}`);
  });

  test("guard-main-branch.sh also fails closed", () => {
    const res = runCmd(["scripts/guard-main-branch.sh"], bareEnv());
    assert.strictEqual(res.status, 2, `expected 2, got ${res.status}\nstderr: ${res.stderr}`);
  });

  test("non-guard script keeps the exit-0 skip", () => {
    const res = runCmd(["scripts/hook-typecheck.sh"], bareEnv());
    assert.strictEqual(res.status, 0, `expected 0, got ${res.status}\nstderr: ${res.stderr}`);
    assert.ok(res.stderr.includes("Hook skipped"), `stderr: ${res.stderr}`);
  });

  test("inline -c command keeps the exit-0 skip", () => {
    const res = runCmd(["-c", "echo hello"], bareEnv());
    assert.strictEqual(res.status, 0, `expected 0, got ${res.status}\nstderr: ${res.stderr}`);
  });
});

// ─── Discovery success (requires a real Git Bash on this machine) ───────────

group("discovery success", () => {
  if (!REAL_BASH) {
    process.stdout.write("  → Git Bash not found on this machine — positive-path tests skipped\n");
    return;
  }

  test("CLAUDE_CODE_GIT_BASH_PATH override is honored", () => {
    const res = runCmd(["-c", "exit 0"], bareEnv({ CLAUDE_CODE_GIT_BASH_PATH: REAL_BASH }));
    assert.strictEqual(res.status, 0, `stderr: ${res.stderr}`);
    assert.ok(!res.stderr.includes("not found"), `stderr: ${res.stderr}`);
  });

  test("exit codes propagate through the runner (blocking fidelity)", () => {
    const res = runCmd(["-c", "exit 2"], bareEnv({ CLAUDE_CODE_GIT_BASH_PATH: REAL_BASH }));
    assert.strictEqual(res.status, 2, `expected 2, got ${res.status}\nstderr: ${res.stderr}`);
  });

  test("PATH probe finds Git Bash outside \\Windows\\", () => {
    const res = runCmd(
      ["-c", "exit 0"],
      bareEnv({ PATH: `${SYSTEM32};${path.dirname(REAL_BASH)}` })
    );
    assert.strictEqual(res.status, 0, `stderr: ${res.stderr}`);
    assert.ok(!res.stderr.includes("not found"), `stderr: ${res.stderr}`);
  });

  test("stdin flows through to the delegated script", () => {
    const guard = path.join(__dirname, "guard-forbidden-commands.sh").replace(/\\/g, "/");
    const res = spawnSync("cmd.exe", ["/d", "/c", RUNNER, guard], {
      env: bareEnv({ CLAUDE_CODE_GIT_BASH_PATH: REAL_BASH, PATH: process.env.PATH }),
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "npm publish" } }),
      encoding: "utf8",
    });
    assert.strictEqual(res.status, 2, `expected 2, got ${res.status}\nstderr: ${res.stderr}`);
    assert.ok(res.stderr.includes("dos-apes guard: blocked"), `stderr: ${res.stderr}`);
  });
});

// ─── Summary ─────────────────────────────────────────────────────────────────

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  for (const { name, err } of failures) {
    process.stdout.write(`\nFAIL: ${name}\n${err && err.stack ? err.stack : err}\n`);
  }
  process.exit(1);
}
