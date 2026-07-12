"use strict";
//
// allowed-tools-guard.test.js — M-0002 Task 6 drift guard (repo-only test,
// never ships; cli.test.js's packaging group asserts fixtures stay out of the
// tarball). Guards the three-way contract between each command/skill's
// `allowed-tools` frontmatter, its body's actual invocations, and the shipped
// permission policy (framework/settings.json). This test IS the mission's L1
// (static analysis) mechanism and rides L0 via `npm test`.
//
// Layers:
//   A  frontmatter syntax   — entries well-formed; no bare Bash / stale names.
//   B  declaration → usage  — every grant above the Read/Grep/Glob floor needs
//                             body evidence (or a cited pin). Catches
//                             declared-but-unused drift (apes-map cat/wc/tail
//                             class).
//   C  usage → coverage     — every extracted invocation must be allow-covered,
//                             ask-covered, a cited expected-deny, or a cited
//                             known-prompting pin. Catches new uncovered
//                             invocations the moment a body changes.
//
// ── Rule-matching semantics (APPROXIMATION — read before editing) ──────────
// This matcher approximates Claude Code's permission rules (docs:
// https://code.claude.com/docs/en/settings.md and .../iam.md — deny → ask →
// allow, first match wins; Bash rules are prefix matchers on the literal
// command string). Known quirks are REPLICATED FAITHFULLY, not corrected,
// because the guard must categorize sites the way the product does:
//   * `Bash(x *)` (space-star) does NOT match the bare command `x` — the
//     bare-form gap from the M-0001 deny-audit follow-up. `Bash(git push *)`
//     matches `git push origin main` but not bare `git push`.
//   * `Bash(x:*)` (colon-star, the frontmatter convention) matches the bare
//     command AND any continuation (`npm run lint:*` covers `npm run lint`,
//     `npm run lint:fix`, `npm run lint -- --fix`).
//   * Env-var prefixes (`FOO=1 cmd`) break prefix matching — such segments are
//     never rule-covered (testing.md:176 class; M-0003 rewrites them).
//   * Compound commands are split into segments here (on && || | ; and $()),
//     which mirrors the product's per-subcommand checking closely enough for
//     categorization.
//   * Precedence modeled here: deny → frontmatter grant → settings allow →
//     settings ask → pins. Frontmatter grants are evaluated before the ask
//     list because an active skill's grant silences the ask prompt (M-0002's
//     premise — the grant exists to remove that prompt); deny is silenced by
//     nothing.
//     KNOWN DIVERGENCE (M-0003 Task 3a): the PRODUCT evaluates ask BEFORE
//     allow ("a matching ask rule prompts even when a more specific allow
//     rule also matches" — permissions.md, confirmed by live probe). Safe
//     today only because no shipped ask rule overlaps an allow rule on the
//     same command string (the AC-3 ask is exact-match `git switch main`).
//     Parked in the M-0003 ledger closeout (2026-07-09); fix the model before
//     authoring any overlapping rule.
//   * LIMITATION — fences do not nest: an inner ``` inside a fenced block
//     would toggle this parser. Verified against the current corpus: no
//     nested or unclosed fences, and no powershell/cmd blocks (langs present:
//     bash, css, dockerfile, js, json, markdown, prisma, toml, tsx,
//     typescript, yaml, plus unlabeled). Re-verify if a template block ever
//     embeds a fenced example.
//
// Run:  node framework/scripts/allowed-tools-guard.test.js
//       node framework/scripts/allowed-tools-guard.test.js --inventory
//         (dump every extracted segment with its category — pin maintenance aid)
//

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..", "..");
const COMMANDS_DIR = path.join(REPO_ROOT, "framework", "commands");
const SKILLS_DIR = path.join(REPO_ROOT, "framework", "skills");
const SETTINGS = path.join(REPO_ROOT, "framework", "settings.json");
const FIXTURES = path.join(__dirname, "fixtures", "allowed-tools-guard");

const INVENTORY = process.argv.includes("--inventory");

// ── constants ────────────────────────────────────────────────────────────────

