# Contributing to Dos Apes Super Agent Framework

Thank you for your interest in contributing! This framework is built on the combined wisdom of several AI coding approaches, and we welcome contributions that make it even better.

## Ways to Contribute

### 1. New Skills

Add domain-specific skills for common use cases:

- Framework-specific patterns (Next.js, Django, Rails, etc.)
- Testing patterns for different frameworks
- Database patterns (Prisma, Drizzle, TypeORM, etc.)
- CI/CD patterns

**How to add:**
1. Create `framework/skills/your-skill/SKILL.md`
2. Follow the skill format in `framework/skills/README.md`
3. Test it in a real project
4. Submit PR with examples

### 2. New Commands

Add commands for common workflows:

- `/apes-deploy` - Deployment workflows
- `/apes-migrate` - Database migrations
- `/apes-audit` - Security/dependency audits

**How to add:**
1. Create `framework/commands/pathway-your-command.md`
2. Follow existing command patterns
3. Include verification steps
4. Document in README

### 3. New Agents

Add specialized agents:

- Security Engineer
- DevOps Engineer
- Technical Writer

**How to add:**
1. Create `framework/agents/your-agent.md`
2. Define clear responsibilities
3. Include verification requirements
4. Add to documentation

### 4. Bug Fixes

- Issues with existing commands
- Hook script improvements
- Documentation errors

### 5. Documentation

- Tutorials and guides
- Video walkthroughs
- Integration examples

## Development Setup

```bash
# Clone the repo
git clone https://github.com/pathway/dos-apes
cd dos-apes

# Install for testing
npm link

# Test in a project
cd /path/to/test-project
npx dos-apes --local

# Test commands
claude
> /apes-help
```

## PR Guidelines

### Commit Messages

Use conventional commits:

```
feat(commands): add deploy command
fix(hooks): handle missing STATE.md gracefully
docs(readme): add brownfield workflow example
```

### PR Template

```markdown
## What

Brief description of changes.

## Why

Why these changes are needed.

## Testing

How you tested these changes:
- [ ] Tested in greenfield project
- [ ] Tested in brownfield project
- [ ] Tested Ralph loop
- [ ] Tested verification hooks

## Screenshots/Examples

If applicable, show the changes in action.
```

### Review Checklist

Before submitting:

- [ ] Commands follow existing patterns
- [ ] Verification steps included
- [ ] Works with Ralph loop mode
- [ ] Works with worktrees
- [ ] Documentation updated
- [ ] No breaking changes (or documented migration)

## Code of Conduct

- Be respectful and constructive
- Focus on the work, not the person
- Assume good intentions
- Help others learn

## Questions?

- Open a GitHub issue for bugs/features
- Start a discussion for questions
- Tag maintainers if blocked

---

Thank you for helping make AI-assisted development better for everyone! 🚀
