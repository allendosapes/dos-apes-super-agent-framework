"use strict";
//
// mission-parser.test.js — tests for the mission frontmatter / body parser.
// Hand-rolled runner so we don't pull in a test framework (CLI must remain
// zero-dep — and the rest of the framework follows suit).
//
// Run:  node framework/lib/mission-parser.test.js
//

const assert = require("assert");
const {
  parseFrontmatter,
  serializeFrontmatter,
  extractBodySection,
  appendBodySection,
} = require("./mission-parser.js");

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

// ─── parseFrontmatter ───────────────────────────────────────────────────────

group("parseFrontmatter", () => {
  test("parses a typical mission file", () => {
    const text = [
      "---",
      "id: M-0001",
      "title: Add POST /todos endpoint",
      "state: todo",
      "priority: 3",
      "created: 2026-05-01",
      "updated: 2026-05-01",
      "phase: phase-1-foundation",
      "depends_on:",
      "  - M-0000",
      "labels:",
      "  - backend",
      "  - api",
      "verification:",
      "  required_levels:",
      "    - L0",
      "    - L1",
      "  optional_levels:",
      "    - L3",
      "workspace:",
      "  branch: feat/m-0001-todos",
      "  worktree: .worktrees/M-0001",
      "max_iterations: 50",
      "---",
      "",
      "## Context",
      "",
      "Body content.",
    ].join("\n");
    const { frontmatter, body } = parseFrontmatter(text);
    assert.strictEqual(frontmatter.id, "M-0001");
    assert.strictEqual(frontmatter.title, "Add POST /todos endpoint");
    assert.strictEqual(frontmatter.priority, 3);
    assert.strictEqual(frontmatter.created, "2026-05-01");
    assert.deepStrictEqual(frontmatter.depends_on, ["M-0000"]);
    assert.deepStrictEqual(frontmatter.labels, ["backend", "api"]);
    assert.deepStrictEqual(frontmatter.verification, {
      required_levels: ["L0", "L1"],
      optional_levels: ["L3"],
    });
    assert.deepStrictEqual(frontmatter.workspace, {
      branch: "feat/m-0001-todos",
      worktree: ".worktrees/M-0001",
    });
    assert.strictEqual(frontmatter.max_iterations, 50);
    assert(body.startsWith("## Context"), `expected body to start with "## Context", got: ${JSON.stringify(body.slice(0, 40))}`);
  });

  test("strips full-line YAML comments", () => {
    const text = [
      "---",
      "# Comment about id",
      "id: M-0007",
      "title: Foo",
      "  # indented comment also skipped",
      "state: todo",
      "created: 2026-05-01",
      "updated: 2026-05-01",
      "---",
      "",
    ].join("\n");
    const { frontmatter } = parseFrontmatter(text);
    assert.strictEqual(frontmatter.id, "M-0007");
    assert.strictEqual(frontmatter.title, "Foo");
  });

  test("returns {frontmatter: {}} when text has no frontmatter", () => {
    const text = "Just a body. No leading dashes.";
    const { frontmatter, body } = parseFrontmatter(text);
    assert.deepStrictEqual(frontmatter, {});
    assert.strictEqual(body, text);
  });

  test("returns {frontmatter: {}} when frontmatter is unterminated", () => {
    const text = "---\nid: M-0001\nno terminator follows";
    const { frontmatter, body } = parseFrontmatter(text);
    assert.deepStrictEqual(frontmatter, {});
    assert.strictEqual(body, text);
  });

  test("handles empty body", () => {
    const text = "---\nid: M-0001\ntitle: Foo\nstate: todo\ncreated: 2026-05-01\nupdated: 2026-05-01\n---\n";
    const { frontmatter, body } = parseFrontmatter(text);
    assert.strictEqual(frontmatter.id, "M-0001");
    assert.strictEqual(body, "");
  });

  test("parses double-quoted strings with escapes", () => {
    const text = [
      "---",
      'id: M-0001',
      'title: "Has \\"quotes\\" and \\n newline"',
      "state: todo",
      "created: 2026-05-01",
      "updated: 2026-05-01",
      "---",
    ].join("\n");
    const { frontmatter } = parseFrontmatter(text);
    assert.strictEqual(frontmatter.title, 'Has "quotes" and \n newline');
  });

  test("parses single-quoted strings with doubled quote escape", () => {
    const text = [
      "---",
      "id: M-0001",
      "title: 'It''s mine'",
      "state: todo",
      "created: 2026-05-01",
      "updated: 2026-05-01",
      "---",
    ].join("\n");
    const { frontmatter } = parseFrontmatter(text);
    assert.strictEqual(frontmatter.title, "It's mine");
  });

  test("parses booleans, null, and integers correctly", () => {
    const text = [
      "---",
      "flag_true: true",
      "flag_false: false",
      "missing: null",
      "tilde: ~",
      "count: 42",
      "negative: -7",
      "---",
    ].join("\n");
    const { frontmatter } = parseFrontmatter(text);
    assert.strictEqual(frontmatter.flag_true, true);
    assert.strictEqual(frontmatter.flag_false, false);
    assert.strictEqual(frontmatter.missing, null);
    assert.strictEqual(frontmatter.tilde, null);
    assert.strictEqual(frontmatter.count, 42);
    assert.strictEqual(frontmatter.negative, -7);
  });

  test("supports empty list `[]` and empty object `{}` as the only flow style", () => {
    const text = [
      "---",
      "id: M-0001",
      "title: Foo",
      "state: todo",
      "created: 2026-05-01",
      "updated: 2026-05-01",
      "depends_on: []",
      "extras: {}",
      "---",
    ].join("\n");
    const { frontmatter } = parseFrontmatter(text);
    assert.deepStrictEqual(frontmatter.depends_on, []);
    assert.deepStrictEqual(frontmatter.extras, {});
  });

  test("parses the canonical mission template", () => {
    const path = require("path");
    const fs = require("fs");
    const templatePath = path.join(__dirname, "..", "templates", "mission-template.md");
    if (!fs.existsSync(templatePath)) return; // skip if template missing
    const text = fs.readFileSync(templatePath, "utf8");
    const { frontmatter } = parseFrontmatter(text);
    assert.strictEqual(frontmatter.id, "M-0001");
    assert.strictEqual(frontmatter.state, "todo");
    assert(Array.isArray(frontmatter.depends_on));
    assert(Array.isArray(frontmatter.verification.required_levels));
  });
});

