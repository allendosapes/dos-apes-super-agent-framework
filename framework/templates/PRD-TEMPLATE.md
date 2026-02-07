# Product Requirements Document (PRD) Template

> **How to use:** Copy this template and fill in the sections below. You don't need to fill in everything — write what you know and leave the rest blank. The more detail you provide, the better the AI team can plan and build your product.
>
> **Not sure what to write?** Just describe your product idea in plain language in the Overview section. The AI will ask you clarifying questions at `[APPROVAL]` checkpoints during the build.
>
> **Technical sections optional:** If you see a section that feels too technical (like "Tech Stack Preferences" or "Data Requirements"), skip it. The AI team will make good default choices and check with you at approval gates.

---

## Product Overview

### Product Name

[Your product name]

### One-Line Description

[Describe what this product does in one sentence]

### Problem Statement

[What problem does this solve? Who has this problem?]

### Target Users

- **Primary:** [Main user persona - who will use this most?]
- **Secondary:** [Other users who might use this]

### Success Metrics

[How will you measure if this product is successful?]

- [ ] [Metric 1 - e.g., "User can complete X in under Y minutes"]
- [ ] [Metric 2]
- [ ] [Metric 3]

---

## Requirements

### Must Have (P0) - Launch Blockers

These features are required for the product to be useful at all.

1. **[Feature Name]**
   - Description: [What does it do?]
   - User Story: As a [user], I want to [action] so that [benefit]
   - Acceptance Criteria:
     - [ ] [Specific testable requirement]
     - [ ] [Another requirement]

2. **[Feature Name]**
   - Description:
   - User Story:
   - Acceptance Criteria:
     - [ ]
     - [ ]

3. **[Feature Name]**
   - Description:
   - User Story:
   - Acceptance Criteria:
     - [ ]
     - [ ]

### Should Have (P1) - Important but Not Blocking

These features make the product significantly better.

1. **[Feature Name]**
   - Description:
   - User Story:
   - Acceptance Criteria:
     - [ ]
     - [ ]

2. **[Feature Name]**
   - Description:
   - User Story:
   - Acceptance Criteria:
     - [ ]
     - [ ]

### Nice to Have (P2) - Future Enhancements

These can wait for later versions.

1. **[Feature Name]**
   - Description:
2. **[Feature Name]**
   - Description:

---

## Technical Requirements

> **Skip this section if you're not technical.** Just check the Platform boxes below and leave the rest blank — the AI team will choose appropriate tools.

### Platform

- [ ] Web Application
- [ ] Mobile (iOS)
- [ ] Mobile (Android)
- [ ] Desktop
- [ ] API Only

### Tech Stack Preferences (optional)

[Leave blank for Dos Apes to choose, or specify preferences]

- Frontend: [e.g., React, Vue, vanilla JS]
- Backend: [e.g., Node.js, Python, Go]
- Database: [e.g., PostgreSQL, MongoDB, SQLite]
- Hosting: [e.g., Vercel, AWS, self-hosted]

### Integrations

[Any external services this needs to connect to?]

- [ ] [Integration 1 - e.g., "Stripe for payments"]
- [ ] [Integration 2 - e.g., "SendGrid for email"]
- [ ] [Integration 3]

### Authentication

- [ ] No auth needed (public)
- [ ] Simple auth (email/password)
- [ ] OAuth (Google, GitHub, etc.)
- [ ] Enterprise SSO

### Data Requirements

[Any specific data storage, privacy, or compliance needs?]

- Data retention: [How long to keep data?]
- Privacy: [Any GDPR, CCPA, HIPAA requirements?]
- Backup: [Recovery requirements?]

---

## User Experience

### Key User Flows

[Describe the main paths users take through your product]

**Flow 1: [Name - e.g., "New User Onboarding"]**

1. User lands on [page]
2. User [action]
3. System [response]
4. User [action]
5. Done: [outcome]

**Flow 2: [Name - e.g., "Core Task Completion"]**

1.
2.
3.

### Design Preferences (optional)

- Style: [e.g., "Minimal and clean", "Bold and colorful", "Professional/corporate"]
- Reference sites: [Any sites you like the look of?]
- Brand colors: [If any - e.g., "#3B82F6 blue, #10B981 green"]

---

## Constraints

### Timeline

[When do you need this?]

- Target launch: [Date or "ASAP"]
- Must-have deadline: [If any hard deadline]

### Budget Constraints

[Any cost limitations for tools/services?]

### Technical Constraints

[Any technical limitations to work within?]

- Must use existing [X] infrastructure
- Must work on [browser/device]
- Must support [number] concurrent users

---

## Out of Scope

[What are you explicitly NOT building in this version?]

- [ ] [Feature that might be expected but isn't included]
- [ ] [Another out-of-scope item]

---

## Open Questions

[Any decisions that still need to be made?]

1. [Question 1]
2. [Question 2]

---

## Appendix

### Glossary

[Define any domain-specific terms]

- **[Term]**: [Definition]

### References

[Links to relevant documents, designs, or research]

- [Link 1]
- [Link 2]

---

_This PRD was created for use with [Dos Apes Super Agent Framework](https://github.com/allendosapes/dos-apes-super-agent-framework)_
