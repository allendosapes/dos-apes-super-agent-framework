# M-0004 — Worktree Write Guard, Mission-Move Companions, CLAUDE.md Batch
## Mission Charter + Execution Playbook

**Status:** Ready to execute once the M-0003 closeout PR is merged to main
**Branch:** `mission/M-0004-worktree-guard-and-move-fixes` (cut from fresh main)
**Budget:** One Claude Code session, four prompts, four STOP gates
**Release gate:** AC-1 through AC-3 and AC-6 are 3.6.0-blocking

---

## Charter

M-0004 fixes the two release-blocking defects surfaced by M-0003's AC-9 live-fire dry-run, ships the bundled permission grant, lands the queued CLAUDE.md hazard batch, and re-runs the dry-run to prove the flagship flow no longer fights its own policy.

### Acceptance criteria

- **AC-1 (blocking):** `guard-main-branch.sh` resolves the branch of the **target path's containing worktree**, not the session cwd. Writes into the framework's worktree directories succeed when that worktree has a mission branch checked out; direct writes to main-checked-out paths remain blocked. Regression tests cover both directions (worktree write from main cwd passes; main write still blocked).
- **AC-2 (blocking, ships with AC-1):** `EnterWorktree` granted in the shipped `settings.json` allow-list; allowed-tools guard covering-declaration bookkeeping updated in the same commit.
- **AC-3 (blocking):** `mission-cli.js move` succeeds when the mission has untracked companion files and/or a pre-existing destination directory: `git mv` for tracked files, plain-rename fallback for untracked companions, tolerate existing `review/<id>/`. Tests cover the exact M-0003 failure shape (tracked mission file + untracked evidence dir + pre-created destination).
- **AC-4:** CLAUDE.md updated with the queued hazard batch: the three entries from `_planning/M-0002-process-notes-for-claude-md.md` (retire that file once absorbed), the session-cwd-vs-target-path hook defect-class note, and the RM-staging hazard (git mv stages the rename; later content edits need their own add; verify committed contents post-commit). Stay under the CLAUDE.md token budget — prune if needed.
- **AC-5:** M-0003's `review → done` transition rides this branch's **first commit**.
- **AC-6 (blocking):** In-use verification — re-run the AC-9-style headless `/apes-build` dry-run (Task 3a probe method, Git Bash runner). Expected: the three Write denials, the improvised-fallback cascade, and the EnterWorktree prompt are gone. Remaining acceptable denials: only the parked cd-prefixed-chain class and, if it recurs, the parked mkdir anomaly (evidence appended, still no fix).
- **AC-7:** Final state — allowed-tools guard test and full npm test green at final HEAD.

### Explicitly out of scope

The installer permission migration (`--update-permissions`) — the former `todo/M-0004-installer-permission-migration.md` stub — is REFILED as its own mission at the next free ID (see Prompt 0) and gates `latest` promotion, not the 3.6.0 beta publish. Also out: the parked mkdir anomaly (optional bounded probe only — see Prompt 3), the parked template-hygiene candidate, the parked cd-prefixed-chain class, and anything not enumerated above. New discoveries get appended to the ledger with file:line evidence, never fixed in-mission.

---

## Pre-flight (Allen, PowerShell, after the closeout PR merges)

```powershell
git switch main
git pull
git switch -c mission/M-0004-worktree-guard-and-move-fixes
git push -u origin mission/M-0004-worktree-guard-and-move-fixes
```

---

## Prompt 0 — Setup, stub refile, M-0003 done transition

