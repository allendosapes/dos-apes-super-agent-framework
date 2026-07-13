// mission-next.js — print the id of the highest-priority unblocked mission
// in todo/, or nothing when none qualifies (M-0003).
//
// Replaces the inline `node -e` selection pipeline in /apes-build Step 1
// (M-0003 AC-4). Selection stays with mission-cli — list order (priority,
// created) and dependency resolution are its contract; this wrapper only
// walks the JSON it returns.
//
// Usage: node scripts/mission-next.js
//   stdout: the mission id, or nothing (empty) when todo/ has no unblocked
//   mission. Run from the project root (same cwd contract as mission-cli).

"use strict";

const { execFileSync } = require("child_process");

const list = JSON.parse(
  execFileSync("node", ["scripts/mission-cli.js", "list", "--state", "todo"], { encoding: "utf8" })
);
for (const m of list.missions) {
  const deps = JSON.parse(
    execFileSync("node", ["scripts/mission-cli.js", "deps", m.id], { encoding: "utf8" })
  );
  if (deps.unmet.length === 0) {
    console.log(m.id);
    break;
  }
}
