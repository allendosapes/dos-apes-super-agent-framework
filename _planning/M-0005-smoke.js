#!/usr/bin/env node
"use strict";
//
// M-0005 smoke test — drives the mission-native Codex contract end-to-end
// against a temporary project tree, no Codex CLI required.
//
// Scenarios:
//   1. Create mission, no L8 → no codex block in frontmatter
//   2. Simulate single-shot review → codex block appears via mission-cli show
//   3. /apes-status-style render → codex line shown for missions w/ a block
//   4. Force loop terminal = exhausted → frontmatter + workpad both populated
//   5. codex.required: true blocks 'skipped' terminal (RequiredSkipError)
//   6. v1 mission auto-migrates to v2 on first read; disk untouched
//
// Run:  node _planning/M-0005-smoke.js
//

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const { MissionTracker, STATES } = require(path.join(REPO_ROOT, "framework/lib/mission-tracker.js"));
const parser = require(path.join(REPO_ROOT, "framework/lib/mission-parser.js"));
const codexReview = require(path.join(REPO_ROOT, "framework/scripts/codex-review.js"));
const loop = require(path.join(REPO_ROOT, "framework/scripts/codex-review-loop.js"));

const cleanups = [];
process.on("exit", () => { for (const c of cleanups) try { c(); } catch (_) {} });

function makeProject({ git = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "m0005-smoke-"));
  for (const s of STATES) {
    fs.mkdirSync(path.join(root, ".planning", "missions", s), { recursive: true });
  }
  if (git) {
    // mission-cli.js refuses to run outside a git repo. The smoke test
    // exercises mission-cli for parity with how /apes-build reads state,
    // so the project must be a real repo.
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["config", "user.email", "smoke@example.com"], { cwd: root });
    execFileSync("git", ["config", "user.name", "M-0005 Smoke"], { cwd: root });
    execFileSync("git", ["commit", "-q", "--allow-empty", "-m", "init"], { cwd: root });
  }
  cleanups.push(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function trackerFor(root) {
  return new MissionTracker({ root: path.join(root, ".planning", "missions") });
}

function seedMission(root, state, id, extras = {}) {
  const fm = {
    id,
    schema_version: 2,
    title: `Smoke ${id}`,
    state,
    created: "2026-05-01",
    updated: "2026-05-01",
    ...extras,
  };
  const text = `---\n${parser.serializeFrontmatter(fm)}\n---\n\n## Workpad\n`;
  const file = path.join(root, ".planning", "missions", state, `${id}-smoke.md`);
  fs.writeFileSync(file, text);
  return file;
}

function seedV1Mission(root, state, id) {
  // No schema_version field → v1
  const fm = `id: ${id}\ntitle: Legacy ${id}\nstate: ${state}\ncreated: 2025-01-01\nupdated: 2025-01-01\n`;
  const text = `---\n${fm}---\n\n## Workpad\n`;
  const file = path.join(root, ".planning", "missions", state, `${id}-legacy.md`);
  fs.writeFileSync(file, text);
  return file;
}

function fakeReviewPath(root, iteration) {
  const p = path.join(root, ".dos-apes", "codex-reviews", `iteration-${iteration}`, "review.json");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ stub: true }));
  return p;
}

// Run the mission-cli show command against the temp project root and
// return parsed JSON. Mirrors how /apes-build reads state in P4.
function missionCliShow(projectRoot, id) {
  const cli = path.join(REPO_ROOT, "framework/scripts/mission-cli.js");
  const out = execFileSync(process.execPath, [cli, "show", id], {
    encoding: "utf8",
    cwd: projectRoot,
    env: { ...process.env, MISSIONS_ROOT: path.join(projectRoot, ".planning", "missions") },
  });
  return JSON.parse(out.trim());
}

const results = [];
function scenario(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (err) {
    results.push({ name, ok: false, err });
    process.stdout.write(`  ✗ ${name}\n    ${err.message}\n`);
  }
}

process.stdout.write("\nM-0005 smoke test — mission-native Codex state\n");
process.stdout.write("──────────────────────────────────────────────\n");

// ─── Scenario 1: no L8, no codex block ─────────────────────────────────────

scenario("1. New mission has no codex block when L8 hasn't run", () => {
  const root = makeProject();
  const t = trackerFor(root);
  const { id } = t.createMission({ title: "Build feature X" });
  const m = t.readMission(id);
  assert.strictEqual(m.frontmatter.schema_version, 2,
    "newly created missions must ship at v2");
  assert.strictEqual(m.frontmatter.codex, undefined,
    "missions without L8 activity must NOT have a codex block");
  // The on-disk file must literally not contain the word `codex:` as a key.
  const text = fs.readFileSync(m.path, "utf8");
  assert(!/^\s*codex\s*:/m.test(text), "file must not contain a `codex:` line");
});

// ─── Scenario 2: single-shot review writes codex block ─────────────────────

scenario("2. recordCodexReview (single-shot equiv) writes the codex block", () => {
  const root = makeProject({ git: true }); // mission-cli requires a git repo
  seedMission(root, "doing", "M-0001");
  const t = trackerFor(root);
  const outputPath = fakeReviewPath(root, 1);

  // Simulate what codex-review.js does after a successful review.
  codexReview.recordCodexReview({
    missionId: "M-0001",
    review: {
      verdict: "revise",
      confidence: 0.85,
      summary: "needs work",
      findings: [
        { severity: "critical", file: "a.js", note: "boom" },
        { severity: "high",     file: "b.js", note: "bang" },
        { severity: "low",      file: "c.js", note: "nit"  },
      ],
    },
    outputPath,
    projectRoot: root,
    tracker: t,
  });

  // Verify via the same surface /apes-build uses: mission-cli show.
  const shown = missionCliShow(root, "M-0001");
  const codex = shown.frontmatter.codex;
  assert(codex, "codex block must appear in mission-cli show output");
  assert.strictEqual(codex.last_verdict, "findings-reported");
  assert.strictEqual(codex.unresolved_findings, 2);
  assert(/iteration-1\/review\.json$/.test(codex.last_review_path),
    `last_review_path should reference the review file, got: ${codex.last_review_path}`);
});

