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
const schema = require("./mission-schema.js");

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
    execFileSync("git", ["config", "user.email", "test@example.com"], {
      cwd: repoRoot,
    });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: repoRoot });
    execFileSync("git", ["add", "-A"], { cwd: repoRoot });
    execFileSync("git", ["commit", "-q", "--allow-empty", "-m", "init"], {
      cwd: repoRoot,
    });
  }
  cleanups.push(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  return { repoRoot, root };
}

function seedMission(root, state, id, extras = {}) {
  const title = extras.title || `Mission ${id}`;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60);
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
      assert(
        typeof entry.frontmatter === "object" && entry.frontmatter !== null,
      );
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
      ["M-0001", "doing"], // todo → doing
      ["M-0002", "review"], // doing → review
      ["M-0003", "done"], // review → done
      ["M-0004", "doing"], // review → doing (rejection)
      ["M-0005", "canceled"], // todo → canceled
      ["M-0006", "canceled"], // doing → canceled
      ["M-0007", "canceled"], // review → canceled
    ];
    for (const [id, target] of legal) {
      const r = t.canTransition(id, target);
      assert.strictEqual(
        r.allowed,
        true,
        `expected ${id} → ${target} allowed; got: ${r.reason}`,
      );
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
      ["M-0001", "doing"], // done → doing
      ["M-0001", "todo"], // done → todo
      ["M-0001", "canceled"], // done → canceled (terminal)
      ["M-0002", "done"], // todo → done (skipping)
      ["M-0002", "review"], // todo → review (skipping)
      ["M-0003", "todo"], // canceled → anything
      ["M-0004", "todo"], // doing → todo (no backward jump)
      ["M-0004", "done"], // doing → done (skipping review)
    ];
    for (const [id, target] of illegal) {
      const r = t.canTransition(id, target);
      assert.strictEqual(
        r.allowed,
        false,
        `expected ${id} → ${target} rejected; got allowed`,
      );
      assert(
        typeof r.reason === "string" && r.reason.length > 0,
        "reason should be non-empty",
      );
    }
  });

  test("validateStateTransition throws on invalid edge", () => {
    const t = new MissionTracker({ root: "/tmp/whatever" });
    assert.throws(
      () => t.validateStateTransition("done", "doing"),
      /transition done → doing is not allowed/,
    );
    assert.throws(
      () => t.validateStateTransition("wibble", "doing"),
      /invalid current state/,
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
      false,
    );

    const m = t.findMissionById("M-0001");
    assert.strictEqual(m.state, "doing");
    assert.strictEqual(m.frontmatter.state, "doing");
    // updated should be today
    assert.strictEqual(
      m.frontmatter.updated,
      new Date().toISOString().slice(0, 10),
    );
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
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert(
      /^R[ M]/m.test(status),
      `expected git to show staged rename; got:\n${status}`,
    );

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
      `{"level":"L0","outcome":"pass"}\n`,
    );
    const t = new MissionTracker({ root });
    t.moveMissionState("M-0001", "doing");
    assert.strictEqual(fs.existsSync(path.join(root, "todo", "M-0001")), false);
    assert.strictEqual(
      fs.existsSync(path.join(root, "doing", "M-0001", "verification.jsonl")),
      true,
    );
  });

  test("refuses to perform an illegal transition", () => {
    const { root } = makeTempTree();
    seedMission(root, "done", "M-0001");
    const t = new MissionTracker({ root });
    assert.throws(() => t.moveMissionState("M-0001", "doing"), /not allowed/);
  });
});

// ─── State transitions — AC-3 move hardening (M-0004) ──────────────────────
// The exact M-0003 closeout failure shape plus the ledger-folded
// non-atomicity fixture: tracked mission file, UNTRACKED companion
// directory, pre-created destination; validation failures move nothing;
// mid-move failures roll back to a reported, recoverable state.

