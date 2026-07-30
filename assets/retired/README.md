# Retired assets

Assets that are no longer referenced by the app but are kept **in the repo** as a
reserve, in case a future feature wants them back. This is deliberately tracked in
git (unlike `old/`, which is gitignored) so the files survive and stay versioned.

Rules:
- Move a file here (with `git mv`) when its last code reference is removed, instead
  of deleting it — that way we never lose a usable asset to a refactor.
- Keep the original filename so its origin/intent stays obvious.
- Nothing in here is loaded at runtime; if you want to use an asset again, move it
  back into the productive tree (`assets/icons/app/`, `assets/food/`, etc.) and wire
  up the code reference.

## Contents

- `event-interrupted-sleep.png` — moon + zZz + red ✕ marker for a night awakening.
  Used briefly as the editor's sleep-loss icon; retired when the editor switched to
  the static zZz sleep haze (which conveys the awakening on its own).
- `event-lost-sleep.png` — earlier, rougher sleep-loss marker variant; superseded by
  `event-interrupted-sleep.png` and then by the sleep haze.
