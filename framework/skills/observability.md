---
name: observability
description: Runtime diagnosis, structured logging, performance verification,
  health checks, and error budget awareness. Load when verifying quantitative
  acceptance criteria, diagnosing test failures, or building observability
  into applications.
allowed-tools: Read, Bash, Grep, Glob
---

# Observability Skill

Give agents eyes into running applications — logs, metrics, health, and performance.

## Structured Logging

Teach every application to emit structured JSON logs. Unstructured strings are not queryable by agents in future sessions.

### Format

```json
{"level":"info","msg":"User created","userId":"abc-123","email":"alice@test.com","ts":"2025-01-15T10:30:00Z"}
{"level":"error","msg":"Failed to fetch user","userId":"abc-123","error":"ETIMEDOUT","correlationId":"req-456","ts":"2025-01-15T10:30:01Z"}
```

### Rules

- **Always JSON** — never `console.log("something happened")`
- **Include correlation IDs** — tie related operations together across request boundaries
- **Log at decision points** — not just errors. Log when a branch is taken, a fallback is used, or a retry happens
- **Include context** — user ID, request ID, entity ID. Enough to grep for a specific operation

### Logger Setup

```typescript
// src/lib/logger.ts
export function log(level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) {
  const entry = { level, msg, ts: new Date().toISOString(), ...data };
  console[level === "error" ? "error" : "log"](JSON.stringify(entry));
}
```

## Runtime Self-Diagnosis

When a test fails or a feature doesn't work, diagnose systematically:

```
1. CHECK DEV SERVER OUTPUT
   Read terminal output for runtime errors, unhandled rejections, stack traces.

2. READ STRUCTURED LOGS
   grep -i "error\|warn" on log output for the failing operation.
   Filter by correlation ID if available.

3. CHECK NETWORK RESPONSES
   For API failures: what status code? What error body?
   For frontend: are requests reaching the server?

4. CAPTURE BROWSER ERRORS
   Use Playwright MCP to check browser console for errors.
   See skills/browser-verification.md for tool details.

5. COMPARE PRE/POST BEHAVIOR
   What changed between the working state and the broken state?
   git diff against the last known-good tag.
```

Do not guess at the cause. Read actual output first, then form a hypothesis.

## Performance Verification

When acceptance criteria include performance targets (e.g., "page loads in under 2 seconds"), measure and report.

### Frontend Measurement

```typescript
// Measure in Playwright E2E test
test("homepage loads under 2s", async ({ page }) => {
  const start = Date.now();
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const elapsed = Date.now() - start;

  expect(elapsed).toBeLessThan(2000);
});
```

### API Measurement

```bash
# Measure API response time (run 3x, take median)
for i in 1 2 3; do
  curl -o /dev/null -s -w "%{time_total}\n" http://localhost:3000/api/health
done | sort -n | sed -n '2p'
```

### Reporting

```
═══ PERFORMANCE VERIFICATION ═══
Target: Homepage loads in < 2000ms
Runs: 1847ms, 1623ms, 1712ms
Median: 1712ms
Result: ✅ PASS (288ms under budget)
═════════════════════════════════
```

Rules:
- **Run 3x minimum**, take the median — single-run measurements are unreliable
- **Report target vs actual** with explicit pass/fail
- **Measure after build**, not in dev mode (dev mode includes HMR overhead)

## Health Check Patterns

Every backend service should have a health endpoint that agents can verify before running tests.

### Implementation

```typescript
// GET /health
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    version: process.env.npm_package_version || "unknown",
    timestamp: new Date().toISOString(),
  });
});
```

### Startup Verification

Before running integration or E2E tests:

```bash
# Wait for server to be ready (max 30s)
for i in $(seq 1 30); do
  curl -sf http://localhost:3000/health > /dev/null 2>&1 && break
  sleep 1
done
curl -sf http://localhost:3000/health || { echo "Server failed to start"; exit 1; }
```

Log startup confirmation:

```json
{"level":"info","msg":"Server ready","port":3000,"dbConnected":true,"ts":"..."}
```

## Error Budget Awareness

When an application has error tracking, check error counts before and after changes.

```
1. BEFORE changes: note baseline error count / rate
2. AFTER changes: check error count / rate
3. COMPARE:
   - Same or lower → change is safe
   - Higher → change introduced a regression, investigate
4. REPORT the delta in verification output
```

A change that increases the error rate is a regression regardless of whether tests pass. Tests verify expected behavior — error budgets catch unexpected behavior.

## Browser DevTools Integration

Extends `skills/browser-verification.md` with observability-specific checks:

- **Console error count** — Capture `console.error` calls during E2E runs. Any new errors are regressions.
- **Network failures** — Monitor for failed requests (4xx/5xx) during user flows that should succeed.
- **Memory baseline** — For long-running sessions, compare `performance.memory.usedJSHeapSize` at start and end. Growth beyond 2x suggests a leak.
- **Screenshot diff** — Before/after screenshots for visual comparison. Use Playwright's `toHaveScreenshot()` for automated diff.

```typescript
// Capture console errors during a test
const errors: string[] = [];
page.on("console", msg => {
  if (msg.type() === "error") errors.push(msg.text());
});

// ... run the test flow ...

expect(errors).toHaveLength(0);
```

## Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| `console.log("user created")` | Not queryable, no context | Use structured JSON with IDs |
| Ignoring console errors in E2E | Hidden regressions | Capture and assert zero errors |
| Single-run perf measurement | Flaky, misleading | Run 3x, take median |
| Testing without health check | Tests fail because server isn't ready | Verify `/health` first |
| Logging everything at `info` | Noise drowns signal | Reserve `info` for decisions, `error` for failures |