const NATIVE_TOOLS = new Set([
  "Read", "Edit", "Write", "Grep", "Glob",
  "TaskCreate", "TaskUpdate", "TaskList",
]);
// Never flagged as unused (Task 4 gate ruling: permitted floor for prose-only files).
const FLOOR = new Set(["Read", "Grep", "Glob"]);
// v1-era tool names; also bare Bash (the thing this mission removed everywhere).
const FORBIDDEN_ENTRIES = new Set(["Task", "TodoWrite", "Bash"]);
// Task tools get literal-token usage evidence; Edit/Write have no mechanical
// signal and are pinned per file instead (see EDIT_WRITE_EXPECTED).
const TASK_TOOLS = new Set(["TaskCreate", "TaskUpdate", "TaskList"]);

// First tokens that make a line/segment count as an invocation.
const EXEC = new Set([
  "node", "bash", "sh", "git", "npm", "npx", "codex", "agent-browser",
  "curl", "wget", "rm", "mv", "cp", "mkdir", "touch", "chmod", "ln",
  "cat", "ls", "find", "grep", "rg", "sed", "awk", "head", "tail", "wc",
  "sort", "uniq", "tr", "cut", "echo", "printf", "date", "xargs", "trap",
  "tsc", "tsx", "vitest", "jest", "eslint", "prettier", "gitleaks", "semgrep",
]);

// Fenced-block languages whose content is shell to extract. Everything else
// (markdown templates, typescript/jest examples, json, yaml, plain text
// renderings) is display content, not invocations.
const SHELL_LANGS = new Set(["", "bash", "sh", "shell", "console"]);

// ── pins (every entry cites its justification; stale pins fail the run) ─────

// Layer B: grants justified by prose instructions the extractor cannot see.
const PROSE_JUSTIFIED = [
  // evidence-packets.md instructs regeneration in prose ("fix the gap and
  // re-run" :23, "Resolution: … regenerate the packet" :88); the generate
  // command appears only in prose/inline code. Task 5 gate ruling.
  { file: "skills/evidence-packets.md", grant: "Bash(node scripts/evidence-packet.js:*)" },
  // apes-test-e2e's only run instruction is the numbered prose step
  // "3. Run via: npx playwright test" (:15); the fenced blocks are usage
  // banners and a TypeScript template. Task 4 gate kept the grant on core-
  // function evidence.
  { file: "commands/apes-test-e2e.md", grant: "Bash(npx playwright:*)" },
];

// Layer B: Task-tool grants justified by prose instructions (no literal token
// in the body). Surfaced when the falsifiability fix exposed that the earlier
// whole-file token scan had been matching the frontmatter declaration itself.
const TASK_TOOL_PROSE_JUSTIFIED = [
  // product.md:127 "Output a structured task list using the Tasks API" —
  // backlog creation is the skill's core function.
  { file: "skills/product.md", tool: "TaskCreate" },
  // orchestration.md:272 "Task status and dependencies | Tasks API | All
  // agents" — the lead reads task state to coordinate waves.
  { file: "skills/orchestration.md", tool: "TaskList" },
  // product/TaskUpdate was trimmed at the Task 6 correction gate: its only
  // basis was the self-matching whole-file token scan (Task 5 evidence
  // defect), and a pin admitted as weakest-citation violates this table's
  // every-entry-cites contract. Restore only with a real citation, in the
  // same commit as the evidence.
];

// Layer B: Edit/Write expectations per file (no mechanical usage signal —
// bodies instruct file creation in prose). Guarded list, updated only at a
// mission gate. Task 6 design gate ruling (Q1).
const EDIT_WRITE_EXPECTED = {
  "commands/apes-build.md": ["Edit", "Write"],
  "commands/apes-feature.md": ["Edit", "Write"],
  "commands/apes-fix.md": ["Edit", "Write"],
  "commands/apes-refactor.md": ["Edit", "Write"],
  "commands/apes-gc.md": ["Edit", "Write"],
  "commands/apes-test-e2e.md": ["Write"],       // generates Playwright specs
  "skills/cross-model-review.md": ["Edit"],      // fix protocol edits cited files
};

