// mission-dashboard.js — render the /apes-status missions dashboard from
// `mission-cli list` JSON on stdin (M-0003).
//
// Replaces the inline `node -e` dashboard block in /apes-status (M-0003
// AC-4). The rendering logic is ported verbatim: four standard groupings
// (doing, review, todo top-5 with blocked-by markers, done-this-week), last
// workpad timestamps, evidence-packet presence, and the M-0005 codex block
// surface. No frontmatter parsing here — the CLI owns that.
//
// Usage: node scripts/mission-cli.js list | node scripts/mission-dashboard.js
//   Run from the project root (mission paths in the JSON are read from disk
//   for workpad timestamps and mtimes).

"use strict";

const fs = require("fs");

let buf = "";
process.stdin.on("data", (d) => (buf += d)).on("end", () => {
  const all = JSON.parse(buf).missions;

  function lastWorkpadTimestamp(body) {
    // Canonical: `### YYYY-MM-DD HH:MM`. Legacy: `... — <role>`. Anchored
    // at EOL so a stray `###` mid-line cannot match.
    const re = /^###\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?:\s+—\s+\S.*)?\s*$/gm;
    const ms = [...body.matchAll(re)];
    return ms.length ? ms[ms.length - 1][1] + " " + ms[ms.length - 1][2] : null;
  }
  function ageDays(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : Math.floor((Date.now() - d.getTime()) / 86400000);
  }
  // M-0005: surface the L8 codex block when present. mission-cli list
  // already returns full frontmatter, so no extra CLI call is needed.
  // Missions without a codex block render exactly as before.
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

  console.log("=== Missions ===");

  // DOING
  console.log("");
  console.log(`Doing (${all.doing.length}):`);
  if (all.doing.length === 0) {
    console.log("  (none in flight)");
  } else {
    for (const m of all.doing) {
      const fm = m.frontmatter;
      const branch = (fm.workspace && fm.workspace.branch) || `feat/${m.id.toLowerCase()}`;
      const fileText = fs.readFileSync(m.path, "utf8");
      const wp = lastWorkpadTimestamp(fileText) || "(no workpad entry yet)";
      const age = ageDays(fm.updated);
      const ageStr = age === null ? "" : ` · ${age}d in doing`;
      const cx = codexLine(fm);
      console.log(`  ${m.id} p${fm.priority || 3} — ${m.title}`);
      console.log(`    branch: ${branch} · last workpad: ${wp}${ageStr}`);
      if (cx) console.log(`    ${cx}`);
    }
  }

  // REVIEW
  console.log("");
  console.log(`Review (${all.review.length}):`);
  if (all.review.length === 0) {
    console.log("  (none awaiting review)");
  } else {
    for (const m of all.review) {
      const packet = `.planning/missions/review/${m.id}/evidence/summary.md`;
      const has = fs.existsSync(packet) ? "evidence packet ✓" : "evidence packet MISSING";
      const moved = fs.statSync(m.path).mtime.toISOString().slice(0, 10);
      const cx = codexLine(m.frontmatter);
      // Backward-compat flag from M-0004 — still set by /apes-build for
      // exhausted/no-progress terminals. Render it alongside the codex
      // verdict so reviewers see both signals.
      const unresolvedFlag = m.frontmatter.codex_findings_unresolved === true
        ? " · ⚠ codex_findings_unresolved"
        : "";
      console.log(`  ${m.id} p${m.frontmatter.priority || 3} — ${m.title}`);
      console.log(`    ${has} · moved to review: ${moved}${unresolvedFlag}`);
      if (cx) console.log(`    ${cx}`);
    }
  }

  // TODO (top 5) with blocked-by markers
  console.log("");
  const todoTop = all.todo.slice(0, 5);
  console.log(`Todo (${all.todo.length} total, showing top ${todoTop.length}):`);
  const doneIds = new Set(all.done.map(m => m.id));
  if (todoTop.length === 0) {
    console.log("  (none queued)");
  } else {
    for (const m of todoTop) {
      const deps = m.frontmatter.depends_on || [];
      const unmet = deps.filter(d => !doneIds.has(d));
      const tag = unmet.length ? `  blocked by ${unmet.join(", ")}` : "";
      console.log(`  ${m.id} p${m.frontmatter.priority || 3} — ${m.title}${tag}`);
    }
  }

  // DONE this week
  console.log("");
  const cutoff = Date.now() - 7 * 86400000;
  const recent = all.done.filter(m => fs.statSync(m.path).mtime.getTime() >= cutoff);
  console.log(`Done this week (${recent.length}):`);
  if (recent.length === 0) {
    console.log("  (none completed in the last 7 days)");
  } else {
    recent.sort((a, b) => fs.statSync(b.path).mtime - fs.statSync(a.path).mtime);
    console.log("  " + recent.map(m => m.id).join(", "));
  }
});
