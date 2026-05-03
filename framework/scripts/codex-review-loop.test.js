"use strict";
//
// codex-review-loop.test.js — exercises the terminal-state side-effect
// surface of the loop driver: codex frontmatter updates, selective workpad
// entries, codex.required gate, and the invariant that the loop never
// changes mission state.
//
// The Codex / Claude subprocess paths are integration territory and are
// covered by their own scripts; here we drive the helpers directly with
// synthetic terminal payloads.
//
// Run:  node framework/scripts/codex-review-loop.test.js
//

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { MissionTracker, STATES } = require("../lib/mission-tracker.js");
const parser = require("../lib/mission-parser.js");
const schema = require("../lib/mission-schema.js");

const loop = require("./codex-review-loop.js");

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

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeProjectTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-loop-test-"));
  for (const s of STATES) {
    fs.mkdirSync(path.join(root, ".planning", "missions", s), { recursive: true });
  }
  cleanups.push(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function seedMission(root, state, id, extras = {}) {
  const fm = {
    id,
    schema_version: 2,
    title: `Mission ${id}`,
    state,
    created: "2026-05-01",
    updated: "2026-05-01",
    ...extras,
  };
  const text = `---\n${parser.serializeFrontmatter(fm)}\n---\n\n## Workpad\n`;
  const file = path.join(root, ".planning", "missions", state, `${id}-mission.md`);
  fs.writeFileSync(file, text);
  return file;
}

function trackerFor(root) {
  return new MissionTracker({ root: path.join(root, ".planning", "missions") });
}

function captureStderr(fn) {
  const orig = process.stderr.write.bind(process.stderr);
  const lines = [];
  process.stderr.write = (chunk) => { lines.push(String(chunk)); return true; };
  try { fn(); } finally { process.stderr.write = orig; }
  return lines.join("");
}

function fakeFinding(severity, file, lineStart, explanation) {
  return {
    severity,
    file,
    line_range: { start: lineStart, end: lineStart },
    explanation,
  };
}

function makeReviewPath(root, iteration) {
  const p = path.join(root, ".dos-apes", "codex-reviews", `iteration-${iteration}`, "review.json");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ stub: true, iteration }));
  return p;
}

// Read the mission file's state directory directly, NOT through the tracker —
// we want to verify the file is still in the same state directory after the
// loop helpers run, regardless of any in-memory bookkeeping.
function missionStateOnDisk(root, id) {
  for (const s of STATES) {
    const dir = path.join(root, ".planning", "missions", s);
    if (!fs.existsSync(dir)) continue;
    if (fs.readdirSync(dir).some((f) => f.startsWith(`${id}-`) && f.endsWith(".md"))) {
      return s;
    }
  }
  return null;
}

// ─── Pure helpers ──────────────────────────────────────────────────────────

