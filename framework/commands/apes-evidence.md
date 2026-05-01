---
description: Generate the evidence packet for a mission (proof-of-work bundle for review)
---

# Evidence Packet

Assembles the evidence packet for a mission and writes it to
`.planning/missions/review/<M-NNNN>/evidence/`. The generator refuses to
produce a packet unless every level listed in the mission's
`verification.required_levels` has a passing entry in its verification log.

Before doing anything else, load `.claude/skills/evidence-packets.md` for the
format spec, refusal semantics, and reviewer checklist.

## Resolve the mission ID

Use the argument supplied to the command (`$ARGUMENTS`). If empty, fall back
to `.planning/active-mission`:

```bash
MISSION_ID="${ARGUMENTS:-}"
if [ -z "$MISSION_ID" ] && [ -f .planning/active-mission ]; then
  MISSION_ID=$(head -n1 .planning/active-mission | tr -d '[:space:]')
fi
if [ -z "$MISSION_ID" ]; then
  echo "Usage: /apes-evidence M-NNNN  (or set .planning/active-mission)"
  exit 1
fi
echo "Generating evidence packet for $MISSION_ID..."
```

## Generate

```bash
node scripts/evidence-packet.js generate "$MISSION_ID"
```

The generator prints two `evidence-packet:` lines on success — the output
path and a one-line summary (entry count, screenshot count, auto-review
present/absent). Non-zero exit means a required verification level didn't
pass; the message lists which one(s).

## Show the cover sheet

After successful generation, display the cover sheet so the user can read
it without leaving the chat:

```bash
cat ".planning/missions/review/$MISSION_ID/evidence/summary.md"
```

## Next actions

If the packet generated cleanly:

- The mission is ready to transition `doing` → `review`. Move the mission
  file with `git mv` and update the `state` frontmatter field in the same
  commit. (See `.claude/skills/missions.md`.)
- Open a PR pointing reviewers at `.planning/missions/review/<M-NNNN>/evidence/summary.md`.

If the generator refused:

- Read the failure line. It names the missing or failing level(s).
- Re-run that verification (typically `scripts/check-coverage.sh`,
  `scripts/check-secrets.sh`, or whichever maps to the level).
- Confirm the new log entry in
  `.planning/missions/<state>/<M-NNNN>/verification.jsonl` shows `pass`.
- Re-run `/apes-evidence <M-NNNN>`.
