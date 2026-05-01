#!/usr/bin/env node
//
// evidence-packet.js — assemble the proof-of-work bundle for a mission's review.
//
// Usage:
//   node evidence-packet.js generate <M-NNNN>
//
// Reads:
//   .planning/missions/<state>/M-NNNN-<slug>.md          (mission file)
//   .planning/missions/<state>/M-NNNN/verification.jsonl (verification log)
//   .planning/missions/<state>/M-NNNN/screenshots/       (optional L7 artifacts)
//   .claude/auto-reviews/M-NNNN-*.md                     (optional, most recent)
//
// Writes (always under .planning/missions/review/M-NNNN/evidence/, regardless
// of the mission's current state — the packet is the artifact a reviewer
// reads, so its location is anchored to "review"):
//   summary.md
//   verification.jsonl   (copy)
//   diff-stats.txt       (git diff --stat merge-base...branch)
//   diff.patch           (git diff merge-base...branch)
//   auto-review.md       (copy of most recent L0.5 auto-review, if any)
//   screenshots/         (copy of L7 artifacts, if present)
//
// Refuses to generate if any verification.required_levels lacks a pass entry.
// Idempotent: re-running wipes and rewrites the evidence/ directory.
//
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PREFIX = "evidence-packet:";
const STATES = ["todo", "doing", "review", "done", "canceled"];

// ─── Helpers ────────────────────────────────────────────────────────────────

function fail(msg, code = 1) {
  process.stderr.write(`${PREFIX} ${msg}\n`);
  process.exit(code);
}

function info(msg) {
  process.stdout.write(`${PREFIX} ${msg}\n`);
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function gitTry(args) {
  try {
    return { ok: true, stdout: git(args) };
  } catch (err) {
    const stderr = err.stderr ? String(err.stderr).trim() : err.message;
    return { ok: false, stderr };
  }
}

function repoRoot() {
  const r = gitTry(["rev-parse", "--show-toplevel"]);
  if (!r.ok) fail("not inside a git repository");
  return r.stdout.trim();
}

function parseMissionId(id) {
  if (!/^M-\d{4}$/.test(id || "")) {
    fail(`invalid mission ID "${id}" — must match M-NNNN`);
  }
  return id;
}

function findMissionFile(root, id) {
  for (const state of STATES) {
    const dir = path.join(root, ".planning", "missions", state);
    if (!fs.existsSync(dir)) continue;
    const matches = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(`${id}-`) && f.endsWith(".md"));
    if (matches.length > 1) {
      fail(`multiple mission files for ${id} in ${state}/: ${matches.join(", ")}`);
    }
    if (matches.length === 1) {
      return { path: path.join(dir, matches[0]), state };
    }
  }
  fail(`mission ${id} not found in any .planning/missions/<state>/`);
}

// ─── Frontmatter parsing ────────────────────────────────────────────────────

function splitFrontmatter(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const parts = text.split(/^---\s*$/m);
  if (parts.length < 3) fail(`mission file ${filePath} has no frontmatter`);
  return { frontmatter: parts[1], body: parts.slice(2).join("---") };
}

function getScalar(fm, key) {
  const re = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const m = fm.match(re);
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, "");
}