group("codexBlockUpdateForTerminal — verdict + counts", () => {
  test("accepted → last_verdict=accepted, unresolved_findings=0", () => {
    const u = loop.codexBlockUpdateForTerminal({
      state: "accepted",
      mission: "M-0001",
      iteration: 1,
      max_iterations: 3,
      reviews: ["/abs/iter-1/review.json"],
    }, { projectRoot: "/abs" });
    assert.strictEqual(u.last_verdict, "accepted");
    assert.strictEqual(u.unresolved_findings, 0);
    assert(u.last_review_path.endsWith("iter-1/review.json"));
    assert(/^\d{4}-\d{2}-\d{2}T/.test(u.last_run_at));
  });

  test("partial-success → last_verdict=partial-success, unresolved=findings_count (low/medium total)", () => {
    const u = loop.codexBlockUpdateForTerminal({
      state: "partial-success",
      iteration: 2,
      max_iterations: 3,
      mission: "M-0001",
      findings_count: 4,
      reviews: ["/abs/iter-2/review.json"],
    }, { projectRoot: "/abs" });
    assert.strictEqual(u.last_verdict, "partial-success");
    assert.strictEqual(u.unresolved_findings, 4);
  });

  test("findings-reported → last_verdict=findings-reported, unresolved=findings_count", () => {
    const u = loop.codexBlockUpdateForTerminal({
      state: "findings-reported",
      iteration: 1,
      max_iterations: 3,
      mission: "M-0001",
      findings_count: 2,
      reviews: ["/abs/iter-1/review.json"],
    }, { projectRoot: "/abs" });
    assert.strictEqual(u.last_verdict, "findings-reported");
    assert.strictEqual(u.unresolved_findings, 2);
  });

  test("exhausted → last_verdict=exhausted, unresolved=findings_count", () => {
    const u = loop.codexBlockUpdateForTerminal({
      state: "exhausted",
      iteration: 3,
      max_iterations: 3,
      mission: "M-0001",
      findings_count: 1,
      reviews: ["/abs/iter-3/review.json"],
    }, { projectRoot: "/abs" });
    assert.strictEqual(u.last_verdict, "exhausted");
    assert.strictEqual(u.unresolved_findings, 1);
  });

  test("no-progress → last_verdict=no-progress, unresolved=findings_count", () => {
    const u = loop.codexBlockUpdateForTerminal({
      state: "no-progress",
      iteration: 2,
      max_iterations: 3,
      mission: "M-0001",
      findings_count: 3,
      reviews: ["/abs/iter-2/review.json"],
    }, { projectRoot: "/abs" });
    assert.strictEqual(u.last_verdict, "no-progress");
    assert.strictEqual(u.unresolved_findings, 3);
  });

  test("skipped → only last_verdict + last_run_at (preserves prior counts)", () => {
    const u = loop.codexBlockUpdateForTerminal({
      state: "skipped",
      mission: "M-0001",
      message: "Codex unavailable",
    });
    assert.strictEqual(u.last_verdict, "skipped");
    assert(u.last_run_at);
    assert.strictEqual(u.unresolved_findings, undefined,
      "skipped must NOT reset unresolved_findings");
    assert.strictEqual(u.last_review_path, undefined,
      "skipped must NOT clobber last_review_path");
  });

  test("each terminal verdict matches the schema's CODEX_VERDICTS enum", () => {
    const states = ["accepted", "partial-success", "findings-reported", "exhausted", "no-progress", "skipped"];
    for (const state of states) {
      const u = loop.codexBlockUpdateForTerminal({ state, mission: "M-0001" });
      assert(schema.CODEX_VERDICTS.includes(u.last_verdict),
        `${u.last_verdict} must be a valid codex.last_verdict`);
    }
  });
});

group("workpadEntryForTerminal — selectivity per playbook table", () => {
  test("accepted → null (clean accept doesn't merit a note)", () => {
    assert.strictEqual(loop.workpadEntryForTerminal({ state: "accepted" }), null);
  });
  test("findings-reported → null (--no-fix; user wanted findings only)", () => {
    assert.strictEqual(loop.workpadEntryForTerminal({ state: "findings-reported" }), null);
  });
  test("skipped → null (skip is not an interesting event)", () => {
    assert.strictEqual(loop.workpadEntryForTerminal({ state: "skipped" }), null);
  });

  test("partial-success → summary of low/medium findings", () => {
    const note = loop.workpadEntryForTerminal({
      state: "partial-success",
      iteration: 1,
      open_findings: [
        fakeFinding("low", "src/a.js", 3, "minor nit"),
        fakeFinding("medium", "src/b.js", 7, "consider refactor"),
      ],
    });
    assert(note !== null);
    assert(/partial-success/.test(note));
    assert(/low.*src\/a\.js:3/.test(note));
    assert(/medium.*src\/b\.js:7/.test(note));
  });

  test("exhausted → list unresolved findings + path to final review", () => {
    const note = loop.workpadEntryForTerminal({
      state: "exhausted",
      iteration: 3,
      max_iterations: 3,
      reviews: ["/proj/.dos-apes/codex-reviews/iteration-3/review.json"],
      open_findings: [fakeFinding("critical", "src/a.js", 5, "broken")],
    }, { projectRoot: "/proj" });
    assert(/exhausted/.test(note));
    assert(/critical.*src\/a\.js:5/.test(note));
    assert(/Final review:.*iteration-3\/review\.json/.test(note));
  });

  test("no-progress → note + path to final review", () => {
    const note = loop.workpadEntryForTerminal({
      state: "no-progress",
      iteration: 2,
      reviews: ["/proj/.dos-apes/codex-reviews/iteration-2/review.json"],
      open_findings: [fakeFinding("high", "x.js", 1, "still broken")],
      message: "No new commits detected after Claude Code fix step.",
    }, { projectRoot: "/proj" });
    assert(/no-progress/.test(note));
    assert(/No new commits/.test(note));
    assert(/Final review:.*iteration-2\/review\.json/.test(note));
  });

  test("truncates long finding lists to 10 with an overflow line", () => {
    const findings = [];
    for (let i = 0; i < 25; i++) {
      findings.push(fakeFinding("low", `f${i}.js`, i, "nit"));
    }
    const note = loop.workpadEntryForTerminal({
      state: "partial-success",
      iteration: 1,
      open_findings: findings,
    });
    const bullets = note.split("\n").filter((l) => l.startsWith("- "));
    assert.strictEqual(bullets.length, 11, "10 findings + 1 overflow line");
    assert(/15 more/.test(bullets[10]));
  });
});