// Layer C: sites that match a DENY rule on purpose-visible drift. Each entry
// must cite the ledger. Empty since M-0003 Task 1 removed the last site
// (apes-feature.md remote-branch deletion); repopulate only with a cite.
const EXPECTED_DENY = [];

// Layer C: today's accepted prompt surface, frozen. Key = file + command
// prefix, i.e. the freeze is per (file, command-family), NOT per site: a new
// invocation that shares a pinned family prefix in the same file will not
// fail (accepted trade-off — per-site pins were rejected as churn noise). A
// new invocation in an unpinned family or file fails immediately. M-0003
// shrinks this list in the same commits that rewrite the bodies (Task 3 +
// Task 6 gates).
// Classes: node-e = inline node -e (M-0003 AC); util = bare read-only utility
// (T3 ruling: grants ride M-0003 rewrites); env = env-prefix invocation
// (testing.md:176 class); policy = must-prompt by M-0001 design; bare-form =
// argument-less command unmatched by its own space-star baseline rule (the
// deny-audit quirk — e.g. `Bash(git status *)` covers `git status --short`
// but not bare `git status`); ledgered for the M-0003/M-0004 policy sweep.
const KNOWN_PROMPTING = [
  // ── commands ──
  { file: "commands/apes-board.md", prefix: "head", cls: "util" },
  { file: "commands/apes-board.md", prefix: "sed", cls: "util" },
  { file: "commands/apes-board.md", prefix: "echo", cls: "util" },
  { file: "commands/apes-build.md", prefix: "node -e", cls: "node-e" },
  { file: "commands/apes-build.md", prefix: "cat", cls: "util" },
  { file: "commands/apes-build.md", prefix: "echo", cls: "util" },
  { file: "commands/apes-build.md", prefix: "grep", cls: "util" },
  { file: "commands/apes-build.md", prefix: "git status", cls: "bare-form" }, // :1092 bare; `git status *` doesn't cover it
  { file: "commands/apes-build.md", prefix: "git init", cls: "policy" }, // greenfield bootstrap; prompts outside a repo by design
  { file: "commands/apes-build.md", prefix: "git switch feat/", cls: "policy" }, // phase-branch switches; the narrow ask covers only `git switch main` (AC-3 / F-2 ruling)
  { file: "commands/apes-build.md", prefix: "git checkout .", cls: "policy" },   // working-tree discard; deliberately prompting (AC-3; extractable since the Task 3b F-1 restructure)
  { file: "commands/apes-build.md", prefix: "npm run deploy", cls: "policy" }, // deploy must prompt (M-0001 rationale)
  { file: "commands/apes-build.md", prefix: "trap", cls: "node-e" },           // apes-build:362, M-0003 AC removes the idiom
  { file: "commands/apes-codex-review.md", prefix: "node -e", cls: "node-e" },
  { file: "commands/apes-codex-review.md", prefix: "cat", cls: "util" },
  { file: "commands/apes-codex-review.md", prefix: "echo", cls: "util" },
  { file: "commands/apes-evidence.md", prefix: "node -e", cls: "node-e" },
  { file: "commands/apes-evidence.md", prefix: "cat", cls: "util" },
  { file: "commands/apes-evidence.md", prefix: "echo", cls: "util" },
  { file: "commands/apes-feature.md", prefix: "cat", cls: "util" },
  { file: "commands/apes-feature.md", prefix: "echo", cls: "util" },
  { file: "commands/apes-feature.md", prefix: "find", cls: "util" },
  { file: "commands/apes-feature.md", prefix: "grep", cls: "util" },
  { file: "commands/apes-feature.md", prefix: "head", cls: "util" },
  { file: "commands/apes-feature.md", prefix: "git status", cls: "bare-form" }, // :236 bare (conflict-resolution step)
  { file: "commands/apes-fix.md", prefix: "cat", cls: "util" },
  { file: "commands/apes-fix.md", prefix: "git stash", cls: "bare-form" },      // :64 bare; `git stash *` doesn't cover it
  { file: "commands/apes-fix.md", prefix: "echo", cls: "util" },
  { file: "commands/apes-fix.md", prefix: "grep", cls: "util" },
  { file: "commands/apes-fix.md", prefix: "head", cls: "util" },
  { file: "commands/apes-gc.md", prefix: "echo", cls: "util" },
  { file: "commands/apes-gc.md", prefix: "find", cls: "util" },
  { file: "commands/apes-gc.md", prefix: "grep", cls: "util" },
  { file: "commands/apes-gc.md", prefix: "bash scripts/check-structure.sh", cls: "bare-form" }, // :89 argument-less
  { file: "commands/apes-metrics.md", prefix: "node -e", cls: "node-e" },
  { file: "commands/apes-metrics.md", prefix: "cat", cls: "util" },
  { file: "commands/apes-metrics.md", prefix: "echo", cls: "util" },
  { file: "commands/apes-metrics.md", prefix: "ls", cls: "util" },
  { file: "commands/apes-metrics.md", prefix: "head", cls: "util" },
  { file: "commands/apes-mission.md", prefix: "node -e", cls: "node-e" },
  { file: "commands/apes-mission.md", prefix: "echo", cls: "util" },
  { file: "commands/apes-mission.md", prefix: "ls", cls: "util" },
  { file: "commands/apes-refactor.md", prefix: "find", cls: "util" },
  { file: "commands/apes-refactor.md", prefix: "grep", cls: "util" },
  { file: "commands/apes-refactor.md", prefix: "head", cls: "util" },
  { file: "commands/apes-refactor.md", prefix: "wc", cls: "util" },
  { file: "commands/apes-refactor.md", prefix: "git status", cls: "bare-form" }, // :188 bare (conflict-resolution step)
  { file: "commands/apes-status.md", prefix: "node -e", cls: "node-e" },
  { file: "commands/apes-status.md", prefix: "cat", cls: "util" },
  { file: "commands/apes-status.md", prefix: "echo", cls: "util" },
  { file: "commands/apes-status.md", prefix: "grep", cls: "util" },
  { file: "commands/apes-status.md", prefix: "wc", cls: "util" },
  { file: "commands/apes-verify.md", prefix: "node -e", cls: "node-e" },
  { file: "commands/apes-verify.md", prefix: "echo", cls: "util" },
  { file: "commands/apes-verify.md", prefix: "find", cls: "util" },
  { file: "commands/apes-verify.md", prefix: "grep", cls: "util" },
  { file: "commands/apes-verify.md", prefix: "sed", cls: "util" },
  { file: "commands/apes-verify.md", prefix: "tail", cls: "util" },
  { file: "commands/apes-verify.md", prefix: "wc", cls: "util" },
  // ── skills ──
  { file: "skills/cross-model-review.md", prefix: "node -e", cls: "node-e" },
  { file: "skills/devops.md", prefix: "curl", cls: "policy" },   // FLAG I: exfil surface prompts by design
  { file: "skills/devops.md", prefix: "grep", cls: "util" },
  { file: "skills/devops.md", prefix: "git switch --detach", cls: "policy" }, // rollback to previous tag via $(git describe); detached switch prompts by design
  { file: "skills/devops.md", prefix: "STAGING_URL=", cls: "env" },    // env-prefixed smoke run; M-0003 class
  { file: "skills/missions.md", prefix: "node -e", cls: "node-e" },
  { file: "skills/missions.md", prefix: "find", cls: "util" },
  { file: "skills/missions.md", prefix: "ls", cls: "util" },
  { file: "skills/observability.md", prefix: "curl", cls: "policy" }, // FLAG I
  { file: "skills/observability.md", prefix: "grep", cls: "util" },
  { file: "skills/observability.md", prefix: "sed", cls: "util" },
  // Bare `git tag <name>` matches neither the `git tag -a *` ask rule nor any
  // allow — it prompts via the default. Real ask-list gap surfaced by the
  // faithful matcher; noted for the M-0003/M-0004 policy sweep.
  { file: "skills/orchestration.md", prefix: "git tag", cls: "policy" },
  { file: "skills/testing.md", prefix: "COVERAGE_THRESHOLD=", cls: "env" }, // testing.md:176, M-0003 AC
];

