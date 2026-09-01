#!/usr/bin/env bash
# Read-only worktree prune audit. Classifies every git worktree by size, merge
# state, uncommitted work, remote/PR state, and the newest Amp thread that
# touched its path or branch. Emits a table sorted by size with a suggested
# bucket. Never deletes anything; deletion stays a human-gated step in the
# playbook.
#
# Usage: worktree-audit.sh [repo-path]   (defaults to the current repo)
# AMP_THREADS_SEARCH, if set, is the command used instead of
# `amp threads search --json`. Tests inject a stub here.
set -u

repo="${1:-$(git rev-parse --show-toplevel 2>/dev/null)}"
[ -z "$repo" ] && { echo "not in a git repo; pass a repo path" >&2; exit 1; }
cd "$repo" || exit 1

# Main worktree is the first entry; everything else is a candidate.
main_wt=$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')

# origin/main drives the merge check. Best-effort; stale is fine for a first pass.
git fetch origin main --quiet 2>/dev/null || echo "warn: could not fetch origin/main; merged column may be stale" >&2

# PR state by branch, fetched once. Empty if gh is unavailable.
prs=$(mktemp)
gh pr list --author "@me" --state all --limit 1000 \
	--json number,state,headRefName 2>/dev/null > "$prs" || echo "[]" > "$prs"

now=$(date +%s)
searcher=${AMP_THREADS_SEARCH:-}

search_threads() {
	local query="$1"
	if [ -n "$searcher" ]; then
		"$searcher" "$query" 2>/dev/null || echo "[]"
	else
		amp threads search --json -n 5 "$query" 2>/dev/null || echo "[]"
	fi
}

newest_thread() {
	local wt="$1" branch="$2"
	local json hits="[]"
	json=$(search_threads "file:${wt}")
	if [ -n "$branch" ]; then
		hits=$(search_threads "$branch")
		json=$(jq -s 'add' <(printf '%s' "$json") <(printf '%s' "$hits") 2>/dev/null || echo "[]")
	fi
	printf '%s' "$json" | jq -r --arg now "$now" '
		if type != "array" then empty
		elif length == 0 then empty
		else
			(sort_by(.updatedAt) | reverse | .[0]) as $t
			| ($t.updatedAt | fromdateiso8601? // 0) as $ts
			| "\($t.id // "-")\t\($ts)"
		end
	' 2>/dev/null
}

printf "SIZE\tAGE\tMERGED\tDIRTY\tREMOTE\tPR\tLAST_THREAD\tBUCKET\tWORKTREE\n"

git worktree list --porcelain | awk '/^worktree /{print $2}' | while read -r wt; do
	[ "$wt" = "$main_wt" ] && continue

	size=$(du -sh "$wt" 2>/dev/null | awk '{print $1}')
	head=$(git -C "$wt" rev-parse HEAD 2>/dev/null)
	head_ts=$(git -C "$wt" log -1 --format='%ct' HEAD 2>/dev/null || echo 0)
	age=$([ "$head_ts" -gt 0 ] 2>/dev/null && echo "$(( (now - head_ts) / 86400 ))d" || echo "?")

	# Squash-merged branches are not ancestors of main, so PR state is the
	# real signal; merge-base only catches fast-forward/rebase merges.
	git merge-base --is-ancestor "$head" origin/main 2>/dev/null && merged=YES || merged=no

	# Distinguish real WIP (tracked edits) from disposable untracked scratch.
	porcelain=$(git -C "$wt" status --porcelain 2>/dev/null)
	if [ -z "$porcelain" ]; then dirty=clean
	elif printf '%s\n' "$porcelain" | grep -qv '^??'; then
		dirty="wip:$(printf '%s\n' "$porcelain" | grep -cv '^??')"
	else dirty="scratch:$(printf '%s\n' "$porcelain" | grep -c '^??')"; fi

	branch=$(git -C "$wt" symbolic-ref --quiet --short HEAD 2>/dev/null || echo "")
	if [ -z "$branch" ]; then remote=detached
	elif git -C "$wt" show-ref --verify --quiet "refs/remotes/origin/$branch"; then
		[ "$(git -C "$wt" rev-parse "origin/$branch" 2>/dev/null)" = "$head" ] \
			&& remote=pushed \
			|| remote="ahead$(git -C "$wt" rev-list --count "origin/$branch..HEAD" 2>/dev/null)"
	else remote=no-remote; fi

	pr=$([ -n "$branch" ] && jq -r --arg b "$branch" \
		'.[] | select(.headRefName==$b) | "#\(.number)/\(.state)"' "$prs" 2>/dev/null | head -1)
	[ -z "$pr" ] && pr="-"

	thread_row=$(newest_thread "$wt" "$branch")
	if [ -z "$thread_row" ]; then
		if [ -n "$searcher" ] || command -v amp >/dev/null 2>&1; then
			last="-"
			last_ts=0
			amp_ok=yes
		else
			last="unavailable"
			last_ts=0
			amp_ok=no
		fi
	else
		last=$(printf '%s' "$thread_row" | awk -F'\t' '{print $1}')
		last_ts=$(printf '%s' "$thread_row" | awk -F'\t' '{print $2}')
		amp_ok=yes
	fi
	recent=$([ "$last_ts" -gt 0 ] 2>/dev/null && [ $(( (now - last_ts) / 86400 )) -le 4 ] && echo yes || echo no)

	case "$dirty" in wip:*) bucket=hold-wip ;; *)
		case "$pr" in *OPEN*) bucket=hold-open-pr ;; *)
			if [ "$recent" = yes ]; then bucket=hold-recent-thread
			elif [ "$amp_ok" = no ]; then bucket=verify-thread-then-safe
			elif [ "$merged" = YES ] || [ "$pr" != "-" ]; then bucket=safe
			else bucket=review; fi ;;
		esac ;;
	esac

	printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
		"$size" "$age" "$merged" "$dirty" "$remote" "$pr" "$last" "$bucket" "$wt"
done | sort -t$'\t' -k1,1 -rh

rm -f "$prs"
