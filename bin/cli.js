#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const FRAMEWORK_DIR = path.join(__dirname, "..", "framework");
const VERSION = "2.0.0-beta.9";

// ─── ANSI Colors ────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  white: "\x1b[37m",
};

function print(msg, color = "") {
  console.log(`${color}${msg}${c.reset}`);
}

function printStep(label, detail) {
  console.log(`  ${c.green}✓${c.reset} ${c.bold}${label}${c.reset} ${c.dim}${detail}${c.reset}`);
}

function printSkip(label, detail) {
  console.log(`  ${c.yellow}→${c.reset} ${c.dim}${label} ${detail}${c.reset}`);
}

function printWarn(msg) {
  console.log(`  ${c.yellow}⚠${c.reset} ${msg}`);
}

// ─── Banner ─────────────────────────────────────────────────────────────────

function printBanner() {
  // Read external banner file if available, otherwise use inline
  const bannerPath = path.join(__dirname, "..", "assets", "banner.txt");
  if (fs.existsSync(bannerPath)) {
    const banner = fs.readFileSync(bannerPath, "utf8");
    console.log(`${c.cyan}${banner}${c.reset}`);
  } else {
    console.log(`
${c.cyan}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           🦍🦍  Dos Apes Super Agent Framework  🦍🦍          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${c.reset}`);
  }

  console.log(`${c.bold}              Dos Apes Super Agent Framework v${VERSION}${c.reset}`);
  console.log(`${c.cyan}                  "We ain't monkeying around with code!"${c.reset}`);
  console.log();
  console.log(`${c.dim}  Built on Claude Code Agent Teams + Tasks API${c.reset}`);
  console.log(`${c.dim}  Skills-based architecture · 8-level verification · Automated quality gates${c.reset}`);
  console.log();
}

// ─── Prompt Helper ──────────────────────────────────────────────────────────