// ─── Side effect orchestration against a real mission tracker ──────────────

group("recordTerminalSideEffects — frontmatter + workpad against a real tracker", () => {
  test("accepted: codex block updated; NO workpad entry", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001");
    const tracker = trackerFor(root);
    const reviewPath = makeReviewPath(root, 1);

    loop.recordTerminalSideEffects({
      state: "accepted",
      mission: "M-0001",
      iteration: 1,
      max_iterations: 3,
      reviews: [reviewPath],
    }, { tracker, projectRoot: root });

    const codex = tracker.getCodexState("M-0001");
    assert.strictEqual(codex.last_verdict, "accepted");
    assert.strictEqual(codex.unresolved_findings, 0);
    assert.strictEqual(codex.last_review_path, ".dos-apes/codex-reviews/iteration-1/review.json");
    assert(/^\d{4}-\d{2}-\d{2}T/.test(codex.last_run_at));

    const m = tracker.readMission("M-0001");
    assert(!/codex-loop/.test(m.body), "no workpad entry should be written for clean accept");
  });

  test("partial-success: codex block updated; workpad entry present with low/medium summary", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001");
    const tracker = trackerFor(root);
    const reviewPath = makeReviewPath(root, 2);

    loop.recordTerminalSideEffects({
      state: "partial-success",
      mission: "M-0001",
      iteration: 2,
      max_iterations: 3,
      findings_count: 2,
      open_findings: [
        fakeFinding("low", "a.js", 3, "nit"),
        fakeFinding("medium", "b.js", 7, "consider refactor"),
      ],
      reviews: [reviewPath],
    }, { tracker, projectRoot: root });

    const codex = tracker.getCodexState("M-0001");
    assert.strictEqual(codex.last_verdict, "partial-success");
    assert.strictEqual(codex.unresolved_findings, 2);

    const m = tracker.readMission("M-0001");
    assert(/codex-loop/.test(m.body));
    assert(/partial-success/.test(m.body));
    assert(/low.*a\.js:3/.test(m.body));
    // Heading is the canonical M-0002 format: "### YYYY-MM-DD HH:MM"
    assert(/^### \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/m.test(m.body),
      "workpad heading must match M-0002 canonical format");
  });

  test("findings-reported: codex block updated; NO workpad entry", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001");
    const tracker = trackerFor(root);
    const reviewPath = makeReviewPath(root, 1);

    loop.recordTerminalSideEffects({
      state: "findings-reported",
      mission: "M-0001",
      iteration: 1,
      max_iterations: 3,
      findings_count: 2,
      open_findings: [fakeFinding("high", "x.js", 1, "important")],
      reviews: [reviewPath],
    }, { tracker, projectRoot: root });

    const codex = tracker.getCodexState("M-0001");
    assert.strictEqual(codex.last_verdict, "findings-reported");
    assert.strictEqual(codex.unresolved_findings, 2);

    const m = tracker.readMission("M-0001");
    assert(!/codex-loop/.test(m.body), "--no-fix path should not pollute the workpad");
  });

  test("exhausted: codex updated; workpad lists findings and final review path", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001");
    const tracker = trackerFor(root);
    const reviewPath = makeReviewPath(root, 3);

    loop.recordTerminalSideEffects({
      state: "exhausted",
      mission: "M-0001",
      iteration: 3,
      max_iterations: 3,
      findings_count: 1,
      open_findings: [fakeFinding("critical", "src/a.js", 5, "still broken")],
      reviews: [makeReviewPath(root, 1), makeReviewPath(root, 2), reviewPath],
    }, { tracker, projectRoot: root });

    const codex = tracker.getCodexState("M-0001");
    assert.strictEqual(codex.last_verdict, "exhausted");
    assert.strictEqual(codex.unresolved_findings, 1);
    assert.strictEqual(codex.last_review_path, ".dos-apes/codex-reviews/iteration-3/review.json");

    const m = tracker.readMission("M-0001");
    assert(/exhausted/.test(m.body));
    assert(/critical.*src\/a\.js:5/.test(m.body));
    assert(/Final review:.*iteration-3\/review\.json/.test(m.body));
  });

  test("no-progress: codex updated; workpad has no-progress note + final review path", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001");
    const tracker = trackerFor(root);
    const reviewPath = makeReviewPath(root, 2);

    loop.recordTerminalSideEffects({
      state: "no-progress",
      mission: "M-0001",
      iteration: 2,
      max_iterations: 3,
      findings_count: 3,
      open_findings: [fakeFinding("high", "x.js", 1, "still broken")],
      reviews: [makeReviewPath(root, 1), reviewPath],
      message: "No new commits detected after Claude Code fix step.",
    }, { tracker, projectRoot: root });

    const codex = tracker.getCodexState("M-0001");
    assert.strictEqual(codex.last_verdict, "no-progress");
    assert.strictEqual(codex.unresolved_findings, 3);

    const m = tracker.readMission("M-0001");
    assert(/no-progress/.test(m.body));
    assert(/No new commits/.test(m.body));
    assert(/Final review:.*iteration-2\/review\.json/.test(m.body));
  });

  test("skipped: codex updated with verdict only; NO workpad entry", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001", {
      // Pre-existing codex state — must be preserved across a 'skipped' update.
      codex: {
        required: false,
        max_rounds: 3,
        last_verdict: "accepted",
        last_review_path: ".dos-apes/codex-reviews/old.json",
        unresolved_findings: 5,
      },
    });
    const tracker = trackerFor(root);

    loop.recordTerminalSideEffects({
      state: "skipped",
      mission: "M-0001",
      message: "Codex unavailable",
    }, { tracker, projectRoot: root });

    const codex = tracker.getCodexState("M-0001");
    assert.strictEqual(codex.last_verdict, "skipped");
    // Prior fields must survive the partial merge.
    assert.strictEqual(codex.unresolved_findings, 5, "skipped must preserve prior unresolved_findings");
    assert.strictEqual(codex.last_review_path, ".dos-apes/codex-reviews/old.json",
      "skipped must preserve prior last_review_path");
    assert.strictEqual(codex.required, false);
    assert.strictEqual(codex.max_rounds, 3);

    const m = tracker.readMission("M-0001");
    assert(!/codex-loop/.test(m.body));
  });
});

