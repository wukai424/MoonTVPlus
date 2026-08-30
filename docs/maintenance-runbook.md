# MoonTVPlus maintenance runbook

This runbook governs maintenance of `wukai424/MoonTVPlus` against `mtvpls/MoonTVPlus`, with production at `https://kaitv.qzz.io/`.

## 1. Execution contract

Before writes, record:

```text
Task type:
Target outcome:
In scope:
Out of scope:
Stable baseline:
Planned actions:
Acceptance gates:
Stop conditions:
Rollback point:
Production authority:
```

Classify the task as upstream sync, ad-filter maintenance, video-source diagnosis or repair, and/or deployment/workflow repair.

## 2. Preflight and backup

1. Inspect the worktree and preserve unrelated changes.
2. Fetch `origin` and the canonical upstream remote.
3. Record `origin/main`, upstream head, merge bases, tree differences, production deployment, and current workflow health.
4. Confirm the production site still reaches the known-good login and critical routes.
5. For upstream work, create and push `backup/pre-sync-<version>-<YYYYMMDD>` from the current stable main.
6. Create a dedicated topic branch. Never develop directly on `main`.

## 3. Upstream integration

1. Read `docs/local-customizations.md` and compare its ledger with the live diff between upstream and `origin/main`.
2. Inspect history for earlier upstream merges, reverts, or multiple merge bases.
3. Use an ordinary merge only when Git history represents the real content delta. If history is misleading, reconstruct from the upstream head and explicitly merge the known-good customization baseline.
4. Resolve only genuine conflicts. For every resolution, record upstream behavior, fork intent, the chosen implementation, and its verification method.
5. Review the full tree diff. Remove obsolete compatibility routes or proxies when upstream now provides the intended behavior.
6. Reconcile the topic branch with current `origin/main` without changing its file tree before opening the final PR.

## 4. Ad-filter maintenance

1. Determine whether the issue is a rule problem or a playback path that bypasses the shared filter.
2. Prefer editing the control-panel custom script for rule-only changes.
3. Add code only when web, TV, or a proxy route cannot consume the shared rule correctly.
4. Accept high-confidence URL markers and explicit HLS cue blocks. Treat ordinary discontinuities, intros, transitions, and short segments as content unless evidence proves otherwise.
5. Add regression tests for every newly supported marker and likely false positive.
6. Test filtering enabled and disabled, on web and TV where affected.

## 5. Video-source diagnosis

Locate the first failed boundary instead of applying a broad proxy immediately:

1. search API and expected result shape;
2. source detail and episode list;
3. episode URL resolution;
4. valid HLS playlist retrieval;
5. media segment reachability;
6. browser playback startup and stability.

Test local and Vercel paths separately. Record results per source. A local success does not prove Vercel egress, and one failed source does not prove a global regression.

## 6. Automated verification

Install dependencies without modifying the lockfile, then run checks appropriate to the change. Default gates are:

```text
pnpm typecheck
pnpm test
pnpm build
```

Run targeted lint for changed files. Report repository-wide pre-existing lint debt separately from new regressions. Validate modified workflow YAML and inspect its target owner, triggers, permissions, and publish conditions.

## 7. Preview gate

Push the topic branch and open a Draft PR. Wait for Vercel `Ready`, then verify with real configuration:

1. login and home page;
2. representative searches and source list;
3. detail and episodes;
4. at least one HLS playback path;
5. web and TV behavior when affected;
6. ad filtering on and off when affected;
7. browser console/runtime errors and required workflows.

If deployment protection prevents meaningful verification, keep the PR in Draft. Do not use build success as a substitute.

## 8. Production release

After the user or an authenticated verifier confirms Preview:

1. ensure the PR is mergeable and required checks pass;
2. preserve history needed for future upstream merges;
3. merge without deleting the backup branch;
4. wait for production `Ready` and confirm `kaitv.qzz.io` points to it;
5. verify login and critical protected-route behavior;
6. inspect recent production errors;
7. wait for full and lite Docker workflows when triggered;
8. report warnings separately from failures.

## 9. Stop and rollback

Stop at the first unresolved acceptance boundary. Do not announce completion for partial source recovery.

If production regresses, identify the exact known-good commit and tree, compare it with the backup branch, restore through a reviewable branch/PR or appropriate deployment rollback, verify the restored production path, and update the ledger or runbook when the failure reveals a reusable rule.

## 10. Completion report

Report the baseline, backup branch, topic branch, commits, PR, upstream head, automated and deployed checks, search/detail/playback evidence, production workflows, remaining risks, and rollback point.
