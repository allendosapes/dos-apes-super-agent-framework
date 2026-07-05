"use strict";
//
// cli.test.js — tests for the installer's settings customization: install-time
// Skill-rule generation (M-0001 AC #2), static-list fallback, and version
// stamping. Hand-rolled runner so we don't pull in a test framework (CLI must
// remain zero-dep — and the rest of the framework follows suit).
//
// Run:  node bin/cli.test.js
//

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { generateSkillRules, customizeSettings, unpatchWindowsHooks } = require("./cli.js");
const { version: PKG_VERSION } = require("../package.json");

const REPO_ROOT = path.join(__dirname, "..");
const REAL_FRAMEWORK_DIR = path.join(REPO_ROOT, "framework");

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

// ─── Fixture helpers ─────────────────────────────────────────────────────────

const tmpRoots = [];

function makeFixtureFrameworkDir({ commands = [], skills = [], settings } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dos-apes-cli-test-"));
  tmpRoots.push(root);
  fs.mkdirSync(path.join(root, "commands"));
  fs.mkdirSync(path.join(root, "skills"));
  for (const name of commands) {
    fs.writeFileSync(path.join(root, "commands", name), "# fixture command\n");
  }
  for (const name of skills) {
    fs.writeFileSync(path.join(root, "skills", name), "# fixture skill\n");
  }
  if (settings !== undefined) {
    fs.writeFileSync(path.join(root, "settings.json"), JSON.stringify(settings, null, 2));
  }
  return root;
}

function baseFixtureSettings() {
  return {
    permissions: {
      allow: [
        "Skill(stale-command)",
        "Skill(stale-command *)",
        "Skill(stale-skill)",
        "Bash(git status *)",
        "Bash(npm test *)",
      ],
      ask: ["Bash(git push *)"],
      deny: ["Bash(npm publish)"],
    },
    env: {
      DOS_APES_FRAMEWORK: "true",
      DOS_APES_VERSION: "0.0.0-template",
    },
  };
}

