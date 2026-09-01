### Worktree and simulator cleanup

**You own the disk and the safety gate.** Prune merged or abandoned git worktrees and stale iOS simulators to reclaim space. Deletion is irreversible, so every step guards against deleting something in use or holding uncommitted work.

1. Snapshot and audit. Record `df -h /`, then run `scripts/worktree-audit.sh` (principle-build-the-lever). It reads paths from `git worktree list`, never hand-typed. It classifies each worktree by size, age, merge state, uncommitted work, remote state, and PR state, then suggests a bucket.
2. The bucket is advice, not permission. Use `find_thread file:<path>` for each deletion candidate and read matching active Amp threads. Pinned or active threads and running child agents win over the heuristic.
3. Verify usage before deleting. Check current processes, open PRs, running Amp threads, and branch ownership. A parent thread may have spawned work in sibling worktrees whose names never appear in its latest message.
4. Pause on irreversible loss. `wip:N` is N tracked uncommitted edits. Show the diff and get a decision first, since removing a clean worktree is recoverable from its branch but uncommitted work is gone. `scratch:N` is untracked throwaway, safe to drop, but name the files. Per Autonomy, clean and merged and not-in-use proceeds; `wip` and in-use pause.
5. Prune the confirmed set. Per path, `git worktree remove --force <path>`; if the dir survives on ignored build artifacts, `rm -rf` it, then `git worktree prune`. Branch refs survive, so no commits are lost. Confirm with `df -h /` and re-list.
6. Simulators and other reclaimers. On macOS, simulators are often the next-biggest win: `xcrun simctl --set testing delete all`, `xcrun simctl delete unavailable`, then remove explicitly obsolete runtimes. Other candidates include Xcode `DerivedData`, `iOS DeviceSupport`, and package caches. Clear only caches the user explicitly authorizes.

This is the one playbook that deletes user state with no code review to catch a slip, so the gates above are the review.

**Reply:** `df -h /` before and after with space reclaimed, the worktrees pruned, and a one-line reason for each held back (in-use by which chat, or uncommitted work).
