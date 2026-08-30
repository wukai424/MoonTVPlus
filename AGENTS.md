# MoonTVPlus fork maintenance rules

These rules apply to all work in this repository.

## Required preparation

Before modifying files, pushing a branch, changing deployment configuration, or merging a pull request:

1. Inspect the dirty worktree, current `origin/main`, upstream head, deployment state, and relevant workflows.
2. State the task type, target outcome, in-scope and out-of-scope behavior, planned actions, acceptance gates, stop conditions, and rollback point.
3. Read `docs/maintenance-runbook.md`. For upstream sync or conflict resolution, also read `docs/local-customizations.md`.

## Non-negotiable safeguards

- Do not use GitHub **Sync fork** and do not make maintenance changes directly on `main`.
- Preserve unrelated user changes and existing configuration. Never expose or overwrite secrets during diagnosis.
- Before an upstream integration, create a dated remote backup branch from the current stable main.
- Inspect commit history and file-tree differences before selecting merge, rebase, cherry-pick, or reconstruction. Prior merge/revert history must not be treated as a normal clean merge.
- Preserve the intent recorded in `docs/local-customizations.md`; an upstream implementation may replace a local one only when it demonstrably satisfies the same intent.
- Keep the pull request in Draft until automated checks and the relevant Preview flows pass.
- A successful build is not sufficient for playback changes. Validate login, search, detail, episode resolution, playlist retrieval, and real playback in the target deployment environment.
- Do not merge when Preview is inaccessible or materially unverified. Merge to production only after the user or an authenticated verification confirms the acceptance gates.
- After merge, wait for production `Ready`, verify the production alias and critical routes, inspect runtime errors, and wait for relevant GitHub workflows.
- If the result is worse than the stable baseline, stop speculative repair and use the recorded rollback point.

## Feature-specific boundaries

- Ad filtering: prefer the control-panel custom script; change code only to connect missing playback paths. Do not broadly remove normal discontinuities or short media segments.
- Video sources: locate the first failing boundary and test from Vercel. Do not infer application failure from one source or infer Vercel reachability from local reachability.
- Workflow publishing: fork workflows must target resources owned by the current repository owner, never hardcoded upstream-owner packages or deployments.

Update `docs/local-customizations.md` whenever a customization is added, removed, replaced by upstream, or changes its verification method.