function getNestedScalar(fm, parent, key) {
  // Captures "<parent>:" then any continuous indented block, then `  <key>: value`
  const lines = fm.split(/\r?\n/);
  let inParent = false;
  for (const line of lines) {
    if (/^[A-Za-z_]/.test(line)) {
      inParent = line.startsWith(parent + ":");
      continue;
    }
    if (!inParent) continue;
    const m = line.match(new RegExp(`^\\s{2}${key}:\\s*(.+)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

function getList(fm, key, indent = 0) {
  // Extract a YAML-style list under `<indent>key:` where each item is `<indent+2>- value`.
  const lines = fm.split(/\r?\n/);
  const pad = " ".repeat(indent);
  const itemPad = " ".repeat(indent + 2);
  const items = [];
  let inList = false;
  for (const line of lines) {
    if (line.match(new RegExp(`^${pad}${key}:\\s*$`))) {
      inList = true;
      continue;
    }
    if (!inList) continue;
    const itemMatch = line.match(new RegExp(`^${itemPad}-\\s+(.+)$`));
    if (itemMatch) {
      items.push(itemMatch[1].trim().replace(/^["']|["']$/g, ""));
      continue;
    }
    // Stop at next sibling key (same indent, ends with ':') or any line at lower indent
    if (line.trim() === "") continue;
    const leading = line.match(/^(\s*)/)[1].length;
    if (leading <= indent) break;
  }
  return items;
}

function getNestedList(fm, parent, key) {
  // Same as getList but the key lives one level under `parent:`.
  const lines = fm.split(/\r?\n/);
  let phase = "before"; // before | inParent | inList
  const items = [];
  for (const line of lines) {
    if (phase === "before") {
      if (line.startsWith(parent + ":")) phase = "inParent";
      continue;
    }
    if (phase === "inParent") {
      if (/^[A-Za-z_]/.test(line)) {
        // Left the parent block before finding the key
        return [];
      }
      if (line.match(new RegExp(`^\\s{2}${key}:\\s*$`))) {
        phase = "inList";
      }
      continue;
    }
    if (phase === "inList") {
      const itemMatch = line.match(/^\s{4}-\s+(.+)$/);
      if (itemMatch) {
        items.push(itemMatch[1].trim().replace(/^["']|["']$/g, ""));
        continue;
      }
      if (line.trim() === "") continue;
      const leading = line.match(/^(\s*)/)[1].length;
      if (leading <= 2) break;
    }
  }
  return items;
}

function readMissionMeta(filePath) {
  const { frontmatter, body } = splitFrontmatter(filePath);
  return {
    id: getScalar(frontmatter, "id"),
    title: getScalar(frontmatter, "title"),
    state: getScalar(frontmatter, "state"),
    branch: getNestedScalar(frontmatter, "workspace", "branch"),
    acceptance: getList(frontmatter, "acceptance", 0),
    requiredLevels: getNestedList(frontmatter, "verification", "required_levels"),
    optionalLevels: getNestedList(frontmatter, "verification", "optional_levels"),
    body,
  };
}

function defaultBranch(id) {
  return `feat/${id.toLowerCase()}`;
}

// ─── Verification log ───────────────────────────────────────────────────────

function readVerificationLog(root, state, id) {
  const file = path.join(root, ".planning", "missions", state, id, "verification.jsonl");
  if (!fs.existsSync(file)) return { file, entries: [] };
  const text = fs.readFileSync(file, "utf8");
  const entries = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // skip malformed lines but warn
      process.stderr.write(`${PREFIX} skipped malformed log line: ${trimmed.slice(0, 80)}\n`);
    }
  }
  return { file, entries };
}

function latestByLevel(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!e || !e.level) continue;
    map.set(e.level, e); // log is append-only; last wins
  }
  return map;
}

// ─── Acceptance status from workpad ─────────────────────────────────────────

function acceptanceStatus(body, criteria) {
  // A criterion is "met" if any `- [x]` line in the body contains its quoted text.
  const checked = body.match(/- \[x\][^\n]*/g) || [];
  return criteria.map((c) => ({
    text: c,
    met: checked.some((line) => line.includes(c)),
  }));
}

// ─── Diff computation ───────────────────────────────────────────────────────

function pickMainRef() {
  if (gitTry(["show-ref", "--verify", "--quiet", "refs/remotes/origin/main"]).ok) {
    return "origin/main";
  }
  if (gitTry(["show-ref", "--verify", "--quiet", "refs/heads/main"]).ok) {
    return "main";
  }
  return null;
}

function computeDiff(branch) {
  const branchExists = gitTry(["rev-parse", "--verify", "--quiet", branch]).ok;
  if (!branchExists) {
    return { error: `branch "${branch}" not found locally` };
  }
  const mainRef = pickMainRef();
  if (!mainRef) {
    return { error: "neither origin/main nor main exists locally" };
  }
  const mb = gitTry(["merge-base", branch, mainRef]);
  if (!mb.ok) {
    return { error: `git merge-base failed: ${mb.stderr}` };
  }
  const base = mb.stdout.trim();
  const stat = gitTry(["diff", "--stat", `${base}...${branch}`]);
  const patch = gitTry(["diff", `${base}...${branch}`]);
  return {
    base,
    branch,
    mainRef,
    stat: stat.ok ? stat.stdout : `(stat failed: ${stat.stderr})`,
    patch: patch.ok ? patch.stdout : `(patch failed: ${patch.stderr})`,
  };
}

// ─── Auto-review lookup ─────────────────────────────────────────────────────

function findAutoReview(root, id) {
  const dir = path.join(root, ".claude", "auto-reviews");
  if (!fs.existsSync(dir)) return null;
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const matches = entries
    .filter((f) => f.startsWith(`${id}-`) && f.endsWith(".md"))
    .map((f) => {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      return { full, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return matches.length > 0 ? matches[0].full : null;
}

// ─── Tree copy (no shell, no deps) ──────────────────────────────────────────

function copyTree(src, dst) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dst, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      count += copyTree(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
      count++;
    }
  }
  return count;
}

// ─── Summary builder ────────────────────────────────────────────────────────

function renderSummary({ meta, levels, accStatus, diff, autoReviewPath, screenshotCount }) {
  const lines = [];
  lines.push(`# Evidence Packet: ${meta.id} — ${meta.title || "(no title)"}`);
  lines.push("");
  lines.push(`> Generated ${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")} for review.`);
  lines.push("");
  lines.push(`- **Mission state at packet time:** ${meta.state || "(unknown)"}`);
  lines.push(`- **Branch:** \`${meta.branch || defaultBranch(meta.id)}\``);
  if (diff.base) {
    lines.push(`- **Diff range:** \`${diff.base.slice(0, 12)}...${meta.branch || ""}\` (against \`${diff.mainRef}\`)`);
  }
  lines.push("");

  // Acceptance criteria
  lines.push("## Acceptance criteria");
  lines.push("");
  if (accStatus.length === 0) {
    lines.push("_No acceptance criteria declared in mission frontmatter._");
  } else {
    for (const a of accStatus) {
      lines.push(`- [${a.met ? "x" : " "}] ${a.text}`);
    }
  }
  lines.push("");

  // Verification levels
  lines.push("## Verification levels");
  lines.push("");
  lines.push("| Level | Required | Outcome | Summary |");
  lines.push("|---|---|---|---|");
  const allLevelIds = new Set([
    ...meta.requiredLevels,
    ...meta.optionalLevels,
    ...levels.keys(),
  ]);
  const sorted = [...allLevelIds].sort((a, b) => parseFloat(a.slice(1)) - parseFloat(b.slice(1)));
  for (const lvl of sorted) {
    const entry = levels.get(lvl);
    const required = meta.requiredLevels.includes(lvl) ? "yes" : (meta.optionalLevels.includes(lvl) ? "optional" : "no");
    const outcome = entry ? entry.outcome : "(no run)";
    const summary = entry ? (entry.summary || "") : "";
    lines.push(`| ${lvl} | ${required} | ${outcome} | ${summary.replace(/\|/g, "\\|")} |`);
  }
  lines.push("");

  // Diff stats
  lines.push("## Diff stats");
  lines.push("");
  if (diff.error) {
    lines.push(`_Diff unavailable: ${diff.error}_`);
  } else {
    lines.push("```");
    lines.push((diff.stat || "").trimEnd() || "(no changes)");
    lines.push("```");
    lines.push("");
    lines.push("Full patch: [`diff.patch`](./diff.patch)");
  }
  lines.push("");

  // Auto-review
  lines.push("## Auto code review (L0.5)");
  lines.push("");
  if (autoReviewPath) {
    lines.push(`Source: \`${path.relative(process.cwd(), autoReviewPath).replace(/\\/g, "/")}\``);
    lines.push("");
    lines.push("Local copy: [`auto-review.md`](./auto-review.md)");
  } else {
    lines.push("_No auto-review file found in `.claude/auto-reviews/`._");
  }
  lines.push("");

  // Screenshots
  lines.push("## Screenshots");
  lines.push("");
  if (screenshotCount > 0) {
    lines.push(`${screenshotCount} file${screenshotCount === 1 ? "" : "s"} in [\`screenshots/\`](./screenshots/).`);
  } else {
    lines.push("_No L7 visual artifacts captured for this mission._");
  }
  lines.push("");

  // Verification log
  lines.push("## Verification log");
  lines.push("");
  lines.push("Full machine-readable record: [`verification.jsonl`](./verification.jsonl)");
  lines.push("");

  return lines.join("\n");
}

// ─── Verb: generate ─────────────────────────────────────────────────────────

function cmdGenerate(id) {
  parseMissionId(id);
  const root = repoRoot();
  const { path: missionPath, state } = findMissionFile(root, id);
  const meta = readMissionMeta(missionPath);

  const log = readVerificationLog(root, state, id);
  const levels = latestByLevel(log.entries);

  // Gate: every required level must have a passing entry.
  const missing = [];
  for (const lvl of meta.requiredLevels) {
    const e = levels.get(lvl);
    if (!e || e.outcome !== "pass") {
      missing.push({ level: lvl, status: e ? e.outcome : "(no run)" });
    }
  }
  if (missing.length > 0) {
    const list = missing.map((m) => `${m.level} (${m.status})`).join(", ");
    fail(`missing required passing verification level${missing.length > 1 ? "s" : ""}: ${list}`);
  }

  // Compute diff against main.
  const branch = meta.branch || defaultBranch(id);
  const diff = computeDiff(branch);

  // Acceptance status from workpad checkboxes.
  const accStatus = acceptanceStatus(meta.body, meta.acceptance);

  // Find auto-review.
  const autoReviewPath = findAutoReview(root, id);

  // Locate per-mission directory (may live under any state).
  const perMissionDir = path.join(root, ".planning", "missions", state, id);
  const screenshotsSrc = path.join(perMissionDir, "screenshots");

  // Output destination — always under review/, regardless of current state.
  const outDir = path.join(root, ".planning", "missions", "review", id, "evidence");

  // Idempotent: wipe and recreate.
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // 1. summary.md
  fs.writeFileSync(
    path.join(outDir, "summary.md"),
    renderSummary({
      meta,
      levels,
      accStatus,
      diff,
      autoReviewPath,
      screenshotCount: fs.existsSync(screenshotsSrc)
        ? fs.readdirSync(screenshotsSrc).length
        : 0,
    })
  );

  // 2. verification.jsonl (copy)
  if (fs.existsSync(log.file)) {
    fs.copyFileSync(log.file, path.join(outDir, "verification.jsonl"));
  } else {
    fs.writeFileSync(path.join(outDir, "verification.jsonl"), "");
  }

  // 3. diff-stats.txt + 4. diff.patch
  if (diff.error) {
    fs.writeFileSync(path.join(outDir, "diff-stats.txt"), `(diff unavailable: ${diff.error})\n`);
    fs.writeFileSync(path.join(outDir, "diff.patch"), "");
  } else {
    fs.writeFileSync(path.join(outDir, "diff-stats.txt"), diff.stat || "");
    fs.writeFileSync(path.join(outDir, "diff.patch"), diff.patch || "");
  }

  // 5. auto-review.md
  if (autoReviewPath) {
    fs.copyFileSync(autoReviewPath, path.join(outDir, "auto-review.md"));
  }

  // 6. screenshots/
  let shots = 0;
  if (fs.existsSync(screenshotsSrc)) {
    shots = copyTree(screenshotsSrc, path.join(outDir, "screenshots"));
  }

  info(`packet for ${id} written to ${path.relative(root, outDir).replace(/\\/g, "/")}`);
  info(`  ${log.entries.length} verification entries, ${shots} screenshot${shots === 1 ? "" : "s"}, auto-review ${autoReviewPath ? "included" : "absent"}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

function usage() {
  process.stderr.write(
    "Usage:\n  node evidence-packet.js generate <M-NNNN>\n"
  );
  process.exit(2);
}

function main() {
  const [, , verb, id] = process.argv;
  if (!verb) usage();
  switch (verb) {
    case "generate":
      if (!id) usage();
      cmdGenerate(id);
      break;
    default:
      usage();
  }
}

try {
  main();
} catch (err) {
  fail(err && err.message ? err.message : String(err));
}