// ─── Mission state invariant ───────────────────────────────────────────────

group("loop never changes mission state", () => {
  test("mission stays in 'doing' across all six terminal states", () => {
    const states = ["accepted", "partial-success", "findings-reported", "exhausted", "no-progress", "skipped"];
    for (const state of states) {
      const root = makeProjectTree();
      seedMission(root, "doing", "M-0001");
      const tracker = trackerFor(root);
      const reviewPath = makeReviewPath(root, 1);
      assert.strictEqual(missionStateOnDisk(root, "M-0001"), "doing",
        `${state}: mission should start in doing/`);

      loop.recordTerminalSideEffects({
        state,
        mission: "M-0001",
        iteration: 1,
        max_iterations: 3,
        findings_count: 1,
        open_findings: [fakeFinding("high", "x.js", 1, "x")],
        reviews: [reviewPath],
        message: "synthetic",
      }, { tracker, projectRoot: root });

      assert.strictEqual(missionStateOnDisk(root, "M-0001"), "doing",
        `${state}: mission must NOT have moved out of doing/`);
    }
  });
});

// ─── codex.required gate ───────────────────────────────────────────────────

group("codex.required: true blocks 'skipped' termination", () => {
  test("preventRequiredSkip throws RequiredSkipError when required=true and state=skipped", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001", {
      codex: { required: true, max_rounds: 3 },
    });
    const tracker = trackerFor(root);

    assert.throws(
      () => loop.preventRequiredSkip(
        { state: "skipped", mission: "M-0001", message: "Codex unavailable" },
        { tracker, projectRoot: root }
      ),
      (err) => err.code === "REQUIRED_SKIP" &&
        /codex\.required: true/.test(err.message) &&
        /Codex unavailable/.test(err.message),
    );
  });

  test("recordTerminalSideEffects propagates RequiredSkipError; codex/workpad NOT updated", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001", {
      codex: { required: true, max_rounds: 3, last_verdict: "none" },
    });
    const tracker = trackerFor(root);

    assert.throws(
      () => loop.recordTerminalSideEffects(
        { state: "skipped", mission: "M-0001", message: "Codex CLI not installed" },
        { tracker, projectRoot: root }
      ),
      (err) => err.code === "REQUIRED_SKIP",
    );

    // Verdict must NOT have been bumped to skipped.
    const codex = tracker.getCodexState("M-0001");
    assert.strictEqual(codex.last_verdict, "none",
      "codex block must not be updated when required-skip fires");
    const m = tracker.readMission("M-0001");
    assert(!/codex-loop/.test(m.body), "no workpad entry on required-skip");
  });

  test("required=false (or absent) allows skipped to terminate normally", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001", {
      codex: { required: false, max_rounds: 3 },
    });
    const tracker = trackerFor(root);

    let threw = false;
    try {
      loop.recordTerminalSideEffects(
        { state: "skipped", mission: "M-0001", message: "ok" },
        { tracker, projectRoot: root }
      );
    } catch (_) { threw = true; }
    assert.strictEqual(threw, false);
    assert.strictEqual(tracker.getCodexState("M-0001").last_verdict, "skipped");
  });

  test("no codex block at all: skipped is allowed (required defaults to false)", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001"); // no codex block
    const tracker = trackerFor(root);

    let threw = false;
    try {
      loop.recordTerminalSideEffects(
        { state: "skipped", mission: "M-0001", message: "ok" },
        { tracker, projectRoot: root }
      );
    } catch (_) { threw = true; }
    assert.strictEqual(threw, false);
  });
});

