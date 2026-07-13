// codex-envelope.js — classify a codex-review.js result envelope from stdin
// (M-0003).
//
// Replaces the inline `node -e` envelope parser in /apes-verify's L8 step
// (M-0003 AC-4). Reads the script's stdout capture, parses the LAST line as
// the JSON envelope (earlier lines may be progress noise), and prints exactly
// one machine-readable state line:
//
//   skipped:<reason>   envelope has skipped:true (reason falls back to
//                      "unknown" — the M-0005 reason strings pass through)
//   verdict:<v>:<n>    verdict plus findings count
//   parse-error        last line is not a JSON envelope
//
// Never exits non-zero and never writes stderr: the caller's case statement
// treats every outcome, including parse-error, as non-blocking (L8 fails
// open).
//
// Usage: echo "$L8_OUT" | node scripts/codex-envelope.js

"use strict";

let raw = "";
process.stdin.on("data", (d) => (raw += d)).on("end", () => {
  try {
    const j = JSON.parse(raw.trim().split(/\r?\n/).pop());
    if (j.skipped) console.log("skipped:" + (j.reason || "unknown"));
    else console.log("verdict:" + j.verdict + ":" + (j.findings ? j.findings.length : 0));
  } catch (_) {
    console.log("parse-error");
  }
});
