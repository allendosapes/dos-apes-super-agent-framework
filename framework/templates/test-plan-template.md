# Test Plan Template

> **How to use:** Create a test plan for each major feature or release. This ensures comprehensive test coverage.

---

## Test Plan: [Feature/Release Name]

**Version:** [1.0]
**Created:** [YYYY-MM-DD]
**Last Updated:** [YYYY-MM-DD]
**Author:** [Name/Agent]
**Status:** [Draft | In Review | Approved | In Progress | Complete]

---

## Overview

### Scope
[What is being tested in this plan?]

### Objectives
- [ ] Verify [functionality 1]
- [ ] Validate [requirement 1]
- [ ] Ensure [quality attribute]

### Out of Scope
- [What is explicitly NOT tested]
- [Features excluded from this plan]

---

## Test Strategy

### Test Levels

| Level | Scope | Responsible | Coverage Target |
|-------|-------|-------------|-----------------|
| Unit | Individual functions | Developer/AI | 80%+ |
| Integration | API/Service interactions | QA/AI | Key paths |
| E2E | User workflows | QA/AI | Happy paths |
| Performance | Load/stress testing | DevOps | SLAs |
| Security | Vulnerability scanning | Security | OWASP Top 10 |

### Test Types
- [ ] **Functional Testing** - Feature works as specified
- [ ] **Regression Testing** - Existing features still work
- [ ] **Smoke Testing** - Basic functionality works
- [ ] **Sanity Testing** - Specific fixes verified
- [ ] **UAT** - User acceptance criteria met

### Test Environment

| Environment | Purpose | URL | Data |
|-------------|---------|-----|------|
| Local | Development | localhost:3000 | Mock |
| Dev | Integration | dev.example.com | Test DB |
| Staging | Pre-production | staging.example.com | Sanitized Prod |
| Production | Live | example.com | Live (read-only) |

---

## Test Cases

### Functional Tests

#### Feature: [Feature Name 1]

| TC-ID | Test Case | Steps | Expected Result | Priority | Status |
|-------|-----------|-------|-----------------|----------|--------|
| TC-001 | [Description] | 1. [Step] 2. [Step] | [Result] | High | Pending |
| TC-002 | [Description] | 1. [Step] 2. [Step] | [Result] | Medium | Pending |
| TC-003 | [Description] | 1. [Step] 2. [Step] | [Result] | Low | Pending |

#### Feature: [Feature Name 2]

| TC-ID | Test Case | Steps | Expected Result | Priority | Status |
|-------|-----------|-------|-----------------|----------|--------|
| TC-004 | [Description] | 1. [Step] 2. [Step] | [Result] | High | Pending |
| TC-005 | [Description] | 1. [Step] 2. [Step] | [Result] | Medium | Pending |

---

### Edge Cases

| TC-ID | Scenario | Input | Expected Behavior |
|-------|----------|-------|-------------------|
| EC-001 | Empty input | "" | Show validation error |
| EC-002 | Max length | [max chars] | Accept and process |
| EC-003 | Special chars | `<script>alert('xss')</script>` | Sanitize/escape |
| EC-004 | Concurrent access | Multiple users | Handle gracefully |
| EC-005 | Network failure | Connection drop | Retry/show error |

---

### Negative Tests

| TC-ID | Scenario | Steps | Expected Error |
|-------|----------|-------|----------------|
| NT-001 | Invalid credentials | Enter wrong password | "Invalid credentials" |
| NT-002 | Missing required field | Submit without email | "Email is required" |
| NT-003 | Unauthorized access | Access without login | 401 redirect to login |
| NT-004 | Resource not found | Request invalid ID | 404 with message |

---

### Performance Tests

| Test | Metric | Target | Tool |
|------|--------|--------|------|
| Page Load | Time to Interactive | < 3s | Lighthouse |
| API Response | P95 Latency | < 200ms | k6/Artillery |
| Concurrent Users | Max supported | 1000 | k6/Artillery |
| Database | Query time | < 50ms | DB profiler |
| Memory | Peak usage | < 512MB | Node profiler |

---

### Security Tests

| Test | Description | Method | Status |
|------|-------------|--------|--------|
| SQL Injection | Test all inputs | Manual + SQLMap | Pending |
| XSS | Test all outputs | Manual + Scanner | Pending |
| CSRF | Verify token validation | Manual | Pending |
| Auth Bypass | Test access controls | Manual | Pending |
| Sensitive Data | Check for exposure | Manual | Pending |
| Dependencies | Check vulnerabilities | npm audit | Pending |

---

### Accessibility Tests

| Test | Standard | Tool | Status |
|------|----------|------|--------|
| Color Contrast | WCAG AA (4.5:1) | Axe/Lighthouse | Pending |
| Keyboard Navigation | All interactive elements | Manual | Pending |
| Screen Reader | Proper announcements | NVDA/VoiceOver | Pending |
| Focus Indicators | Visible focus states | Manual | Pending |
| Alt Text | All images | Manual | Pending |

---

## Test Data

### Test Users

| Role | Username | Password | Permissions |
|------|----------|----------|-------------|
| Admin | admin@test.com | Test123! | Full access |
| User | user@test.com | Test123! | Standard |
| Guest | N/A | N/A | Read-only |

### Test Data Sets

| Dataset | Description | Location |
|---------|-------------|----------|
| Happy Path | Valid, typical data | tests/fixtures/valid.json |
| Edge Cases | Boundary values | tests/fixtures/edge.json |
| Invalid | Error-triggering data | tests/fixtures/invalid.json |

---

## Entry/Exit Criteria

### Entry Criteria (Start Testing)
- [ ] Development complete
- [ ] Build successful
- [ ] Unit tests passing
- [ ] Test environment available
- [ ] Test data prepared

### Exit Criteria (Release)
- [ ] All High priority tests pass
- [ ] 95%+ Medium priority tests pass
- [ ] No Critical bugs open
- [ ] No High bugs open (or approved exceptions)
- [ ] Coverage meets target (80%+)
- [ ] Performance meets SLAs
- [ ] Security scan clean

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Test env unstable | Medium | High | Use containers, reset between runs |
| Incomplete test data | Low | Medium | Generate data programmatically |
| Time constraints | High | Medium | Prioritize critical paths |
| Flaky tests | Medium | Medium | Implement retries, fix root cause |

---

## Schedule

| Phase | Start | End | Status |
|-------|-------|-----|--------|
| Test Planning | [Date] | [Date] | Complete |
| Test Case Development | [Date] | [Date] | In Progress |
| Test Execution | [Date] | [Date] | Pending |
| Bug Fixes | [Date] | [Date] | Pending |
| Regression | [Date] | [Date] | Pending |
| Sign-off | [Date] | [Date] | Pending |

---

## Defects

### Bug Summary

| Severity | Open | In Progress | Resolved | Total |
|----------|------|-------------|----------|-------|
| Critical | 0 | 0 | 0 | 0 |
| High | 0 | 0 | 0 | 0 |
| Medium | 0 | 0 | 0 | 0 |
| Low | 0 | 0 | 0 | 0 |

### Open Defects

| Bug ID | Severity | Description | Status | Assigned |
|--------|----------|-------------|--------|----------|
| | | | | |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | | | |
| Dev Lead | | | |
| Product Owner | | | |

---

*Template for [Dos Apes Super Agent Framework](https://github.com/dos-apes/dos-apes)*
