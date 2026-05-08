---
audience: claude-desktop
purpose: Guides Claude Desktop through interviewing a user about a bug they encountered and producing a well-formed bugfix mission with reproduction steps, expected and actual behavior, and verbatim error output.
---

# Authoring bugfix missions

*This guide is one of three workflow sub-guides under [dos-apes-authoring.md](./dos-apes-authoring.md).*

## When this guide applies

The user encountered a bug — something that should work doesn't, or works incorrectly. Not for missing features (those are feature missions; load `authoring-feature-missions.md` instead). Not for technical debt or refactoring (those are future workflow types not yet covered).

A bugfix mission has a clear shape: reproduction → fix → verify. The interview is mostly about extracting reproduction details from the user; pushback is lighter than greenfield or brownfield work because user intent is concrete (the bug exists, it needs to stop existing). The procedure is stricter — the bugfix workflow Claude Code follows is test-first, and the mission has to give Claude Code enough information to write a failing test.

## Core principle

Bugs need reproductions, not descriptions. The bugfix workflow is test-first: Claude Code writes a failing test that captures the bug, then writes the fix, then verifies the test passes. The mission's job is to capture enough information that a failing test can be written from it.

A bug report without a reproduction is hope, not engineering work. If the user can't reliably reproduce the bug, that's a different kind of mission — intermittent bugs need their own treatment (an investigation mission, with a wider net of logging and instrumentation as the deliverable). Surface that distinction; don't paper over it by filing a bugfix mission against a bug nobody can reproduce.

## The interview

Five questions, in this order. The order matters — start with what the user did, end with the artifacts. Don't run as a checklist; have a real conversation. But all five answers need to be captured before the mission is filed.

### What did you do?

The exact sequence of actions, in order. Not "I tried to log in" — "I went to `/login`, entered email `foo@bar.com`, entered password `baz`, clicked Sign In." Specificity is everything; "I tried to log in" doesn't tell anyone how to reproduce.

### What did you expect to happen?

"I expected to be logged in and redirected to `/dashboard`." This pins down what "broken" means — the gap between expectation and reality is the bug.

### What actually happened?

"Got a 500 error and was kicked back to `/login`." The observed reality, as concrete as possible. Screenshots help when describing UI bugs but don't replace this question — the words matter for the test.

### Can you reproduce it?

Critical question. If the user can't reproduce reliably, the bug is harder to fix and harder to verify fixed. Suggest they try once or twice to confirm before filing. If the bug is intermittent, capture that explicitly ("Reproduction frequency: ~50%, no clear trigger") rather than pretending it's reliable — Claude Code will treat reliable and intermittent bugs differently.

### What error messages or logs do you have?

Verbatim. Not paraphrased. If the user has a stack trace, it goes in the mission body verbatim, in a code block. The exact text is diagnostic — "something about a token" is useless; the actual error string often points directly at the failing file and line.

## What to capture in the mission

The bug report shape — these become Markdown sections in the mission body:

1. **Steps to reproduce** — the "what did you do" answer, numbered.
2. **Expected behavior** — what should have happened.
3. **Actual behavior** — what did happen.
4. **Error output** — verbatim, in a code block. Stack traces, log lines, error messages exactly as they appeared.
5. **Reproduction frequency** — `always` / `often` / `sometimes` / `rare`. Default `always` if reliable.
6. **Suspected location** — optional. The user may know roughly where the bug lives (a specific file or component); helpful but not required, and shouldn't be guessed at.

This shape replaces the Context / Implementation notes / Out of scope sections used in feature missions. The bug report shape is the canonical body structure for bugfix missions.

## Pushback patterns

### "It just doesn't work"

Push for specifics. What did they click? What did they expect? What did they see? "It doesn't work" is not actionable; you need the same five answers from a user who said it doesn't work as from a user who described the bug carefully — but extracting those answers takes more turns. Be patient and specific in your questions.

### Paraphrased error messages

Get verbatim. The exact text matters; paraphrasing loses information that might be diagnostic. "Something about a token expiring" is useless; the actual `JsonWebTokenError: jwt expired at ... iat: 1715000000` line tells the implementer which library, which error class, and which timestamp — three diagnostic clues paraphrasing throws away.

### "I haven't actually tried to reproduce it, but..."

Stop. Suggest they reproduce once before filing. A bug they can't reproduce is a bug they can't verify is fixed. If they file it anyway, the resulting mission has no test that proves the bug existed — which means it has no test that proves the bug was fixed. The whole bugfix workflow falls apart.

### Multiple bugs in one mission

Split. Each mission fixes exactly one bug. "Login is broken AND signup is broken" is two missions, even if they share a root cause — sharing a root cause is a hypothesis, not a fact, and the fix for one might not fix the other. Two missions also produce two focused diffs, which review can handle. One mission with two bugs produces a sprawling diff, which review can't.

## Producing the mission file

