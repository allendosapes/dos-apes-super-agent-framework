"use strict";
//
// codex-config.test.js — regression coverage for M-0005 (inverted L8 default).
//
// Both codex-review.js and codex-review-loop.js used to treat a missing,
// unparseable, or non-object .dos-apes/codex-review-config.json as
// enabled:true — L8 activated exactly when the config was absent or corrupt,
// inverting the documented opt-in contract. The BOM case is the sharpest
// regression: a PowerShell-BOM'd config containing an explicit
// {"enabled": false} used to turn L8 ON.
//
// Eight config states × both scripts, driven as subprocesses in throwaway
// git sandboxes. Spies sit at the exec boundaries:
//   - review:  a stub scripts/codex-check.js drops a marker when the
//     capability gate is consulted — reaching it proves the enabled gate
//     passed; not reaching it proves no Codex invocation was attempted.
//   - loop:    a stub scripts/codex-review.js drops a marker when the loop
//     shells out to the single-shot review.
//   - both:    a poison `codex` on PATH drops a marker if the real binary
//     is ever spawned. It must never fire in this suite.
//
// Fixtures live in fixtures/codex-config/ (repo-only, never shipped). The
// BOM fixture is committed as deliberate bytes — a self-check test asserts
// the EF BB BF prefix survived git/editors before the states that rely on it.
//
// Run: node framework/scripts/codex-config.test.js
//

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const REVIEW_SCRIPT = path.join(__dirname, "codex-review.js");
const LOOP_SCRIPT = path.join(__dirname, "codex-review-loop.js");
const FIXTURES = path.join(__dirname, "fixtures", "codex-config");
const IS_WINDOWS = process.platform === "win32";

let passed = 0;
let failed = 0;
const failures = [];
const cleanups = [];

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

// ─── Sandbox + spies ────────────────────────────────────────────────────────

function mkdtemp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const resolved = fs.realpathSync(dir);
  cleanups.push(() => {
    try { fs.rmSync(resolved, { recursive: true, force: true }); }
    catch (_) { /* best-effort */ }
  });
  return resolved;
}

// Poison `codex` on PATH: writes a marker to $CODEX_POISON_MARKER and exits 1.
// Installed once, prepended to PATH for every case. Must never fire here —
// no state in this suite gets past the stubbed capability gate.
function installPoisonCodex() {
  const stubDir = mkdtemp("codex-poison-");
  const stubJs = path.join(stubDir, "codex-poison.js");
  fs.writeFileSync(
    stubJs,
    `"use strict";
const fs = require("fs");
const marker = process.env.CODEX_POISON_MARKER;
if (marker) { try { fs.writeFileSync(marker, "codex binary was spawned"); } catch (_) {} }
process.exit(1);
`
  );
  if (IS_WINDOWS) {
    fs.writeFileSync(
      path.join(stubDir, "codex.cmd"),
      `@echo off\r\nnode "%~dp0codex-poison.js" %*\r\n`
    );
  } else {
    const shim = path.join(stubDir, "codex");
    fs.writeFileSync(shim, `#!/bin/sh\nexec node "$(dirname "$0")/codex-poison.js" "$@"\n`);
    fs.chmodSync(shim, 0o755);
  }
  return stubDir;
}

const POISON_DIR = installPoisonCodex();

