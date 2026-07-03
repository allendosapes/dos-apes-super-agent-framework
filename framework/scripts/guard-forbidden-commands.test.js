"use strict";
//
// guard-forbidden-commands.test.js — fixture tests for the PreToolUse Bash
// guard (M-0001 AC #7). Drives the real script through bash with hook-shaped
// stdin JSON and asserts on exit codes: 2 = blocked, 0 = allowed.
// Hand-rolled runner, zero-dep, per house style.
//
// Run:  node framework/scripts/guard-forbidden-commands.test.js
//

const assert = require("assert");
const path = require("path");
const { spawnSync } = require("child_process");

const SCRIPT = path.join(__dirname, "guard-forbidden-commands.sh");

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

function group(name, fn) {
  process.stdout.write(`\n${name}\n`);
  fn();
}

function runGuard(command) {
  const input = JSON.stringify({
    tool_name: "Bash",
    tool_input: { command, description: "fixture" },
  });
  const res = spawnSync("bash", [SCRIPT], { input, encoding: "utf8" });
  assert.strictEqual(res.error, undefined, `spawn failed: ${res.error}`);
  return res;
}

function assertBlocked(command) {
  const res = runGuard(command);
  assert.strictEqual(res.status, 2, `expected exit 2 (block), got ${res.status} for: ${command}\nstderr: ${res.stderr}`);
  assert.ok(res.stderr.includes("dos-apes guard: blocked"), `stderr should explain the block, got: ${res.stderr}`);
  assert.ok(!res.stderr.trim().startsWith("{"), "stderr must be plain text, not JSON");
}

function assertAllowed(command) {
  const res = runGuard(command);
  assert.strictEqual(res.status, 0, `expected exit 0 (allow), got ${res.status} for: ${command}\nstderr: ${res.stderr}`);
}

// ─── npm registry mutation ───────────────────────────────────────────────────

group("npm registry mutation — blocked", () => {
  test("npm publish", () => assertBlocked("npm publish"));
  test("npm publish with args", () => assertBlocked("npm publish --tag beta"));
  test("npm version", () => assertBlocked("npm version patch"));
  test("npm dist-tag", () => assertBlocked("npm dist-tag add pkg@1.0.0 latest"));
  test("npm unpublish", () => assertBlocked("npm unpublish pkg@1.0.0 --force"));
  test("npm deprecate", () => assertBlocked('npm deprecate pkg@1.0.0 "bad release"'));
  test("flags between npm and verb", () => assertBlocked("npm --registry=https://registry.npmjs.org publish"));
  test("compound chain: git commit -m x && npm publish", () =>
    assertBlocked("git commit -m x && npm publish"));
  test("compound chain with semicolon", () => assertBlocked("npm test; npm publish"));
  test("multi-line command", () => assertBlocked("npm test\nnpm publish"));
  test("quoted evasion: bash -c \"npm publish\"", () => assertBlocked('bash -c "npm publish"'));

  // Documented false-positive trade-off (see the script's overmatch policy):
  // a commit message that merely QUOTES a forbidden command is blocked too.
  // The block message tells the agent to rephrase the quoted text. Accepted
  // cost — a backstop must not undermatch, and quoted-string parsing in bash
  // is where evasions live (bash -c "npm publish" above).
  test("pinned overmatch: commit message quoting a forbidden command", () =>
    assertBlocked('git commit -m "docs: explain why npm publish is denied"'));
});

group("npm — allowed", () => {
  test("npm test", () => assertAllowed("npm test"));
  test("npm install", () => assertAllowed("npm install"));
  test("npm ci", () => assertAllowed("npm ci"));
  test("npm --version (flag, not verb)", () => assertAllowed("npm --version"));
  test("npm run version (user script)", () => assertAllowed("npm run version"));
  test("npm run publish-docs (verb prefix in script name)", () =>
    assertAllowed("npm run publish-docs"));
  test("npm pack --dry-run", () => assertAllowed("npm pack --dry-run"));
});

// ─── force push ──────────────────────────────────────────────────────────────