// ─── Scenario 3: /apes-status renderer produces a codex line ───────────────

scenario("3. /apes-status-style renderer surfaces codex state", () => {
  const root = makeProject();
  seedMission(root, "doing", "M-0001", {
    codex: { last_verdict: "exhausted", unresolved_findings: 3 },
  });
  seedMission(root, "doing", "M-0002"); // no codex block — should render plain

  // Replicates the codexLine() function inlined in apes-status.md
  function codexLine(fm) {
    const c = fm && fm.codex;
    if (!c || typeof c !== "object") return null;
    const verdict = c.last_verdict || "none";
    const unresolved = (typeof c.unresolved_findings === "number") ? c.unresolved_findings : null;
    const required = c.required === true ? " · required" : "";
    return unresolved === null
      ? `codex: ${verdict}${required}`
      : `codex: ${verdict}, ${unresolved} unresolved${required}`;
  }

  const t = trackerFor(root);
  const m1 = t.readMission("M-0001");
  const m2 = t.readMission("M-0002");
  assert.strictEqual(codexLine(m1.frontmatter), "codex: exhausted, 3 unresolved");
  assert.strictEqual(codexLine(m2.frontmatter), null,
    "missions without codex block must render exactly as before (no codex line)");
});

// ─── Scenario 4: forced exhausted terminal → frontmatter + workpad ─────────

scenario("4. Loop terminal=exhausted → frontmatter exhausted + workpad lists findings", () => {
  const root = makeProject();
  seedMission(root, "doing", "M-0001");
  const t = trackerFor(root);
  const reviewPath = fakeReviewPath(root, 3);

  loop.recordTerminalSideEffects({
    state: "exhausted",
    mission: "M-0001",
    iteration: 3,
    max_iterations: 3,
    findings_count: 2,
    open_findings: [
      { severity: "critical", file: "src/a.js", line_range: { start: 5 }, explanation: "broken" },
      { severity: "high",     file: "src/b.js", line_range: { start: 9 }, explanation: "leaks" },
    ],
    reviews: [reviewPath],
  }, { tracker: t, projectRoot: root });

  const codex = t.getCodexState("M-0001");
  assert.strictEqual(codex.last_verdict, "exhausted");
  assert(codex.unresolved_findings > 0, "exhausted must record unresolved findings");

  const m = t.readMission("M-0001");
  assert(/exhausted/.test(m.body), "workpad must mention exhausted state");
  assert(/critical.*src\/a\.js:5/.test(m.body), "workpad must list each finding");
  assert(/Final review:.*iteration-3\/review\.json/.test(m.body),
    "workpad must include the path to the final review JSON");
  // M-0002 canonical workpad heading format.
  assert(/^### \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/m.test(m.body),
    "workpad heading must match canonical M-0002 format (no UTC marker, no role suffix)");
});

// ─── Scenario 5: codex.required: true blocks 'skipped' ─────────────────────

scenario("5. codex.required: true makes 'skipped' a hard error", () => {
  const root = makeProject();
  seedMission(root, "doing", "M-0001", {
    codex: { required: true, max_rounds: 3, last_verdict: "none" },
  });
  const t = trackerFor(root);

  let threwCorrectly = false;
  try {
    loop.recordTerminalSideEffects(
      { state: "skipped", mission: "M-0001", message: "Codex CLI not installed" },
      { tracker: t, projectRoot: root }
    );
  } catch (err) {
    if (err.code === "REQUIRED_SKIP" && /codex\.required: true/.test(err.message)) {
      threwCorrectly = true;
    } else {
      throw err;
    }
  }
  assert.strictEqual(threwCorrectly, true,
    "loop must throw RequiredSkipError on skipped+required");

  // Verdict must NOT have been bumped to skipped on the disk file.
  const codex = t.getCodexState("M-0001");
  assert.strictEqual(codex.last_verdict, "none",
    "frontmatter must not be updated when required-skip fires");
});

// ─── Scenario 6: v1 mission auto-migrates to v2 on first read ──────────────

scenario("6. v1 mission auto-migrates to v2 on first read; disk untouched", () => {
  const root = makeProject();
  const file = seedV1Mission(root, "todo", "M-0001");
  const beforeText = fs.readFileSync(file, "utf8");
  const beforeMtime = fs.statSync(file).mtimeMs;

  assert(!/schema_version/.test(beforeText), "seed must be a true v1 file");

  const t = trackerFor(root);
  const m = t.readMission("M-0001");

  assert.strictEqual(m.frontmatter.schema_version, 2,
    "in-memory frontmatter must be v2");
  assert.strictEqual(m.frontmatter.codex, undefined,
    "migration must NOT add a codex block");

  const afterText = fs.readFileSync(file, "utf8");
  assert.strictEqual(afterText, beforeText,
    "disk file MUST be byte-identical after a pure read (no-surprise mutation)");
  assert.strictEqual(fs.statSync(file).mtimeMs, beforeMtime,
    "mtime MUST not move on a pure read");
});

// ─── Summary ───────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.ok);
process.stdout.write("\n");
process.stdout.write(`${results.length - failed.length}/${results.length} scenarios passed\n`);
if (failed.length > 0) {
  process.stdout.write("\nFailures:\n");
  for (const r of failed) {
    process.stdout.write(`  - ${r.name}\n    ${r.err.stack || r.err.message}\n`);
  }
  process.exit(1);
}