// ─── Rejection of unsupported YAML ──────────────────────────────────────────

group("rejection of unsupported YAML", () => {
  const cases = [
    {
      name: "rejects YAML anchor",
      text: "---\nid: M-0001\nfoo: &anchor value\n---\n",
      featureFragment: "anchor",
    },
    {
      name: "rejects YAML reference",
      text: "---\nid: M-0001\nfoo: *anchor\n---\n",
      featureFragment: "reference",
    },
    {
      name: "rejects literal block scalar (`|`)",
      text: "---\nid: M-0001\ndesc: |\n  multi\n  line\n---\n",
      featureFragment: "literal block scalar",
    },
    {
      name: "rejects folded block scalar (`>`)",
      text: "---\nid: M-0001\ndesc: >\n  multi\n  line\n---\n",
      featureFragment: "folded block scalar",
    },
    {
      name: "rejects flow-style sequence",
      text: "---\nid: M-0001\nlabels: [a, b]\n---\n",
      featureFragment: "flow-style sequence",
    },
    {
      name: "rejects flow-style mapping",
      text: "---\nid: M-0001\nws: {a: b}\n---\n",
      featureFragment: "flow-style mapping",
    },
    {
      name: "rejects YAML tag",
      text: "---\nid: M-0001\nfoo: !!str bar\n---\n",
      featureFragment: "tag",
    },
    {
      name: "rejects list item with anchor",
      text: "---\nid: M-0001\nlist:\n  - &x foo\n---\n",
      featureFragment: "anchor",
    },
  ];
  for (const c of cases) {
    test(c.name, () => {
      let threw = null;
      try { parseFrontmatter(c.text); } catch (err) { threw = err; }
      assert(threw !== null, `expected ${c.name} to throw, but it didn't`);
      assert(/^mission-parser: unsupported YAML feature/.test(threw.message),
        `error should start with "mission-parser: unsupported YAML feature"; got: ${threw.message}`);
      assert(threw.message.toLowerCase().includes(c.featureFragment.toLowerCase()),
        `error should mention "${c.featureFragment}"; got: ${threw.message}`);
    });
  }
});

// ─── serializeFrontmatter round-trip ────────────────────────────────────────

