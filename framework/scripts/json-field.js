// json-field.js — print one field from a JSON document on stdin (M-0003).
//
// Replaces the inline `node -e` JSON extractors that no permission rule can
// match (M-0003 AC-4). Callers pipe a JSON producer (typically mission-cli)
// into this script instead of an anonymous one-liner:
//
//   node scripts/mission-cli.js show M-0042 | node scripts/json-field.js state
//
// Usage: node scripts/json-field.js <dot.path> [fallback] [--json]
//
//   <dot.path>  field to extract, dots descend (frontmatter.codex.last_verdict)
//   [fallback]  printed when the field is missing or null (default: nothing)
//   --json      print the value JSON-encoded instead of bare. Load-bearing for
//               strict-boolean gates: `enabled --json` prints `true` only for
//               boolean true; the string "true" prints as `"true"` and fails a
//               bash `= "true"` comparison (matches the `enabled === true`
//               contract in codex-config.js / apes-verify's bash gate).
//
// Output rules (without --json): strings/numbers/booleans print bare, arrays
// print comma-joined, objects print as compact JSON. Unparseable stdin exits 1
// with nothing on stdout, so `$(...)` callers see an empty (unset) value.

"use strict";

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const positional = argv.filter((a) => a !== "--json");
const fieldPath = positional[0];
const fallback = positional.length > 1 ? positional[1] : null;

if (!fieldPath) {
  console.error("usage: node scripts/json-field.js <dot.path> [fallback] [--json]");
  process.exit(1);
}

let raw = "";
process.stdin.on("data", (d) => (raw += d)).on("end", () => {
  let value;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    console.error(`json-field: unparseable JSON on stdin: ${err.message}`);
    process.exit(1);
  }
  for (const key of fieldPath.split(".")) {
    if (value === null || value === undefined) break;
    value = value[key];
  }
  if (value === null || value === undefined) {
    if (fallback !== null) console.log(fallback);
    return;
  }
  if (asJson) {
    console.log(JSON.stringify(value));
  } else if (Array.isArray(value)) {
    console.log(value.join(","));
  } else if (typeof value === "object") {
    console.log(JSON.stringify(value));
  } else {
    console.log(String(value));
  }
});
