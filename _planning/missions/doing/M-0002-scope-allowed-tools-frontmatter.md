---
id: M-0002
title: Scope allowed-tools frontmatter across all commands and skills
priority: 1
labels: [security, dx, skills]
depends_on: [M-0001]  # least-privilege permissions policy
verification:
  required_levels: [L0, L1]
---

## Context

Twelve of fifteen commands declare bare `Bash` in `allowed-tools` frontmatter — each skill
grants itself unrestricted shell for its entire run, defeating the global policy the moment
any framework skill is active. Only `apes-map.md:3` scopes correctly. `allowed-tools`
*grants* (does not restrict) the listed tools while the skill is active, and for
project-checked-in skills takes effect only after workspace trust is accepted.
Analysis report §2.4.

## Scope

**In:** frontmatter of all files under `framework/commands/` and `framework/skills/`.

**Out:** command-body rewrites (compound-command hygiene is its own mission — this mission
changes only frontmatter). Directory-layout migration to `SKILL.md` form (P2 mission).

## Acceptance criteria

- [ ] No command or skill declares bare `Bash` in `allowed-tools`.
- [ ] Each frontmatter grants only tools/scopes exceeding the global baseline shipped by
      M-0001, per the split table in analysis report §2.4:
      build/feature/fix/refactor get branch-create + merge + npm run/test (no push, no tags);
      mission/evidence get their named `node scripts/*.js` entry points + `git commit`;
      codex-review gets the three codex script entry points only;
      verify/security/test-* get check-scripts + playwright + audit + semgrep + log-verification;
      board/metrics/status/help get read-only + `mission-cli list`;
      domain knowledge skills (backend, frontend, product, review, design-integration,
      architecture) get read-only sets — they are documents, not executors.
- [ ] `apes-map` frontmatter unchanged (already correct); used as the reference pattern in
      the diff description.
- [ ] Fresh install smoke check: `/apes-mission list` and `/apes-status` run end-to-end with
      zero permission prompts; `/apes-build` on a sample mission prompts only at the
      intended ask points (push, reset, tag ops).

## References

Analysis report §2.4 table. Note the trust-dialog caveat: frontmatter grants activate only
after workspace trust — first-run UX still includes exactly one trust prompt by design.
