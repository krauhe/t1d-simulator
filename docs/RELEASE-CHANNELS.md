# Single public release

The Pages site contains one playable T1D Simulator release at its root. The former `preview/` entry points redirect to that release. Local experiments and mockups are excluded from the published artifact.

## Build and publication boundary

1. `tools/releases/build-pages.cjs` reads the selected Git commit (`HEAD` by default) and copies only its explicit runtime allowlist. It does not publish the repository root, development notes, raw research, mockups, dependencies or local test results.
2. Application JavaScript, CSS and media are copied byte-for-byte from the source commit. Main HTML entry points gain release metadata and cache identifiers; documentation links target the selected commit. No channel switch, preview badge or storage wrapper is added.
3. `release-manifest.json` uses schema 2 and records one `release`: source commit, app version, source-file SHA-256 hashes and content identifier. `localWorkingTree` distinguishes local experiments from committed releases. The generated metadata helper has its own `shellHash`.
4. Old `preview/index.html`, `preview/mobile/index.html`, dashboard and model-validation entry points are small redirects, not second applications. Normal root storage remains in use. Historical `t1d-preview:` browser keys are neither copied nor deleted.
5. `tools/releases/channels.json` retains the historical stable pin for reference, but is not read by the single-release builder. Its commit is not an automatically selected release. Older runtime source remains recoverable through Git history.
6. Output must be a new directory under `.release-builds/`. Existing directories are never overwritten. Choose a new name when repeating a build.
7. A push does not deploy the site when Pages is configured for GitHub Actions. Only the manually dispatched **Publish T1D Simulator** workflow publishes the tested artifact.

## Local verification

Use Node.js 22 or newer from the repository root:

```powershell
node tests/release-build.test.cjs
node tools/releases/build-pages.cjs --out .release-builds/committed-check
node tests/release-browser.cjs .release-builds/committed-check --chromium
```

The browser check requires the locked Playwright dependencies and Chromium. If they are missing:

```powershell
npm ci --ignore-scripts
npx --no-install playwright install chromium
```

For local edits, build a separate, explicitly unpublished artifact:

```powershell
node tools/releases/build-pages.cjs --out .release-builds/local-check --working-tree
node tests/release-browser.cjs .release-builds/local-check --chromium
```

A working-tree build includes only tracked runtime files. New runtime scripts need both Git staging and an allowlist entry. Its documentation links still refer to the base commit, which may not contain uncommitted documentation. Never upload a working-tree artifact to Pages.

`--ref <commit>` selects an exact source commit for local inspection. The normal publication workflow intentionally uses its selected `main` commit and verifies that the manifest matches `GITHUB_SHA`. `RELEASE_TEST_PORT` can override the browser test's default localhost port 8765 when another local test owns that port.

The release smoke test checks packaging, Campaign startup, dashboard, desktop/mobile routing, redirects and missing local assets. It stubs Tone.js and is not a substitute for the physiology, translation and gameplay checks appropriate to the app changes.

## Publishing an approved release

1. Finish and test the intended app changes. Review local modifications so unrelated work is not accidentally included.
2. Confirm Settings > Pages > Build and deployment > Source is **GitHub Actions**. Legacy branch publishing would deploy ordinary pushes and bypass this workflow. Do not delete or unpublish the site, and do not switch back to branch publishing as a workaround.
3. Confirm the `github-pages` environment is restricted to `main`. Configure any required reviewer according to the owner's chosen approval policy.
4. Follow the repository's version rules for the approved push: increment the patch version, update date and player-facing history, synchronise CSS/JS cache versions in desktop and mobile entry points, and run version/text checks.
5. Commit and push only the approved changes. Keep the previous release SHA in Git history; create or publish a restore tag only when authorised. The push alone does not publish Pages.
6. Dispatch **Publish T1D Simulator** on `main` with the explicit publication input checked. Verify the selected commit before starting the run. The workflow builds one root release, checks the manifest against that commit, runs the browser check and uploads only the tested artifact.
7. Verify the completed deployment, the public root and mobile app, the old preview redirects and the live `release-manifest.json`. A successful local build or push alone is not proof of publication.

The workflow has no push or pull-request trigger. Its build job can only read repository content; only the separate deployment job receives Pages-write and OIDC permissions. `configure-pages` has automatic enablement disabled. Deployment runs are serialised rather than cancelling an in-progress publication.

## Restoring an earlier release

Select the earlier known-good source from Git history and obtain approval to restore it. Do not reset the development branch or discard current work. Use a normal reviewed revert or restoration commit that preserves the single-release packaging contract, apply the normal version/history rules, test it and publish through the manual workflow. The resulting source SHA may differ from the historical commit; the manifest must report the actual release source honestly.

For investigation, `--ref <historical-commit>` can package an earlier source without changing the worktree or hosting. Local historical builds do not bypass the normal publication tests or approval boundary.
