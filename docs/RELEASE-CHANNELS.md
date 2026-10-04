# Stable and preview release channels

This document describes the local release tooling and the separately authorised GitHub Pages activation procedure. Creating these files does not change GitHub settings, create a release tag, push code, or publish a site.

## Public layout and release boundary

1. The site's existing root is the **stable** channel. `tools/releases/channels.json` pins its complete source commit and expected app version. The initial pin is `95c3b5a3fcb36b69dfae0db3d504014de40f01c9`, version `0.9.126-beta`, verified against the deployment from 22 September 2026.
2. `preview/` is the only other public channel. A manual workflow run builds it from that run's selected `main` commit. A newer push does not update either public channel by itself once Pages is configured to use GitHub Actions.
3. Both channels are packaged and published together. Previous versions remain recoverable through Git history and explicitly created release tags; there are no additional public version folders.
4. “Stable” identifies the selected release, not a claim that the model is clinically validated or free of defects. The simulator remains an educational game, not individual treatment guidance.

## How the build works

1. `tools/releases/build-pages.cjs` reads the pinned stable commit directly from Git and reads preview from `HEAD` by default. A full Git history is required in CI so the older stable commit is available.
2. The build copies an explicit allowlist of public runtime files. Repository history, development notes, raw research files, dependencies and local test outputs are not a second website to upload. Upload only the generated directory, never the repository root.
3. Stable JavaScript, model code, styles and assets are copied byte-for-byte from the pinned commit. Selected HTML entry points gain the channel controls and release metadata, and local CSS/JavaScript URLs receive a release cache identifier. The original stable source files in Git are not changed. This is therefore a preserved runtime with an added release interface, not a byte-identical copy of every deployed HTML file.
4. Preview receives visible preview identification. Its browser-storage access is scoped to preview; stable keeps its existing keys. The channel switch does not copy settings, progress, scores or other saved values between channels. This prevents accidental cross-channel state use by the app; it is not an origin-level security boundary between two sites hosted on the same origin.
5. `release-manifest.json` records each channel's version, commit and source-file hashes, plus whether local working files were included. The workflow refuses a local-working-tree build and checks that preview matches the workflow's selected commit.
6. The build requires a new output directory under `.release-builds/`. It refuses to overwrite an existing directory. Choose a new directory name for each repeat; do not delete a broad workspace directory to make a build succeed.
7. Local working-tree builds include only tracked runtime files. New scripts require an explicit addition to the builder's runtime list and Git staging. Documentation links target each channel's source commit; an uncommitted local preview can therefore contain newer changes than the linked documentation.

## Local verification without publishing

Run these commands from the repository root with Node.js 22 or newer. On this Windows installation, `tests/.bin/node.exe` can be used in place of `node` if the portable runtime is present.

```powershell
node tests/release-storage.test.cjs
node tests/release-build.test.cjs
node tools/releases/build-pages.cjs --out .release-builds/committed-check
```

That build uses committed preview files. To inspect uncommitted local runtime changes, use a separate directory and the explicit local-only flag:

```powershell
node tools/releases/build-pages.cjs --out .release-builds/local-check --working-tree
```

The stable pin is unchanged in both cases. The second build is marked as local and must not be uploaded to Pages.

Install the locked browser-test dependencies if needed, then run the browser check against the actual generated artifact:

```powershell
npm ci --ignore-scripts
npx --no-install playwright install chromium
node tests/release-browser.cjs .release-builds/local-check --chromium
```

Use `.release-builds/committed-check` instead to check the committed artifact. The browser smoke test is a release-packaging check, not a replacement for physiology, translation and gameplay checks appropriate to the changes being released.

## First activation: order matters

Do not perform these steps without explicit user approval to change hosting settings and publish. Approval to implement the tooling locally is not publication approval.

