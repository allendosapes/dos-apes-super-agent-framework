// codex-config.js — shared config loader for the L8 review scripts (M-0005).
//
// L8 is opt-in and off by default (README "Cross-Model Review (L8)" contract;
// apes-verify's bash gate). Absence of config is never consent: every state
// other than a parsed plain-object config carrying a strict `enabled: true`
// resolves to disabled, with a machine-readable reason:
//
//   config-absent       file missing                                (silent)
//   config-unparseable  JSON.parse failed (bad JSON, BOM)           (warns)
//   config-invalid      parsed but not a plain object — arrays too  (warns)
//   disabled            plain object without enabled === true       (silent)
//
// Consumers: codex-review.js and codex-review-loop.js. codex-check.js keeps
// its own deliberately tolerant reader (it only extracts `model` and must not
// fail because the user typo'd JSON).

"use strict";

const fs = require("fs");

// Load the L8 config and decide enablement.
//
//   configPath  absolute path to .dos-apes/codex-review-config.json
//   defaults    per-script defaults for non-enablement fields. Must NOT
//               contain an `enabled` key — enablement comes only from a
//               strict `enabled === true` on the parsed file, matching
//               apes-verify's bash gate.
//   warn        the caller's stderr warning helper (carries the script's
//               own "codex-review:" / "codex-review-loop:" prefix)
//
// Returns { enabled, reason, config }: `reason` is one of the four states
// above when disabled, null when enabled; `config` is defaults merged with
// the parsed object (pure defaults in the three defective states).
function loadCodexConfig({ configPath, defaults, warn }) {
  const base = { ...defaults };

  if (!fs.existsSync(configPath)) {
    return { enabled: false, reason: "config-absent", config: base };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    warn(`config parse failed: ${err.message} — L8 stays disabled (config-unparseable)`);
    return { enabled: false, reason: "config-unparseable", config: base };
  }

  // typeof [] === "object", so the Array check is load-bearing: a JSON array
  // must not spread-merge into defaults and silently pass as a valid config.
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    warn("config is not a JSON object — L8 stays disabled (config-invalid)");
    return { enabled: false, reason: "config-invalid", config: base };
  }

  const config = { ...base, ...parsed };

  if (parsed.enabled !== true) {
    return { enabled: false, reason: "disabled", config };
  }

  return { enabled: true, reason: null, config };
}

module.exports = { loadCodexConfig };