// ─── Per-iteration last_run_at bump ────────────────────────────────────────

group("bumpLastRunAt", () => {
  test("creates the codex block on first call if absent and sets last_run_at", () => {
    const root = makeProjectTree();
    seedMission(root, "doing", "M-0001");
    const tracker = trackerFor(root);
    assert.strictEqual(tracker.getCodexState("M-0001"), null);

    loop.bumpLastRunAt("M-0001", { tracker, projectRoot: root });

    const codex = tracker.getCodexState("M-0001");
    assert(codex !== null);
    assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(codex.last_run_at));
  });

  test("missionId null/undefined → no-op (does not throw)", () => {
    const root = makeProjectTree();
    loop.bumpLastRunAt(null, { projectRoot: root });
    loop.bumpLastRunAt(undefined, { projectRoot: root });
  });

  test("tracker failure → stderr warning, no throw", () => {
    const throwingTracker = {
      setCodexState() { throw new Error("simulated"); },
    };
    let threw = false;
    const stderr = captureStderr(() => {
      try { loop.bumpLastRunAt("M-0001", { tracker: throwingTracker }); }
      catch (_) { threw = true; }
    });
    assert.strictEqual(threw, false);
    assert(/codex last_run_at update skipped/.test(stderr));
  });
});

// ─── recordCodexState failure tolerance ────────────────────────────────────

group("recordCodexState — failure tolerance", () => {
  test("tracker.setCodexState throwing does NOT throw out of recordCodexState", () => {
    const throwingTracker = {
      setCodexState() { throw new Error("simulated"); },
      getCodexState() { return null; },
    };
    let threw = false;
    const stderr = captureStderr(() => {
      try {
        loop.recordCodexState(
          { state: "accepted", mission: "M-0001", iteration: 1, reviews: [] },
          { tracker: throwingTracker }
        );
      } catch (_) { threw = true; }
    });
    assert.strictEqual(threw, false);
    assert(/codex block update skipped/.test(stderr));
  });

  test("no missionId → no-op", () => {
    let setCalled = false;
    const tracker = {
      setCodexState() { setCalled = true; },
      getCodexState() { return null; },
    };
    loop.recordCodexState({ state: "accepted", mission: null }, { tracker });
    assert.strictEqual(setCalled, false);
  });
});

// ─── Cleanup + summary ─────────────────────────────────────────────────────

for (const c of cleanups) {
  try { c(); } catch (_) { /* ignore */ }
}

if (failed > 0) {
  process.stderr.write(`\n${failed} test(s) failed:\n`);
  for (const { name, err } of failures) {
    process.stderr.write(`\n  ✗ ${name}\n`);
    process.stderr.write(`    ${err.stack || err.message}\n`);
  }
  process.stderr.write(`\n${passed} passed, ${failed} failed\n`);
  process.exit(1);
}
process.stdout.write(`\n${passed} passed\n`);
