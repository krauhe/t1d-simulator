# UI / Front-end Review

Date: 2026-04-10
Scope: `index.html`, `style.css`, `js/main.js`, `js/ui.js`, existing Playwright screenshots
Focus: layout robustness, interaction design, pedagogical clarity, accessibility, and UI structure

## Overall assessment

The simulator has a distinctive and coherent visual identity on desktop. The graph-first presentation, strong color coding, and capsule-based HUD make the product feel more intentional than most browser-based educational simulations.

The main UI risks are no longer about visual polish. They are structural front-end issues:

- the layout remains too desktop-bound on small screens;
- core interactions are implemented as clickable `div`s instead of robust semantic controls;
- important explanations are still hidden behind hover and `title` behavior that degrades badly on touch devices.

So the front-end is visually strong, but interactionally less robust than it looks.

## Highest-priority findings

### 1. The mobile layout preserves too much of the desktop HUD, so the graph loses critical space

Files:
- `style.css:3670`
- `style.css:3686`
- `style.css:1292`
- `index.html:772`

Problem:
- The responsive layer mainly compresses the top bar.
- The CSS explicitly states that side-drawer, dock, event-log/bottom systems are not substantially reworked at smaller widths.
- The bottom capsule and right-side drawer logic therefore remain desktop-shaped even when the viewport is narrow.
- In the existing `375x667` screenshot, the graph is visibly compressed while persistent HUD elements keep occupying a disproportionate share of the screen.

Why this matters:
- The graph is the primary gameplay surface.
- If the graph loses width, the player loses both readability and timing precision.
- This is not just an aesthetic mobile issue; it directly weakens the simulator’s core interaction loop.

Recommendation:
- Build a true mobile layout instead of only compacting the top bar.
- Move the side drawer to an overlay or bottom sheet on narrow screens.
- Let the bottom capsule collapse into simpler states where BG and primary actions have first priority.

### 2. Core UI actions are implemented as clickable `div`s rather than semantic buttons

Files:
- `index.html:840`
- `index.html:542`
- `index.html:651`
- `index.html:732`
- `js/main.js:1350`
- `js/main.js:1229`
- `style.css:1403`
- `style.css:1885`

Problem:
- Dock items, food presets, activity chips, and kit actions are implemented as `div` elements with click listeners.
- They are visually button-like, but they do not inherit native button semantics, keyboard behavior, focus order, or accessibility support.
- The UI therefore depends on a custom shortcut system instead of robust browser-native interaction behavior.

Why this matters:
- This makes the front-end less accessible and less predictable.
- It also increases implementation fragility because keyboard and assistive behavior must be recreated manually.
- For an educational simulator with clinically adjacent subject matter, that is a meaningful UX and maintenance risk.

Recommendation:
- Convert primary interactive controls to native `button` elements wherever possible.
- If any non-button elements must remain, add proper `role`, `tabindex`, keyboard activation, and state semantics. Native buttons are still the preferred fix.

### 3. Focus visibility is weak, and some controls suppress outline without a strong replacement

Files:
- `style.css:355`
- `style.css:2648`

Problem:
- There is no clear global `:focus` or `:focus-visible` strategy for important controls.
- Some inputs and sliders explicitly remove outline.
- The front-end is therefore optimized for mouse/touch presentation much more than for keyboard navigation.

Why this matters:
- Keyboard users and many assistive workflows get poor visibility of current interaction state.
- This becomes more serious because many controls are already non-semantic.
- The combination creates a front-end that looks polished but offers weak navigational feedback.

Recommendation:
- Add a global, consistent `:focus-visible` treatment across all interactive components.
- Only remove native outline when a stronger replacement is applied.

## Medium-priority findings

### 4. Too much pedagogical explanation is hidden behind hover and `title`, which degrades badly on touch devices

Files:
- `style.css:1802`
- `style.css:1944`
- `style.css:1961`
- `index.html:623`
- `index.html:800`

Problem:
- Food-chip details, shortcut hints, life-bar explanations, and many data labels rely on hover tooltips or `title` attributes.
- The CSS even notes that some shortcut guidance now lives via mouseover/title behavior.
- On touch devices, these explanations are partial, awkward, or effectively absent.

