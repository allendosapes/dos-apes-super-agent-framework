// metrics-summary.js — render a session metrics JSON file as the
// /apes-metrics "Current Session" block (M-0003).
//
// Replaces the inline `cat | node -e` render in /apes-metrics (M-0003 AC-4).
// Takes the file path directly instead of stdin — no cat pipe needed.
//
// Usage: node scripts/metrics-summary.js <path-to-session-metrics.json>

"use strict";

const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/metrics-summary.js <metrics.json>");
  process.exit(1);
}

let m;
try {
  m = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (err) {
  console.error(`metrics-summary: cannot read ${file}: ${err.message}`);
  process.exit(1);
}

console.log("  Started:    " + m.session_start);
console.log("  Branch:     " + m.branch);
console.log("  Tasks Done: " + m.tasks_completed);
console.log("  Tasks Failed: " + m.tasks_failed);
console.log("  Files Modified: " + m.files_modified);
console.log("  Verifications: " + m.verification_runs);
console.log("  Review Issues: " + m.auto_review_issues);