1. Review the intended publication commit and the stable pin. Keep unrelated local changes out of the release unless explicitly approved. Run the local release checks and the relevant model/gameplay checks. Confirm the existing stable source commit is still available with `git show 95c3b5a3fcb36b69dfae0db3d504014de40f01c9:js/version-data.js`.
2. **Before any push, change Settings > Pages > Build and deployment > Source from “Deploy from a branch” to “GitHub Actions”.** The legacy `main`/root setting publishes ordinary pushes directly and bypasses this stable pin. Merely adding the manual workflow does not disable that legacy behaviour. Check the saved setting and make sure no old branch-based deployment remains queued or running before proceeding. Do not delete or unpublish the Pages site.
3. In Settings > Environments, restrict the `github-pages` environment to the `main` branch. Enable a required reviewer when available and appropriate. This complements the workflow's `main` guard; it must not be assumed to exist merely because the workflow names the environment.
4. With publication approval, prepare the release commit under the existing `AGENTS.md` rules: increment the app patch version, update its date and player-facing history, synchronise the local CSS/JavaScript cache versions in both HTML entry points, and run the required version/text checks. Do not change the stable pin simply because preview has a new version.
5. If explicitly authorised, create an annotated restore tag for the known stable source before its first replacement. For the initial pin, an example is `git tag -a stable-0.9.126-beta 95c3b5a3fcb36b69dfae0db3d504014de40f01c9 -m "Stable source verified from the 2026-09-22 deployment"`. Check for an existing tag first; never force-update one. Creating or publishing a tag requires approval and is not part of local verification.
6. Commit and push only the approved changes to `main`; publish only the specifically approved tag if one was created. With the Pages source now set to Actions, this push does not deploy the site. The workflow must be present on the default branch before its manual run control is available.
7. Open Actions > Publish stable and preview > Run workflow, select `main`, review its commit, and tick the explicit publication approval input. The run builds both channels, runs the release tests and Chromium smoke test, uploads only the tested artifact, and then deploys it through `github-pages`.
8. Check that the workflow completes successfully. Open the published root and `preview/`, including their mobile entry points and channel switches. Verify the displayed versions and the deployed `release-manifest.json` against the intended commits. A successful local build or push alone is not proof of a successful public deployment.

If a step fails, stop before the next publication step. Do not switch back to legacy branch publishing as a workaround; it would reintroduce automatic publication of `main`.

## Updating preview after activation

1. Test the intended changes. Follow the repository's version, history, translation and cache-version rules for every approved push.
2. Commit and push only with explicit approval. Leave `stableCommit` and `stableVersion` unchanged.
3. When preview publication is approved, manually run **Publish stable and preview** on `main` and approve its publication input. Preview changes to the selected commit; the root remains built from the stable pin.
4. Verify both deployed channels and the manifest. Concurrency serialises deployment runs; do not dispatch several runs as a substitute for inspecting the first result.

## Promoting a tested preview to stable

1. Select the exact preview source commit that has passed the agreed tests and user acceptance. Do not use an uncommitted working-tree build as a promotion candidate.
2. Obtain explicit approval for promoting that commit to the root. Record the old stable SHA and version; retain them in Git history and, when authorised, an annotated restore tag. Do not rewrite or force-move existing release tags.
3. Change `stableCommit` and `stableVersion` together in `tools/releases/channels.json` to the selected commit and its actual `js/version-data.js` version. The builder rejects a commit/version mismatch. Keep provenance fields accurate: a planned deployment is not an already verified publication timestamp.
4. Build into a fresh directory and run the release checks plus the model/gameplay checks required for that candidate. Read the manifest and inspect both channels before approving publication.
5. Follow the normal approved commit/push and manual workflow procedure. The commit containing the pin change is the new preview build; stable is the explicitly selected, tested source commit. A promotion never happens automatically merely because preview passes CI.
6. Verify the published manifest and record the actual deployment result. No extra public version directory is created.

## Rolling back stable

1. Find the previous stable SHA and version in the configuration's Git history or an approved restore tag. Do not reset the development branch or discard local work.
2. With rollback approval, set `stableCommit` and `stableVersion` back to that exact pair and correct any provenance fields that no longer describe the selected release.
3. Rebuild into a new directory, run the release checks, then use the approved commit/push and manual deployment procedure. Preview remains the selected `main` source; only the stable pin is rolled back.
4. Verify the public root and manifest. The rollback restores the pinned runtime through the current release tooling; it does not require an additional public archive or a destructive Git history rewrite.

## What remains manual

1. The repository owner approves publication, hosting-setting changes, promotions, rollbacks and release tags.
2. The workflow has no `push` or pull-request deployment trigger. Its build job has read-only repository access; only its deployment job has Pages-write and OIDC permissions.
3. `configure-pages` reads the existing Pages configuration with automatic enablement disabled. It does not replace the required first-activation setting change.
4. The local files do not prove that Pages is already configured correctly. The remote setting and a real approved Actions run must be checked during activation.