// Sandbox: git-init'd (findProjectRoot resolves to the sandbox and stderr
// stays free of git fatals) with exec-boundary stubs in scripts/.
//   scripts/codex-check.js  → marker check-invoked.marker, reports not-ready
//   scripts/codex-review.js → marker review-invoked.marker, reports skipped
function makeSandbox() {
  const root = mkdtemp("codex-config-test-");
  execFileSync("git", ["init", "-q"], { cwd: root, encoding: "utf8" });

  const scriptsDir = path.join(root, "scripts");
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.writeFileSync(
    path.join(scriptsDir, "codex-check.js"),
    `"use strict";
const fs = require("fs"), path = require("path");
fs.writeFileSync(path.join(__dirname, "..", "check-invoked.marker"), "1");
process.stdout.write(JSON.stringify({ ok: false, code: 1, message: "stub-reached-capability-gate" }) + "\\n");
process.exit(1);
`
  );
  fs.writeFileSync(
    path.join(scriptsDir, "codex-review.js"),
    `"use strict";
const fs = require("fs"), path = require("path");
fs.writeFileSync(path.join(__dirname, "..", "review-invoked.marker"), "1");
process.stdout.write(JSON.stringify({ skipped: true, reason: "stub-reached-review" }) + "\\n");
`
  );
  return root;
}

// fixture: filename under fixtures/codex-config/, or null for the absent
// state (no .dos-apes/ at all). copyFileSync preserves bytes — the BOM
// fixture arrives intact.
function runScript(script, fixture) {
  const root = makeSandbox();
  if (fixture !== null) {
    const dosApes = path.join(root, ".dos-apes");
    fs.mkdirSync(dosApes, { recursive: true });
    fs.copyFileSync(
      path.join(FIXTURES, fixture),
      path.join(dosApes, "codex-review-config.json")
    );
  }
  const poisonMarker = path.join(root, "codex-poison.marker");
  const res = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: POISON_DIR + path.delimiter + process.env.PATH,
      CODEX_POISON_MARKER: poisonMarker,
    },
  });
  return {
    root,
    res,
    checkInvoked: fs.existsSync(path.join(root, "check-invoked.marker")),
    reviewInvoked: fs.existsSync(path.join(root, "review-invoked.marker")),
    codexSpawned: fs.existsSync(poisonMarker),
  };
}

// Warnings are the only permitted stderr in a git-init'd sandbox; count the
// script's own prefixed lines rather than asserting raw emptiness.
function warnLines(res, prefix) {
  return (res.stderr || "")
    .split(/\r?\n/)
    .filter((l) => l.startsWith(prefix + ":"));
}

function parseStdout(res) {
  const line = (res.stdout || "").trim();
  assert(line, `expected a JSON envelope on stdout, got empty. stderr: ${res.stderr}`);
  return JSON.parse(line);
}

// ─── The eight-state matrix ─────────────────────────────────────────────────
//
//   warn: whether exactly one prefixed stderr warning is required (and its
//   required substring). States without warn must produce zero prefixed lines.

const LOOP_MESSAGES = {
  "config-absent":
    ".dos-apes/codex-review-config.json absent — L8 is opt-in and off by default (config-absent)",
  "config-unparseable":
    ".dos-apes/codex-review-config.json is not parseable JSON — L8 stays disabled (config-unparseable)",
  "config-invalid":
    ".dos-apes/codex-review-config.json is not a JSON object — L8 stays disabled (config-invalid)",
  "disabled":
    "L8 disabled in .dos-apes/codex-review-config.json",
};