group("State transitions — AC-3 move hardening (M-0004)", () => {
  test("M-0003 shape: tracked file + untracked companion + pre-created destination → succeeds, entries merged", () => {
    const { root, repoRoot } = makeTempTree({ git: true });
    const file = seedMission(root, "doing", "M-0001", { title: "Shape" });
    execFileSync("git", ["add", "-A"], { cwd: repoRoot });
    execFileSync("git", ["commit", "-q", "-m", "track mission file"], {
      cwd: repoRoot,
    });
    // untracked companion written mid-flight
    fs.mkdirSync(path.join(root, "doing", "M-0001"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "doing", "M-0001", "verification.jsonl"),
      `{"level":"L0","outcome":"pass"}\n`,
    );
    // destination pre-created by the evidence generator
    fs.mkdirSync(path.join(root, "review", "M-0001", "evidence"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, "review", "M-0001", "evidence", "summary.md"),
      "packet\n",
    );

    const t = new MissionTracker({ root });
    const newPath = t.moveMissionState("M-0001", "review");
    assert(fs.existsSync(newPath));
    assert.strictEqual(fs.existsSync(file), false);
    // merged: mid-flight log arrived, pre-existing evidence untouched
    assert.strictEqual(
      fs.existsSync(path.join(root, "review", "M-0001", "verification.jsonl")),
      true,
    );
    assert.strictEqual(
      fs.existsSync(
        path.join(root, "review", "M-0001", "evidence", "summary.md"),
      ),
      true,
    );
    assert.strictEqual(
      fs.existsSync(path.join(root, "doing", "M-0001")),
      false,
    );
    const m = t.findMissionById("M-0001");
    assert.strictEqual(m.state, "review");
    assert.strictEqual(m.frontmatter.state, "review");
  });

  test("untracked mission file in a git repo moves via the rename fallback", () => {
    const { root } = makeTempTree({ git: true }); // file never committed
    seedMission(root, "todo", "M-0001", { title: "Untracked" });
    const t = new MissionTracker({ root });
    const newPath = t.moveMissionState("M-0001", "doing");
    assert(fs.existsSync(newPath));
    assert.strictEqual(t.findMissionById("M-0001").state, "doing");
  });

  test("companion entry collision with pre-existing destination → throws, nothing moved", () => {
    const { root } = makeTempTree({ git: false });
    const file = seedMission(root, "doing", "M-0001", { title: "Collide" });
    fs.mkdirSync(path.join(root, "doing", "M-0001"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "doing", "M-0001", "verification.jsonl"),
      "src\n",
    );
    fs.mkdirSync(path.join(root, "review", "M-0001"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "review", "M-0001", "verification.jsonl"),
      "dest\n",
    );

    const t = new MissionTracker({ root });
    assert.throws(
      () => t.moveMissionState("M-0001", "review"),
      /collides .* nothing moved/s,
    );
    assert.strictEqual(fs.existsSync(file), true);
    assert.strictEqual(
      fs.readFileSync(
        path.join(root, "doing", "M-0001", "verification.jsonl"),
        "utf8",
      ),
      "src\n",
    );
    assert.strictEqual(
      fs.readFileSync(
        path.join(root, "review", "M-0001", "verification.jsonl"),
        "utf8",
      ),
      "dest\n",
    );
  });

  test("REQUIRED fixture (M-0004 ledger): frontmatter validation failure moves nothing — no stale-state stranding", () => {
    const { root } = makeTempTree({ git: false });
    // the M-0004 Task 0 shape: codex.required is a non-boolean on disk
    const file = path.join(root, "doing", "M-0001-bad-codex.md");
    const text =
      "---\nid: M-0001\ntitle: Bad codex\nstate: doing\ncreated: 2026-05-01\n" +
      "updated: 2026-05-01\ncodex:\n  required: nope\n---\n\n## Workpad\n";
    fs.writeFileSync(file, text);

    const t = new MissionTracker({ root });
    assert.throws(
      () => t.moveMissionState("M-0001", "review"),
      /refusing to write invalid frontmatter[\s\S]*nothing moved/,
    );
    // zero filesystem effects: still in doing/, content byte-identical
    assert.strictEqual(fs.existsSync(file), true);
    assert.strictEqual(fs.readFileSync(file, "utf8"), text);
    assert.strictEqual(
      fs.existsSync(path.join(root, "review", "M-0001-bad-codex.md")),
      false,
    );
  });

  test("mid-move failure rolls completed steps back and reports it", () => {
    const { root } = makeTempTree({ git: false });
    const file = seedMission(root, "doing", "M-0001", { title: "Midfail" });
    fs.mkdirSync(path.join(root, "doing", "M-0001"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "doing", "M-0001", "verification.jsonl"),
      "log\n",
    );
    // destination companion path exists as a FILE: the entry-merge rename
    // into it fails after the mission file has already moved
    fs.mkdirSync(path.join(root, "review"), { recursive: true });
    fs.writeFileSync(path.join(root, "review", "M-0001"), "not a directory\n");

    const t = new MissionTracker({ root });
    assert.throws(() => t.moveMissionState("M-0001", "review"), /rolled back/);
    // recoverable state: mission file and companion restored to doing/
    assert.strictEqual(fs.existsSync(file), true);
    assert.strictEqual(
      fs.readFileSync(
        path.join(root, "doing", "M-0001", "verification.jsonl"),
        "utf8",
      ),
      "log\n",
    );
    const m = t.findMissionById("M-0001");
    assert.strictEqual(m.state, "doing");
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
      () =>
        t.writeMission("M-0001", {
          frontmatter: { ...m.frontmatter, id: "M-9999" },
          body: m.body,
        }),
      /immutable/,
    );
  });

  test("updateFrontmatter merges, bumps `updated`, and persists", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0001", { priority: 3 });
    const t = new MissionTracker({ root });
    t.updateFrontmatter("M-0001", { priority: 1 });
    const m = t.readMission("M-0001");
    assert.strictEqual(m.frontmatter.priority, 1);
    assert.strictEqual(
      m.frontmatter.updated,
      new Date().toISOString().slice(0, 10),
    );
  });

  test("updateFrontmatter rejects changes to `id`", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0001");
    const t = new MissionTracker({ root });
    assert.throws(
      () => t.updateFrontmatter("M-0001", { id: "M-9999" }),
      /cannot change `id`/,
    );
  });

  test("updateFrontmatter refuses writes that fail schema validation", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0001");
    const t = new MissionTracker({ root });
    // Invalid state value — should be rejected at validation time.
    assert.throws(
      () => t.updateFrontmatter("M-0001", { state: "wibble" }),
      /invalid frontmatter|invalid state/,
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
    assert(
      /### \d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(after),
      "new timestamp heading present",
    );
    // Prior entry comes before new entry.
    assert(after.indexOf("prior entry") < after.indexOf("fresh note line"));
  });
});