Run from the project root, in Claude Code:

```
/apes-mission new "<title>" --label bug
```

For users who script it, the equivalent CLI form is `node scripts/mission-cli.js create --title "<title>" --label bug`. The `--label bug` is the current-state convention for tagging bugfix missions; see the future schema note at the end of this section.

After creation, edit the mission file directly to populate the body sections (Steps to reproduce, Expected behavior, Actual behavior, Error output, Reproduction frequency, Suspected location). There are no CLI update verbs for these — they're plain file edits. The one exception is `/apes-mission workpad <id> "<note>"` for appending workpad entries, which Claude Code uses during execution.

Here's what good body sections look like for a bugfix mission titled "Login fails when email contains apostrophe":

~~~markdown
## Steps to reproduce
1. Navigate to `/login`
2. Enter email: `o'brien@example.com`
3. Enter password: any valid password
4. Click Sign In

## Expected behavior
User logs in successfully and is redirected to `/dashboard`.

## Actual behavior
500 Internal Server Error displayed. User remains on `/login`.

## Error output
```
SyntaxError: Unexpected end of JSON input
    at JSON.parse (<anonymous>)
    at parseAuthRequest (src/auth/parser.js:42:18)
    at validateLogin (src/auth/login.js:23:14)
    at /usr/src/app/src/routes/auth.js:18:5
```

## Reproduction frequency
Always. Reproduces 100% of the time when the email contains an apostrophe.

## Suspected location
`src/auth/parser.js` — the JSON serialization of the auth payload likely isn't escaping the apostrophe before parsing.

## Workpad
<!-- Updated by agent during execution. Append timestamped entries; do not delete prior entries. -->
~~~

The Steps to reproduce section is concrete enough to be turned into a test directly. The Error output is verbatim, in a fenced code block. The Suspected location is helpful but not load-bearing — Claude Code will verify or contradict it during diagnosis.

### Future schema note

A future framework version (after M-0007 ships) will introduce a `type` field for missions. Bugfix missions will then be filed with `--type bugfix --label bug`. The transition is additive: labels keep working, types become the canonical field for routing decisions. Today's `--label bug` filing remains forward-compatible — when types arrive, a label-tagged bugfix mission is still recognizable as a bugfix; the label simply persists alongside the new type field.

## Frontmatter to set explicitly

Beyond the fields the CLI auto-populates (`id`, `title`, `state`, `created`, `updated`, `workspace`, `schema_version`):

- **`priority`** — bugs often warrant higher priority than features. Default to 2 unless the user specifies otherwise; raise to 1 if the bug blocks critical functionality (auth, payments, data integrity).
- **`labels`** — always include `bug`. Add other labels as helpful (`auth`, `ui`, `data-loss`, etc.). Lowercase, kebab-case.
- **`acceptance`** — typically two items, plus any user-facing verification:
  - "Test reproduces the bug (test fails before fix)"
  - "Test passes after fix"
  - Optional third: a concrete user-facing acceptance criterion if the bug has visible impact (e.g., "User can log in with email containing apostrophe and reach `/dashboard`").
- **`verification.required_levels`** — always include `L2` (unit test for the bug). Add `L3` if the bug spans multiple components or layers. Add `L6` if the bug is reproducible in the browser and a Playwright test would be the natural reproduction.

The full schema (every field, every constraint) lives at `.claude/skills/missions.md` in the user's framework install. Don't memorize it; cross-reference when needed.

## Anti-patterns to avoid

**Filing without reproducing.** You'll spend more time fixing a bug nobody can reliably reproduce than fixing one with a clean repro. If the user "thinks" they saw it but can't reproduce, that's not a bugfix mission yet — that's an investigation mission, which has a different shape (logging and instrumentation as deliverables, not a fix).

**Bundling multiple bugs.** Each mission fixes exactly one bug. "Login and signup are both broken" is two missions, even if they share a root cause. Splitting keeps the test-first workflow tractable: one failing test per mission, one fix per mission, one passing test per mission.

**Skipping the verbatim error output.** Paraphrased errors lose diagnostic information. "Something about JSON parsing" is much less useful than the actual `SyntaxError: Unexpected end of JSON input at parseAuthRequest (src/auth/parser.js:42:18)` line that points directly at the suspect file and function. If the user doesn't have the verbatim error, send them back to reproduce once more and capture it.

## When you're done

The handoff to Claude Code:

1. The mission file exists in `.planning/missions/todo/` with the bug report shape populated (Steps to reproduce, Expected behavior, Actual behavior, Error output, Reproduction frequency, optional Suspected location).
2. The user runs `/apes-build --mission <id>` in Claude Code. Claude Code follows the test-first bugfix workflow: write failing test that captures the bug → fix → verify test passes → run the full verification pyramid before review → done.

Your job is done. If the user discovers a related bug while debugging the first one, capture it as a separate mission rather than expanding the in-flight one.