const STATES = [
  { name: "absent (no .dos-apes/)", fixture: null, reason: "config-absent", warn: null },
  { name: "unparseable — garbage", fixture: "garbage.json", reason: "config-unparseable", warn: "config-unparseable" },
  { name: "unparseable — BOM'd enabled:false", fixture: "bom-enabled-false.json", reason: "config-unparseable", warn: "config-unparseable" },
  { name: "invalid — primitive true", fixture: "primitive-true.json", reason: "config-invalid", warn: "config-invalid" },
  { name: "invalid — array []", fixture: "array.json", reason: "config-invalid", warn: "config-invalid" },
  { name: "disabled — explicit false", fixture: "enabled-false.json", reason: "disabled", warn: null },
  { name: "disabled — enabled key missing", fixture: "missing-enabled-key.json", reason: "disabled", warn: null },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

group("fixture self-check", () => {
  test("BOM fixture starts with EF BB BF and carries an explicit enabled:false", () => {
    const bytes = fs.readFileSync(path.join(FIXTURES, "bom-enabled-false.json"));
    assert.deepStrictEqual(
      [...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf],
      "BOM bytes were normalized away — recreate the fixture as deliberate bytes"
    );
    const body = JSON.parse(bytes.slice(3).toString("utf8"));
    assert.strictEqual(body.enabled, false);
  });
});

group("codex-review.js — disabled states skip before any Codex boundary", () => {
  for (const s of STATES) {
    test(`${s.name} → skipped, reason ${s.reason}`, () => {
      const { res, checkInvoked, codexSpawned } = runScript(REVIEW_SCRIPT, s.fixture);
      assert.strictEqual(res.status, 0, `skip must exit 0; got ${res.status}. stderr: ${res.stderr}`);
      const envelope = parseStdout(res);
      assert.deepStrictEqual(envelope, { skipped: true, reason: s.reason });

      const warns = warnLines(res, "codex-review");
      if (s.warn) {
        assert.strictEqual(warns.length, 1, `expected exactly one warning, got: ${JSON.stringify(warns)}`);
        assert(warns[0].includes(s.warn), `warning must name ${s.warn}; got: ${warns[0]}`);
      } else {
        assert.strictEqual(warns.length, 0, `expected no warnings, got: ${JSON.stringify(warns)}`);
      }

      assert.strictEqual(checkInvoked, false, "capability gate must not be consulted in a disabled state");
      assert.strictEqual(codexSpawned, false, "codex binary must never be spawned in a disabled state");
    });
  }

  test("enabled: true → proceeds to the capability gate (enabled-check stays first)", () => {
    const { res, checkInvoked, codexSpawned } = runScript(REVIEW_SCRIPT, "enabled-true.json");
    assert.strictEqual(res.status, 0, `stderr: ${res.stderr}`);
    const envelope = parseStdout(res);
    // The stub capability gate reports not-ready, so the envelope carries its
    // message — proof the gate ran, and ran AFTER the enabled check.
    assert.deepStrictEqual(envelope, { skipped: true, reason: "stub-reached-capability-gate" });
    assert.strictEqual(checkInvoked, true, "enabled:true must reach the capability gate");
    assert.strictEqual(warnLines(res, "codex-review").length, 0);
    assert.strictEqual(codexSpawned, false, "not-ready capability gate must still block the codex binary");
  });
});

group("codex-review-loop.js — disabled states skip before invokeReview", () => {
  for (const s of STATES) {
    test(`${s.name} → state skipped, message names ${s.reason}`, () => {
      const { res, reviewInvoked, codexSpawned } = runScript(LOOP_SCRIPT, s.fixture);
      assert.strictEqual(res.status, 0, `skip must exit 0; got ${res.status}. stderr: ${res.stderr}`);
      const envelope = parseStdout(res);
      assert.strictEqual(envelope.state, "skipped");
      assert.strictEqual(envelope.message, LOOP_MESSAGES[s.reason]);

      const warns = warnLines(res, "codex-review-loop");
      if (s.warn) {
        assert.strictEqual(warns.length, 1, `expected exactly one warning, got: ${JSON.stringify(warns)}`);
        assert(warns[0].includes(s.warn), `warning must name ${s.warn}; got: ${warns[0]}`);
      } else {
        assert.strictEqual(warns.length, 0, `expected no warnings, got: ${JSON.stringify(warns)}`);
      }

      assert.strictEqual(reviewInvoked, false, "single-shot review must not be invoked in a disabled state");
      assert.strictEqual(codexSpawned, false, "codex binary must never be spawned in a disabled state");
    });
  }

  test("enabled: true → shells out to codex-review.js (enabled-check stays first)", () => {
    const { res, reviewInvoked } = runScript(LOOP_SCRIPT, "enabled-true.json");
    assert.strictEqual(res.status, 0, `stderr: ${res.stderr}`);
    const envelope = parseStdout(res);
    // The stub single-shot reports skipped:stub-reached-review; the loop
    // forwards it as its skipped terminal — proof invokeReview ran.
    assert.strictEqual(envelope.state, "skipped");
    assert.strictEqual(envelope.message, "stub-reached-review");
    assert.strictEqual(reviewInvoked, true, "enabled:true must reach invokeReview");
  });
});

group("writeResult guard — .dos-apes/ is never created by a skip", () => {
  test("config-absent skip creates no .dos-apes/", () => {
    const { root, res } = runScript(LOOP_SCRIPT, null);
    assert.strictEqual(res.status, 0);
    assert.strictEqual(
      fs.existsSync(path.join(root, ".dos-apes")), false,
      "a config-absent skip must not create the directory whose absence caused it"
    );
  });

  test("disabled skip with existing .dos-apes/ still writes result.json", () => {
    const { root, res } = runScript(LOOP_SCRIPT, "enabled-false.json");
    assert.strictEqual(res.status, 0);
    const resultPath = path.join(root, ".dos-apes", "codex-reviews", "result.json");
    assert(fs.existsSync(resultPath), "result.json must be written when .dos-apes/ already exists");
    const persisted = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    assert.strictEqual(persisted.state, "skipped");
    assert.strictEqual(persisted.message, LOOP_MESSAGES["disabled"]);
  });
});

group("codex.required: true — a config-disabled skip is a hard failure (AC-4)", () => {
  test("required + config-absent → non-zero exit, message names config-absent and the remedy", () => {
    const root = makeSandbox();
    // Mission with codex.required: true — no .dos-apes/ at all (config-absent).
    const missionsDir = path.join(root, ".planning", "missions", "doing");
    fs.mkdirSync(missionsDir, { recursive: true });
    fs.writeFileSync(
      path.join(missionsDir, "M-0900-required-test.md"),
      [
        "---",
        "id: M-0900",
        "schema_version: 2",
        "title: required-skip interaction test",
        "state: doing",
        "created: 2026-07-05",
        "updated: 2026-07-05",
        "workspace:",
        "  branch: main",
        "codex:",
        "  required: true",
        "---",
        "",
        "## Workpad",
        "",
      ].join("\n")
    );

    const res = spawnSync(process.execPath, [LOOP_SCRIPT, "--mission", "M-0900"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PATH: POISON_DIR + path.delimiter + process.env.PATH },
    });

    assert.notStrictEqual(
      res.status, 0,
      `required-skip must be the failure path, not a clean skip; got exit 0\nstdout: ${res.stdout}`
    );
    // The refusal surfaces the config state and the remedy — not a Codex outage.
    assert(
      /config-absent/.test(res.stderr),
      `refusal must name the config state; stderr: ${res.stderr}`
    );
    assert(
      /remove codex\.required/.test(res.stderr),
      `refusal must state the remedy; stderr: ${res.stderr}`
    );
    // The skipped payload still reaches stdout so envelope parsers see the state.
    const envelope = parseStdout(res);
    assert.strictEqual(envelope.state, "skipped");
    assert.strictEqual(envelope.message, LOOP_MESSAGES["config-absent"]);
    // And the skip still must not create .dos-apes/ (ruling 2 holds here too).
    assert.strictEqual(fs.existsSync(path.join(root, ".dos-apes")), false);
  });
});

// ─── Teardown ───────────────────────────────────────────────────────────────

for (const c of cleanups) {
  try { c(); } catch (_) { /* best-effort */ }
}

process.stdout.write(`\n${passed} passed${failed ? `, ${failed} failed` : ""}\n`);
if (failed > 0) {
  for (const { name, err } of failures) {
    process.stderr.write(`\n--- ${name}\n${err && err.stack ? err.stack : err}\n`);
  }
  process.exit(1);
}