function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function ask(question, defaultValue = "") {
  const rl = createPrompt();
  const suffix = defaultValue ? ` ${c.dim}(${defaultValue})${c.reset}` : "";
  return new Promise((resolve) => {
    rl.question(`${c.white}  ${question}${suffix}: ${c.reset}`, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function askChoice(question, options) {
  console.log(`\n${c.bold}  ${question}${c.reset}`);
  options.forEach((opt, i) => {
    console.log(`    ${c.cyan}${i + 1}.${c.reset} ${opt.label}${opt.desc ? c.dim + " — " + opt.desc + c.reset : ""}`);
  });
  console.log();

  const rl = createPrompt();
  return new Promise((resolve) => {
    rl.question(`${c.white}  Choose (1-${options.length}): ${c.reset}`, (answer) => {
      rl.close();
      const idx = parseInt(answer, 10) - 1;
      if (idx >= 0 && idx < options.length) {
        resolve(options[idx].value);
      } else {
        resolve(options[0].value); // default to first
      }
    });
  });
}

async function askMultiChoice(question, options) {
  console.log(`\n${c.bold}  ${question}${c.reset}`);
  options.forEach((opt, i) => {
    console.log(`    ${c.cyan}${i + 1}.${c.reset} ${opt.label}${opt.desc ? c.dim + " — " + opt.desc + c.reset : ""}`);
  });
  console.log();

  const rl = createPrompt();
  return new Promise((resolve) => {
    rl.question(`${c.white}  Choose (comma-separated, e.g. 1,3): ${c.reset}`, (answer) => {
      rl.close();
      const indices = answer.split(",").map(s => parseInt(s.trim(), 10) - 1);
      const selected = indices
        .filter(i => i >= 0 && i < options.length)
        .map(i => options[i].value);
      resolve(selected.length > 0 ? selected : [options[0].value]);
    });
  });
}

// ─── File Operations ────────────────────────────────────────────────────────

function copyDir(src, dest, label) {
  if (!fs.existsSync(src)) {
    printWarn(`Source not found: ${src}`);
    return 0;
  }

  let count = 0;

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyDir(srcPath, destPath, label);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;

      // Make shell scripts executable on Unix
      if (entry.name.endsWith(".sh")) {
        try {
          fs.chmodSync(destPath, "755");
        } catch (_) {
          // Windows doesn't support chmod
        }
      }
    }
  }

  return count;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
}

// ─── CLAUDE.md Generator ────────────────────────────────────────────────────

function generateClaudeMd(config) {
  const {
    projectName,
    description,
    projectType,
    frontend,
    backend,
    database,
    styling,
    testing,
    deployment,
    packageManager,
    productDescription,
    deployTarget,
    testingStrategy,
  } = config;

  const techStackLines = [];
  if (frontend) techStackLines.push(`- **Frontend:** ${frontend}`);
  if (backend) techStackLines.push(`- **Backend:** ${backend}`);
  if (database) techStackLines.push(`- **Database:** ${database}`);
  if (styling) techStackLines.push(`- **Styling:** ${styling}`);
  if (testing) techStackLines.push(`- **Testing:** ${testing}`);
  if (deployment) techStackLines.push(`- **Deployment:** ${deployment}`);

  // Deploy target label mapping
  const deployTargetLabels = {
    vercel: "Vercel",
    railway: "Railway",
    gcp: "Google Cloud (GCP)",
    aws: "AWS",
    azure: "Azure",
    "github-pages": "GitHub Pages (static)",
    docker: "Docker / self-hosted",
    undecided: "Not decided yet",
  };

  // Testing strategy label mapping
  const testingStrategyLabels = {
    localhost: "Local dev server (localhost)",
    preview: "Preview deployments (Vercel/Netlify previews)",
    staging: "Cloud staging environment",
    "ci-only": "CI-only (no manual testing)",
  };

  const deploySection = deployTarget
    ? `## Deployment\n\n- **Target:** ${deployTargetLabels[deployTarget] || deployTarget}`
    : "";

  let testSection = "";
  if (testingStrategy && testingStrategy.length > 0) {
    const strategyLines = testingStrategy.map(s => `- ${testingStrategyLabels[s] || s}`).join("\n");
    testSection = `## Testing Strategy\n\n${strategyLines}`;
    const hasBrowserEnv = testingStrategy.some(s => ["localhost", "preview", "staging"].includes(s));
    if (!hasBrowserEnv) {
      testSection += `\n\n> **Note:** No browser testing environment selected. L6 (E2E/Browser) and L7 (Visual Regression) verification levels are deferred until a test environment is configured.`;
    }
  }

  const pm = packageManager || "npm";
  const run = pm === "yarn" ? "yarn" : pm === "pnpm" ? "pnpm" : pm === "bun" ? "bun" : "npm run";

  let claudeMd = `# ${projectName || "Project"}

> This file is read by Claude at the start of every session. Keep it under 2000 tokens.

## Overview

${description || "[Describe what this project is and its current state]"}

## Tech Stack

${techStackLines.length > 0 ? techStackLines.join("\n") : "- **TBD** — Run /apes-build with a PRD to set up tech stack"}

${deploySection}

${testSection}

## Commands

\`\`\`bash
${run} dev          # Start dev server
${run} build        # Production build
${run} test         # Run tests
${run} lint         # Lint
${run} typecheck    # TypeScript check
\`\`\`

## Dos Apes Commands

\`\`\`bash
# Build
/apes-build          # Full autonomous build from PRD
/apes-feature        # Add feature to existing codebase
/apes-fix            # Test-first bug fix
/apes-refactor       # Behavior-preserving refactor

# Quality
/apes-verify         # 8-level verification pyramid
/apes-review         # Code review with security audit
/apes-test-e2e       # Generate and run E2E tests
/apes-test-visual    # Visual regression testing
/apes-test-a11y      # Accessibility audit
/apes-security-scan  # Full security pipeline

# Info
/apes-status         # Progress and git state
/apes-metrics        # Session and project metrics
/apes-map            # Analyze existing codebase
/apes-help           # All commands
\`\`\`

## Conventions

- TypeScript strict mode · No \`any\`
- Functional components · Named exports
- Co-located tests: \`Component.tsx\` + \`Component.test.tsx\`
- Git: \`feat/\`, \`fix/\`, \`refactor/\` branches · Conventional commits · Squash merge

## Model Guidance

- Solo work / simple tasks: Lead handles directly
- Complex implementation: Spawn builder teammate
- Use teams for parallelizable work only

## Key Decisions

_Add architecture decisions here as the project evolves._

## Known Issues

_Track recurring issues here. Remove when resolved._

---

_Managed by [Dos Apes Super Agent Framework v${VERSION}](https://github.com/allendosapes/dos-apes-super-agent-framework)_
`;

  return claudeMd;
}

// ─── Windows Hook Patching ──────────────────────────────────────────────────

/**
 * On Windows, the bare `bash` command often resolves to WSL's bash, which may
 * be broken or misconfigured. This rewrites hook commands to use
 * `scripts/run-hook.cmd` — a wrapper that finds Git Bash explicitly.
 */
function patchHooksForWindows(settings) {
  if (!settings.hooks) return;

  for (const hookGroups of Object.values(settings.hooks)) {
    if (!Array.isArray(hookGroups)) continue;
    for (const group of hookGroups) {
      if (!group.hooks || !Array.isArray(group.hooks)) continue;
      for (const hook of group.hooks) {
        if (hook.type !== "command" || typeof hook.command !== "string") continue;
        if (hook.command.includes("run-hook.cmd")) continue;

        const cmd = hook.command;
        // Script-file invocation: bash scripts/foo.sh [args]
        const scriptMatch = cmd.match(/^bash\s+(scripts\/[\w.-]+\.sh(?:\s+.*)?)$/);
        if (scriptMatch) {
          hook.command = `scripts\\run-hook.cmd ${scriptMatch[1]}`;
        } else {
          // Inline command: wrap with -c for Git Bash evaluation
          const escaped = cmd.replace(/"/g, '\\"');
          hook.command = `scripts\\run-hook.cmd -c "${escaped}"`;
        }
      }
    }
  }
}

// ─── Settings.json Customizer ───────────────────────────────────────────────

function customizeSettings(config) {
  const settingsPath = path.join(FRAMEWORK_DIR, "settings.json");

  if (!fs.existsSync(settingsPath)) {
    printWarn("settings.json template not found — using defaults");
    return JSON.stringify({ permissions: {}, hooks: {} }, null, 2);
  }

  let settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));

  // Remove v1 artifacts if present
  delete settings.contextFiles;
  delete settings._comment;

  // Windows: route hook commands through Git Bash wrapper
  if (process.platform === "win32") {
    patchHooksForWindows(settings);
  }

  // Add cloud CLI permissions based on deploy target
  if (config.deployTarget === "gcp") {
    settings.permissions.allow.push("Bash(gcloud *)");
  } else if (config.deployTarget === "aws") {
    settings.permissions.allow.push("Bash(aws *)");
  } else if (config.deployTarget === "azure") {
    settings.permissions.allow.push("Bash(az *)");
  }

  return JSON.stringify(settings, null, 2);
}

// ─── Main Install Flow ──────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // ── Parse flags ──
  const flags = {
    global: args.includes("--global") || args.includes("-g"),
    local: args.includes("--local") || args.includes("-l"),
    greenfield: args.includes("--greenfield"),
    brownfield: args.includes("--brownfield"),
    yes: args.includes("--yes") || args.includes("-y"),
    help: args.includes("--help") || args.includes("-h"),
    version: args.includes("--version") || args.includes("-v"),
    noHooks: args.includes("--no-hooks"),
    noCi: args.includes("--no-ci"),
  };

  // ── Version ──
  if (flags.version) {
    console.log(`dos-apes v${VERSION}`);
    process.exit(0);
  }

  // ── Help ──
  if (flags.help) {
    console.log(`
${c.bold}dos-apes v${VERSION}${c.reset} — Multi-agent framework for Claude Code

${c.bold}Usage:${c.reset}
  npx dos-apes-super-agent              Interactive setup
  npx dos-apes-super-agent --local      Install to ./.claude/ (this project)
  npx dos-apes-super-agent --global     Install to ~/.claude/ (all projects)

${c.bold}Flags:${c.reset}
  --greenfield      New project (skip prompt)
  --brownfield      Existing project (skip prompt)
  --yes, -y         Accept all defaults
  --no-hooks        Skip hook scripts installation
  --no-ci           Skip CI workflow templates
  --version, -v     Print version
  --help, -h        Show this help

${c.bold}What gets installed:${c.reset}
  .claude/
  ├── commands/        13 slash commands (build, test, review, etc.)
  ├── skills/          7 domain skills (architecture, testing, security, etc.)
  └── settings.json    Permissions, hooks, MCP servers

  scripts/             10 hook scripts (quality gates, metrics, etc.)
  .planning/           Project state directory
  CLAUDE.md            Project brain (customized for your stack)
  docs/templates/      PRD and ADR templates

${c.bold}Optional:${c.reset}
  .github/workflows/   CI templates (weekly quality, dep audit, post-merge)
`);
    process.exit(0);
  }

  // ── Banner ──
  printBanner();

  // ── Install Location ──
  let installBase; // The project root
  let claudeDir;   // .claude/ directory

  if (flags.global) {
    const home = process.env.HOME || process.env.USERPROFILE;
    claudeDir = path.join(home, ".claude");
    installBase = home;
    print(`  Installing globally to ${claudeDir}`, c.blue);
  } else if (flags.local) {
    claudeDir = path.join(process.cwd(), ".claude");
    installBase = process.cwd();
    print(`  Installing locally to ${claudeDir}`, c.blue);
  } else {
    const location = await askChoice("Where should the framework be installed?", [
      { value: "local", label: "This project", desc: "./.claude/ — recommended" },
      { value: "global", label: "Global", desc: "~/.claude/ — available everywhere" },
    ]);

    if (location === "global") {
      const home = process.env.HOME || process.env.USERPROFILE;
      claudeDir = path.join(home, ".claude");
      installBase = home;
    } else {
      claudeDir = path.join(process.cwd(), ".claude");
      installBase = process.cwd();
    }
  }

  // ── Project Type ──
  let projectType;

  if (flags.greenfield) {
    projectType = "greenfield";
  } else if (flags.brownfield) {
    projectType = "brownfield";
  } else {
    projectType = await askChoice("What type of project?", [
      { value: "greenfield", label: "Greenfield", desc: "New project from PRD" },
      { value: "brownfield", label: "Brownfield", desc: "Existing codebase" },
    ]);
  }

  // ── Tech Stack (for CLAUDE.md generation) ──
  let config = {
    projectName: "",
    description: "",
    projectType,
    frontend: "",
    backend: "",
    database: "",
    styling: "",
    testing: "",
    deployment: "",
    packageManager: "npm",
    productDescription: "",
    deployTarget: "",
    testingStrategy: [],
  };

  if (!flags.yes) {
    console.log(`\n${c.bold}  Project details ${c.dim}(press Enter to skip)${c.reset}\n`);

    config.projectName = await ask("Project name", path.basename(process.cwd()));

    if (projectType === "brownfield") {
      config.description = await ask("Brief description");

      console.log(`${c.dim}  Example: A B2B SaaS platform for managing restaurant inventory with real-time supplier integration${c.reset}`);
      config.productDescription = await ask(
        "Describe your product in 1-2 sentences",
        "A web application"
      );

      // Detect package manager
      if (fs.existsSync(path.join(process.cwd(), "bun.lockb"))) {
        config.packageManager = "bun";
      } else if (fs.existsSync(path.join(process.cwd(), "pnpm-lock.yaml"))) {
        config.packageManager = "pnpm";
      } else if (fs.existsSync(path.join(process.cwd(), "yarn.lock"))) {
        config.packageManager = "yarn";
      }
    } else {
      config.description = await ask("What are you building?");

      console.log(`${c.dim}  Example: A B2B SaaS platform for managing restaurant inventory with real-time supplier integration${c.reset}`);
      config.productDescription = await ask(
        "Describe your product in 1-2 sentences",
        "A web application"
      );

      const stack = await askChoice("Tech stack preset?", [
        { value: "react-node", label: "React + Node.js", desc: "TypeScript, Tailwind, Vitest, PostgreSQL" },
        { value: "next", label: "Next.js fullstack", desc: "TypeScript, Tailwind, Vitest, PostgreSQL" },
        { value: "react-python", label: "React + Python", desc: "TypeScript, FastAPI, pytest" },
        { value: "custom", label: "Custom", desc: "I'll configure manually" },
      ]);

      switch (stack) {
        case "react-node":
          config.frontend = "React 18 + TypeScript + Vite";
          config.backend = "Node.js + Express + TypeScript";
          config.database = "PostgreSQL with Prisma";
          config.styling = "Tailwind CSS";
          config.testing = "Vitest + React Testing Library + Playwright";
          break;
        case "next":
          config.frontend = "Next.js 15 + TypeScript";
          config.backend = "Next.js API Routes";
          config.database = "PostgreSQL with Prisma";
          config.styling = "Tailwind CSS";
          config.testing = "Vitest + React Testing Library + Playwright";
          break;
        case "react-python":
          config.frontend = "React 18 + TypeScript + Vite";
          config.backend = "Python + FastAPI";
          config.database = "PostgreSQL with SQLAlchemy";
          config.styling = "Tailwind CSS";
          config.testing = "Vitest + pytest + Playwright";
          break;
        case "custom":
          config.frontend = await ask("Frontend", "React + TypeScript");
          config.backend = await ask("Backend", "Node.js + Express");
          config.database = await ask("Database", "PostgreSQL");
          config.styling = await ask("Styling", "Tailwind CSS");
          config.testing = await ask("Testing", "Vitest + Playwright");
          break;
      }

      config.packageManager = await askChoice("Package manager?", [
        { value: "npm", label: "npm" },
        { value: "pnpm", label: "pnpm" },
        { value: "yarn", label: "yarn" },
        { value: "bun", label: "bun" },
      ]);
    }

    config.deployTarget = await askChoice("Where will this deploy?", [
      { value: "vercel", label: "Vercel" },
      { value: "railway", label: "Railway" },
      { value: "gcp", label: "Google Cloud (GCP)" },
      { value: "aws", label: "AWS" },
      { value: "azure", label: "Azure" },
      { value: "github-pages", label: "GitHub Pages (static)" },
      { value: "docker", label: "Docker / self-hosted" },
      { value: "undecided", label: "Not sure yet" },
    ]);

    config.testingStrategy = await askMultiChoice("How will you test? (select all that apply)", [
      { value: "localhost", label: "Local dev server", desc: "localhost" },
      { value: "preview", label: "Preview deployments", desc: "Vercel/Netlify previews" },
      { value: "staging", label: "Cloud staging environment" },
      { value: "ci-only", label: "CI-only", desc: "no manual testing" },
    ]);
  } else {
    config.projectName = path.basename(process.cwd());
    config.productDescription = "A web application";
    config.deployTarget = "docker";
    config.testingStrategy = ["localhost"];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INSTALL
  // ═══════════════════════════════════════════════════════════════════════════

  console.log(`\n${c.bold}  Installing framework...${c.reset}\n`);

  let totalFiles = 0;

  // ── 1. Create directory structure ──
  const dirs = [
    claudeDir,
    path.join(claudeDir, "commands"),
    path.join(claudeDir, "skills"),
  ];

  if (!flags.noHooks) {
    dirs.push(path.join(installBase, "scripts"));
  }

  for (const dir of dirs) {
    if (ensureDir(dir)) {
      printStep("Created", path.relative(process.cwd(), dir) || dir);
    }
  }

  // ── 2. Slash Commands ──
  const cmdCount = copyDir(
    path.join(FRAMEWORK_DIR, "commands"),
    path.join(claudeDir, "commands"),
    "commands"
  );
  printStep("Commands", `${cmdCount} slash commands → .claude/commands/`);
  totalFiles += cmdCount;

  // ── 3. Skills ──
  const skillCount = copyDir(
    path.join(FRAMEWORK_DIR, "skills"),
    path.join(claudeDir, "skills"),
    "skills"
  );
  printStep("Skills", `${skillCount} domain skills → .claude/skills/`);
  totalFiles += skillCount;

  // ── 4. Hook Scripts ──
  if (!flags.noHooks) {
    const scriptCount = copyDir(
      path.join(FRAMEWORK_DIR, "scripts"),
      path.join(installBase, "scripts"),
      "scripts"
    );
    printStep("Scripts", `${scriptCount} hook scripts → scripts/`);
    totalFiles += scriptCount;
  } else {
    printSkip("Scripts", "skipped (--no-hooks)");
  }

  // ── 5. Settings.json ──
  const settingsPath = path.join(claudeDir, "settings.json");
  const settingsExist = fs.existsSync(settingsPath);

  if (!settingsExist) {
    const settingsContent = customizeSettings(config);
    fs.writeFileSync(settingsPath, settingsContent);
    printStep("Settings", ".claude/settings.json (hooks, permissions, MCP)");
    totalFiles++;
  } else {
    // Migrate existing settings.json for schema compatibility
    let migrated = false;
    let existingSettings;
    try {
      existingSettings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch (_) {
      printSkip("Settings", ".claude/settings.json exists but could not parse — preserved");
      existingSettings = null;
    }

    if (existingSettings) {
      // Migrate deprecated $schema URL
      const OLD_SCHEMA = "https://raw.githubusercontent.com/anthropics/claude-code/main/schemas/settings.schema.json";
      const NEW_SCHEMA = "https://json.schemastore.org/claude-code-settings.json";
      if (existingSettings.$schema === OLD_SCHEMA) {
        existingSettings.$schema = NEW_SCHEMA;
        migrated = true;
      }

      // Migrate environment → env
      if (existingSettings.environment && !existingSettings.env) {
        existingSettings.env = existingSettings.environment;
        delete existingSettings.environment;
        migrated = true;
      }

      // Remove invalid keys
      if (existingSettings._comment !== undefined) {
        delete existingSettings._comment;
        migrated = true;
      }
      if (existingSettings.contextFiles !== undefined) {
        delete existingSettings.contextFiles;
        migrated = true;
      }

      // Migrate permissions.allowedTools → permissions.allow
      if (existingSettings.permissions?.allowedTools && !existingSettings.permissions?.allow) {
        const allowedTools = existingSettings.permissions.allowedTools;
        const allow = [];

        for (const [tool, config] of Object.entries(allowedTools)) {
          if (tool === "Bash" && config.allowedCommands) {
            for (const cmd of config.allowedCommands) {
              allow.push(`Bash(${cmd})`);
            }
          } else if (config.allowed === true) {
            allow.push(tool);
          }
        }

        delete existingSettings.permissions.allowedTools;
        existingSettings.permissions.allow = allow;
        migrated = true;
      }

      // Migrate /tmp/ paths to project-relative .planning/ paths in hook prompts
      const hooksJson = JSON.stringify(existingSettings.hooks || {});
      if (hooksJson.includes("/tmp/dos-apes-")) {
        for (const hookGroups of Object.values(existingSettings.hooks || {})) {
          if (!Array.isArray(hookGroups)) continue;
          for (const group of hookGroups) {
            if (!group.hooks || !Array.isArray(group.hooks)) continue;
            for (const hook of group.hooks) {
              if (typeof hook.prompt === "string" && hook.prompt.includes("/tmp/dos-apes-modified-files.txt")) {
                hook.type = "agent";
                hook.prompt = "IMPORTANT: Your ENTIRE response must be a single JSON object — nothing else.\nNo text before it, no text after it, no markdown code fences, no explanation.\n\nValid responses (pick exactly one):\n  {\"ok\": true}\n  {\"ok\": false, \"reason\": \"description of issues\"}\n\nIf stop_hook_active is true in the hook input, respond: {\"ok\": true}\n\nSteps:\n1. Read .planning/.modified-files.txt — if it does not exist or is empty, respond: {\"ok\": true}\n   Do NOT read any other files until step 1 succeeds with content.\n2. Read .claude/skills/review.md for review guidelines.\n3. Review each modified file. Only flag issues with confidence >= 80.\n4. No issues >= 80: {\"ok\": true}\n5. Issues found: {\"ok\": false, \"reason\": \"Fix: [file:line - category (N) - desc] ...\"}\n\nCRITICAL: Output ONLY the JSON object. No prose. No markdown. No fences.";
              }
              if (typeof hook.command === "string") {
                hook.command = hook.command.replace(/\/tmp\/dos-apes-modified-files\.txt/g, ".planning/.modified-files.txt");
                hook.command = hook.command.replace(/\/tmp\/dos-apes-current-metrics\.txt/g, ".planning/.current-metrics.txt");
              }
            }
          }
        }
        migrated = true;
      }

      // Migrate broken prompt-type Stop hook to agent-type
      const stopHooks = existingSettings.hooks?.Stop;
      if (Array.isArray(stopHooks)) {
        for (const group of stopHooks) {
          if (!group.hooks || !Array.isArray(group.hooks)) continue;
          for (const hook of group.hooks) {
            if (hook.type === "prompt" && typeof hook.prompt === "string" && hook.prompt.includes("You are a code reviewer")) {
              hook.type = "agent";
              hook.prompt = "IMPORTANT: Your ENTIRE response must be a single JSON object — nothing else.\nNo text before it, no text after it, no markdown code fences, no explanation.\n\nValid responses (pick exactly one):\n  {\"ok\": true}\n  {\"ok\": false, \"reason\": \"description of issues\"}\n\nIf stop_hook_active is true in the hook input, respond: {\"ok\": true}\n\nSteps:\n1. Read .planning/.modified-files.txt — if it does not exist or is empty, respond: {\"ok\": true}\n   Do NOT read any other files until step 1 succeeds with content.\n2. Read .claude/skills/review.md for review guidelines.\n3. Review each modified file. Only flag issues with confidence >= 80.\n4. No issues >= 80: {\"ok\": true}\n5. Issues found: {\"ok\": false, \"reason\": \"Fix: [file:line - category (N) - desc] ...\"}\n\nCRITICAL: Output ONLY the JSON object. No prose. No markdown. No fences.";
              migrated = true;
            }
          }
        }
      }

      // Migrate old v2 Stop hook prompt (ends with "You MUST respond with ONLY JSON") to new resilient version
      if (Array.isArray(stopHooks)) {
        for (const group of stopHooks) {
          if (!group.hooks || !Array.isArray(group.hooks)) continue;
          for (const hook of group.hooks) {
            if (hook.type === "agent" && typeof hook.prompt === "string" && hook.prompt.includes("You MUST respond with ONLY JSON")) {
              hook.prompt = "IMPORTANT: Your ENTIRE response must be a single JSON object — nothing else.\nNo text before it, no text after it, no markdown code fences, no explanation.\n\nValid responses (pick exactly one):\n  {\"ok\": true}\n  {\"ok\": false, \"reason\": \"description of issues\"}\n\nIf stop_hook_active is true in the hook input, respond: {\"ok\": true}\n\nSteps:\n1. Read .planning/.modified-files.txt — if it does not exist or is empty, respond: {\"ok\": true}\n   Do NOT read any other files until step 1 succeeds with content.\n2. Read .claude/skills/review.md for review guidelines.\n3. Review each modified file. Only flag issues with confidence >= 80.\n4. No issues >= 80: {\"ok\": true}\n5. Issues found: {\"ok\": false, \"reason\": \"Fix: [file:line - category (N) - desc] ...\"}\n\nCRITICAL: Output ONLY the JSON object. No prose. No markdown. No fences.";
              migrated = true;
            }
          }
        }
      }

      // Migrate PostToolUse hooks missing || true safety net
      const postToolUseHooks = existingSettings.hooks?.PostToolUse;
      if (Array.isArray(postToolUseHooks)) {
        const needsSafety = ["hook-format-and-stage.sh", "hook-typecheck.sh", "hook-test-related.sh"];
        for (const group of postToolUseHooks) {
          if (!group.hooks || !Array.isArray(group.hooks)) continue;
          for (const hook of group.hooks) {
            if (hook.type === "command" && typeof hook.command === "string") {
              for (const script of needsSafety) {
                if (hook.command.includes(script) && !hook.command.includes("|| true")) {
                  hook.command = hook.command.replace(
                    /bash\s+(scripts\/[\w.-]+\.sh)/,
                    "bash $1 2>/dev/null || true"
                  );
                  // Also handle Windows-patched commands
                  if (hook.command.includes("run-hook.cmd") && !hook.command.includes("|| true")) {
                    hook.command += " 2>/dev/null || true";
                  }
                  migrated = true;
                }
              }
            }
          }
        }
      }

      // Windows: patch hook commands to use Git Bash wrapper
      if (process.platform === "win32") {
        const hasUnpatchedBash = JSON.stringify(existingSettings.hooks || {}).includes('"bash ');
        if (hasUnpatchedBash) {
          patchHooksForWindows(existingSettings);
          migrated = true;
        }
      }

      if (migrated) {
        fs.writeFileSync(settingsPath, JSON.stringify(existingSettings, null, 2));
        printStep("Settings", ".claude/settings.json — migrated to current schema");
      } else {
        printSkip("Settings", ".claude/settings.json already exists — preserved");
      }
    }
  }

  // ── 6. CLAUDE.md ──
  const claudeMdPath = path.join(installBase, "CLAUDE.md");
  const claudeMdExists = fs.existsSync(claudeMdPath);

  if (!claudeMdExists) {
    const claudeMd = generateClaudeMd(config);
    fs.writeFileSync(claudeMdPath, claudeMd);
    printStep("CLAUDE.md", "Generated project brain file");
    totalFiles++;
  } else {
    printSkip("CLAUDE.md", "already exists — preserved");
  }

  // ── 7. .planning/ directory ──
  const planningDir = path.join(installBase, ".planning");

  if (ensureDir(planningDir)) {
    // Create PROJECT.md stub
    const projectMd = `# ${config.projectName || "Project"}

## Product Vision

${config.productDescription || config.description || "[Describe the product vision]"}

## Target Users

(To be defined)

## Success Criteria

(To be defined)

## Status

- **Phase:** Not started
- **Initialized:** ${new Date().toISOString().split("T")[0]}
- **Type:** ${projectType}

## Requirements

_Add requirements here or run /apes-build with a PRD._
`;
    fs.writeFileSync(path.join(planningDir, "PROJECT.md"), projectMd);

    // Create ROADMAP.md stub
    fs.writeFileSync(
      path.join(planningDir, "ROADMAP.md"),
      `# Roadmap\n\n_Run /apes-build to generate phases from PRD._\n`
    );

    // Create MEMORY.md
    fs.writeFileSync(
      path.join(planningDir, "MEMORY.md"),
      `# Memory\n\nCross-session learnings and patterns.\n\n- ${new Date().toISOString().split("T")[0]}: Project initialized with Dos Apes v${VERSION}\n`
    );

    printStep("Planning", ".planning/ (PROJECT.md, ROADMAP.md, MEMORY.md)");
    totalFiles += 3;
  } else {
    printSkip("Planning", ".planning/ already exists — preserved");
  }

  // ── 8. Templates ──
  const docsTemplateDir = path.join(installBase, "docs", "templates");
  ensureDir(docsTemplateDir);

  const templatesToCopy = ["PRD-TEMPLATE.md", "adr-template.md"];
  let templateCount = 0;

  for (const tmpl of templatesToCopy) {
    const src = path.join(FRAMEWORK_DIR, "templates", tmpl);
    const dest = path.join(docsTemplateDir, tmpl);
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      templateCount++;
    }
  }

  if (templateCount > 0) {
    printStep("Templates", `${templateCount} templates → docs/templates/`);
    totalFiles += templateCount;
  }

  // ── 9. CI Workflows (optional) ──
  if (!flags.noCi) {
    const ciSrc = path.join(FRAMEWORK_DIR, "ci");
    if (fs.existsSync(ciSrc)) {
      const ciDest = path.join(installBase, ".github", "workflows");
      const ciCount = copyDir(ciSrc, ciDest, "ci");
      if (ciCount > 0) {
        printStep("CI", `${ciCount} workflow templates → .github/workflows/`);
        totalFiles += ciCount;
      }
    }
  } else {
    printSkip("CI", "skipped (--no-ci)");
  }

  // ── 10. .gitignore additions ──
  const gitignorePath = path.join(installBase, ".gitignore");
  const gitignoreAdditions = [
    "# Dos Apes",
    ".planning/metrics/",
    ".planning/.modified-files.txt",
    ".planning/.current-metrics.txt",
  ];

  if (fs.existsSync(gitignorePath)) {
    const existing = fs.readFileSync(gitignorePath, "utf8");
    const missing = gitignoreAdditions.filter((line) => !existing.includes(line));
    if (missing.length > 0) {
      fs.appendFileSync(gitignorePath, "\n" + missing.join("\n") + "\n");
      printStep("Gitignore", "Added Dos Apes entries");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  console.log(`
${c.green}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ${c.bold}✅ Dos Apes v${VERSION} installed!${c.reset}${c.green}                              ║
║                                                              ║
║   ${c.white}${totalFiles} files installed${c.green}                                       ║
║                                                              ║
║   ${c.white}Start Claude Code and run ${c.bold}/apes-help${c.reset}${c.green}                       ║
║                                                              ║
║   ${c.cyan}🦍🦍 Ready to ship!${c.green}                                         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${c.reset}`);

  // ── Next Steps ──
  console.log();

  if (projectType === "greenfield") {
    print("  Next steps:", c.bold);
    console.log();
    print("    1. Review CLAUDE.md and customize for your project", c.white);
    print("    2. Create your PRD (see docs/templates/PRD-TEMPLATE.md)", c.white);
    print("    3. Start Claude Code and run:", c.white);
    console.log();
    print("       /apes-build --prd your-prd.md", c.cyan);
    console.log();
    print("    The framework will plan, build, test, and ship autonomously. 🚀", c.dim);
  } else {
    print("  Next steps:", c.bold);
    console.log();
    print("    1. Start Claude Code", c.white);
    print("    2. Run /apes-map to analyze your codebase", c.white);
    print("    3. Then use:", c.white);
    console.log();
    print('       /apes-feature "Add user authentication"', c.cyan);
    print('       /apes-fix "Login button not responding"', c.cyan);
    print('       /apes-refactor "Extract API client"', c.cyan);
    console.log();
    print("    The framework will plan, implement, test, and commit. 🚀", c.dim);
  }

  console.log();
  print("  Docs: https://github.com/allendosapes/dos-apes-super-agent-framework", c.blue);
  console.log();
}

// ─── Run ────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error(`\n${c.red}  Installation failed:${c.reset}`, err.message);
  process.exit(1);
});
