#!/usr/bin/env node

// codex-review-loop.js — review-fix-review loop driver.
//
// Usage:
//   node scripts/codex-review-loop.js [--mission <id>] [--base <ref>]
//                                     [--max-iterations N] [--no-fix]
//
// Each iteration:
//   1. Invoke scripts/codex-review.js (capture findings).
//   2. Decide whether to terminate based on the result.
//   3. If continuing: write a feedback packet, spawn Claude Code to fix,
//      detect "no progress" by comparing HEAD before and after.
//
// Six terminal states (written to stdout as JSON and to
// .dos-apes/codex-reviews/result.json):
//   - accepted          clean review on iteration N
//   - partial-success   only low/medium findings, accepted as final
//   - findings-reported --no-fix was set; no fix attempted
//   - exhausted         hit iteration cap with unresolved high/critical
//   - no-progress       Claude Code couldn't make a fix
//   - skipped           Codex unavailable (config disabled, CLI missing, etc.)
//
// Exit codes:
//   0  loop terminated cleanly in one of the six states above
//   1  script error (config parse, codex-review.js failure, fs error, etc.)

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

// ─── Paths ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = process.cwd();
const DOS_APES_DIR = path.join(PROJECT_ROOT, ".dos-apes");
const CONFIG_PATH = path.join(DOS_APES_DIR, "codex-review-config.json");
const REVIEWS_DIR = path.join(DOS_APES_DIR, "codex-reviews");
const RESULT_PATH = path.join(REVIEWS_DIR, "result.json");
const REVIEW_SCRIPT = path.join(PROJECT_ROOT, "scripts", "codex-review.js");

const DEFAULT_CONFIG = {
  enabled: true,
  diff_base: "main",
  max_iterations: 3,
  loop_on_severity: ["high", "critical"],
};

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

// ─── CLI parsing ────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { mission: null, base: null, maxIterations: null, noFix: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--mission": out.mission = argv[++i]; break;
      case "--base": out.base = argv[++i]; break;
      case "--max-iterations": {
        const n = parseInt(argv[++i], 10);
        if (!Number.isFinite(n) || n < 1) {
          process.stderr.write(`codex-review-loop: --max-iterations must be a positive integer\n`);
          process.exit(1);
        }
        out.maxIterations = n;
        break;
      }
      case "--no-fix": out.noFix = true; break;
      case "--help":
      case "-h": out.help = true; break;
      default:
        process.stderr.write(`codex-review-loop: unknown argument '${a}'\n`);
        process.exit(1);
    }
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    "Usage: node scripts/codex-review-loop.js [--mission <id>] [--base <ref>]\n" +
    "                                          [--max-iterations N] [--no-fix]\n" +
    "\n" +
    "Runs the Codex review-fix-review loop. Reads .dos-apes/codex-review-config.json.\n" +
    "Skips silently when disabled.\n"
  );
}

// ─── Output helpers ─────────────────────────────────────────────────────────

function warn(msg) {
  process.stderr.write(`codex-review-loop: ${msg}\n`);
}

function writeResult(payload) {
  try {
    fs.mkdirSync(REVIEWS_DIR, { recursive: true });
    fs.writeFileSync(RESULT_PATH, JSON.stringify(payload, null, 2));
  } catch (err) {
    warn(`could not write result.json: ${err.message}`);
  }
}

function terminal(payload) {
  writeResult(payload);
  appendMissionWorkpad(payload);
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exit(0);
}

// ─── Config ─────────────────────────────────────────────────────────────────

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    if (parsed === null || typeof parsed !== "object") return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (err) {
    warn(`config parse failed: ${err.message} — using defaults`);
    return { ...DEFAULT_CONFIG };
  }
}

// ─── codex-review.js invocation ─────────────────────────────────────────────

