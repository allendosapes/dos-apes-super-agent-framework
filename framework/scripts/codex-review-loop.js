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
// Six terminal states (written to stdout as JSON and — when .dos-apes/
// already exists — to .dos-apes/codex-reviews/result.json):
//   - accepted          clean review on iteration N
//   - partial-success   only low/medium findings, accepted as final
//   - findings-reported --no-fix was set; no fix attempted
//   - exhausted         hit iteration cap with unresolved high/critical
//   - no-progress       Claude Code couldn't make a fix
//   - skipped           L8 not opted in (config absent/unparseable/invalid/
//                       disabled — see codex-config.js) or Codex unavailable
//
// Exit codes:
//   0  loop terminated cleanly in one of the six states above
//   1  script error (config parse, codex-review.js failure, fs error, etc.)

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const { MissionTracker } = require("../lib/mission-tracker.js");
const { loadCodexConfig } = require("./codex-config.js");

// ─── Paths ──────────────────────────────────────────────────────────────────

function findProjectRoot() {
  // From inside a worktree, `git rev-parse --git-common-dir` points at the
  // main repo's .git/ directory; its parent is the canonical project root.
  try {
    const commonDir = execFileSync(
      "git", ["rev-parse", "--git-common-dir"],
      { encoding: "utf8", cwd: process.cwd() }
    ).trim();
    const abs = path.resolve(process.cwd(), commonDir);
    return path.dirname(abs);
  } catch {
    return process.cwd();
  }
}

const PROJECT_ROOT = findProjectRoot();
const DOS_APES_DIR = path.join(PROJECT_ROOT, ".dos-apes");
const CONFIG_PATH = path.join(DOS_APES_DIR, "codex-review-config.json");
const REVIEWS_DIR = path.join(DOS_APES_DIR, "codex-reviews");
const RESULT_PATH = path.join(REVIEWS_DIR, "result.json");
const REVIEW_SCRIPT = path.join(PROJECT_ROOT, "scripts", "codex-review.js");

// No `enabled` key here by design (M-0005): enablement comes only from a
// strict enabled === true on the parsed config — see codex-config.js.
const DEFAULT_CONFIG = {
  diff_base: "main",
  max_iterations: 3,
  loop_on_severity: ["high", "critical"],
};

// Skip messages keyed by codex-config.js disabled-reasons. Each names the
// config state so a codex.required RequiredSkipError surfaces the real cause
// (a config problem, not a Codex outage).
const SKIP_MESSAGE_BY_REASON = {
  "config-absent":
    ".dos-apes/codex-review-config.json absent — L8 is opt-in and off by default (config-absent)",
  "config-unparseable":
    ".dos-apes/codex-review-config.json is not parseable JSON — L8 stays disabled (config-unparseable)",
  "config-invalid":
    ".dos-apes/codex-review-config.json is not a JSON object — L8 stays disabled (config-invalid)",
  "disabled":
    "L8 disabled in .dos-apes/codex-review-config.json",
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
  // Never create .dos-apes/ as a side effect of a terminal write (M-0005):
  // a config-absent skip must not create the directory whose absence caused
  // it. When .dos-apes/ exists, creating codex-reviews/ inside it is fine.
  if (!fs.existsSync(DOS_APES_DIR)) return;
  try {
    fs.mkdirSync(REVIEWS_DIR, { recursive: true });
    fs.writeFileSync(RESULT_PATH, JSON.stringify(payload, null, 2));
  } catch (err) {
    warn(`could not write result.json: ${err.message}`);
  }
}