// ── tiny test harness (house style) ─────────────────────────────────────────

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; process.stdout.write(`  ✓ ${name}\n`); }
  catch (err) { failed++; failures.push({ name, err }); process.stdout.write(`  ✗ ${name}\n`); }
}
function group(name, fn) { process.stdout.write(`\n${name}\n`); fn(); }

// ── frontmatter ──────────────────────────────────────────────────────────────

function splitEntries(line) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of line) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function bodyAfterFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") return text;
  const close = lines.indexOf("---", 1);
  return close > 0 ? lines.slice(close + 1).join("\n") : text;
}

// Task-tool tokens appear literally in bodies that use them; both directions
// are checked against the BODY ONLY — including the frontmatter would make
// the declared→used direction unfalsifiable (the declaration matches itself).
function taskToolViolations(entries, bodyOnly) {
  const out = [];
  for (const e of entries) {
    if (TASK_TOOLS.has(e) && !bodyOnly.includes(e)) {
      out.push(`declared ${e} but token never appears in body`);
    }
  }
  for (const t of TASK_TOOLS) {
    if (bodyOnly.includes(t) && !entries.includes(t)) {
      out.push(`body uses ${t} but frontmatter does not declare it`);
    }
  }
  return out;
}

function parseFrontmatter(text, relFile) {
  const lines = text.split(/\r?\n/);
  assert.strictEqual(lines[0], "---", `${relFile}: no frontmatter open`);
  const close = lines.indexOf("---", 1);
  assert.ok(close > 0, `${relFile}: no frontmatter close`);
  const fmLines = lines.slice(1, close);
  const atIdx = fmLines.findIndex((l) => l.startsWith("allowed-tools:"));
  assert.ok(atIdx >= 0, `${relFile}: missing allowed-tools`);
  if (atIdx + 1 < fmLines.length) {
    assert.ok(!/^\s+\S/.test(fmLines[atIdx + 1]) || /^\s*(name|description):/.test(fmLines[atIdx + 1]),
      `${relFile}: allowed-tools must be single-line`);
  }
  return splitEntries(fmLines[atIdx].slice("allowed-tools:".length));
}