```
Begin mission M-0004 on branch mission/M-0004-worktree-guard-and-move-fixes, cut from main after the M-0003 closeout PR merged. FIXED facts: branch retention policy active; M-0003 evidence and ledger are final; the parked items (mkdir anomaly, template hygiene, cd-prefixed chains) stay parked.

TASK 0a — Stub refile (ruling already made, execute it): _planning/missions/todo/M-0004-installer-permission-migration.md is a placeholder stub (frontmatter id M-XXYA, "renumber on filing"). Refile it as its OWN mission: assign the next free ID via the mission tooling's auto-increment, rename the file to match (<new-id>-installer-permission-migration.md), set frontmatter id accordingly, resolve depends_on to M-0001 (least-privilege policy, done), keep priority 1 and codex.required: true, and append a frontmatter/body note: "Gates latest-tag promotion; does not block the 3.6.0 beta publish." Preserve the stub's body verbatim otherwise. The M-0004 ID belongs to THIS mission per the committed M-0003 ledger dispositions.

TASK 0b — Mission file: create the M-0004 mission file via the framework's mission tooling, titled "Worktree write guard, mission-move companions, CLAUDE.md batch", with the seven charter ACs. Move it todo -> doing via the standard transition.

TASK 0c — M-0003 done transition: git mv the M-0003 mission file review -> done. Note in its workpad that the closeout PR approval served as review.

STOP GATE: Report the refiled mission's new ID and filename, the M-0004 frontmatter, and git status. Do not commit. If the auto-increment produces an ID that collides with anything in any state directory, stop and report instead of forcing.
```

**Gate review:** confirm the refiled ID landed clean and the stub body survived verbatim. Then commit (this is the "first commit" carrying AC-5):

```
Commit as: "M-0004: mission open, installer-migration stub refiled as <new-id>, M-0003 review -> done". Push. Report SHA and stop.
```

## Prompt 1 — AC-1 + AC-2 (guard fix + grant, one unit)

```
Continue M-0004. TASK — Fix guard-main-branch.sh per AC-1 and grant EnterWorktree per AC-2, as ONE unit:

1. Read framework/scripts/guard-main-branch.sh and the worktree sections of apes-build.md to confirm the worktree root convention before writing anything.
2. Rework the guard to resolve the branch of the TARGET FILE's containing git worktree (git -C <target-dir> or equivalent), not the session cwd. Preserve existing behavior for paths outside any worktree. Windows-safe: no bashisms the shipped runner can't handle; hook must keep its fail-open safety net.
3. Regression tests: (a) write into a mission-branch worktree while session cwd is on main -> allowed; (b) write to a main-checked-out path -> blocked; (c) fail-open path unchanged.
4. Add EnterWorktree to shipped settings.json allow-list; update allowed-tools guard bookkeeping (covering declaration) in the same change. Evidence rule applies: exact form vs star per actual invocation evidence.
5. Run guard test + full npm test (Git Bash). Report counts.

STOP GATE: full diff, test counts, any new ledger candidates. No commit.
```

**Commit on approval:** `"M-0004 AC-1/AC-2: guard-main-branch resolves target-path worktree branch; EnterWorktree granted"`

## Prompt 2 — AC-3 (mission-cli move)

```
Continue M-0004. TASK — Fix mission-cli.js move per AC-3:

1. Reproduce first: a test fixture with a tracked mission file, an untracked companion evidence directory, and a pre-created destination review/<id>/ — confirm the current failure shape ("source directory is empty") before fixing.
2. Fix: git mv for tracked content; plain-rename fallback for untracked companions; tolerate pre-existing destination; the transition must remain atomic-in-effect (no half-moved mission on failure — report what rollback/ordering guarantees you implement).
3. Tests: the reproduction fixture passes; plain moves unaffected; failure mid-move leaves a recoverable, reported state.
4. Run guard test + full npm test. Report counts.

STOP GATE: full diff, the before/after reproduction evidence, test counts. No commit.
```

**Commit on approval:** `"M-0004 AC-3: mission-cli move handles untracked companions and pre-existing destinations"`

## Prompt 3 — AC-4 (CLAUDE.md batch) + optional bounded probe

