# Roadmap

> Strategic phases live here. Atomic execution units (missions) live in
> `.planning/missions/`. A mission optionally claims a phase via its
> `phase` frontmatter field; standalone missions (no phase) are first-class.
> See `.claude/skills/missions.md` for the mission lifecycle.

## Vision

[One paragraph. The product's north star — what success looks like a year from
now, who it serves, and the single most important outcome it must produce.
Avoid feature lists; describe the destination, not the route.]

---

## Phases

Each phase is a subsection. The `<!-- phase: ... -->` metadata block at the top
of every phase is the machine-readable record; the prose underneath is for
humans. Allowed `state` values: `planned`, `active`, `complete`, `paused`.

### Q2 Foundation

<!-- phase:
  id: q2-foundation
  title: Q2 Foundation
  state: active
  target_date: 2026-06-30
-->

[Free-form description: scope, success criteria for this phase, key risks,
stakeholders. Keep it focused — execution detail belongs in mission files,
not here. Link to PRDs or ADRs that motivated the phase.]

### Q3 Growth

<!-- phase:
  id: q3-growth
  title: Q3 Growth
  state: planned
  target_date: 2026-09-30
-->

[Description of the next phase. Add or remove phase subsections as the
roadmap evolves. Phases that move to `state: complete` stay in the file as
historical record — do not delete them.]

---

## Active Missions

This section is refreshed by tooling. Manual edits **inside** the markers
below will be overwritten on the next refresh; edit the underlying mission
files instead. Manual prose **outside** the markers is preserved.

<!-- AUTO-GENERATED: missions by phase -->

_No missions tracked yet. Run `/apes-build` (greenfield) or create a mission
manually using `framework/templates/mission-template.md` to populate this
section._

<!-- /AUTO-GENERATED -->

---

_Template from [Dos Apes Super Agent Framework](https://github.com/allendosapes/dos-apes-super-agent-framework)_
