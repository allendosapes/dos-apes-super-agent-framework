#!/usr/bin/env node
"use strict";
// Dogfooding shim (repo-only, never shipped — not in package.json `files`).
// The codex L8 scripts resolve their siblings at <project-root>/scripts/,
// which is the INSTALLED layout; this repo keeps the production scripts in
// framework/scripts/. Forward the invocation, preserving args, stdio, and
// exit code. Same shim body serves codex-review.js / codex-check.js /
// log-verification.js via basename dispatch. Full dogfooding alignment of
// this repo's layout is the P3 dogfooding mission's scope.
const { spawnSync } = require("child_process");
const path = require("path");
const res = spawnSync(
  process.execPath,
  [path.join(__dirname, "..", "framework", "scripts", path.basename(__filename)),
   ...process.argv.slice(2)],
  { stdio: "inherit" }
);
process.exit(res.status === null ? 1 : res.status);