// ── extraction ───────────────────────────────────────────────────────────────

function firstToken(seg) { return seg.split(/\s+/)[0] || ""; }

function looksExecutable(seg) {
  if (/^[A-Z_][A-Z0-9_]*=\S*$/.test(seg)) return false; // pure shell assignment, not an invocation
  if (/^[A-Z_][A-Z0-9_]*=\S+\s+\S/.test(seg)) return true; // env-prefixed command (faithful: never rule-covered)
  return EXEC.has(firstToken(seg));
}

function splitSegments(line) {
  // pull out $(...) contents as their own candidate segments
  const inner = [];
  const outer = line.replace(/\$\(([^()]*)\)/g, (_, body) => { inner.push(body); return "$SUB"; });
  const rawSegs = [];
  for (const part of outer.split(/&&|\|\||;|\|/)) rawSegs.push(part);
  for (const part of inner) for (const p of part.split(/&&|\|\||;|\|/)) rawSegs.push(p);
  return rawSegs;
}

function cleanSegment(seg) {
  let s = seg.trim();
  // strip trailing comments introduced by 2+ spaces before '#'
  s = s.replace(/\s{2,}#.*$/, "");
  // unwrap shell conditionals so the underlying command surfaces
  s = s.replace(/^(if|elif|until|while)\s+!?\s*/, "");
  // unwrap `VAR=$(cmd …` when the $() closes on a later line (single-line
  // substitutions are handled in splitSegments)
  s = s.replace(/^[A-Z_][A-Z0-9_]*=\$\(\s*/, "");
  return s.trim();
}

function extractInvocations(text, relFile) {
  const segs = [];
  const lines = text.split(/\r?\n/);
  let inFence = false, fenceLang = "";
  // skip frontmatter
  let i = lines[0] === "---" ? lines.indexOf("---", 1) + 1 : 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```(\S*)\s*$/);
    if (fence) {
      if (!inFence) { inFence = true; fenceLang = fence[1].toLowerCase(); }
      else { inFence = false; fenceLang = ""; }
      continue;
    }
    let candidates = [];
    if (inFence) {
      if (!SHELL_LANGS.has(fenceLang)) continue;
      const stripped = line.trim();
      if (!stripped || stripped.startsWith("#") || stripped.startsWith("//")) continue;
      candidates = splitSegments(line);
    } else {
      // unfenced indentation-style code (browser-verification class)
      if (!/^\s{2,}\S/.test(line)) continue;
      const stripped = line.trim();
      if (/^([-*>#|]|\d+\.)/.test(stripped)) continue; // bullets, tables, quotes, numbered prose
      if (!looksExecutable(stripped)) continue;
      candidates = splitSegments(line);
    }
    for (const raw of candidates) {
      const s = cleanSegment(raw);
      if (!s || !looksExecutable(s)) continue;
      segs.push({ cmd: s, line: i + 1 });
    }
  }
  return segs;
}

// ── rule matching (see semantics header) ─────────────────────────────────────

function bashRuleInner(entry) {
  const m = entry.match(/^Bash\((.+)\)$/);
  return m ? m[1] : null;
}

function ruleMatches(inner, cmd) {
  if (inner.endsWith(":*")) {
    return cmd.startsWith(inner.slice(0, -2));
  }
  if (inner.endsWith(" *")) {
    const p = inner.slice(0, -2);
    return cmd.startsWith(p + " ") && cmd.length > p.length + 1; // bare-form gap: bare `p` does NOT match
  }
  return cmd === inner;
}

function anyRuleMatches(rules, cmd) {
  return rules.some((r) => ruleMatches(r, cmd));
}

// ── load policy ──────────────────────────────────────────────────────────────

const settings = JSON.parse(fs.readFileSync(SETTINGS, "utf8"));
const bashRulesOf = (list) => (list || []).map(bashRuleInner).filter(Boolean);
const ALLOW = bashRulesOf(settings.permissions.allow);
const ASK = bashRulesOf(settings.permissions.ask);
const DENY = bashRulesOf(settings.permissions.deny);

// ── collect files ────────────────────────────────────────────────────────────

function mdFiles(dir, skip) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !skip.includes(f))
    .map((f) => ({ rel: `${path.basename(dir)}/${f}`, abs: path.join(dir, f) }));
}
const FILES = [
  ...mdFiles(COMMANDS_DIR, []),
  ...mdFiles(SKILLS_DIR, ["README.md"]),
];

// ── fixture self-test (aborts before guarding real files) ───────────────────

group("extractor self-test (pinned fixtures)", () => {
  const fx1 = fs.readFileSync(path.join(FIXTURES, "indented-fence.md"), "utf8");
  const got1 = extractInvocations(fx1, "fixture1").map((s) => s.cmd);
  test("column-0 fence, indented fence, pipeline halves extracted; template block excluded", () => {
    assert.deepStrictEqual(got1.sort(), [
      "git checkout -b feature/x",
      "git status --short",
      "node -e 'let s=\"\"'",
      "node scripts/mission-cli.js list",
      "npm run lint",
      "npm test",
    ].sort());
    assert.ok(!got1.some((c) => c.includes("deploy")), "template block leaked into extraction");
  });

  const fx2 = fs.readFileSync(path.join(FIXTURES, "unfenced-indented.md"), "utf8");
  const got2 = extractInvocations(fx2, "fixture2").map((s) => s.cmd);
  test("unfenced indented commands extracted; prose/bullets/tables/numbered steps excluded", () => {
    assert.deepStrictEqual(got2.sort(), [
      "agent-browser open http://localhost:3000",
      "agent-browser snapshot -i --json",
      "npx playwright test --project=chromium",
    ].sort());
  });
});

group("layer-B logic self-test (task-tool checks are falsifiable)", () => {
  const declaredUnused =
    "---\nname: x\nallowed-tools: Read, Grep, Glob, TaskList\n---\n\nNo token in this body.\n";
  test("declared-but-unused Task tool is flagged", () => {
    const v = taskToolViolations(
      parseFrontmatter(declaredUnused, "synthetic"),
      bodyAfterFrontmatter(declaredUnused));
    assert.deepStrictEqual(v, ["declared TaskList but token never appears in body"]);
  });
  const usedUndeclared =
    "---\nname: x\nallowed-tools: Read, Grep, Glob\n---\n\nPlan with TaskCreate here.\n";
  test("used-but-undeclared Task tool is flagged", () => {
    const v = taskToolViolations(
      parseFrontmatter(usedUndeclared, "synthetic"),
      bodyAfterFrontmatter(usedUndeclared));
    assert.deepStrictEqual(v, ["body uses TaskCreate but frontmatter does not declare it"]);
  });
  const consistent =
    "---\nname: x\nallowed-tools: Read, Grep, Glob, TaskCreate\n---\n\nPlan with TaskCreate here.\n";
  test("declared-and-used Task tool passes", () => {
    const v = taskToolViolations(
      parseFrontmatter(consistent, "synthetic"),
      bodyAfterFrontmatter(consistent));
    assert.deepStrictEqual(v, []);
  });
});
if (failed > 0) {
  process.stdout.write("\nextractor self-test FAILED — aborting before guarding real files\n");
  process.exit(1);
}

// ── the guard ────────────────────────────────────────────────────────────────

const usedPins = { deny: new Set(), prompt: new Set(), prose: new Set(), taskProse: new Set() };

group("layer A — frontmatter syntax", () => {
  for (const f of FILES) {
    const text = fs.readFileSync(f.abs, "utf8");
    test(f.rel, () => {
      const entries = parseFrontmatter(text, f.rel);
      for (const e of entries) {
        assert.ok(!FORBIDDEN_ENTRIES.has(e), `${f.rel}: forbidden entry '${e}'`);
        if (NATIVE_TOOLS.has(e)) continue;
        const inner = bashRuleInner(e);
        assert.ok(inner, `${f.rel}: unrecognized entry '${e}'`);
        assert.ok(inner.trim().length > 0, `${f.rel}: empty Bash rule`);
      }
    });
  }
});

group("layer B — declaration → usage", () => {
  for (const f of FILES) {
    const text = fs.readFileSync(f.abs, "utf8");
    const entries = parseFrontmatter(text, f.rel);
    const bodyOnly = bodyAfterFrontmatter(text);
    const segs = extractInvocations(text, f.rel);
    // lenient copies for usage evidence: env prefixes stripped
    const evidence = segs.map((s) => s.cmd.replace(/^([A-Z_][A-Z0-9_]*=\S+\s+)+/, ""));
    test(f.rel, () => {
      const declaredEW = entries.filter((e) => e === "Edit" || e === "Write").sort();
      const expectedEW = (EDIT_WRITE_EXPECTED[f.rel] || []).slice().sort();
      assert.deepStrictEqual(declaredEW, expectedEW,
        `${f.rel}: Edit/Write declarations must match the pinned expectation list`);
      const ttv = taskToolViolations(entries, bodyOnly).filter((v) => {
        const m = v.match(/^declared (Task\w+) /);
        if (!m) return true;
        const pin = TASK_TOOL_PROSE_JUSTIFIED.find((p) => p.file === f.rel && p.tool === m[1]);
        if (pin) { usedPins.taskProse.add(f.rel + "|" + pin.tool); return false; }
        return true;
      });
      assert.deepStrictEqual(ttv, [], `${f.rel}: ${ttv.join("; ")}`);
      for (const e of entries) {
        if (FLOOR.has(e) || e === "Edit" || e === "Write" || TASK_TOOLS.has(e)) continue;
        const inner = bashRuleInner(e);
        const prose = PROSE_JUSTIFIED.find((p) => p.file === f.rel && p.grant === e);
        if (prose) { usedPins.prose.add(f.rel + "|" + e); continue; }
        const hit = evidence.some((cmd) => ruleMatches(inner, cmd));
        assert.ok(hit, `${f.rel}: grant '${e}' has no matching body invocation (declared-but-unused)`);
      }
    });
  }
});

group("layer C — usage → coverage", () => {
  for (const f of FILES) {
    const text = fs.readFileSync(f.abs, "utf8");
    const entries = parseFrontmatter(text, f.rel);
    const fmRules = entries.map(bashRuleInner).filter(Boolean);
    const segs = extractInvocations(text, f.rel);
    const problems = [];
    for (const s of segs) {
      let category;
      if (anyRuleMatches(DENY, s.cmd)) {
        const pin = EXPECTED_DENY.find((p) => p.file === f.rel && s.cmd.startsWith(p.prefix));
        if (pin) { usedPins.deny.add(f.rel + "|" + pin.prefix); category = "expected-deny"; }
        else { category = "DENY-UNPINNED"; problems.push(`${s.line}: deny-matched, not whitelisted: ${s.cmd}`); }
      } else if (anyRuleMatches(fmRules, s.cmd)) {
        category = "allowed:frontmatter"; // grant silences the ask prompt while the skill is active
      } else if (anyRuleMatches(ALLOW, s.cmd)) {
        category = "allowed:settings";
      } else if (anyRuleMatches(ASK, s.cmd)) {
        category = "ask";
      } else {
        const pin = KNOWN_PROMPTING.find((p) => p.file === f.rel && p.prefix && s.cmd.startsWith(p.prefix));
        if (pin) { usedPins.prompt.add(f.rel + "|" + pin.prefix); category = `pinned:${pin.cls}`; }
        else { category = "UNCOVERED"; problems.push(`${s.line}: uncovered invocation (new drift): ${s.cmd}`); }
      }
      if (INVENTORY) process.stdout.write(`    [${category}] ${f.rel}:${s.line} ${s.cmd}\n`);
    }
    test(f.rel, () => {
      assert.deepStrictEqual(problems, [], `${f.rel}:\n  ${problems.join("\n  ")}`);
    });
  }
});

group("pin hygiene — no stale pins", () => {
  test("every EXPECTED_DENY pin matched a live site", () => {
    const stale = EXPECTED_DENY.filter((p) => !usedPins.deny.has(p.file + "|" + p.prefix));
    assert.deepStrictEqual(stale, [], `stale deny pins (site gone — remove the pin): ${JSON.stringify(stale)}`);
  });
  test("every KNOWN_PROMPTING pin matched a live site", () => {
    const stale = KNOWN_PROMPTING.filter((p) => p.prefix && !usedPins.prompt.has(p.file + "|" + p.prefix));
    assert.deepStrictEqual(stale.map((p) => p.file + "|" + p.prefix), [],
      "stale known-prompting pins (site gone — remove the pin)");
  });
  test("every PROSE_JUSTIFIED pin matched a live grant", () => {
    const stale = PROSE_JUSTIFIED.filter((p) => !usedPins.prose.has(p.file + "|" + p.grant));
    assert.deepStrictEqual(stale, [], `stale prose pins: ${JSON.stringify(stale)}`);
  });
  test("every TASK_TOOL_PROSE_JUSTIFIED pin matched a live declaration gap", () => {
    const stale = TASK_TOOL_PROSE_JUSTIFIED.filter((p) => !usedPins.taskProse.has(p.file + "|" + p.tool));
    assert.deepStrictEqual(stale, [], `stale task-tool prose pins: ${JSON.stringify(stale)}`);
  });
});

// ── summary ──────────────────────────────────────────────────────────────────

process.stdout.write(
  `\nallowed-tools-guard: ${passed} passed, ${failed} failed ` +
  `(files: ${FILES.length}, deny pins: ${EXPECTED_DENY.length}, ` +
  `prompt pins: ${KNOWN_PROMPTING.length}, prose pins: ${PROSE_JUSTIFIED.length}, ` +
  `task-tool prose pins: ${TASK_TOOL_PROSE_JUSTIFIED.length})\n`
);
if (failed > 0) {
  for (const f of failures) process.stdout.write(`\n✗ ${f.name}\n  ${f.err.message}\n`);
  process.exit(1);
}