function invokeReview({ base, mission, iteration }) {
  if (!fs.existsSync(REVIEW_SCRIPT)) {
    return { error: `scripts/codex-review.js not found at ${REVIEW_SCRIPT}` };
  }

  const iterDir = path.join(REVIEWS_DIR, `iteration-${iteration}`);
  fs.mkdirSync(iterDir, { recursive: true });
  const reviewPath = path.join(iterDir, "review.json");

  const args = [REVIEW_SCRIPT, "--out", reviewPath];
  if (base) args.push("--base", base);
  if (mission) args.push("--mission", mission);

  const res = spawnSync(process.execPath, args, {
    encoding: "utf8",
    cwd: PROJECT_ROOT,
  });

  if (res.error) {
    return { error: `failed to launch codex-review.js: ${res.error.message}` };
  }
  if (res.status !== 0) {
    return {
      error: `codex-review.js exited ${res.status}. stderr: ${(res.stderr || "").trim().slice(0, 500)}`,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse((res.stdout || "").trim());
  } catch (err) {
    return { error: `codex-review.js stdout is not JSON: ${err.message}` };
  }
  return { data: parsed, reviewPath };
}

// ─── Findings filter ────────────────────────────────────────────────────────

function filterBySeverity(findings, severities) {
  if (!Array.isArray(findings)) return [];
  const allowed = new Set((severities || []).map((s) => String(s).toLowerCase()));
  return findings.filter((f) => allowed.has(String(f.severity || "").toLowerCase()));
}

// ─── Feedback packet ────────────────────────────────────────────────────────

function writeFeedbackPacket({ iteration, review, filtered, base, mission }) {
  const iterDir = path.join(REVIEWS_DIR, `iteration-${iteration}`);
  fs.mkdirSync(iterDir, { recursive: true });
  const packetPath = path.join(iterDir, "feedback.json");

  const packet = {
    iteration,
    base,
    mission: mission || null,
    timestamp: new Date().toISOString(),
    verdict: review.verdict,
    confidence: review.confidence,
    summary: review.summary,
    findings_total: Array.isArray(review.findings) ? review.findings.length : 0,
    findings_eligible: filtered.length,
    findings: filtered,
  };

  // Default UTF-8 — Node never adds a BOM.
  fs.writeFileSync(packetPath, JSON.stringify(packet, null, 2));
  return packetPath;
}

// ─── Git helpers ────────────────────────────────────────────────────────────

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      cwd: PROJECT_ROOT,
    }).trim();
  } catch (_) {
    return null;
  }
}

// ─── Claude Code spawn (fix step) ───────────────────────────────────────────

// TODO[P5]: Verify Claude Code CLI invocation syntax before relying on this in
// production. The flag names evolve — confirm against `claude --help` and the
// docs at the time of implementation.
//
// Current best-effort shape (Claude Code 1.x):
//   claude -p "<prompt>"
//
// Skills are auto-loaded by description match, so the prompt names the skill
// and the packet path explicitly to maximize the chance of cross-model-review
// loading. If a future Claude Code release adds an explicit skill flag (e.g.
// `--skill cross-model-review`) or a structured input flag (e.g. `--input
// <path>`), prefer those over prompt-only orchestration.
//
// What needs to be verified before treating this as the final spawn call:
//   1. The exact non-interactive flag (`-p` vs `--print` vs something newer).
//   2. Whether skills can be loaded explicitly or rely on description match.
//   3. Whether allowed-tools is per-invocation (`--allowedTools <list>`) or
//      inherits from .claude/settings.json.
//   4. The exit-code contract for failed/blocked sessions.
//
// On any failure, this function returns { ok: false } and the loop terminates
// with `no-progress` (since HEAD won't have advanced).
function spawnClaudeFix({ packetPath, missionId, iteration, timeoutMs }) {
  const promptLines = [
    "Address the Codex review findings from a cross-model-review loop.",
    `Feedback packet (JSON): ${path.relative(PROJECT_ROOT, packetPath)}`,
    `Iteration: ${iteration}`,
    "Load and follow the cross-model-review skill — it specifies the triage protocol, fix protocol, and commit-message format. Do not over-correct on low-severity items.",
    missionId ? `Active mission: ${missionId}` : "No active mission — operate standalone.",
    "When done, exit. Do not start a new conversation.",
  ];
  const prompt = promptLines.join("\n");

  const result = spawnSync("claude", ["-p", prompt], {
    encoding: "utf8",
    cwd: PROJECT_ROOT,
    stdio: ["ignore", "inherit", "inherit"],
    timeout: timeoutMs,
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      warn("claude CLI not found on PATH — cannot run the fix step");
    } else if (result.error.code === "ETIMEDOUT" || result.signal === "SIGTERM") {
      warn(`claude CLI timed out after ${timeoutMs}ms`);
    } else {
      warn(`claude CLI failed to launch: ${result.error.message}`);
    }
    return { ok: false };
  }
  if (result.status !== 0) {
    warn(`claude CLI exited ${result.status}`);
    return { ok: false };
  }
  return { ok: true };
}