group("serializeFrontmatter round-trip", () => {
  function roundTrip(fm) {
    const text = serializeFrontmatter(fm);
    const wrapped = `---\n${text}\n---\n\nbody\n`;
    return parseFrontmatter(wrapped).frontmatter;
  }

  test("round-trips a fully-populated mission frontmatter", () => {
    const fm = {
      id: "M-0042",
      title: "Fix race condition in session refresh",
      state: "doing",
      priority: 1,
      created: "2026-05-01",
      updated: "2026-05-02",
      phase: "phase-1-foundation",
      depends_on: ["M-0001", "M-0007"],
      labels: ["backend", "urgent"],
      acceptance: [
        "Session refresh no longer races",
        'Test "refresh under concurrent load" passes',
      ],
      verification: {
        required_levels: ["L0", "L1", "L2", "L2.5"],
        optional_levels: ["L5"],
      },
      workspace: {
        branch: "feat/m-0042-fix-session-refresh-race",
        worktree: ".worktrees/M-0042",
      },
      max_iterations: 50,
    };
    assert.deepStrictEqual(roundTrip(fm), fm);
  });

  test("preserves field insertion order", () => {
    const fm = { c: 1, a: 2, b: 3 };
    const text = serializeFrontmatter(fm);
    const lines = text.split("\n");
    assert.strictEqual(lines[0], "c: 1");
    assert.strictEqual(lines[1], "a: 2");
    assert.strictEqual(lines[2], "b: 3");
  });

  test("round-trips strings that need quoting", () => {
    const fm = {
      title: "Has: a colon followed by space",
      tricky: "12345",            // looks like a number
      reserved: "true",           // looks like a boolean
      withhash: "comment # here", // would otherwise start a comment
    };
    assert.deepStrictEqual(roundTrip(fm), fm);
  });

  test("round-trips empty arrays and objects", () => {
    const fm = { id: "M-0001", labels: [], extras: {} };
    assert.deepStrictEqual(roundTrip(fm), fm);
  });

  test("round-trips booleans, null, and numbers", () => {
    const fm = { flag: true, gone: null, count: 42, negative: -7, codex_findings_unresolved: false };
    assert.deepStrictEqual(roundTrip(fm), fm);
  });

  test("round-trips nested objects and lists inside them", () => {
    const fm = {
      verification: {
        required_levels: ["L0", "L1"],
        optional_levels: ["L3", "L5"],
      },
    };
    assert.deepStrictEqual(roundTrip(fm), fm);
  });
});

// ─── extractBodySection ─────────────────────────────────────────────────────

group("extractBodySection", () => {
  test("extracts a middle section, stops at the next ## heading", () => {
    const body = [
      "## A",
      "",
      "A content",
      "",
      "## B",
      "",
      "B content",
      "",
      "## C",
      "",
      "C content",
    ].join("\n");
    const b = extractBodySection(body, "B");
    assert.notStrictEqual(b, null);
    assert(b.includes("B content"));
    assert(!b.includes("C content"));
    assert(!b.includes("A content"));
  });

  test("extracts the last section through EOF", () => {
    const body = "## A\n\nA content\n\n## Workpad\n\nlast entry\n";
    const wp = extractBodySection(body, "Workpad");
    assert.notStrictEqual(wp, null);
    assert(wp.includes("last entry"));
  });

  test("returns null when section is missing", () => {
    const body = "## A\n\nA content";
    assert.strictEqual(extractBodySection(body, "Missing"), null);
  });

  test("accepts both `Workpad` and `## Workpad` as the section name", () => {
    const body = "## Workpad\n\ncontent\n";
    assert.strictEqual(
      extractBodySection(body, "Workpad"),
      extractBodySection(body, "## Workpad")
    );
  });
});

// ─── appendBodySection ──────────────────────────────────────────────────────

group("appendBodySection", () => {
  test("appends to a middle section without disturbing subsequent sections", () => {
    const body = [
      "## A",
      "",
      "A1",
      "",
      "## B",
      "",
      "B1",
      "",
      "## C",
      "",
      "C1",
    ].join("\n");
    const out = appendBodySection(body, "A", "\nA2 appended\n");
    assert(out.includes("A1"));
    assert(out.includes("A2 appended"));
    assert(out.includes("B1"));
    assert(out.includes("C1"));
    assert(out.indexOf("A2 appended") < out.indexOf("## B"));
    assert(out.indexOf("B1") < out.indexOf("## C"));
  });

  test("appends to the last section (no following heading)", () => {
    const body = "## A\n\nA1\n";
    const out = appendBodySection(body, "A", "\nA2 appended\n");
    assert(out.includes("A1"));
    assert(out.includes("A2 appended"));
  });

  test("throws when the section is missing", () => {
    assert.throws(
      () => appendBodySection("## A\n\nA1", "Missing", "\ncontent\n"),
      /section "## Missing" not found/
    );
  });
});

// ─── Summary ────────────────────────────────────────────────────────────────

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
