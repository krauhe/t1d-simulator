# Scientific additions and single-version publication preparation

Date: 2026-10-25. The owner explicitly requested incorporation of today's evidence into BG-SCIENCE, one latest public version, and commit/push. This supersedes the previous no-Git instruction for this bounded publication only.

## 1. Scientific additions

BG-SCIENCE doc-version is now 2026-10-25-v1. The carbohydrate section adds glucose/sucrose interpretation and fibre-viscosity evidence; the fat/protein section adds a matched-insulin early/late fat comparison. No simulation parameters were changed.

1. **Gray and Ingelfinger 1966:** original PDF methods and summary, printed pages 388/396, visually rechecked. The perfusion comparison is sucrose versus an equivalent glucose–fructose mixture, not oral sucrose versus pure glucose. Hydrolysis was faster than product absorption under those conditions; this does not determine oral systemic kinetics. Existing full PDF reused.
2. **Slama 1990:** original indexed abstract reused and its identity checked again. The limited early glucose comparison is reported with population, carbohydrate dose and endpoint. Formal equivalence, a universal glucose advantage and extra-water benefit are not inferred. Full text remains on the existing wishlist.
3. **Wolever 2020:** original abstract reused. Viscosity differs from total fibre quantity; the healthy-adult meal comparison does not establish a T1D kinetic coefficient. The older claim assigning a dominant share of fibre benefit to one intestinal mechanism was removed because the retained evidence did not substantiate it. Full text added to the private wishlist.
4. **Bell 2020:** original abstract reused. Early and late glucose areas move in opposite directions with increasing fat under the trial's fixed split-bolus regimen. These are glycaemic endpoints, not isolated gastric or intestinal rates. Full text added to the private wishlist; publisher access returned HTTP 403.

Abstract-only coverage is stated inline at each new claim. Existing implementation footers remain valid. The material is physiology-only and contains no simulator calibration values. No new whole-article approval or clinical validation is claimed.

## 2. Source access and retained artifacts

All four new citation destinations were checked from the local PC: three Europe PMC original-abstract records returned HTTP 200 with matching PMID/title/DOI; the JCI PDF returned HTTP 200 through its publisher CDN and its identity was checked in the original pages. Wolever's publisher DOI reached a linking page, not an appraised full text. Existing public-destination access caveats in BG-SCIENCE remain applicable to older citations.

Existing scientific files were reused; no new full-text PDF was acquired. The archive preflight reported 173 cached PDF extractions, three pending and none blocked. No missing conversion was presented as completed. Retrieval logs are private under .local-artifacts/2026-10-25-science-release/. Full texts, private abstracts and wishlist remain outside the public runtime package.

## 3. Publication boundary

The source version advances from the already pushed 0.9.129-beta to 0.9.130-beta, with matching desktop/mobile cache identifiers. Today's player-facing history retains the meaningful game changes; this documentation update does not create an irrelevant scientific-edit announcement. README, implementation/API corrections and the permanent player-history editorial rule from the preceding task are included.

The existing single-release builder publishes only the selected commit's allowlisted runtime files. Prior preview entry points are redirects, not a second simulator. Git history and historical pin metadata are retained for traceability; they do not select or serve an additional app. The manual Pages workflow and deployed manifest determine actual publication status, independently of this preparation record.

Status: scientific edits complete within the stated evidence scope. Commit-package browser verification, push and manual deployment are the remaining execution gates at the time this record is written.