Why this matters:
- The simulator’s educational value depends on explanation, not just action.
- If important meaning only appears on hover, the UI becomes much less instructive on phones and tablets.
- That weakens one of the product’s strongest differentiators.

Recommendation:
- Move essential meaning into visible labels, microcopy, or explicit info affordances.
- Use tap-open popovers for secondary detail instead of hover-only disclosure.

### 5. The bottom capsule is visually strong but too rigid and information-heavy across all states

Files:
- `index.html:776`
- `index.html:799`
- `index.html:822`
- `index.html:838`
- `index.html:871`
- `index.html:876`
- `style.css:3595`

Problem:
- CGM, life bars, stats, dock, speed, forces, and points are all concentrated in one persistent bottom structure.
- On desktop this is stylish and coherent, but it also locks substantial UI weight below the graph at all times.
- On smaller screens the capsule becomes a dominant permanent HUD block instead of a flexible contextual layer.

Why this matters:
- The graph should remain visually and cognitively primary.
- A permanently dense bottom HUD competes with the graph and reduces progressive disclosure.
- It is especially costly before gameplay starts and on narrow screens.

Recommendation:
- Make the bottom capsule adaptive by screen size and game state.
- Before gameplay, hide or collapse secondary fragments.
- On smaller screens, allow stats and life bars to fold into secondary views.

### 6. The food panel still requires too much scanning and too much self-decoding

Files:
- `index.html:533`
- `style.css:1877`
- `style.css:1927`

Problem:
- The panel is still presented as a flat 3x5 grid.
- The code comments describe a BG-impact logic, but the visual grouping does not make that logic sufficiently explicit.
- Macro bars are compact and helpful, but too small to carry the educational burden alone.

Why this matters:
- New users still need to decode which items are hypo rescue, standard meals, or delayed fat/protein combinations.
- The panel is teachable once learned, but not self-explanatory enough at first contact.

Recommendation:
- Group foods visually into categories such as fast rescue, everyday meals, and delayed/high-fat items.
- Keep keyboard efficiency under the surface, but let the visible IA follow learning goals rather than key-grid logic.

## Lower-priority observations

### 7. The side-drawer tab is both easy to miss and too expensive in narrow layouts

Files:
- `style.css:1313`
- `style.css:1354`

Problem:
- The drawer tab is narrow, vertically written, and visually subtle.
- At the same time, it still consumes layout width.
- So it reduces graph width while remaining relatively undiscoverable.

Why this matters:
- This is a poor tradeoff on small screens.
- Users either miss the control or pay a continuous layout penalty for it.

Recommendation:
- On small screens, replace the persistent drawer edge-tab with an overlay trigger or move it into menu/settings.

### 8. Help text and actual close behavior still do not form one fully consistent interaction contract

Files:
- `index.html:1034`
- `js/main.js:1774`
- `js/main.js:1451`
- `js/main.js:1039`

Problem:
- Help text says `Escape` closes open panels.
- The current key handler closes popup overlays and dock panels.
- But settings dropdown, mobile menu, and side-drawer states are not clearly governed by the same close model.

Why this matters:
- The problem is smaller than a full broken shortcut bug, but it still makes the UI less predictable.
- A user-facing interaction contract should be broader or the help text should be narrower.

Recommendation:
- Standardize close behavior across popup, menu, dropdown, drawer, and dock states.
- Then align the help text with the real behavior.

## Suggested improvement order

1. Build a true mobile layout for graph, drawer, and bottom capsule.
2. Convert primary clickable `div`s to semantic buttons.
3. Introduce a global `:focus-visible` strategy.
4. Move critical explanatory content away from hover/title-only behavior.
5. Reorganize the food panel around learning categories instead of keyboard-grid logic.
6. Make secondary HUD layers more progressive and less permanently visible.

## What is already good

- The desktop visual identity is strong and unusually coherent.
- The graph area is spacious and readable on large screens.
- Color coding across insulin, food, activity, and kit is consistent and easy to learn.
- The settings panel is relatively mature and already grouped in a sensible way.
- The profile popup is calmer and better structured than the denser control panels.

## Bottom line

The front-end already looks like a real product on desktop. The next step is not more gloss. It is stronger UI architecture: responsive behavior that genuinely changes by device, native interaction semantics, visible focus handling, and pedagogy that does not depend on hover.
