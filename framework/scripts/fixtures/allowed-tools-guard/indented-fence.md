---
name: fixture-indented-fence
description: Extractor fixture — fenced blocks at column 0 AND indented inside
  numbered list items (the Task 2 column-0 parser bug), plus a template block
  that must be excluded.
allowed-tools: Read, Grep, Glob
---

# Fixture: indented fences

Column-zero fence:

```bash
git status --short
npm test && npm run lint
```

1. **Create Branch** (indented fence inside a list item — the class the
   column-0-anchored parser silently skipped)

   ```bash
   git checkout -b feature/x
   ```

2. **Template block** (generated-file content, NOT an invocation — the
   apes-build generated-CLAUDE.md lesson)

   ```markdown
   npm run deploy # command-shaped template text
   ```

3. **Pipeline** (both halves must surface as separate segments)

   ```bash
   node scripts/mission-cli.js list | node -e 'let s=""'
   ```
