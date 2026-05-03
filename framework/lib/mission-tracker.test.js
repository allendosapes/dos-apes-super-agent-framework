"use strict";
//
// mission-tracker.test.js — exercises the MissionTracker class against
// temporary mission trees on disk. Some tests run inside an `git init`'d
// directory to cover the git-aware path of moveMissionState.
//
// Run:  node framework/lib/mission-tracker.test.js
//

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const { MissionTracker, STATES } = require("./mission-tracker.js");
const parser = require("./mission-parser.js");

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

// ─── Temp tree helpers ──────────────────────────────────────────────────────

function makeTempTree({ git = false } = {}) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mt-test-"));
  const root = path.join(repoRoot, ".planning", "missions");
  for (const s of STATES) {
    fs.mkdirSync(path.join(root, s), { recursive: true });
  }
  if (git) {
    execFileSync("git", ["init", "-q"], { cwd: repoRoot });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repoRoot });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: repoRoot });
    execFileSync("git", ["add", "-A"], { cwd: repoRoot });
    execFileSync("git", ["commit", "-q", "--allow-empty", "-m", "init"], { cwd: repoRoot });
  }
  cleanups.push(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  return { repoRoot, root };
}

function seedMission(root, state, id, extras = {}) {
  const title = extras.title || `Mission ${id}`;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
  const fm = {
    id,
    title,
    state,
    created: "2026-05-01",
    updated: "2026-05-01",
    ...extras,
  };
  const text = `---\n${parser.serializeFrontmatter(fm)}\n---\n\n## Workpad\n`;
  const file = path.join(root, state, `${id}-${slug}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
}

// ─── Identity ───────────────────────────────────────────────────────────────

group("Identity", () => {
  test("generateNextId returns M-0001 on an empty tree", () => {
    const { root } = makeTempTree();
    const t = new MissionTracker({ root });
    assert.strictEqual(t.generateNextId(), "M-0001");
  });

  test("generateNextId returns max+1 when missions already exist", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0003");
    seedMission(root, "doing", "M-0007");
    seedMission(root, "done", "M-0042");
    const t = new MissionTracker({ root });
    assert.strictEqual(t.generateNextId(), "M-0043");
  });

  test("isValidId correctly classifies IDs", () => {
    const t = new MissionTracker({ root: "/tmp/whatever" });
    assert.strictEqual(t.isValidId("M-0001"), true);
    assert.strictEqual(t.isValidId("M-9999"), true);
    assert.strictEqual(t.isValidId("M-1"), false);
    assert.strictEqual(t.isValidId("m-0001"), false);
    assert.strictEqual(t.isValidId(""), false);
    assert.strictEqual(t.isValidId(null), false);
    assert.strictEqual(t.isValidId(undefined), false);
  });

  test("findMissionById returns null for a nonexistent mission", () => {
    const { root } = makeTempTree();
    const t = new MissionTracker({ root });
    assert.strictEqual(t.findMissionById("M-9999"), null);
  });

  test("findMissionById finds a mission across all five state directories", () => {
    const { root } = makeTempTree();
    const t = new MissionTracker({ root });
    for (const state of STATES) {
      const id = `M-000${STATES.indexOf(state) + 1}`;
      seedMission(root, state, id);
      const found = t.findMissionById(id);
      assert.notStrictEqual(found, null, `expected to find ${id} in ${state}`);
      assert.strictEqual(found.state, state);
      assert.strictEqual(found.frontmatter.id, id);
      assert.strictEqual(found.frontmatter.state, state);
      assert(found.body.includes("## Workpad"));
    }
  });

  test("findMissionByIdInState scopes its lookup", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0001");
    const t = new MissionTracker({ root });
    assert.notStrictEqual(t.findMissionByIdInState("M-0001", "todo"), null);
    assert.strictEqual(t.findMissionByIdInState("M-0001", "done"), null);
  });
});

// ─── Listing ────────────────────────────────────────────────────────────────

group("Listing", () => {
  test("listMissionsByState returns id/title/frontmatter/path entries", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0001", { title: "First" });
    seedMission(root, "todo", "M-0002", { title: "Second" });
    const t = new MissionTracker({ root });
    const list = t.listMissionsByState("todo");
    assert.strictEqual(list.length, 2);
    const ids = list.map((m) => m.id).sort();
    assert.deepStrictEqual(ids, ["M-0001", "M-0002"]);
    for (const entry of list) {
      assert(typeof entry.title === "string" && entry.title.length > 0);
      assert(typeof entry.frontmatter === "object" && entry.frontmatter !== null);
      assert(entry.path.endsWith(".md"));
    }
  });

  test("listAllMissions returns one array per state", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0001");
    seedMission(root, "done", "M-0002");
    const t = new MissionTracker({ root });
    const all = t.listAllMissions();
    assert.deepStrictEqual(Object.keys(all).sort(), [...STATES].sort());
    assert.strictEqual(all.todo.length, 1);
    assert.strictEqual(all.done.length, 1);
    assert.strictEqual(all.review.length, 0);
  });
});

// ─── State transitions ─────────────────────────────────────────────────────

group("State transitions — canTransition", () => {
  test("accepts every legal transition", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0001");
    seedMission(root, "doing", "M-0002");
    seedMission(root, "review", "M-0003");
    seedMission(root, "review", "M-0004");
    seedMission(root, "todo", "M-0005");
    seedMission(root, "doing", "M-0006");
    seedMission(root, "review", "M-0007");
    const t = new MissionTracker({ root });

    const legal = [
      ["M-0001", "doing"],     // todo → doing
      ["M-0002", "review"],    // doing → review
      ["M-0003", "done"],      // review → done
      ["M-0004", "doing"],     // review → doing (rejection)
      ["M-0005", "canceled"],  // todo → canceled
      ["M-0006", "canceled"],  // doing → canceled
      ["M-0007", "canceled"],  // review → canceled
    ];
    for (const [id, target] of legal) {
      const r = t.canTransition(id, target);
      assert.strictEqual(r.allowed, true, `expected ${id} → ${target} allowed; got: ${r.reason}`);
    }
  });

  test("rejects every illegal transition", () => {
    const { root } = makeTempTree();
    seedMission(root, "done", "M-0001");
    seedMission(root, "todo", "M-0002");
    seedMission(root, "canceled", "M-0003");
    seedMission(root, "doing", "M-0004");
    const t = new MissionTracker({ root });

    const illegal = [
      ["M-0001", "doing"],   // done → doing
      ["M-0001", "todo"],    // done → todo
      ["M-0001", "canceled"],// done → canceled (terminal)
      ["M-0002", "done"],    // todo → done (skipping)
      ["M-0002", "review"],  // todo → review (skipping)
      ["M-0003", "todo"],    // canceled → anything
      ["M-0004", "todo"],    // doing → todo (no backward jump)
      ["M-0004", "done"],    // doing → done (skipping review)
    ];
    for (const [id, target] of illegal) {
      const r = t.canTransition(id, target);
      assert.strictEqual(r.allowed, false, `expected ${id} → ${target} rejected; got allowed`);
      assert(typeof r.reason === "string" && r.reason.length > 0, "reason should be non-empty");
    }
  });

  test("validateStateTransition throws on invalid edge", () => {
    const t = new MissionTracker({ root: "/tmp/whatever" });
    assert.throws(
      () => t.validateStateTransition("done", "doing"),
      /transition done → doing is not allowed/
    );
    assert.throws(
      () => t.validateStateTransition("wibble", "doing"),
      /invalid current state/
    );
  });
});

group("State transitions — moveMissionState", () => {
  test("moves the file AND updates frontmatter `state` atomically (non-git)", () => {
    const { root } = makeTempTree({ git: false });
    seedMission(root, "todo", "M-0001", { title: "Move me" });
    const t = new MissionTracker({ root });

    const newPath = t.moveMissionState("M-0001", "doing");
    assert(newPath.includes(path.join("doing", "M-0001-move-me.md")));
    assert.strictEqual(fs.existsSync(newPath), true);
    assert.strictEqual(
      fs.existsSync(path.join(root, "todo", "M-0001-move-me.md")),
      false
    );

    const m = t.findMissionById("M-0001");
    assert.strictEqual(m.state, "doing");
    assert.strictEqual(m.frontmatter.state, "doing");
    // updated should be today
    assert.strictEqual(m.frontmatter.updated, new Date().toISOString().slice(0, 10));
  });

  test("moves the file AND updates frontmatter `state` atomically (git)", () => {
    const { root, repoRoot } = makeTempTree({ git: true });
    seedMission(root, "todo", "M-0001", { title: "Git move" });
    execFileSync("git", ["add", "-A"], { cwd: repoRoot });
    execFileSync("git", ["commit", "-q", "-m", "seed"], { cwd: repoRoot });

    const t = new MissionTracker({ root });
    const newPath = t.moveMissionState("M-0001", "doing");
    assert(fs.existsSync(newPath));

    // git status should show the rename staged
    const status = execFileSync("git", ["status", "--porcelain"], {
      cwd: repoRoot, encoding: "utf8",
    });
    assert(/^R[ M]/m.test(status), `expected git to show staged rename; got:\n${status}`);

    const m = t.findMissionById("M-0001");
    assert.strictEqual(m.state, "doing");
    assert.strictEqual(m.frontmatter.state, "doing");
  });

  test("moves the companion per-mission directory when present", () => {
    const { root } = makeTempTree({ git: false });
    seedMission(root, "todo", "M-0001");
    fs.mkdirSync(path.join(root, "todo", "M-0001"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "todo", "M-0001", "verification.jsonl"),
      `{"level":"L0","outcome":"pass"}\n`
    );
    const t = new MissionTracker({ root });
    t.moveMissionState("M-0001", "doing");
    assert.strictEqual(fs.existsSync(path.join(root, "todo", "M-0001")), false);
    assert.strictEqual(
      fs.existsSync(path.join(root, "doing", "M-0001", "verification.jsonl")),
      true
    );
  });

  test("refuses to perform an illegal transition", () => {
    const { root } = makeTempTree();
    seedMission(root, "done", "M-0001");
    const t = new MissionTracker({ root });
    assert.throws(
      () => t.moveMissionState("M-0001", "doing"),
      /not allowed/
    );
  });
});

// ─── Mutations ─────────────────────────────────────────────────────────────

group("Mutations", () => {
  test("readMission throws when the mission is missing", () => {
    const { root } = makeTempTree();
    const t = new MissionTracker({ root });
    assert.throws(() => t.readMission("M-9999"), /not found/);
  });

  test("writeMission round-trips frontmatter and body", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0001");
    const t = new MissionTracker({ root });
    const m = t.readMission("M-0001");
    const newBody = m.body + "\nfreshly added line\n";
    t.writeMission("M-0001", { frontmatter: m.frontmatter, body: newBody });
    const reread = t.readMission("M-0001");
    assert(reread.body.includes("freshly added line"));
  });

  test("writeMission refuses to change `id`", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0001");
    const t = new MissionTracker({ root });
    const m = t.readMission("M-0001");
    assert.throws(
      () => t.writeMission("M-0001", { frontmatter: { ...m.frontmatter, id: "M-9999" }, body: m.body }),
      /immutable/
    );
  });

  test("updateFrontmatter merges, bumps `updated`, and persists", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0001", { priority: 3 });
    const t = new MissionTracker({ root });
    t.updateFrontmatter("M-0001", { priority: 1 });
    const m = t.readMission("M-0001");
    assert.strictEqual(m.frontmatter.priority, 1);
    assert.strictEqual(m.frontmatter.updated, new Date().toISOString().slice(0, 10));
  });

  test("updateFrontmatter rejects changes to `id`", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0001");
    const t = new MissionTracker({ root });
    assert.throws(
      () => t.updateFrontmatter("M-0001", { id: "M-9999" }),
      /cannot change `id`/
    );
  });

  test("updateFrontmatter refuses writes that fail schema validation", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0001");
    const t = new MissionTracker({ root });
    // Invalid state value — should be rejected at validation time.
    assert.throws(
      () => t.updateFrontmatter("M-0001", { state: "wibble" }),
      /invalid frontmatter|invalid state/
    );
  });

  test("appendWorkpadEntry preserves prior entries and appends a timestamped block", () => {
    const { root } = makeTempTree();
    const file = seedMission(root, "doing", "M-0001");
    // Seed the workpad with a prior entry.
    const initial = fs.readFileSync(file, "utf8");
    fs.writeFileSync(file, initial + "\n### 2025-01-01 09:00\nprior entry\n");

    const t = new MissionTracker({ root });
    t.appendWorkpadEntry("M-0001", "fresh note line");

    const after = fs.readFileSync(file, "utf8");
    assert(after.includes("### 2025-01-01 09:00"), "prior heading preserved");
    assert(after.includes("prior entry"), "prior entry text preserved");
    assert(after.includes("fresh note line"), "new note present");
    // New heading matches the YYYY-MM-DD HH:MM format.
    assert(/### \d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(after), "new timestamp heading present");
    // Prior entry comes before new entry.
    assert(after.indexOf("prior entry") < after.indexOf("fresh note line"));
  });
});

// ─── Dependencies ──────────────────────────────────────────────────────────

group("Dependencies", () => {
  test("getDependencies returns the depends_on array", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0003", { depends_on: ["M-0001", "M-0002"] });
    const t = new MissionTracker({ root });
    assert.deepStrictEqual(t.getDependencies("M-0003"), ["M-0001", "M-0002"]);
  });

  test("resolveUnmetDependencies returns deps not in done/", () => {
    const { root } = makeTempTree();
    seedMission(root, "done", "M-0001");
    seedMission(root, "todo", "M-0002");          // not in done — unmet
    seedMission(root, "todo", "M-0003", { depends_on: ["M-0001", "M-0002"] });
    const t = new MissionTracker({ root });
    assert.deepStrictEqual(t.resolveUnmetDependencies("M-0003"), ["M-0002"]);
  });

  test("resolveUnmetDependencies returns [] when all deps are done", () => {
    const { root } = makeTempTree();
    seedMission(root, "done", "M-0001");
    seedMission(root, "todo", "M-0002", { depends_on: ["M-0001"] });
    const t = new MissionTracker({ root });
    assert.deepStrictEqual(t.resolveUnmetDependencies("M-0002"), []);
  });

  test("detectCycles finds a simple A→B→A cycle", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0001", { depends_on: ["M-0002"] });
    seedMission(root, "todo", "M-0002", { depends_on: ["M-0001"] });
    const t = new MissionTracker({ root });
    const cycles = t.detectCycles("M-0001");
    assert.strictEqual(cycles.length, 1, `expected 1 cycle, got ${cycles.length}: ${JSON.stringify(cycles)}`);
    const cycle = cycles[0];
    assert(cycle.includes("M-0001"));
    assert(cycle.includes("M-0002"));
    assert.strictEqual(cycle[0], cycle[cycle.length - 1], "cycle should close on itself");
  });

  test("detectCycles returns [] when there is no cycle", () => {
    const { root } = makeTempTree();
    seedMission(root, "done", "M-0001");
    seedMission(root, "todo", "M-0002", { depends_on: ["M-0001"] });
    const t = new MissionTracker({ root });
    assert.deepStrictEqual(t.detectCycles("M-0002"), []);
  });
});

// ─── Active mission ────────────────────────────────────────────────────────

group("Active mission", () => {
  test("setActiveMission and getActiveMission round-trip", () => {
    const { root } = makeTempTree();
    seedMission(root, "doing", "M-0042");
    const t = new MissionTracker({ root });
    assert.strictEqual(t.getActiveMission(), null);
    t.setActiveMission("M-0042");
    assert.strictEqual(t.getActiveMission(), "M-0042");
    t.clearActiveMission();
    assert.strictEqual(t.getActiveMission(), null);
  });

  test("setActiveMission rejects an invalid ID", () => {
    const { root } = makeTempTree();
    const t = new MissionTracker({ root });
    assert.throws(() => t.setActiveMission("not-an-id"), /invalid mission ID/);
  });

  test("clearActiveMission is a no-op when no file exists", () => {
    const { root } = makeTempTree();
    const t = new MissionTracker({ root });
    t.clearActiveMission(); // should not throw
    assert.strictEqual(t.getActiveMission(), null);
  });
});

// ─── Verification log path ────────────────────────────────────────────────

group("Verification log", () => {
  test("getVerificationLogPath returns <root>/<state>/<id>/verification.jsonl", () => {
    const { root } = makeTempTree();
    seedMission(root, "doing", "M-0001");
    const t = new MissionTracker({ root });
    const expected = path.join(root, "doing", "M-0001", "verification.jsonl");
    assert.strictEqual(t.getVerificationLogPath("M-0001"), expected);
  });

  test("getVerificationLogPath throws for missing missions", () => {
    const { root } = makeTempTree();
    const t = new MissionTracker({ root });
    assert.throws(() => t.getVerificationLogPath("M-9999"), /not found/);
  });
});

// ─── Cleanup + summary ────────────────────────────────────────────────────

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
