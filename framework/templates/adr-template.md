# Architecture Decision Record (ADR) Template

> **How to use:** Create an ADR for significant architectural decisions. These provide historical context for why decisions were made.

---

## ADR-[NNNN]: [Decision Title]

**Date:** [YYYY-MM-DD]
**Status:** [Proposed | Accepted | Deprecated | Superseded by ADR-XXXX]
**Deciders:** [List of people involved in decision]

---

## Context

### Problem Statement

[What is the issue that we're seeing that motivates this decision?]

### Current State

[Describe the current situation/architecture]

### Requirements

- [Requirement 1 - e.g., "Must handle 10,000 concurrent users"]
- [Requirement 2 - e.g., "Must integrate with existing auth system"]
- [Requirement 3 - e.g., "Must be deployable to AWS"]

### Constraints

- [Constraint 1 - e.g., "Team has limited Go experience"]
- [Constraint 2 - e.g., "Budget limited to $500/month for hosting"]
- [Constraint 3 - e.g., "Must be complete within 2 sprints"]

---

## Decision Drivers

Priority-ordered list of factors influencing this decision:

1. **[Driver 1]** - [Why this matters]
2. **[Driver 2]** - [Why this matters]
3. **[Driver 3]** - [Why this matters]

---

## Considered Options

### Option 1: [Name]

**Description:** [Brief description of the approach]

**Pros:**

- [Advantage 1]
- [Advantage 2]

**Cons:**

- [Disadvantage 1]
- [Disadvantage 2]

**Estimated Effort:** [Low | Medium | High]
**Risk Level:** [Low | Medium | High]

---

### Option 2: [Name]

**Description:** [Brief description of the approach]

**Pros:**

- [Advantage 1]
- [Advantage 2]

**Cons:**

- [Disadvantage 1]
- [Disadvantage 2]

**Estimated Effort:** [Low | Medium | High]
**Risk Level:** [Low | Medium | High]

---

### Option 3: [Name]

**Description:** [Brief description of the approach]

**Pros:**

- [Advantage 1]
- [Advantage 2]

**Cons:**

- [Disadvantage 1]
- [Disadvantage 2]

**Estimated Effort:** [Low | Medium | High]
**Risk Level:** [Low | Medium | High]

---

## Decision

**We will use Option [N]: [Name]**

### Rationale

[Explain why this option was chosen over the others. Reference the decision drivers.]

### Trade-offs Accepted

[What compromises are we making with this decision?]

- [Trade-off 1]
- [Trade-off 2]

---

## Consequences

### Positive

- [Positive consequence 1]
- [Positive consequence 2]

### Negative

- [Negative consequence 1]
- [Negative consequence 2]

### Risks

| Risk     | Likelihood   | Impact       | Mitigation        |
| -------- | ------------ | ------------ | ----------------- |
| [Risk 1] | Low/Med/High | Low/Med/High | [How to mitigate] |
| [Risk 2] | Low/Med/High | Low/Med/High | [How to mitigate] |

---

## Implementation

### Action Items

- [ ] [Action 1 - e.g., "Set up new database"]
- [ ] [Action 2 - e.g., "Migrate existing data"]
- [ ] [Action 3 - e.g., "Update deployment scripts"]

### Migration Path

[If replacing an existing solution, describe the migration strategy]

1. [Step 1]
2. [Step 2]
3. [Step 3]

### Rollback Plan

[How to revert if this decision proves problematic]

---

## Validation

### Success Criteria

How will we know this decision was correct?

- [ ] [Criterion 1 - e.g., "Response time under 200ms"]
- [ ] [Criterion 2 - e.g., "No increase in error rate"]

### Review Date

**Scheduled Review:** [Date to revisit this decision]

---

## Related Decisions

- **Supersedes:** [ADR-XXXX if applicable]
- **Related to:** [ADR-YYYY, ADR-ZZZZ]
- **Depends on:** [ADR-WWWW]

---

## References

- [Link to relevant documentation]
- [Link to benchmark/comparison data]
- [Link to spike/POC results]

---

## Notes

[Any additional context, meeting notes, or discussion points]

---

_Template for [Dos Apes Super Agent Framework](https://github.com/dos-apes/dos-apes)_
