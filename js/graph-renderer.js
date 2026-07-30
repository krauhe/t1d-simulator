// =============================================================================
// GRAPH-RENDERER.JS — Shared BG-graph rendering + zone/trend classification
// =============================================================================
//
// Phase-0 extraction for the mobile version (see mobile/MOBILE-DESIGN.md §2.2).
// This file is the single-source home for graph code that BOTH the desktop shell
// (js/ui.js) and the upcoming mobile shell reuse, so the renderer is not
// duplicated. It loads BEFORE js/ui.js in index.html.
//
// First step (this commit): the pure BG-zone classifier and the CGM trend
// mapping move here out of ui.js. The large drawGraph() renderer and its
// drawing helpers (updateYAxisScale, drawSymptomOverlay, renderFloatingLabels,
// the icon/image caches, …) migrate here in a following step.
//
// NOTE on scope: these are plain top-level declarations in a classic <script>.
// All of the game's scripts share one global lexical environment, so ui.js and
// editor.js (both loaded after this file) reference BG_ZONES / getBGZone /
// cgmTrendForRate directly, exactly as when they lived in ui.js.
// =============================================================================

// BG zone boundaries. < HYPO or > HYPER = danger; > TARGET_HIGH = elevated; else target.
const BG_ZONES = Object.freeze({ HYPO: 4.0, TARGET_HIGH: 10.0, HYPER: 14.0 });

// Classify a BG value (mmol/L) into a zone name used for the CSS classes
// (bg-<zone> / glow-<zone>) and the graph point colours. The zone gradient adds
// its own soft transition band around these same hard boundaries.
function getBGZone(bg) {
    if (bg < BG_ZONES.HYPO || bg > BG_ZONES.HYPER) return 'danger';
    if (bg > BG_ZONES.TARGET_HIGH) return 'elevated';
    return 'target';
}

// CGM trend arrow by rate of change (mmol/L per minute) — clinical CGM standard.
// Ordered fastest-rise → fastest-fall; pick the first level whose threshold the
// rate strictly exceeds. Strict ">" reproduces the original if/else chain exactly
// at the boundaries; the -Infinity sentinel guarantees a match for any finite rate.
const CGM_TREND_LEVELS = [
    { min:  0.10, arrow: '↑', color: 'var(--red)' },     // ↑ rising fast
    { min:  0.05, arrow: '↑', color: 'var(--orange)' },  // ↑ rising
    { min:  0.02, arrow: '↗', color: 'var(--orange)' },  // ↗ rising slowly
    { min: -0.02, arrow: '→', color: 'var(--green)' },   // → stable
    { min: -0.05, arrow: '↘', color: 'var(--orange)' },  // ↘ falling slowly
    { min: -0.10, arrow: '↓', color: 'var(--orange)' },  // ↓ falling
    { min: -Infinity, arrow: '↓', color: 'var(--red)' }, // ↓ falling fast
];
function cgmTrendForRate(rate) {
    return CGM_TREND_LEVELS.find(l => rate > l.min);
}

// Browser globals are shared via the classic-script global scope (above). The
// explicit window assignment mirrors the other js/ modules and lets code guard
// with `typeof getBGZone !== 'undefined'`.
if (typeof window !== 'undefined') {
    window.BG_ZONES = BG_ZONES;
    window.getBGZone = getBGZone;
    window.CGM_TREND_LEVELS = CGM_TREND_LEVELS;
    window.cgmTrendForRate = cgmTrendForRate;
}
