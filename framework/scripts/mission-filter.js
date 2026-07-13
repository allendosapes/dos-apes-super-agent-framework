// mission-filter.js — render `mission-cli list` JSON from stdin as one line
// per mission, optionally filtered by phase and/or label (M-0003).
//
// Replaces the inline `node -e` filter in /apes-mission `list --phase/--label`
// (M-0003 AC-4). The CLI owns ordering (priority, created, per state); this
// script only filters and formats.
//
// Usage: node scripts/mission-cli.js list | \
//          node scripts/mission-filter.js [--phase <phase>] [--label <label>]
//
// An empty-string flag value means "no filter" (callers pass shell variables
// unconditionally: --phase "$PHASE" --label "$LABEL").

"use strict";

const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length && argv[i + 1] !== "" ? argv[i + 1] : null;
}
const phase = flag("--phase");
const label = flag("--label");

let raw = "";
process.stdin.on("data", (d) => (raw += d)).on("end", () => {
  const all = JSON.parse(raw).missions;
  for (const state of ["doing", "review", "todo", "done", "canceled"]) {
    for (const m of (all[state] || [])) {
      if (phase && m.frontmatter.phase !== phase) continue;
      if (label && !(m.frontmatter.labels || []).includes(label)) continue;
      console.log(`${m.id}  ${state}  p${m.frontmatter.priority || 3}  ${m.title}`);
    }
  }
});
