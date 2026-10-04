# Stable and preview packaging verification

Date: 4 October 2026. Status: locally verified; publication authorised. Pages has been switched to Actions before the first push. Deployment results must still be checked after that push.

## Release boundary

The GitHub Pages API reported a successful deployment of commit `95c3b5a3fcb36b69dfae0db3d504014de40f01c9` on 22 September 2026. Its app version is `0.9.126-beta`. This exact commit is the initial stable pin. On 4 October, after publication approval, Pages was switched from legacy branch publication to Actions. The setting was read back, no queued or running legacy deployment was found, and the `github-pages` environment was restricted to `main` without changing its other protection settings.

The builder assembles that stable source at the root and an independent preview source under `preview/`. Stable application JavaScript, model files, CSS and media remain byte-identical to their Git blobs. Entry-point HTML receives navigation, metadata and cache identifiers. This is a release-shell change, not a physiological-model change.

Preview browser storage uses a separate namespace before any original script executes. This includes the inline mobile-routing preference, scores, campaign progress and settings. Stable keeps the existing keys. The two paths share an origin; this is accidental-data-use prevention, not isolation against malicious same-origin code.

## Findings resolved during implementation

1. **Missing bootstrap could bypass preview storage isolation.** An exception handler inside the bootstrap cannot handle a failed download of the bootstrap itself. An independent inline guard now stops loading and navigates to a static error page. The same error page handles unavailable storage installation. The initial `document.open` approach was rejected after browser testing showed that it left the parser stopped without a usable error page. **STATUS: ✅ FIKSET (2026-10-04).**
2. **Directory-wide JavaScript selection could admit unrelated development files.** Runtime script names and mobile entry points are now explicit. Local working-tree builds use tracked files only; ignored downloads, local launchers, reports and dependencies are excluded. The allowlist rejects the tested development-file examples. **STATUS: ✅ FIKSET (2026-10-04).**
3. **Cloned help templates retained moving `main` documentation links.** Generated HTML now pins those links to the channel's source commit, including links inside templates. Runtime link opening preserves this rule for dynamically created links. **STATUS: ✅ FIKSET (2026-10-04).**
4. **Dashboard window names and mobile share links crossed channels.** Dashboard names are channel-specific, and the mobile share destination follows the active channel. **STATUS: ✅ FIKSET (2026-10-04).**
5. **Locally deleted tracked files prevented a working-tree snapshot.** Such files are omitted; mandatory runtime entry points are still required. **STATUS: ✅ FIKSET (2026-10-04).**
6. **Diagram raster fallback images were excluded.** The primary SVG figures were included, but 14 diagram pages also referenced `validation.png` inside their object fallback. The allowlist now includes these PNG files, with a regression check for both figure formats. **STATUS: ✅ FIKSET (2026-10-04).**

## Verification

| Check | Result |
|---|---|
| Scoped-storage unit tests | 9/9 passed |
| Packaging tests, including source-file hashes and source-pinned documentation | 8/8 passed |
| Browser scenario groups against the committed package | 12/12 passed |
| Local working-tree package | Earlier 11 browser groups passed; the additional conflicting-routing-preference group was tested on the committed package |
| Uncaught JavaScript errors / missing local runtime assets in tested pages | 0 / 0 |
| Desktop viewports | 1280 × 800 and 1920 × 1080 |
| Touch-phone viewport | 375 × 667; both channels route to their own mobile shell |
| Text synchronisation | 851 Danish and 851 English keys; help markers matched |
| Intended-purpose text check | Passed |
| Workflow syntax and configuration | YAML parsed; manual-only trigger, default-false approval input and separate build/deploy permissions checked |

Browser checks exercised desktop campaign startup, the food panel, separate persistence, preview score deletion without stable data loss, independent dashboard windows, language changes, desktop/mobile navigation, channel switching, conflicting platform preferences, unavailable storage installation and a missing bootstrap script. Screenshots of the desktop, phone and failure page were inspected.

Two agents contributed a storage audit/adapter and the manual release workflow/documentation. Their actual changes were read and independently tested. The storage reviewer identified findings 1–3; accepted fixes were integrated before the final run.

Local Chrome was used. The standalone Playwright Chromium executable was not installed on this PC; no browser package was installed during the task. The workflow explicitly installs Chromium, but a real GitHub Actions run remains unverified until authorised activation. Tone.js was stubbed using the existing smoke-test double; CDN sound was not tested. These checks do not establish physiological validity or exhaustive gameplay correctness.

## Artefacts and activation

1. Source: `tools/releases/`, `.github/workflows/pages.yml`, and the three `tests/release-*` files.
2. Local working-tree site: `.release-builds/local-channels-20261004-c/`.
3. Committed site tested in Chrome: `.release-builds/test-1791112439283/`.
4. Final browser results/screenshots: `tests/playwright/release-channels-1791112517166/`; earlier working-tree results: `tests/playwright/release-channels-1791112409233/`.
5. Activation procedure: `docs/RELEASE-CHANNELS.md`. Pages must be switched from legacy branch publication to Actions **before** an approved push; otherwise pushing still replaces the public root directly.

Summary: 6 implementation findings fixed. Publication has been approved and the hosting configuration changed; a successful Actions run and public endpoint verification are still required. Uncommitted exercise-model and slogan revisions are excluded from the release candidate. The historical test results above describe the pre-activation package; the final commit is tested again before deployment.