group("force push — blocked", () => {
  test("flag-last ordering: git push origin main --force", () =>
    assertBlocked("git push origin main --force"));
  test("flag-first: git push --force origin main", () =>
    assertBlocked("git push --force origin main"));
  test("--force-with-lease", () => assertBlocked("git push --force-with-lease origin main"));
  test("--force-with-lease=ref, flag-last", () =>
    assertBlocked("git push origin main --force-with-lease=refs/heads/main"));
  test("--force-if-includes", () =>
    assertBlocked("git push origin main --force-with-lease --force-if-includes"));
  test("short flag: git push -f", () => assertBlocked("git push -f"));
  test("short flag last: git push origin main -f", () =>
    assertBlocked("git push origin main -f"));
  test("bundled short flags: git push -fu origin main", () =>
    assertBlocked("git push -fu origin main"));
  test("+refspec force: git push origin +main", () => assertBlocked("git push origin +main"));
  test("compound chain: git add . && git push -f", () =>
    assertBlocked("git add . && git push -f"));
});

group("refspec deletion — blocked", () => {
  test("git push origin :dead-branch", () => assertBlocked("git push origin :dead-branch"));
});

group("git push — allowed", () => {
  test("plain push (ask rule's territory)", () => assertAllowed("git push origin main"));
  test("push with -u", () => assertAllowed("git push -u origin feature/x"));
  test("push with --set-upstream", () => assertAllowed("git push --set-upstream origin feature/x"));
  test("src:dst refspec (no deletion)", () => assertAllowed("git push origin HEAD:main"));
  test("git without push", () => assertAllowed("git fetch origin && git status"));
});

// ─── rm respellings ──────────────────────────────────────────────────────────

group("recursive force rm at dangerous targets — blocked", () => {
  test("rm -fr /var/data (respelled flags)", () => assertBlocked("rm -fr /var/data"));
  test("rm -r -f ~/old (split flags)", () => assertBlocked("rm -r -f ~/old"));
  test("rm --recursive --force .. (long flags)", () =>
    assertBlocked("rm --recursive --force .."));
  test("rm -Rf / (capital R)", () => assertBlocked("rm -Rf /"));
  test("compound chain: cd /tmp && rm -fr ~/x", () => assertBlocked("cd /tmp && rm -fr ~/x"));
});

group("rm — allowed", () => {
  test("relative target: rm -rf ./build", () => assertAllowed("rm -rf ./build"));
  test("relative target: rm -rf dist", () => assertAllowed("rm -rf dist"));
  test("non-recursive: rm -f /tmp/x.lock", () => assertAllowed("rm -f /tmp/x.lock"));
  test("plain rm file", () => assertAllowed("rm build.log"));
});

// ─── hook interface ──────────────────────────────────────────────────────────

group("hook interface", () => {
  test("empty command exits 0", () => {
    const res = spawnSync("bash", [SCRIPT], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: {} }),
      encoding: "utf8",
    });
    assert.strictEqual(res.status, 0);
  });

  test("non-Bash tool input exits 0", () => {
    const res = spawnSync("bash", [SCRIPT], {
      input: JSON.stringify({ tool_name: "Edit", tool_input: { file_path: "x" } }),
      encoding: "utf8",
    });
    assert.strictEqual(res.status, 0);
  });

  test("block output is plain text on stderr with exit 2", () => {
    const res = runGuard("npm publish");
    assert.strictEqual(res.status, 2);
    assert.strictEqual(res.stdout, "");
    assert.ok(/^dos-apes guard: blocked/.test(res.stderr));
  });

  test("corrupt envelope containing a forbidden string is blocked (raw-scan fallback)", () => {
    const res = spawnSync("bash", [SCRIPT], {
      input: '{"tool_name": "Bash", "tool_input": {"command": "npm publish"',
      encoding: "utf8",
    });
    assert.strictEqual(res.status, 2, `expected exit 2, got ${res.status}\nstderr: ${res.stderr}`);
    assert.ok(res.stderr.includes("dos-apes guard: blocked"));
  });

  test("benign corrupt envelope is allowed", () => {
    const res = spawnSync("bash", [SCRIPT], {
      input: '{"tool_name": "Bash", "tool_input": {"command": "npm test"',
      encoding: "utf8",
    });
    assert.strictEqual(res.status, 0, `expected exit 0, got ${res.status}\nstderr: ${res.stderr}`);
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