function terminal(payload) {
  writeResult(payload);
  try {
    recordTerminalSideEffects(payload);
  } catch (err) {
    if (err && err.code === "REQUIRED_SKIP") {
      warn(err.message);
      // Still emit the stdout JSON so callers parsing it see the state, then
      // exit non-zero to signal the gate failure.
      process.stdout.write(JSON.stringify(payload) + "\n");
      process.exit(1);
    }
    throw err;
  }
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exit(0);
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

// ─── Terminal-state side effects ───────────────────────────────────────────
//
// On every terminal state, the loop persists state in two places:
//
//   1. The mission's `codex` frontmatter block (last_verdict,
//      last_review_path, unresolved_findings, last_run_at) via
//      MissionTracker.setCodexState.
//   2. The mission's Workpad section, but ONLY for states where a human
//      reader benefits from seeing it — see workpadEntryForTerminal.
//
// Mission state (todo/doing/review/done/canceled) is intentionally NOT
// touched here. The build flow decides lifecycle transitions; the loop only
// produces verdicts and packets. This separation is what makes
// /apes-codex-review usable in standalone mode.
//
// All persistence routes through MissionTracker — no direct file writes.
// All updates are best-effort: a tracker failure logs a warning but never
// kills the loop. The single hard exception is `codex.required: true`,
// which makes a `skipped` terminal an error.

function makeTracker(opts = {}) {
  if (opts.tracker) return opts.tracker;
  const root = opts.projectRoot || PROJECT_ROOT;
  const missionsRoot = path.join(root, ".planning", "missions");
  if (!fs.existsSync(missionsRoot)) return null;
  return new MissionTracker({ root: missionsRoot });
}

function relativizeReviewPath(p, projectRoot) {
  if (!p) return null;
  const root = projectRoot || PROJECT_ROOT;
  return path.relative(root, p).split(path.sep).join("/");
}

function finalReviewPath(payload, projectRoot) {
  if (!Array.isArray(payload.reviews) || payload.reviews.length === 0) return null;
  return relativizeReviewPath(payload.reviews[payload.reviews.length - 1], projectRoot);
}

// Map a terminal payload onto the partial codex block to merge. Returns
// null when the state warrants no update (currently never — every terminal
// at least bumps last_verdict and last_run_at). Per the playbook table:
//
//   accepted          last_verdict=accepted,           unresolved_findings=0
//   partial-success   last_verdict=partial-success,    unresolved_findings=count of low/medium
//   findings-reported last_verdict=findings-reported,  unresolved_findings=count of filtered
//   exhausted         last_verdict=exhausted,          unresolved_findings=count of filtered
//   no-progress       last_verdict=no-progress,        unresolved_findings=count of filtered
//   skipped           last_verdict=skipped             (no review ran — preserve prior count)

function codexBlockUpdateForTerminal(payload, opts = {}) {
  const update = {
    last_verdict: payload.state,
    last_run_at: new Date().toISOString(),
  };

  if (payload.state === "skipped") {
    // No review ran. Preserve prior unresolved_findings / last_review_path
    // by not including them in the partial update (setCodexState merges
    // shallowly, so unspecified keys retain their previous value).
    return update;
  }

  const finalReview = finalReviewPath(payload, opts.projectRoot);
  if (finalReview) update.last_review_path = finalReview;

  switch (payload.state) {
    case "accepted":
      update.unresolved_findings = 0;
      break;
    case "partial-success":
      // partial-success terminates with NO loop-eligible findings; payload
      // .findings_count carries the total reported count, all low/medium.
      update.unresolved_findings = Number(payload.findings_count) || 0;
      break;
    case "findings-reported":
    case "exhausted":
    case "no-progress":
      update.unresolved_findings = Number(payload.findings_count) || 0;
      break;
    default:
      // Defensive: if a new state is introduced upstream without updating
      // this switch, fall back to whatever the payload reports.
      update.unresolved_findings = Number(payload.findings_count) || 0;
  }
  return update;
}

// Render the workpad note body for a terminal payload, or return null when
// no entry should be written. Per the playbook table:
//
//   accepted          → no entry (clean accept doesn't merit a note)
//   partial-success   → summary of low/medium findings
//   findings-reported → no entry (--no-fix; user wanted findings only)
//   exhausted         → list unresolved findings + path to final review
//   no-progress       → note about no progress + path to final review
//   skipped           → no entry (skip is not an interesting event)
//
// The returned string is the note BODY only — MissionTracker
// .appendWorkpadEntry adds the canonical `### YYYY-MM-DD HH:MM` heading
// (M-0002 format).

function workpadEntryForTerminal(payload, opts = {}) {
  switch (payload.state) {
    case "accepted":
    case "findings-reported":
    case "skipped":
      return null;

    case "partial-success": {
      const findings = Array.isArray(payload.open_findings) ? payload.open_findings : [];
      const lines = [
        `**codex-loop** — partial-success after ${payload.iteration || 0} iteration(s).`,
        `${findings.length} low/medium finding(s) reported (none loop-eligible):`,
      ];
      appendFindingLines(lines, findings);
      return lines.join("\n");
    }

    case "exhausted": {
      const findings = Array.isArray(payload.open_findings) ? payload.open_findings : [];
      const finalReview = finalReviewPath(payload, opts.projectRoot) || "(none)";
      const lines = [
        `**codex-loop** — exhausted after ${payload.iteration || 0} iteration(s) (cap=${payload.max_iterations}).`,
        `${findings.length} loop-eligible finding(s) remain unresolved:`,
      ];
      appendFindingLines(lines, findings);
      lines.push(`Final review: ${finalReview}`);
      return lines.join("\n");
    }

    case "no-progress": {
      const findings = Array.isArray(payload.open_findings) ? payload.open_findings : [];
      const finalReview = finalReviewPath(payload, opts.projectRoot) || "(none)";
      const lines = [
        `**codex-loop** — no-progress on iteration ${payload.iteration || 0}: the fix step did not advance HEAD.`,
      ];
      if (payload.message) lines.push(payload.message);
      lines.push(`${findings.length} loop-eligible finding(s) remain.`);
      lines.push(`Final review: ${finalReview}`);
      return lines.join("\n");
    }

    default:
      return null;
  }
}

function appendFindingLines(lines, findings) {
  for (const f of findings.slice(0, 10)) {
    const start = (f && f.line_range && f.line_range.start) || "?";
    const sev = (f && f.severity) || "?";
    const file = (f && f.file) || "?";
    const note = (f && f.explanation) || "";
    lines.push(`- ${sev} · ${file}:${start}: ${note}`);
  }
  if (findings.length > 10) {
    lines.push(`- … (${findings.length - 10} more)`);
  }
}

// codex.required: true forbids the loop from terminating with skipped.
// Throws RequiredSkipError so terminal() can decide what to do (CLI exits
// non-zero; tests assert on the throw).

class RequiredSkipError extends Error {
  constructor(missionId, reason) {
    super(
      `mission ${missionId} has codex.required: true — refusing to terminate with state 'skipped' ` +
      `(reason: ${reason || "unspecified"}) — enable L8 or remove codex.required`
    );
    this.name = "RequiredSkipError";
    this.code = "REQUIRED_SKIP";
    this.missionId = missionId;
    this.reason = reason;
  }
}

function preventRequiredSkip(payload, opts = {}) {
  if (payload.state !== "skipped" || !payload.mission) return;
  const tracker = makeTracker(opts);
  if (!tracker) return;
  let codex;
  try { codex = tracker.getCodexState(payload.mission); }
  catch (_) { return; }
  if (codex && codex.required === true) {
    throw new RequiredSkipError(payload.mission, payload.message);
  }
}

// Best-effort codex block update. Logs a warning on failure; never throws.
function recordCodexState(payload, opts = {}) {
  if (!payload.mission) return;
  const tracker = makeTracker(opts);
  if (!tracker) return;
  const update = codexBlockUpdateForTerminal(payload, opts);
  if (!update) return;
  try {
    tracker.setCodexState(payload.mission, update);
  } catch (err) {
    warn(`codex block update skipped: ${err && err.message ? err.message : err}`);
  }
}

// Best-effort workpad append, only for states that warrant an entry.
function appendMissionWorkpad(payload, opts = {}) {
  if (!payload.mission) return;
  const note = workpadEntryForTerminal(payload, opts);
  if (note === null) return;
  const tracker = makeTracker(opts);
  if (!tracker) return;
  let mission;
  try { mission = tracker.findMissionById(payload.mission); }
  catch (err) {
    warn(`mission lookup failed for ${payload.mission}: ${err.message}`);
    return;
  }
  if (!mission) return;
  try {
    tracker.appendWorkpadEntry(payload.mission, note);
  } catch (err) {
    warn(`could not append workpad entry to ${mission.path}: ${err && err.message ? err.message : err}`);
  }
}

// Composite — order matters: required-skip is the only guard that aborts;
// codex-block and workpad updates are independent best-effort writes.
function recordTerminalSideEffects(payload, opts = {}) {
  preventRequiredSkip(payload, opts);
  recordCodexState(payload, opts);
  appendMissionWorkpad(payload, opts);
}

// Per-iteration last_run_at bump on the codex block. Best-effort: a missing
// mission, missing tracker, or schema mismatch logs a warning and continues.
function bumpLastRunAt(missionId, opts = {}) {
  if (!missionId) return;
  const tracker = makeTracker(opts);
  if (!tracker) return;
  try {
    tracker.setCodexState(missionId, { last_run_at: new Date().toISOString() });
  } catch (err) {
    warn(`codex last_run_at update skipped: ${err && err.message ? err.message : err}`);
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

  // Opt-in gate — must stay ahead of the invokeReview call below.
  const { enabled, reason, config } = loadCodexConfig({
    configPath: CONFIG_PATH,
    defaults: DEFAULT_CONFIG,
    warn,
  });

  if (!enabled) {
    return terminal({
      state: "skipped",
      iteration: 0,
      max_iterations: 0,
      mission: args.mission || null,
      message: SKIP_MESSAGE_BY_REASON[reason] || `L8 not enabled (${reason})`,
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

    // Bump last_run_at on the codex block at iteration start so the mission
    // file reflects activity even if the iteration ends in failure mode.
    bumpLastRunAt(args.mission);

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

// Exposed for tests. Production CLI invocation lives behind require.main.
module.exports = {
  // Pure helpers — no I/O.
  codexBlockUpdateForTerminal,
  workpadEntryForTerminal,
  finalReviewPath,
  relativizeReviewPath,
  // Side-effect orchestration — accept opts.tracker / opts.projectRoot.
  recordTerminalSideEffects,
  recordCodexState,
  appendMissionWorkpad,
  preventRequiredSkip,
  bumpLastRunAt,
  // Error class for the required-skip gate.
  RequiredSkipError,
};

if (require.main === module) {
  try {
    main();
  } catch (err) {
    warn(`fatal: ${err && err.message ? err.message : String(err)}`);
    process.exit(1);
  }
}
