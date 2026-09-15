# Release verification: 0.9.120-beta

Generated: 2026-09-15

## Scope

Publish the existing local food-catalog, guide, statistics-visibility and documentation changes. The release version and local CSS/JavaScript cache references are updated together. No production physiology parameters or audio recordings were changed during release preparation.

## Verification

1. Simulation suite: 197/197 passed.
2. Food catalog, guide links, symptoms, intended-purpose text, public-release boundary and version-history checks passed.
3. Danish/English text synchronization passed: 848 keys in each language and matching help markers.
4. Food browser smoke test passed: desktop adult/child portions, all six shortcuts, mobile food actions, both languages and no JavaScript page errors.
5. Guide browser smoke test passed: 96 section visits across both languages at 1280, 1920 and 375 px; return from What If preserves the original paused game; result-to-guide-to-retry flow passed. The separate mobile shell still lacks the guide and What If.
6. Intro source audit: 21 bilingual steps; all 40 referenced audio files exist. This checks file presence and configuration, not a fresh listening assessment.

Local browser artifacts are in `tests/playwright/2026-09-15_release-food/` and `tests/playwright/2026-09-15_release-guide/` (gitignored).

## Intro and audio status

1. The first tour step already introduces the learning game, fixed fictional characters and the effects of food, insulin, activity, sleep and stress. It also explains the absence of personal health-data input and individual treatment guidance. Danish and English overview recordings are marked OK in their generation logs.
2. The Insights step opens the menu and explains Physiology view and What If. Both recordings are marked OK. The Danish narration/text says "Indsigt" while the actual button says "Insights"; this wording difference remains.
3. The latest `05-basal.mp3` entries remain REVIEW in both languages. Older Danish OK entries do not establish approval of the newer replacement.
4. `08-food-sugars.mp3` is disconnected in both languages because the old recordings mention cola. Updated text and scripts exist; the step currently uses text only.
5. No paid audio call was made. The broader intro redesign remains separate work.

## External-source access status

An HTTP GET check from the local PC followed redirects for all 578 distinct external URLs in BG-SCIENCE and the six relevant guide/food/exercise reports. The complete technical output is stored locally in `tests/playwright/2026-09-15_release/links.json` (gitignored).

The automated check found 139 browser-challenge/HTTP-403 responses: 124 PMC URLs plus publisher/DOI destinations. A nominal HTTP 200 was not treated as success when its page was a CAPTCHA. Nature authentication redirects and Springer cookie redirects were also inspected; a browser confirmed the expected Nature exercise review and Springer Somogyi article, while the sampled PMC destination still did not provide article text. JCI and MIT redirects reached the expected resources.

**Not fully verified at this release:** PMC source links, including the current changes' PMC4418873 (Morris), PMC3712033 (Hinshaw), PMC7189144 (Liu), PMC8321821 (Romeres) and PMC12628732 (Pemberton), and challenged publisher/DOI destinations. Earlier reports' successful-download statements describe their earlier checks; they do not establish current public accessibility. Existing archived references were retained. These access restrictions do not by themselves establish a broken link or validate citation identity.

The five food-source URLs and both Frontiers URLs used in the changed material returned HTTP 200 with the expected food/article titles. The full-document scan is a technical access check, not a new scientific review of every legacy citation. Existing open citation findings in the short-exercise report remain open.

## Overall status

Application checks passed. Remaining items are the separate mobile guide integration, reader testing, intro redesign, the audio/wording items above and incomplete external-source access verification. No new physiological calibration is included in this release.
