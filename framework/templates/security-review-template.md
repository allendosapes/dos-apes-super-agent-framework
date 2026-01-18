# Security Review Template

> **How to use:** Complete this review before any production deployment. Document findings and remediations.

---

## Security Review: [Feature/Release Name]

**Version:** [1.0]
**Date:** [YYYY-MM-DD]
**Reviewer:** [Name/Agent]
**Status:** [In Progress | Passed | Failed | Passed with Exceptions]

---

## Overview

### Scope

[What is being reviewed?]

- [ ] New feature: [Name]
- [ ] Modified code: [Area]
- [ ] Infrastructure change: [Description]
- [ ] Full application review

### Risk Level

- [ ] **Low** - Internal tool, no sensitive data
- [ ] **Medium** - User data, limited exposure
- [ ] **High** - Financial/PII data, public facing
- [ ] **Critical** - Payment processing, healthcare, auth system

---

## OWASP Top 10 Checklist

### A01:2021 - Broken Access Control

| Check                                        | Status | Notes |
| -------------------------------------------- | ------ | ----- |
| Authentication required for protected routes |        |       |
| Authorization checks on all operations       |        |       |
| Principle of least privilege applied         |        |       |
| CORS properly configured                     |        |       |
| Directory traversal prevented                |        |       |
| Rate limiting implemented                    |        |       |

**Findings:**

- [Finding 1]
- [Finding 2]

**Remediation:**

- [Action 1]

---

### A02:2021 - Cryptographic Failures

| Check                                   | Status | Notes |
| --------------------------------------- | ------ | ----- |
| HTTPS enforced                          |        |       |
| Strong encryption for data at rest      |        |       |
| Secure password hashing (bcrypt/argon2) |        |       |
| No sensitive data in URLs               |        |       |
| No sensitive data in logs               |        |       |
| Secure session management               |        |       |

**Findings:**

- [Finding 1]

**Remediation:**

- [Action 1]

---

### A03:2021 - Injection

| Check                                           | Status | Notes |
| ----------------------------------------------- | ------ | ----- |
| SQL injection prevented (parameterized queries) |        |       |
| NoSQL injection prevented                       |        |       |
| Command injection prevented                     |        |       |
| LDAP injection prevented                        |        |       |
| XPath injection prevented                       |        |       |
| ORM injection prevented                         |        |       |

**Findings:**

- [Finding 1]

**Remediation:**

- [Action 1]

---

### A04:2021 - Insecure Design

| Check                         | Status | Notes |
| ----------------------------- | ------ | ----- |
| Threat modeling completed     |        |       |
| Security requirements defined |        |       |
| Secure design patterns used   |        |       |
| Defense in depth applied      |        |       |
| Fail securely                 |        |       |

**Findings:**

- [Finding 1]

**Remediation:**

- [Action 1]

---

### A05:2021 - Security Misconfiguration

| Check                             | Status | Notes |
| --------------------------------- | ------ | ----- |
| Security headers configured       |        |       |
| Default credentials changed       |        |       |
| Unnecessary features disabled     |        |       |
| Error messages don't leak info    |        |       |
| Debug mode disabled in production |        |       |
| Dependencies up to date           |        |       |

**Security Headers Check:**
| Header | Value | Status |
|--------|-------|--------|
| Content-Security-Policy | [value] | |
| X-Content-Type-Options | nosniff | |
| X-Frame-Options | DENY/SAMEORIGIN | |
| X-XSS-Protection | 1; mode=block | |
| Strict-Transport-Security | max-age=31536000 | |
| Referrer-Policy | strict-origin | |

**Findings:**

- [Finding 1]

**Remediation:**

- [Action 1]

---

### A06:2021 - Vulnerable Components

| Check                           | Status | Notes |
| ------------------------------- | ------ | ----- |
| Dependency audit clean          |        |       |
| No known vulnerable libraries   |        |       |
| Components from trusted sources |        |       |
| Unused dependencies removed     |        |       |

**Dependency Scan Results:**

```
[Paste npm audit / pip audit / cargo audit output]
```

**Findings:**

- [Finding 1]

**Remediation:**

- [Action 1]

---

### A07:2021 - Identification & Auth Failures

| Check                                 | Status | Notes |
| ------------------------------------- | ------ | ----- |
| Strong password requirements          |        |       |
| Account lockout after failed attempts |        |       |
| Secure password recovery              |        |       |
| Session timeout implemented           |        |       |
| Session invalidation on logout        |        |       |
| MFA available/enforced                |        |       |
| No credential stuffing vulnerability  |        |       |

**Findings:**

- [Finding 1]

**Remediation:**

- [Action 1]

---

### A08:2021 - Software & Data Integrity

