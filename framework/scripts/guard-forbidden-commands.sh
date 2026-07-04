#!/bin/bash
# PreToolUse hook (matcher: Bash) — deterministic backstop for the shipped
# permission policy (M-0001 AC #7). Prefix-based deny rules can't match flag
# reordering, flag respellings, or forbidden commands buried in compound
# chains; this script regex-scans the FULL command string and blocks with
# exit 2 + plain-text stderr (the documented blocking interface).
#
# Forbidden set (exactly the deny-audit fall-through spellings):
#   - npm publish / version / dist-tag / unpublish / deprecate (any position)
#   - force push in any spelling or flag position, incl. --force-with-lease
#     and +refspec force pushes
#   - remote branch deletion via refspec (git push origin :branch)
#   - recursive+force rm respellings (-fr, -r -f, --recursive --force)
#     aimed at absolute (/), home (~), or parent (..) targets
#
# Overmatch policy: this is a backstop, so a false block beats a false pass.
# Quotes count as token boundaries — `bash -c "npm publish"` is blocked, and
# so is the rare-but-harmless `echo "npm publish"`.
#
# Fail-closed: NO `|| true` wrapper, and an internal error blocks rather than
# passes. A blocking hook that can't block is worse than none.

set -u
trap 'echo "dos-apes guard: internal error in guard-forbidden-commands.sh — failing closed (command blocked). Re-run manually if this is a guard bug." >&2; exit 2' ERR

INPUT=$(cat)

# Extract tool_input.command from the hook's stdin JSON. Node is a hard
# dependency of the framework (installed via npx); if it is missing OR the
# envelope doesn't parse, fall back to scanning the raw input — may overmatch
# on other fields, but a backstop must not undermatch.
if command -v node >/dev/null 2>&1; then
  CMD=$(printf '%s' "$INPUT" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);process.stdout.write(String((j.tool_input&&j.tool_input.command)||""))}catch(e){process.stdout.write(d)}})')
  if [ -z "$CMD" ]; then
    exit 0  # valid envelope with no command (not a Bash call) — nothing to guard
  fi
else
  CMD="$INPUT"
fi

block() {
  echo "dos-apes guard: blocked forbidden command — $1. This operation is human-only under the shipped permission policy (see SECURITY.md); ask the maintainer to run it. If your command merely QUOTED a forbidden string (e.g. in a commit message or echo), rephrase the quoted text so it no longer spells the command and retry." >&2
  exit 2
}

# Normalize whitespace so multi-line and tab-separated spellings match.
NORM=$(printf '%s' "$CMD" | tr '\n\t' '  ')

# Token boundary before a command word: start, chain/group chars, whitespace,
# or quotes (quotes deliberately included — see overmatch policy above).
B_PRE='(^|[;&|[:space:]("'"'"'`])'
B_POST='([[:space:]]|$|[;&|)"'"'"'])'

# ── npm registry-mutating lifecycle commands ────────────────────────────────
# Flags may sit between `npm` and the verb, either as single tokens
# (npm --force unpublish, npm --registry=X publish) or as flag/value pairs
# (npm --registry https://X publish, npm -w packages/foo publish). Each
# pre-verb group must START with a `-` flag, so subcommands never match:
# `npm run publish` / `npm run version` stay user scripts, not registry ops.
if printf '%s' "$NORM" | grep -Eq "${B_PRE}npm([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+(publish|version|dist-tag|unpublish|deprecate)${B_POST}"; then
  block "npm publish/version/dist-tag/unpublish/deprecate mutates the npm registry"
fi

# ── Per-segment checks: split compound chains (&&, ||, ;, |, &, newlines) ──
SEGS=$NORM
SEGS=${SEGS//&&/$'\n'}
SEGS=${SEGS//||/$'\n'}
SEGS=${SEGS//;/$'\n'}
SEGS=${SEGS//|/$'\n'}
SEGS=${SEGS//&/$'\n'}

while IFS= read -r SEG; do
  # git push segment?
  if printf '%s' "$SEG" | grep -Eq "${B_PRE}git[[:space:]]" && \
     printf '%s' "$SEG" | grep -Eq "${B_PRE}push${B_POST}"; then
    # Force flag in ANY position: --force, --force-with-lease[=ref],
    # --force-if-includes, or short-flag bundle containing f (-f, -fu, ...).
    if printf '%s' "$SEG" | grep -Eq '(^|[[:space:]"'"'"'])(--force(-with-lease|-if-includes)?(=[^[:space:]]*)?|-[A-Za-z]*f[A-Za-z]*)([[:space:]]|$|["'"'"'])'; then
      block "force push (any flag spelling or position)"
    fi
    # Force push via +refspec (git push origin +main).
    if printf '%s' "$SEG" | grep -Eq '(^|[[:space:]])["'"'"']?\+[^[:space:]]'; then
      block "force push via +refspec"
    fi
    # Remote deletion via empty-source refspec (git push origin :branch).
    if printf '%s' "$SEG" | grep -Eq '(^|[[:space:]])["'"'"']?:[^[:space:]"'"'"']'; then
      block "remote branch deletion via refspec (git push origin :branch)"
    fi
  fi

  # rm segment: recursive AND force in any spelling, aimed at /, ~, or ..
  if printf '%s' "$SEG" | grep -Eq "${B_PRE}rm[[:space:]]"; then
    if printf '%s' "$SEG" | grep -Eq '(^|[[:space:]])(-[A-Za-z]*[rR][A-Za-z]*|--recursive)([[:space:]]|$)' && \
       printf '%s' "$SEG" | grep -Eq '(^|[[:space:]])(-[A-Za-z]*f[A-Za-z]*|--force)([[:space:]]|$)' && \
       printf '%s' "$SEG" | grep -Eq '(^|[[:space:]])["'"'"']?(/|~|\.\.)'; then
      block "recursive force rm aimed at an absolute, home, or parent path"
    fi
  fi
done <<< "$SEGS"

exit 0
