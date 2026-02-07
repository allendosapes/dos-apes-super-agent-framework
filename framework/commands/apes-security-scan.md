---
description: Full security audit pipeline
allowed-tools: Bash, Read
---

# Security Scan

## Usage

```bash
/apes-security-scan              # Full security audit
/apes-security-scan --quick      # Dependencies only
```

## Steps

Run all available security checks:

### 1. Dependency Vulnerabilities

```bash
npm audit
```

Review output for high and critical severity issues. Fix with:

```bash
npm audit fix
```

### 2. Secret Detection

```bash
bash scripts/check-secrets.sh
```

Or if installed in .claude/:

```bash
bash .claude/scripts/check-secrets.sh
```

### 3. Static Security Analysis (if installed)

```bash
npx semgrep --config auto src/
```

Semgrep catches common vulnerability patterns: SQL injection, XSS, path traversal, etc.

### 4. OWASP Review

Review code against OWASP Top 10:
- Injection (SQL, command, XSS)
- Broken authentication
- Sensitive data exposure
- Security misconfiguration
- Known vulnerable components

Reference: .claude/skills/backend.md security section

## Output

Report findings by severity:

```
| Severity | Count | Action    |
|----------|-------|-----------|
| Critical | 0     | BLOCK     |
| High     | 2     | Fix now   |
| Medium   | 5     | Fix soon  |
| Low      | 3     | Track     |
```

**Critical findings block merge.** High findings should be fixed before merge. Medium and low can be tracked in .planning/ISSUES.md.