| Check                         | Status | Notes |
| ----------------------------- | ------ | ----- |
| CI/CD pipeline secured        |        |       |
| Code signing implemented      |        |       |
| Dependency integrity verified |        |       |
| Update mechanism secure       |        |       |
| Serialization validated       |        |       |

**Findings:**

- [Finding 1]

**Remediation:**

- [Action 1]

---

### A09:2021 - Security Logging & Monitoring

| Check                             | Status | Notes |
| --------------------------------- | ------ | ----- |
| Authentication events logged      |        |       |
| Authorization failures logged     |        |       |
| Input validation failures logged  |        |       |
| Logs don't contain sensitive data |        |       |
| Log integrity protected           |        |       |
| Alerting configured               |        |       |

**Findings:**

- [Finding 1]

**Remediation:**

- [Action 1]

---

### A10:2021 - Server-Side Request Forgery (SSRF)

| Check                           | Status | Notes |
| ------------------------------- | ------ | ----- |
| URL validation for user input   |        |       |
| Whitelist for external requests |        |       |
| Internal services not exposed   |        |       |
| DNS rebinding prevented         |        |       |

**Findings:**

- [Finding 1]

**Remediation:**

- [Action 1]

---

## Additional Checks

### Input Validation

| Input Type      | Validation | Sanitization | Status |
| --------------- | ---------- | ------------ | ------ |
| User text input | [Method]   | [Method]     |        |
| File uploads    | [Method]   | [Method]     |        |
| URL parameters  | [Method]   | [Method]     |        |
| JSON payloads   | [Method]   | [Method]     |        |
| Form data       | [Method]   | [Method]     |        |

---

### Output Encoding

| Output Context  | Encoding Method      | Status |
| --------------- | -------------------- | ------ |
| HTML body       | HTML entity encoding |        |
| HTML attributes | Attribute encoding   |        |
| JavaScript      | JavaScript encoding  |        |
| CSS             | CSS encoding         |        |
| URL             | URL encoding         |        |
| JSON            | JSON encoding        |        |

---

### API Security

| Check                           | Status | Notes |
| ------------------------------- | ------ | ----- |
| Authentication on all endpoints |        |       |
| Rate limiting per user/IP       |        |       |
| Request size limits             |        |       |
| Response filtering              |        |       |
| API versioning                  |        |       |
| Documentation accurate          |        |       |

---

### Data Protection

| Data Type      | Classification | Protection        | Status |
| -------------- | -------------- | ----------------- | ------ |
| Passwords      | Sensitive      | Hashed (bcrypt)   |        |
| PII            | Sensitive      | Encrypted at rest |        |
| Session tokens | Sensitive      | HttpOnly, Secure  |        |
| API keys       | Secret         | Not in code/logs  |        |
| User content   | Standard       | Access controlled |        |

---

## Findings Summary

### Critical (Must Fix)

| ID  | Description | Remediation | Status |
| --- | ----------- | ----------- | ------ |
|     |             |             |        |

### High (Should Fix)

| ID  | Description | Remediation | Status |
| --- | ----------- | ----------- | ------ |
|     |             |             |        |

### Medium (Consider)

| ID  | Description | Remediation | Status |
| --- | ----------- | ----------- | ------ |
|     |             |             |        |

### Low (Nice to Have)

| ID  | Description | Remediation | Status |
| --- | ----------- | ----------- | ------ |
|     |             |             |        |

---

## Tools Used

| Tool       | Version | Purpose            | Results |
| ---------- | ------- | ------------------ | ------- |
| npm audit  | [ver]   | Dependency scan    | [Link]  |
| Snyk       | [ver]   | Vulnerability scan | [Link]  |
| OWASP ZAP  | [ver]   | Dynamic scan       | [Link]  |
| Burp Suite | [ver]   | Manual testing     | [Link]  |
| SonarQube  | [ver]   | Static analysis    | [Link]  |

---

## Sign-Off

### Review Decision

- [ ] **Approved** - No critical/high findings
- [ ] **Approved with Conditions** - Must fix [items] before release
- [ ] **Not Approved** - Critical issues must be resolved

### Exceptions

[Document any accepted risks]
| Finding | Risk Level | Justification | Approved By | Expiry |
|---------|------------|---------------|-------------|--------|
| | | | | |

### Signatures

| Role              | Name | Date | Signature |
| ----------------- | ---- | ---- | --------- |
| Security Reviewer |      |      |           |
| Tech Lead         |      |      |           |
| Product Owner     |      |      |           |

---

## Follow-Up

### Next Review Date

[Date for next security review]

### Action Items

- [ ] [Item 1 with owner and due date]
- [ ] [Item 2 with owner and due date]

---

_Template for [Dos Apes Super Agent Framework](https://github.com/dos-apes/dos-apes)_