// ─── Mission workpad ────────────────────────────────────────────────────────

function findMissionFile(missionId) {
  const states = ["todo", "doing", "review", "done", "canceled"];
  const root = path.join(PROJECT_ROOT, ".planning", "missions");
  if (!fs.existsSync(root)) return null;

  for (const state of states) {
    const stateDir = path.join(root, state);
    if (!fs.existsSync(stateDir)) continue;
    let entries;
    try { entries = fs.readdirSync(stateDir); } catch (_) { continue; }
    const match = entries.find((f) =>
      f.endsWith(".md") && (
        f === `${missionId}.md` ||
        f.startsWith(`${missionId}-`) ||
        f.startsWith(`${missionId}_`)
      )
    );
    if (match) return path.join(stateDir, match);
  }
  return null;
}

function appendMissionWorkpad(payload) {
  if (!payload.mission) return;
  const file = findMissionFile(payload.mission);
  if (!file) return;

  let body;
  try { body = fs.readFileSync(file, "utf8"); }
  catch (err) { warn(`could not read mission ${payload.mission}: ${err.message}`); return; }

  if (!/^##\s+Workpad\b/m.test(body)) {
    // No workpad section — append one for backward compatibility, but warn.
    warn(`mission ${payload.mission} has no '## Workpad' section; appending one`);
    body = body.replace(/\s*$/, "") + "\n\n## Workpad\n";
  }

  const stamp = new Date().toISOString().replace(/:\d{2}\.\d{3}Z$/, "Z").replace("T", " ").replace("Z", " UTC");
  // Normalize to "YYYY-MM-DD HH:MM UTC" approximated; the missions skill
  // conventionally uses 24-hour UTC.
  const heading = `### ${stamp} — codex-loop`;

  const lines = [
    heading,
    `- L8 cross-model review terminal state: **${payload.state}** after ${payload.iteration || 0} iteration(s).`,
  ];
  if (payload.verdict) lines.push(`- Last verdict: ${payload.verdict} (confidence ${payload.confidence ?? "n/a"}).`);
  if (payload.summary) lines.push(`- Summary: ${payload.summary}`);
  if (Array.isArray(payload.open_findings) && payload.open_findings.length) {
    lines.push(`- Open findings (${payload.open_findings.length}):`);
    for (const f of payload.open_findings.slice(0, 10)) {
      lines.push(`  - ${f.severity} · ${f.file}:${f.line_range && f.line_range.start}: ${f.explanation}`);
    }
    if (payload.open_findings.length > 10) lines.push(`  - … (${payload.open_findings.length - 10} more)`);
  }
  if (payload.message) lines.push(`- ${payload.message}`);

  const entry = "\n" + lines.join("\n") + "\n";

  try {
    fs.appendFileSync(file, entry);
  } catch (err) {
    warn(`could not append workpad entry to ${file}: ${err.message}`);
  }
}

// ─── Sort findings ──────────────────────────────────────────────────────────

function sortFindings(findings) {
  return [...findings].sort((a, b) => {
    const sa = SEVERITY_RANK[String(a.severity || "low").toLowerCase()] ?? 99;
    const sb = SEVERITY_RANK[String(b.severity || "low").toLowerCase()] ?? 99;
    if (sa !== sb) return sa - sb;
    const fa = String(a.file || ""), fb = String(b.file || "");
    if (fa !== fb) return fa < fb ? -1 : 1;
    const la = (a.line_range && a.line_range.start) || 0;
    const lb = (b.line_range && b.line_range.start) || 0;
    return la - lb;
  });
}

