# Skills

Skills are domain knowledge documents that teach Claude project-specific patterns and conventions.

## How Skills Work

When Claude Code starts a session, it loads skills based on:
1. The `description` field in each SKILL.md frontmatter
2. Keywords in your prompts
3. File paths you're working with

## Creating a Skill

1. Create a directory: `.claude/skills/your-skill-name/`
2. Add a `SKILL.md` file with frontmatter:

```markdown
---
name: your-skill-name
description: What this skill does and when to use it. Include keywords that would trigger it.
allowed-tools: Read, Edit, Grep
---

# Skill Title

## When to Use
- Trigger condition 1
- Trigger condition 2

## Core Patterns

### Pattern Name
\`\`\`typescript
// Example code
\`\`\`

## Anti-Patterns

### What NOT to Do
\`\`\`typescript
// Bad example
\`\`\`
```

## Included Skills

The framework includes these starter skills:

| Skill | Purpose |
|-------|---------|
| `testing-patterns` | TDD, unit tests, integration tests |
| `react-patterns` | React components, hooks, state management |
| `api-patterns` | REST APIs, validation, error handling |

## Best Practices

1. **Keep SKILL.md focused** - Under 500 lines
2. **Write trigger-rich descriptions** - Include keywords users would say
3. **Include examples** - Show both good and bad patterns
4. **Reference other skills** - Show how skills work together

## Adding Project-Specific Skills

Create skills for patterns specific to your project:

```
.claude/skills/
├── your-design-system/SKILL.md
├── your-api-patterns/SKILL.md
├── your-testing-patterns/SKILL.md
└── your-conventions/SKILL.md
```