function cleanupFixtures() {
  for (const root of tmpRoots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

// ─── generateSkillRules ──────────────────────────────────────────────────────

group("generateSkillRules", () => {
  test("commands get exact + args pair; skills get exact only", () => {
    const dir = makeFixtureFrameworkDir({
      commands: ["apes-build.md"],
      skills: ["testing.md"],
    });
    const rules = generateSkillRules(path.join(dir, "commands"), path.join(dir, "skills"));
    assert.deepStrictEqual(rules, [
      "Skill(apes-build)",
      "Skill(apes-build *)",
      "Skill(testing)",
    ]);
  });

  test("names are sorted alphabetically within each group", () => {
    const dir = makeFixtureFrameworkDir({
      commands: ["apes-fix.md", "apes-build.md"],
      skills: ["testing.md", "backend.md"],
    });
    const rules = generateSkillRules(path.join(dir, "commands"), path.join(dir, "skills"));
    assert.deepStrictEqual(rules, [
      "Skill(apes-build)",
      "Skill(apes-build *)",
      "Skill(apes-fix)",
      "Skill(apes-fix *)",
      "Skill(backend)",
      "Skill(testing)",
    ]);
  });

  test("README.md is excluded regardless of case; non-md files ignored", () => {
    const dir = makeFixtureFrameworkDir({
      commands: ["apes-build.md", "notes.txt"],
      skills: ["README.md", "readme.md", "testing.md", "helper.sh"],
    });
    const rules = generateSkillRules(path.join(dir, "commands"), path.join(dir, "skills"));
    assert.deepStrictEqual(rules, [
      "Skill(apes-build)",
      "Skill(apes-build *)",
      "Skill(testing)",
    ]);
  });

  test("missing directories yield an empty list (fallback signal)", () => {
    const rules = generateSkillRules(
      path.join(os.tmpdir(), "dos-apes-does-not-exist-a"),
      path.join(os.tmpdir(), "dos-apes-does-not-exist-b")
    );
    assert.deepStrictEqual(rules, []);
  });

  test("generated rules from the real framework match the static list in settings.json (drift guard)", () => {
    const generated = generateSkillRules(
      path.join(REAL_FRAMEWORK_DIR, "commands"),
      path.join(REAL_FRAMEWORK_DIR, "skills")
    );
    const shipped = JSON.parse(
      fs.readFileSync(path.join(REAL_FRAMEWORK_DIR, "settings.json"), "utf8")
    );
    const staticSkillRules = shipped.permissions.allow.filter((r) => r.startsWith("Skill("));
    assert.deepStrictEqual(
      generated,
      staticSkillRules,
      "framework/settings.json static Skill rules have drifted from the command/skill inventory — regenerate the static fallback list"
    );
  });
});

// ─── customizeSettings ───────────────────────────────────────────────────────

group("customizeSettings", () => {
  test("replaces static Skill rules with generated ones, preserving non-Skill rules and order", () => {
    const dir = makeFixtureFrameworkDir({
      commands: ["apes-build.md"],
      skills: ["testing.md"],
      settings: baseFixtureSettings(),
    });
    const out = JSON.parse(customizeSettings({}, dir));
    assert.deepStrictEqual(out.permissions.allow, [
      "Skill(apes-build)",
      "Skill(apes-build *)",
      "Skill(testing)",
      "Bash(git status *)",
      "Bash(npm test *)",
    ]);
    // ask/deny untouched
    assert.deepStrictEqual(out.permissions.ask, ["Bash(git push *)"]);
    assert.deepStrictEqual(out.permissions.deny, ["Bash(npm publish)"]);
  });

  test("a newly added skill file auto-enrolls without touching the static list", () => {
    const dir = makeFixtureFrameworkDir({
      commands: ["apes-build.md", "apes-new-thing.md"],
      skills: ["testing.md"],
      settings: baseFixtureSettings(),
    });
    const out = JSON.parse(customizeSettings({}, dir));
    assert.ok(out.permissions.allow.includes("Skill(apes-new-thing)"));
    assert.ok(out.permissions.allow.includes("Skill(apes-new-thing *)"));
  });

  test("keeps the static Skill rules when enumeration comes up empty (fallback)", () => {
    const dir = makeFixtureFrameworkDir({
      commands: [],
      skills: [],
      settings: baseFixtureSettings(),
    });
    const out = JSON.parse(customizeSettings({}, dir));
    assert.deepStrictEqual(out.permissions.allow, baseFixtureSettings().permissions.allow);
  });

  test("stamps DOS_APES_VERSION from package.json", () => {
    const dir = makeFixtureFrameworkDir({
      commands: ["apes-build.md"],
      skills: [],
      settings: baseFixtureSettings(),
    });
    const out = JSON.parse(customizeSettings({}, dir));
    assert.strictEqual(out.env.DOS_APES_VERSION, PKG_VERSION);
    assert.strictEqual(out.env.DOS_APES_FRAMEWORK, "true");
  });

  test("strips v1 artifacts (contextFiles, _comment)", () => {
    const settings = baseFixtureSettings();
    settings.contextFiles = ["OLD.md"];
    settings._comment = "v1 leftover";
    const dir = makeFixtureFrameworkDir({
      commands: ["apes-build.md"],
      skills: [],
      settings,
    });
    const out = JSON.parse(customizeSettings({}, dir));
    assert.strictEqual(out.contextFiles, undefined);
    assert.strictEqual(out._comment, undefined);
  });

  test("appends cloud CLI rule for the chosen deploy target after generation", () => {
    const dir = makeFixtureFrameworkDir({
      commands: ["apes-build.md"],
      skills: [],
      settings: baseFixtureSettings(),
    });
    const out = JSON.parse(customizeSettings({ deployTarget: "gcp" }, dir));
    assert.ok(out.permissions.allow.includes("Bash(gcloud *)"));
    assert.ok(out.permissions.allow.includes("Skill(apes-build)"));
  });

  test("missing settings.json template falls back to defaults", () => {
    const dir = makeFixtureFrameworkDir({ commands: ["apes-build.md"], skills: [] });
    const out = JSON.parse(customizeSettings({}, dir));
    assert.deepStrictEqual(out, { permissions: {}, hooks: {} });
  });

  test("settings README ships beside the policy and covers its required topics", () => {
    const readme = fs
      .readFileSync(path.join(REAL_FRAMEWORK_DIR, "settings.README.md"), "utf8")
      .replace(/\s+/g, " ");
    for (const topic of [
      "deny → ask → allow",
      "phase tags",
      "never one without the other",
      "guard-forbidden-commands.sh",
      "rephrase",
      "CLAUDE_CODE_GIT_BASH_PATH",
    ]) {
      assert.ok(readme.includes(topic), `settings.README.md missing required topic: ${topic}`);
    }
  });

  test("real framework settings customize cleanly and keep the full allow policy", () => {
    const out = JSON.parse(customizeSettings({}, REAL_FRAMEWORK_DIR));
    // Skill rules present and generated
    assert.ok(out.permissions.allow.includes("Skill(apes-build)"));
    assert.ok(out.permissions.allow.includes("Skill(testing)"));
    // Non-Skill policy intact
    assert.ok(out.permissions.allow.includes("Bash(git checkout -b *)"));
    assert.ok(out.permissions.deny.includes("Bash(npm publish)"));
    assert.ok(out.permissions.ask.includes("Bash(git push *)"));
    // L8 iter-2 regression: no blanket npm run — package scripts are
    // arbitrary code, so `npm run publish` must prompt, not pass
    assert.ok(!out.permissions.allow.includes("Bash(npm run *)"));
    assert.ok(out.permissions.allow.includes("Bash(npm run build)"));
    // Version stamped from package.json
    assert.strictEqual(out.env.DOS_APES_VERSION, PKG_VERSION);
  });
});

// ─── unpatchWindowsHooks ─────────────────────────────────────────────────────
// Claude Code runs hook commands through Git Bash natively on Windows; the
// retired run-hook.cmd rewrite silently broke every hook. These cover the
// reverse migration for previously-patched installs.

group("unpatchWindowsHooks", () => {
  test("restores the script form to bash scripts/*.sh", () => {
    const settings = {
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [
          { type: "command", command: "scripts\\run-hook.cmd scripts/guard-forbidden-commands.sh", timeout: 10 },
        ]}],
      },
    };
    assert.strictEqual(unpatchWindowsHooks(settings), true);
    assert.strictEqual(
      settings.hooks.PreToolUse[0].hooks[0].command,
      "bash scripts/guard-forbidden-commands.sh"
    );
  });

  test("restores the inline -c form with quotes unescaped", () => {
    const settings = {
      hooks: {
        SessionStart: [{ hooks: [
          { type: "command", command: 'scripts\\run-hook.cmd -c "echo \\"hi\\" && cat x | head -5"' },
        ]}],
      },
    };
    assert.strictEqual(unpatchWindowsHooks(settings), true);
    assert.strictEqual(
      settings.hooks.SessionStart[0].hooks[0].command,
      'echo "hi" && cat x | head -5'
    );
  });

  test("leaves unpatched settings untouched and reports no change", () => {
    const settings = {
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [
          { type: "command", command: "bash scripts/guard-forbidden-commands.sh" },
        ]}],
      },
    };
    assert.strictEqual(unpatchWindowsHooks(settings), false);
    assert.strictEqual(
      settings.hooks.PreToolUse[0].hooks[0].command,
      "bash scripts/guard-forbidden-commands.sh"
    );
  });

  test("customizeSettings output contains no run-hook.cmd on any platform", () => {
    const out = customizeSettings({}, REAL_FRAMEWORK_DIR);
    assert.ok(!out.includes("run-hook.cmd"), "hook commands must ship in bash form");
    assert.ok(out.includes("bash scripts/guard-forbidden-commands.sh"));
    assert.ok(out.includes("bash scripts/guard-main-branch.sh"));
  });
});

