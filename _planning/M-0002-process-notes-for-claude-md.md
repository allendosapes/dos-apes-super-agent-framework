# M-0002 → CLAUDE.md process notes (draft — ships in the follow-up lifecycle PR)

Drafted at Task 7 closeout per the closeout-gate ruling; batched with
M-0002's review→done move, NOT this mission's PR. Style matches the existing
"Operational hazards" numbered list (short, behavioral, incident-sourced);
proposed as entries 5–7.

---

5. **"Body invokes" columns in analysis tables are hypotheses — full-read
   re-verification per file is mandatory before acting on them.** Three
   extraction defects were found in one mission (M-0002): a fence parser
   anchored at column 0 silently skipped fenced blocks indented inside list
   items; browser-verification.md's commands live in *unfenced*
   indentation-style code invisible to fence parsers; and a whole-file token
   scan matched frontmatter declarations against themselves, manufacturing
   its own evidence. If a table says a file does X, the table is a lead, not
   a fact.

6. **Reference ≠ invocation.** Prose that *describes* a script or tool — or
   names a different executor (a hook, a loop driver, another command) — is
   not evidence that the reading agent runs it. Grants, permissions, and
   capability claims attach only to sites where the file's own executor is
   instructed to act. Litmus: "who runs this?" — if the answer isn't "the
   agent executing this file," it's a reference.

7. **Never grant ahead of body evidence.** A declared-but-unused grant is
   drift by definition and fails `allowed-tools-guard.test.js`
   (declarations-without-usage). Aspirational grants — "the mechanism this
   will migrate to" — are rejected; the grant lands in the same commit as
   the change that creates the evidence. Judgment-call exceptions live as
   cited pins in the guard, never as uncited frontmatter.