// ─── Schema migration & Codex block ────────────────────────────────────────

group("Schema v2 migration", () => {
  test("readMission migrates a v1 mission to v2 in memory without touching disk", () => {
    const { root } = makeTempTree();
    const file = seedMission(root, "todo", "M-0001"); // no schema_version → v1
    const beforeMtime = fs.statSync(file).mtimeMs;
    const beforeText = fs.readFileSync(file, "utf8");
    assert(
      !/schema_version/.test(beforeText),
      "seed must be v1 (no schema_version)",
    );

    const t = new MissionTracker({ root });
    const m = t.readMission("M-0001");
    assert.strictEqual(
      m.frontmatter.schema_version,
      2,
      "in-memory frontmatter is v2",
    );

    const afterText = fs.readFileSync(file, "utf8");
    const afterMtime = fs.statSync(file).mtimeMs;
    assert.strictEqual(
      afterText,
      beforeText,
      "disk file must be unchanged after a pure read",
    );
    assert.strictEqual(
      afterMtime,
      beforeMtime,
      "mtime must not move on a pure read",
    );
  });

  test("v2 mission with a codex block round-trips intact", () => {
    const { root } = makeTempTree();
    seedMission(root, "doing", "M-0001", {
      schema_version: 2,
      codex: {
        required: true,
        max_rounds: 5,
        last_verdict: "accepted",
        unresolved_findings: 0,
        last_review_path:
          ".planning/missions/doing/M-0001/codex/round-1/review.json",
        last_run_at: "2026-05-03T10:00:00Z",
      },
    });
    const t = new MissionTracker({ root });
    const m = t.readMission("M-0001");
    assert.strictEqual(m.frontmatter.schema_version, 2);
    assert.deepStrictEqual(m.frontmatter.codex, {
      required: true,
      max_rounds: 5,
      last_verdict: "accepted",
      unresolved_findings: 0,
      last_review_path:
        ".planning/missions/doing/M-0001/codex/round-1/review.json",
      last_run_at: "2026-05-03T10:00:00Z",
    });
  });

  test("migrateFrontmatter on an already-v2 mission is a no-op (no field changes)", () => {
    const original = {
      id: "M-0001",
      schema_version: 2,
      title: "Already v2",
      state: "todo",
      created: "2026-05-01",
      updated: "2026-05-01",
    };
    const migrated = schema.migrateFrontmatter(original);
    assert.deepStrictEqual(
      migrated,
      original,
      "v2 input must produce identical output",
    );
    assert.notStrictEqual(
      migrated,
      original,
      "result is a fresh object (shallow clone)",
    );
  });

  test("migrateFrontmatter v1 → v2 adds schema_version and bumps `updated`, no codex block", () => {
    const original = {
      id: "M-0001",
      title: "Old mission",
      state: "todo",
      created: "2025-01-01",
      updated: "2025-01-01",
    };
    const migrated = schema.migrateFrontmatter(original);
    assert.strictEqual(migrated.schema_version, 2);
    assert.strictEqual(migrated.updated, new Date().toISOString().slice(0, 10));
    assert.strictEqual(
      migrated.codex,
      undefined,
      "migration must NOT add a codex block",
    );
  });
});

