# MoonTVPlus local customization ledger

Last reviewed: 2026-08-30

This ledger records behavior that matters to the fork. Preserve the intent, not blindly the current code. When upstream supplies an equivalent implementation, prefer the upstream version and update this document.

## Canonical repositories and production

- Fork: `https://github.com/wukai424/MoonTVPlus`
- Upstream: `https://github.com/mtvpls/MoonTVPlus`
- Production: `https://kaitv.qzz.io/`
- Reviewed upstream head: `701c3d2` (`v225.0.1` at review time; always refresh before maintenance)
- Reviewed fork main: `2fda3b6` (always refresh before maintenance)

## Customization ledger

### Search and detail compatibility

- Intent: preserve private-library-only searches and the fork's authenticated/local username fallback while accepting upstream search changes.
- Primary paths: `src/app/api/search/route.ts`, `src/app/api/detail/route.ts`, `src/components/DetailPanel.tsx`, `src/components/EpisodeSelector.tsx`.
- Verify: authenticated search, private-only search, detail metadata, source selection, and episode list.

### Documentary navigation

- Intent: retain the dedicated documentary entry and page.
- Primary paths: `src/app/documentary/page.tsx`, `src/components/Sidebar.tsx`, `src/components/MobileBottomNav.tsx`.
- Verify: desktop and mobile navigation, theme selection, and detail opening.

### Danmaku behavior

- Intent: retain source filtering/blacklists, count information, selection behavior, cache controls, and web/TV presentation while incorporating upstream conversions and API fixes.
- Primary paths: `src/app/api/danmaku/comment/route.ts`, `src/lib/danmaku/`, `src/components/DanmakuPanel.tsx`, `src/app/play/page.tsx`, `src/app/tv/play/page.tsx`.
- Verify: load, filtering, counts, episode matching, cache behavior, and web/TV display settings.

### Net-disk proxies

- Intent: retain deployable Baidu and Quark proxy configuration while accepting upstream authentication and cookie-renewal improvements.
- Primary paths: `src/lib/netdisk/baidu.client.ts`, `src/lib/netdisk/quark.client.ts`.
- Verify: environment override precedence, authentication renewal, listing, and playback. Never print proxy secrets or cookies.

### Shared ad filtering

- Intent: keep the control-panel custom script as the primary rule surface and ensure web and TV HLS playback can use the shared server filter without double filtering.
- Primary paths: `scripts/custom-ad-filter.js`, `src/app/play/page.tsx`, `src/app/tv/play/page.tsx`, `src/components/tv/player/TVNativeVideo.tsx`, `src/components/tv/player/utils.ts`, related tests.
- Verify: filtering on/off, web/TV playback, cue blocks, normal discontinuities, master playlists, MP4 behavior, and false-positive cases.
- Decision: do not restore broad short-segment or ordinary-discontinuity deletion. The repository script is a conservative fallback and must not automatically overwrite the user's control-panel configuration.

### Fork-owned Docker publishing

- Intent: fork workflows publish full and lite images to the current repository owner's GHCR namespace and do not publish images during PR validation.
- Primary paths: `.github/workflows/docker-image.yml`, `.github/workflows/docker-image-lite.yml`.
- Verify: workflow YAML, trigger conditions, lowercase owner resolution, both architectures, manifest creation, and cleanup jobs.

### Local environment protection

- Intent: prevent Vercel metadata and local environment files from entering Git.
- Primary path: `.gitignore`.
- Verify: `.vercel` and `.env*` remain ignored and no secret values appear in diffs or logs.

## Maintenance rule

Whenever the diff against upstream changes, update the relevant entry with current intent, primary paths, upstream replacements, new acceptance evidence, and obsolete routes that can be removed.

Do not add a customization merely because the fork differs from upstream. Record only behavior deliberately retained for the user.