// ─── packaging drift guard ───────────────────────────────────────────────────
// Second defensive layer next to the per-directory `*.test.js` .npmignore
// files: those cover bin/, framework/lib/, framework/scripts/, while this
// catches leaks from directory-whitelisted `files` entries (framework/
// commands|skills|ci, assets) and any future drift in either mechanism.

group("packaging (npm pack --dry-run --json)", () => {
  const { spawnSync } = require("child_process");
  const res = spawnSync("npm pack --dry-run --json", {
    cwd: REPO_ROOT,
    shell: true,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  let shipped = null;
  try {
    shipped = JSON.parse(res.stdout)[0].files.map((f) => f.path.replace(/\\/g, "/"));
  } catch (_) {
    // fall through — the first test below reports the failure
  }

  test("npm pack --dry-run --json parses", () => {
    assert.ok(Array.isArray(shipped), `npm pack failed: ${res.stderr || res.stdout}`);
  });
  if (!Array.isArray(shipped)) return;

  test("no *.test.js ships in the tarball", () => {
    const leaked = shipped.filter((p) => /\.test\.js$/.test(p));
    assert.deepStrictEqual(leaked, [], `test files leaked into the tarball: ${leaked.join(", ")}`);
  });

  test("nothing from _planning/ ships", () => {
    const leaked = shipped.filter((p) => p.startsWith("_planning/"));
    assert.deepStrictEqual(leaked, []);
  });

  test("no fixtures/ path ships (allowed-tools guard fixtures are repo-only)", () => {
    const leaked = shipped.filter((p) => p.includes("fixtures/"));
    assert.deepStrictEqual(leaked, [], `fixtures leaked into the tarball: ${leaked.join(", ")}`);
  });

  test("cli, guard script, hook runner, and settings ship", () => {
    for (const required of [
      "bin/cli.js",
      "framework/scripts/guard-forbidden-commands.sh",
      "framework/scripts/guard-main-branch.sh",
      "framework/settings.json",
      "framework/settings.README.md",
    ]) {
      assert.ok(shipped.includes(required), `missing from tarball: ${required}`);
    }
  });

  test("every production file enumerated in the files whitelist ships", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
    const explicit = pkg.files.filter((f) => !f.endsWith("/") && !/\.test\.js$/.test(f));
    const missing = explicit.filter((f) => !shipped.includes(f));
    assert.deepStrictEqual(missing, [], `whitelisted files missing from tarball: ${missing.join(", ")}`);
  });
});

// ─── Summary ─────────────────────────────────────────────────────────────────

cleanupFixtures();

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  for (const { name, err } of failures) {
    process.stdout.write(`\nFAIL: ${name}\n${err && err.stack ? err.stack : err}\n`);
  }
  process.exit(1);
}