// ─── Main loop ──────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); process.exit(0); }

  const config = readConfig();

  if (config.enabled === false) {
    return terminal({
      state: "skipped",
      iteration: 0,
      max_iterations: 0,
      mission: args.mission || null,
      message: "L8 disabled in .dos-apes/codex-review-config.json",
    });
  }

  const maxIterations = args.maxIterations || Number(config.max_iterations) || DEFAULT_CONFIG.max_iterations;
  const base = args.base || config.diff_base || DEFAULT_CONFIG.diff_base;
  const severities = Array.isArray(config.loop_on_severity) && config.loop_on_severity.length
    ? config.loop_on_severity
    : DEFAULT_CONFIG.loop_on_severity;

  // Per-iteration claude-fix timeout: half the per-call codex timeout's worth
  // by default. The fixer typically runs longer than the reviewer — give it
  // headroom but bound the loop's wall-clock.
  const fixTimeoutMs = Math.max(60_000, (Number(config.timeout_seconds) || 300) * 4 * 1000);

  const reviewPaths = [];
  let iteration = 0;

  while (true) {
    iteration += 1;

    const inv = invokeReview({ base, mission: args.mission, iteration });
    if (inv.error) {
      warn(inv.error);
      process.exit(1);
    }
    const review = inv.data;
    reviewPaths.push(inv.reviewPath);

    if (review.skipped === true) {
      return terminal({
        state: "skipped",
        iteration,
        max_iterations: maxIterations,
        mission: args.mission || null,
        message: review.reason || "Codex unavailable",
        reviews: reviewPaths,
      });
    }

    const allFindings = Array.isArray(review.findings) ? review.findings : [];

    if (review.verdict === "accept" || allFindings.length === 0) {
      return terminal({
        state: "accepted",
        iteration,
        max_iterations: maxIterations,
        mission: args.mission || null,
        verdict: review.verdict,
        confidence: review.confidence,
        summary: review.summary,
        findings_count: 0,
        message: `Reviewer accepted on iteration ${iteration}.`,
        reviews: reviewPaths,
      });
    }

    const filtered = sortFindings(filterBySeverity(allFindings, severities));

    if (filtered.length === 0) {
      return terminal({
        state: "partial-success",
        iteration,
        max_iterations: maxIterations,
        mission: args.mission || null,
        verdict: review.verdict,
        confidence: review.confidence,
        summary: review.summary,
        findings_count: allFindings.length,
        open_findings: allFindings, // all are non-loop severities; preserved for the workpad
        message: `${allFindings.length} low/medium finding(s) reported but none are loop-eligible.`,
        reviews: reviewPaths,
      });
    }

    if (args.noFix) {
      return terminal({
        state: "findings-reported",
        iteration,
        max_iterations: maxIterations,
        mission: args.mission || null,
        verdict: review.verdict,
        confidence: review.confidence,
        summary: review.summary,
        findings_count: filtered.length,
        open_findings: filtered,
        message: `--no-fix set; ${filtered.length} loop-eligible finding(s) reported, no fix attempted.`,
        reviews: reviewPaths,
      });
    }

    let packetPath;
    try {
      packetPath = writeFeedbackPacket({
        iteration,
        review,
        filtered,
        base,
        mission: args.mission,
      });
    } catch (err) {
      warn(`could not write feedback packet: ${err.message}`);
      process.exit(1);
    }

    if (iteration >= maxIterations) {
      return terminal({
        state: "exhausted",
        iteration,
        max_iterations: maxIterations,
        mission: args.mission || null,
        verdict: review.verdict,
        confidence: review.confidence,
        summary: review.summary,
        findings_count: filtered.length,
        open_findings: filtered,
        last_packet: packetPath,
        message: `Hit iteration cap (${maxIterations}) with ${filtered.length} loop-eligible finding(s) still open.`,
        reviews: reviewPaths,
      });
    }

    const headBefore = gitHead();
    const fix = spawnClaudeFix({
      packetPath,
      missionId: args.mission,
      iteration,
      timeoutMs: fixTimeoutMs,
    });
    const headAfter = gitHead();

    if (!fix.ok || headBefore == null || headAfter == null || headBefore === headAfter) {
      return terminal({
        state: "no-progress",
        iteration,
        max_iterations: maxIterations,
        mission: args.mission || null,
        verdict: review.verdict,
        confidence: review.confidence,
        summary: review.summary,
        findings_count: filtered.length,
        open_findings: filtered,
        last_packet: packetPath,
        message: !fix.ok
          ? "Claude Code fix step failed to launch or exited non-zero."
          : "No new commits detected after Claude Code fix step.",
        reviews: reviewPaths,
      });
    }

    // Continue to next iteration.
  }
}

try {
  main();
} catch (err) {
  warn(`fatal: ${err && err.message ? err.message : String(err)}`);
  process.exit(1);
}