group("Codex state helpers", () => {
  test("getCodexState returns null when the block is absent", () => {
    const { root } = makeTempTree();
    seedMission(root, "doing", "M-0001", { schema_version: 2 });
    const t = new MissionTracker({ root });
    assert.strictEqual(t.getCodexState("M-0001"), null);
  });

  test("setCodexState creates the block on a mission that has none", () => {
    const { root } = makeTempTree();
    seedMission(root, "doing", "M-0001", { schema_version: 2 });
    const t = new MissionTracker({ root });
    t.setCodexState("M-0001", { required: true, max_rounds: 4 });
    const codex = t.getCodexState("M-0001");
    assert.deepStrictEqual(codex, { required: true, max_rounds: 4 });
  });

  test("setCodexState shallow-merges a partial update onto an existing block", () => {
    const { root } = makeTempTree();
    seedMission(root, "doing", "M-0001", {
      schema_version: 2,
      codex: {
        required: true,
        max_rounds: 3,
        last_verdict: "none",
        unresolved_findings: 0,
      },
    });
    const t = new MissionTracker({ root });
    t.setCodexState("M-0001", {
      last_verdict: "findings-reported",
      unresolved_findings: 2,
    });
    const codex = t.getCodexState("M-0001");
    assert.deepStrictEqual(codex, {
      required: true,
      max_rounds: 3,
      last_verdict: "findings-reported",
      unresolved_findings: 2,
    });
  });

  test("clearCodexState removes the block; subsequent reads have no codex field", () => {
    const { root } = makeTempTree();
    seedMission(root, "doing", "M-0001", {
      schema_version: 2,
      codex: { required: true, last_verdict: "accepted" },
    });
    const t = new MissionTracker({ root });
    t.clearCodexState("M-0001");
    const m = t.readMission("M-0001");
    assert.strictEqual(m.frontmatter.codex, undefined);
    assert.strictEqual(t.getCodexState("M-0001"), null);
    // And the on-disk text must not mention the block any more.
    const text = fs.readFileSync(m.path, "utf8");
    assert(
      !/^\s*codex\s*:/m.test(text),
      "disk file should not contain a codex key",
    );
  });

  test("setCodexState with an invalid value is rejected by the validation gate", () => {
    const { root } = makeTempTree();
    seedMission(root, "doing", "M-0001", { schema_version: 2 });
    const t = new MissionTracker({ root });
    assert.throws(
      () => t.setCodexState("M-0001", { last_verdict: "bogus" }),
      /invalid codex.last_verdict/,
    );
    assert.throws(
      () => t.setCodexState("M-0001", { unresolved_findings: -1 }),
      /codex\.unresolved_findings/,
    );
  });
});