```
Continue M-0004. TASK A — CLAUDE.md batch per AC-4: absorb the three entries from _planning/M-0002-process-notes-for-claude-md.md (then delete that file in the same change), add the session-cwd-vs-target-path hook defect-class hazard, add the RM-staging hazard. Respect the CLAUDE.md token budget; prune stale content if needed and report what was pruned.

TASK B (OPTIONAL, hard cap ~10 minutes): one interactive reproduction attempt of the parked mkdir allow-rule denial anomaly. If reproduced: append evidence (exact command, settings state, denial text) to the ledger. If not reproduced or the cap hits: append "repro attempted <date>, not reproduced" and move on. NO FIX either way. Skipping Task B entirely is acceptable.

STOP GATE: CLAUDE.md diff, pruning report, Task B outcome. No commit.
```

**Commit on approval:** `"M-0004 AC-4: CLAUDE.md hazard batch (M-0002 queue + cwd-vs-target-path + RM-staging)"`

## Prompt 4 — AC-6 dry-run, AC-7, closeout

```
Complete M-0004. TASK 1 — AC-6: re-run the AC-9-style headless /apes-build dry-run (same Task 3a probe method, Git Bash runner, fresh sample project). PASS means: zero Write denials into the worktree, no improvised-fallback cascade, no EnterWorktree prompt. Acceptable residuals: parked cd-prefixed-chain denials; the mkdir anomaly if it recurs (append evidence only). Any OTHER unintended denial: STOP and report the rule/site — no patching. Preserve the result JSON into the mission evidence directory.

TASK 2 — AC-7: guard test + full npm test at final HEAD. Exact counts.

TASK 3 — Closeout: finalize ledger dispositions; evidence packet (reference all M-0004 SHAs, the AC-6 before/after denial comparison against M-0003's ac9-result.json, AC-7 counts); closeout workpad entry; git mv doing -> review. Not done. Verify staged content includes post-move edits (RM-staging hazard — check committed contents after the commit lands).

STOP GATE: AC-6 comparison summary, AC-7 counts, ledger diff, git status. No commit.
```

**Commit on approval:** `"M-0004 closeout: AC-6 dry-run clean, evidence packet, mission doing -> review"` — then Allen opens the closeout PR, squash-merges, branch stays per retention policy.

---

## After M-0004 merges

3.6.0 beta is unblocked. Next artifact: the publish runbook session — fresh session from main, dual-publish convention (`--tag beta`; `latest` pinned at 3.0.0), SHA-pinned `v3.6.0` tag, BOM-safe writes. Then branch-retention sunset and the `dosapes` org migration mission. The refiled installer-permission-migration mission is the hard gate on any future `latest` promotion.

---

## Handoff prompt for the new Claude Desktop thread

Paste this as the first message of the new conversation, with this playbook file attached:

```
CPO context handoff — Dos Apes Framework, M-0004 execution thread.

State: M-0003 (body hygiene) is DONE — closed via two PRs (#19 checkpoint + closeout PR), evidence packet in review/M-0003/evidence/, all nine ACs dispositioned including the AC-9 live-fire dry-run that surfaced the defects M-0004 now fixes. 3.6.0 publish is gated behind M-0004 only.

This thread executes M-0004 per the attached charter + playbook. My role: run the pre-flight, paste prompts 0-4 into Claude Code sequentially, bring each STOP-gate report back here for your review and commit ruling. Your role: review gate reports against the charter, rule on deviations and new ledger candidates (default: park with evidence), issue commit instructions in imperative form only, keep commit messages ASCII-safe, never let the session expand scope beyond the seven ACs.

Standing rulings already made (do not reopen): the installer-permission-migration stub refiles as its own mission at the next free ID and gates latest promotion, not the 3.6.0 beta; the mkdir anomaly, template hygiene, and cd-prefixed chains stay parked; F-2/F-3 and all M-0003 dispositions are final; branch retention policy holds until 3.6.0 ships.

Expected decision points: Prompt 0's gate (refiled ID confirmation), Prompt 4's gate (any dry-run denial outside the two parked classes stops everything for a ruling). First action: confirm the M-0003 closeout PR is merged, then give me the pre-flight commands.
```