group("validateFrontmatter — codex block", () => {
  const baseFm = () => ({
    id: "M-0001",
    schema_version: 2,
    title: "Test",
    state: "todo",
    created: "2026-05-01",
    updated: "2026-05-01",
  });

  test("a mission with no codex block validates cleanly", () => {
    const r = schema.validateFrontmatter(baseFm());
    assert.strictEqual(
      r.valid,
      true,
      `expected valid; got: ${r.errors.join(", ")}`,
    );
  });

  test("rejects invalid last_verdict enum value", () => {
    const fm = baseFm();
    fm.codex = { last_verdict: "totally-made-up" };
    const r = schema.validateFrontmatter(fm);
    assert.strictEqual(r.valid, false);
    assert(
      r.errors.some((e) => /invalid codex\.last_verdict/.test(e)),
      `expected last_verdict error; got: ${r.errors.join(", ")}`,
    );
  });

  test("rejects negative unresolved_findings", () => {
    const fm = baseFm();
    fm.codex = { unresolved_findings: -3 };
    const r = schema.validateFrontmatter(fm);
    assert.strictEqual(r.valid, false);
    assert(
      r.errors.some((e) => /unresolved_findings/.test(e)),
      `expected unresolved_findings error; got: ${r.errors.join(", ")}`,
    );
  });

  test("rejects non-boolean `required`", () => {
    const fm = baseFm();
    fm.codex = { required: "yes" };
    const r = schema.validateFrontmatter(fm);
    assert.strictEqual(r.valid, false);
    assert(
      r.errors.some((e) => /codex\.required/.test(e)),
      `expected codex.required error; got: ${r.errors.join(", ")}`,
    );
  });

  test("accepts every valid CODEX_VERDICTS value", () => {
    for (const v of schema.CODEX_VERDICTS) {
      const fm = baseFm();
      fm.codex = { last_verdict: v };
      const r = schema.validateFrontmatter(fm);
      assert.strictEqual(
        r.valid,
        true,
        `${v} should be valid; got: ${r.errors.join(", ")}`,
      );
    }
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
    seedMission(root, "todo", "M-0002"); // not in done — unmet
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
    assert.strictEqual(
      cycles.length,
      1,
      `expected 1 cycle, got ${cycles.length}: ${JSON.stringify(cycles)}`,
    );
    const cycle = cycles[0];
    assert(cycle.includes("M-0001"));
    assert(cycle.includes("M-0002"));
    assert.strictEqual(
      cycle[0],
      cycle[cycle.length - 1],
      "cycle should close on itself",
    );
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

// ─── Authoring (createMission) ──────────────────────────────────────────────

group("Authoring", () => {
  test("createMission writes to todo/ with valid frontmatter", () => {
    const { root } = makeTempTree();
    const t = new MissionTracker({ root });
    const r = t.createMission({ title: "Add POST /todos endpoint" });
    assert.strictEqual(r.id, "M-0001");
    assert(
      r.file.includes(path.join("todo", "M-0001-add-post-todos-endpoint.md")),
    );
    assert(fs.existsSync(r.file));
    const m = t.readMission("M-0001");
    assert.strictEqual(m.frontmatter.id, "M-0001");
    assert.strictEqual(m.frontmatter.state, "todo");
    assert.strictEqual(m.frontmatter.title, "Add POST /todos endpoint");
    assert.deepStrictEqual(m.frontmatter.workspace, {
      branch: "feat/m-0001-add-post-todos-endpoint",
      worktree: ".worktrees/M-0001",
    });
    assert(m.body.includes("## Context"));
    assert(m.body.includes("## Workpad"));
  });

  test("createMission accepts priority/phase/dependsOn/labels", () => {
    const { root } = makeTempTree();
    seedMission(root, "done", "M-0001"); // for dep validation
    const t = new MissionTracker({ root });
    const r = t.createMission({
      title: "Build feature X",
      priority: 1,
      phase: "phase-2-core",
      dependsOn: ["M-0001"],
      labels: ["backend", "urgent"],
    });
    const m = t.readMission(r.id);
    assert.strictEqual(m.frontmatter.priority, 1);
    assert.strictEqual(m.frontmatter.phase, "phase-2-core");
    assert.deepStrictEqual(m.frontmatter.depends_on, ["M-0001"]);
    assert.deepStrictEqual(m.frontmatter.labels, ["backend", "urgent"]);
  });

  test("createMission allocates next ID across all states", () => {
    const { root } = makeTempTree();
    seedMission(root, "todo", "M-0003");
    seedMission(root, "done", "M-0007");
    const t = new MissionTracker({ root });
    const r = t.createMission({ title: "Next" });
    assert.strictEqual(r.id, "M-0008");
  });

  test("createMission rejects empty title", () => {
    const { root } = makeTempTree();
    const t = new MissionTracker({ root });
    assert.throws(() => t.createMission({ title: "" }), /title is required/);
    assert.throws(() => t.createMission({}), /title is required/);
  });

  test("createMission rejects invalid priority and dependency IDs", () => {
    const { root } = makeTempTree();
    const t = new MissionTracker({ root });
    assert.throws(
      () => t.createMission({ title: "x", priority: 6 }),
      /priority must be an integer 1–5/,
    );
    assert.throws(
      () => t.createMission({ title: "x", dependsOn: ["not-an-id"] }),
      /invalid dependency id/,
    );
  });
});

// ─── M-0007: codex.required completion gate + human adjudication ────────────
//
// Regression cover for the defect found by dogfooding in Coding Troop: the
// `review → done` rule in missions.md was documented and unenforced, and even
// once enforced there was no legitimate exit when the review budget was spent
// with only low/medium findings left. Every workaround was falsification.

group("codex.required completion gate (M-0007)", () => {
  const VALID_ADJ = {
    actor: "allen",
    at: "2026-08-24T04:00:00Z",
    adjudicated_verdict: "partial-success",
    no_critical_or_high_remaining: true,
    remaining_findings: 4,
    remaining_low: 3,
    remaining_medium: 1,
    accepted_obligations: [
      "per-runtime execution-surface inventories before qualification",
      "network-side observation before a provider may claim network denial",
    ],
    rationale_ref:
      ".planning/missions/review/M-0001/adversarial-review-findings.md",
  };

  test("required:true + non-accepted verdict + no adjudication → done is REFUSED", () => {
    const { root } = makeTempTree();
    seedMission(root, "review", "M-0001", {
      codex: {
        required: true,
        last_verdict: "partial-success",
        unresolved_findings: 4,
        last_run_at: "2026-08-24T03:40:00Z",
        last_review_path: "findings.md",
      },
    });
    const t = new MissionTracker({ root });
    const r = t.canTransition("M-0001", "done");
    assert.strictEqual(r.allowed, false);
    assert.match(r.reason, /partial-success/);
    // The refusal must name both legitimate remedies, not just say "no".
    assert.match(r.reason, /accepted review/i);
    assert.match(r.reason, /human adjudication/i);
    // And must warn against the falsification path.
    assert.match(r.reason, /Do not rewrite last_verdict/i);
  });

  test("required:true + accepted verdict → done is allowed", () => {
    const { root } = makeTempTree();
    seedMission(root, "review", "M-0001", {
      codex: {
        required: true,
        last_verdict: "accepted",
        unresolved_findings: 0,
      },
    });
    const t = new MissionTracker({ root });
    assert.strictEqual(t.canTransition("M-0001", "done").allowed, true);
  });

  test("required:false is not gated at all", () => {
    const { root } = makeTempTree();
    seedMission(root, "review", "M-0001", {
      codex: {
        required: false,
        last_verdict: "exhausted",
        unresolved_findings: 9,
      },
    });
    const t = new MissionTracker({ root });
    assert.strictEqual(t.canTransition("M-0001", "done").allowed, true);
  });

  test("no codex block at all is not gated", () => {
    const { root } = makeTempTree();
    seedMission(root, "review", "M-0001", {});
    const t = new MissionTracker({ root });
    assert.strictEqual(t.canTransition("M-0001", "done").allowed, true);
  });

  test("the gate applies ONLY to done, not to review or canceled", () => {
    const { root } = makeTempTree();
    seedMission(root, "doing", "M-0001", {
      codex: { required: true, last_verdict: "partial-success", unresolved_findings: 4, last_run_at: "2026-08-24T03:40:00Z", last_review_path: "findings.md" },
    });
    const t = new MissionTracker({ root });
    assert.strictEqual(t.canTransition("M-0001", "review").allowed, true);
    assert.strictEqual(t.canTransition("M-0001", "canceled").allowed, true);
  });

  test("valid adjudication unblocks done", () => {
    const { root } = makeTempTree();
    seedMission(root, "review", "M-0001", {
      codex: {
        required: true,
        last_verdict: "partial-success",
        unresolved_findings: 4,
        last_run_at: "2026-08-24T03:40:00Z",
        last_review_path: "findings.md",
      },
      human_adjudication: VALID_ADJ,
    });
    const t = new MissionTracker({ root });
    const r = t.canTransition("M-0001", "done");
    assert.strictEqual(r.allowed, true, r.reason);
  });

  test("adjudication does NOT rewrite the reviewer verdict", () => {
    const { root } = makeTempTree();
    seedMission(root, "review", "M-0001", {
      codex: {
        required: true,
        last_verdict: "partial-success",
        unresolved_findings: 4,
        last_run_at: "2026-08-24T03:40:00Z",
        last_review_path: "findings.md",
      },
    });
    const t = new MissionTracker({ root });
    t.setHumanAdjudication("M-0001", VALID_ADJ);
    const codex = t.getCodexState("M-0001");
    // The whole point: the human's disposition sits alongside the reviewer's
    // conclusion, and the reviewer's conclusion is untouched.
    assert.strictEqual(codex.last_verdict, "partial-success");
    assert.strictEqual(codex.unresolved_findings, 4);
    assert.strictEqual(
      t.readMission("M-0001").frontmatter.human_adjudication.actor,
      "allen",
    );
    assert.strictEqual(t.canTransition("M-0001", "done").allowed, true);
  });

  test("an invalid adjudication does not unblock done", () => {
    const { root } = makeTempTree();
    seedMission(root, "review", "M-0001", {
      codex: { required: true, last_verdict: "partial-success", unresolved_findings: 4, last_run_at: "2026-08-24T03:40:00Z", last_review_path: "findings.md" },
      // asserts the one thing adjudication may never assert
      human_adjudication: {
        ...VALID_ADJ,
        no_critical_or_high_remaining: false,
      },
    });
    const t = new MissionTracker({ root });
    const r = t.canTransition("M-0001", "done");
    assert.strictEqual(r.allowed, false);
    assert.match(r.reason, /invalid/i);
  });

  test("setHumanAdjudication refuses to write reviewer-reported fields", () => {
    const { root } = makeTempTree();
    seedMission(root, "review", "M-0001", {
      codex: { required: true, last_verdict: "partial-success", unresolved_findings: 4, last_run_at: "2026-08-24T03:40:00Z", last_review_path: "findings.md" },
    });
    const t = new MissionTracker({ root });
    assert.throws(
      () =>
        t.setHumanAdjudication("M-0001", {
          ...VALID_ADJ,
          last_verdict: "accepted",
        }),
      /refusing to write reviewer-reported field/i,
    );
    assert.strictEqual(
      t.getCodexState("M-0001").last_verdict,
      "partial-success",
    );
  });

  test("setHumanAdjudication refuses a verdict mismatch", () => {
    const { root } = makeTempTree();
    seedMission(root, "review", "M-0001", {
      codex: { required: true, last_verdict: "partial-success", unresolved_findings: 4, last_run_at: "2026-08-24T03:40:00Z", last_review_path: "findings.md" },
    });
    const t = new MissionTracker({ root });
    assert.throws(
      () =>
        t.setHumanAdjudication("M-0001", {
          ...VALID_ADJ,
          adjudicated_verdict: "exhausted",
        }),
      /does not match/i,
    );
  });

  test("setHumanAdjudication refuses when the review never ran", () => {
    const { root } = makeTempTree();
    seedMission(root, "review", "M-0001", { codex: { required: true } });
    const t = new MissionTracker({ root });
    assert.throws(
      () => t.setHumanAdjudication("M-0001", VALID_ADJ),
      /no reviewer verdict yet/i,
    );
  });

  test("setHumanAdjudication refuses when the review was already accepted", () => {
    const { root } = makeTempTree();
    seedMission(root, "review", "M-0001", {
      codex: { required: true, last_verdict: "accepted" },
    });
    const t = new MissionTracker({ root });
    assert.throws(
      () =>
        t.setHumanAdjudication("M-0001", {
          ...VALID_ADJ,
          adjudicated_verdict: "accepted",
        }),
      /already has an accepted review/i,
    );
  });

  test("moveMissionState is gated too — the CLI cannot diverge from canTransition", () => {
    const { root } = makeTempTree();
    seedMission(root, "review", "M-0001", {
      codex: { required: true, last_verdict: "partial-success", unresolved_findings: 4, last_run_at: "2026-08-24T03:40:00Z", last_review_path: "findings.md" },
    });
    const t = new MissionTracker({ root });
    assert.throws(() => t.moveMissionState("M-0001", "done"), /not "accepted"/);
    // still in review, not silently moved
    assert.strictEqual(t.findMissionById("M-0001").state, "review");
  });

  test("adjudication is schema-valid on disk and round-trips", () => {
    const { root } = makeTempTree();
    seedMission(root, "review", "M-0001", {
      codex: { required: true, last_verdict: "partial-success", unresolved_findings: 4, last_run_at: "2026-08-24T03:40:00Z", last_review_path: "findings.md" },
    });
// ── Stale-adjudication invariants ────────────────────────────────────────
//
// The hardening pass. Before it, a schema-valid adjudication written against
// `partial-success` stayed valid after the review was re-run and returned
// something worse, and would keep authorizing completion. These invariants are
// enforced in the SCHEMA, so editing the file by hand cannot bypass them —
// the governed setter is a convenience, not the enforcement boundary.

const COMPLETED_REVIEW = {
  required: true,
  last_verdict: "partial-success",
  unresolved_findings: 4,
  last_run_at: "2026-08-24T03:40:00Z",
  last_review_path: "findings.md",
};

test("STALE: verdict changed under the adjudication → done is refused", () => {
  const { root } = makeTempTree();
  seedMission(root, "review", "M-0001", {
    // the review was re-run and came back worse
    codex: { ...COMPLETED_REVIEW, last_verdict: "exhausted" },
    human_adjudication: VALID_ADJ, // still says partial-success
  });
  const t = new MissionTracker({ root });
  const r = t.canTransition("M-0001", "done");
  assert.strictEqual(r.allowed, false);
  assert.match(r.reason, /stale/i);
  assert.match(r.reason, /never edit the verdict to match it/i);
});

test("STALE: finding count changed under the adjudication → done is refused", () => {
  const { root } = makeTempTree();
  seedMission(root, "review", "M-0001", {
    codex: { ...COMPLETED_REVIEW, unresolved_findings: 7 },
    human_adjudication: VALID_ADJ, // accepts 4
  });
  const t = new MissionTracker({ root });
  const r = t.canTransition("M-0001", "done");
  assert.strictEqual(r.allowed, false);
  assert.match(r.reason, /stale/i);
});

test("only partial-success is adjudicable — schema refuses the rest", () => {
  for (const verdict of [
    "exhausted",
    "no-progress",
    "skipped",
    "findings-reported",
  ]) {
    const { root } = makeTempTree();
    seedMission(root, "review", "M-0001", {
      codex: { ...COMPLETED_REVIEW, last_verdict: verdict },
      human_adjudication: { ...VALID_ADJ, adjudicated_verdict: verdict },
    });
    const t = new MissionTracker({ root });
    const r = t.canTransition("M-0001", "done");
    assert.strictEqual(
      r.allowed,
      false,
      `${verdict} should not be adjudicable`,
    );
    assert.match(r.reason, /must be "partial-success"/);
  }
});

test("setHumanAdjudication refuses a non-partial-success verdict", () => {
  const { root } = makeTempTree();
  seedMission(root, "review", "M-0001", {
    codex: { ...COMPLETED_REVIEW, last_verdict: "exhausted" },
  });
  const t = new MissionTracker({ root });
  assert.throws(
    () =>
      t.setHumanAdjudication("M-0001", {
        ...VALID_ADJ,
        adjudicated_verdict: "exhausted",
      }),
    /only "partial-success" is adjudicable/,
  );
});

test("adjudication requires evidence that a review actually ran", () => {
  for (const missing of ["last_run_at", "last_review_path"]) {
    const codex = { ...COMPLETED_REVIEW };
    delete codex[missing];
    const { root } = makeTempTree();
    seedMission(root, "review", "M-0001", {
      codex,
      human_adjudication: VALID_ADJ,
    });
    const t = new MissionTracker({ root });
    const r = t.canTransition("M-0001", "done");
    assert.strictEqual(r.allowed, false, `missing ${missing} should refuse`);
    assert.match(r.reason, new RegExp(missing));
  }
});

test("severity distribution must account for every remaining finding", () => {
  const { root } = makeTempTree();
  seedMission(root, "review", "M-0001", {
    codex: COMPLETED_REVIEW, // 4 remaining
    // 2 + 1 = 3, not 4 — the missing one could be a critical
    human_adjudication: { ...VALID_ADJ, remaining_low: 2, remaining_medium: 1 },
  });
  const t = new MissionTracker({ root });
  const r = t.canTransition("M-0001", "done");
  assert.strictEqual(r.allowed, false);
  assert.match(r.reason, /does not account for every remaining finding/);
});

test("severity distribution is required, not optional", () => {
  const adj = { ...VALID_ADJ };
  delete adj.remaining_low;
  const { root } = makeTempTree();
  seedMission(root, "review", "M-0001", {
    codex: COMPLETED_REVIEW,
    human_adjudication: adj,
  });
  const t = new MissionTracker({ root });
  assert.strictEqual(t.canTransition("M-0001", "done").allowed, false);
});

test("setHumanAdjudication refuses a total that contradicts the reviewer", () => {
  const { root } = makeTempTree();
  seedMission(root, "review", "M-0001", { codex: COMPLETED_REVIEW });
  const t = new MissionTracker({ root });
  assert.throws(
    () =>
      t.setHumanAdjudication("M-0001", {
        ...VALID_ADJ,
        remaining_findings: 99,
      }),
    /contradicts codex.unresolved_findings/,
  );
});

test("setHumanAdjudication requires the severity distribution", () => {
  const adj = { ...VALID_ADJ };
  delete adj.remaining_medium;
  const { root } = makeTempTree();
  seedMission(root, "review", "M-0001", { codex: COMPLETED_REVIEW });
  const t = new MissionTracker({ root });
  assert.throws(
    () => t.setHumanAdjudication("M-0001", adj),
    /remaining_medium must be a non-negative integer/,
  );
});

test("a hand-written adjudication cannot bypass the setter's guards", () => {
  // The enforcement lives in the schema, so writing the file directly is not a
  // way around it. This is the invariant that makes the setter a convenience
  // rather than the boundary.
  const { root } = makeTempTree();
  seedMission(root, "review", "M-0001", {
    codex: { ...COMPLETED_REVIEW, last_verdict: "no-progress" },
    human_adjudication: { ...VALID_ADJ, adjudicated_verdict: "no-progress" },
  });
  const t = new MissionTracker({ root });
  assert.strictEqual(t.canTransition("M-0001", "done").allowed, false);
});
    const t = new MissionTracker({ root });
    t.setHumanAdjudication("M-0001", VALID_ADJ);
    const m = t.readMission("M-0001");
    assert.strictEqual(schema.validateFrontmatter(m.frontmatter).valid, true);
    assert.deepStrictEqual(
      m.frontmatter.human_adjudication.accepted_obligations,
      VALID_ADJ.accepted_obligations,
    );
  });
});

// ─── Cleanup + summary ────────────────────────────────────────────────────

for (const c of cleanups) {
  try {
    c();
  } catch (_) {
    /* ignore */
  }
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
