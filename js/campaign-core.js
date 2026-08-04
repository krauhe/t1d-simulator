// =============================================================================
// CAMPAIGN-CORE.JS — Pure, DOM-free, shell-agnostic campaign engine
// =============================================================================
//
// CampaignCore owns ALL campaign decision logic:
//   - Loads day configurations from CAMPAIGN_LEVELS (levels.js)
//   - Restricts player actions (data-only gating snapshot via getGatingState)
//   - Fires scheduled + randomised events (auto-food, stress, CGM events)
//   - Evaluates objectives, daily-failure detection, star/TIR computation
//   - Runs the full unified tip pipeline (tutorial / game / global / delayed)
//   - Saves/loads progress (via host.storage, falling back to localStorage)
//
// Architecture:
//   CampaignCore wraps AROUND the Simulator class — it does NOT modify
//   simulator.js directly, but reads state and calls existing methods
//   (sim.addFood(), sim.addLongInsulin(), etc.). Physics overrides are
//   applied in the Simulator constructor via the injected levelConfig.physics.
//
//   The core NEVER touches the DOM and NEVER reads desktop-only globals
//   (game, appSettings, isPaused, lastFrameTime, document, window). It reaches
//   the outside world ONLY via:
//     (a) the Simulator instance passed into its methods, and
//     (b) the injected `this.host` adapter (constructor argument).
//
//   Tip messages are still pushed as plain message objects onto
//   sim.graphMessages (the simulator owns graphMessages; both desktop and
//   mobile shells render them). Popups and screens that today are imperative
//   DOM writes are instead emitted as PLAIN-DATA descriptors to the host;
//   the host (shell) builds the HTML/DOM however it likes.
//
// =============================================================================
// HOST CONTRACT (both shells implement this object; passed to the constructor)
// =============================================================================
//   host = {
//     getSettings(): { levelTipsEnabled, globalTipsEnabled, vfxEnabled,
//                      debugUnlockAllLevels, language },
//     getGame(): Simulator | null,
//     playSound(type),
//     flyIconToGraph(icon, panelId, sub?),
//     showActivityActive(type, intensity, durationMin),
//     isPopupOpen(): boolean,            // re-entrancy guard for event popups
//     emitGating(gatingState),           // gatingState = core.getGatingState()
//     emitPopup(descriptor): boolean,    // event popups; returns true if shown
//                                        // (core falls back to a graph tip if false)
//     emitScreen(descriptor),            // intro|complete|failed|gameover|levelSelect
//     storage: { get(key), set(key,value) },   // localStorage wrapper (get -> string|null)
//     requestStart(mode),                // boot a campaign run (desktop: resetGame()+startGame)
//     highlightElement(selector)?,       // optional UI highlight (desktop-only; no-op otherwise)
//     isScoreBlocked()?,                 // optional: true if physiology viewing (practice
//                                        // mode) was used this run — the level's stars/best
//                                        // score are then NOT recorded (mirrors the sandbox
//                                        // highscore block). Completion + unlock still happen.
//   }
// All host members except getGame are optional; missing side-effect callbacks
// are treated as no-ops (guarded with typeof / optional-chaining) so a minimal
// host still works.
//
// ALLOWED shared globals the core may call directly (present in BOTH shells):
//   t(), bgVars()  (i18n.js)
//   CAMPAIGN_LEVELS, GLOBAL_TIPS  (levels.js)
//   guideSectionForTextKeySafe()  (defined below; typeof-guards the optional
//                                  guideSectionForTextKey helper)
//
// Dependencies (global): CAMPAIGN_LEVELS, GLOBAL_TIPS (levels.js),
//   t(), bgVars() (i18n.js)
// Exports (global): CampaignCore, CampaignEventDirector, guideSectionForTextKeySafe, guideSectionsForGameOverDetails,
//   checkGlobalTipsForAllModes, tipSessionState, CAMPAIGN_PROGRESS_KEY,
//   STAR_BONUS, getDefaultCampaignProgress, and the tip helpers used by the
//   pipeline.
// =============================================================================


// =============================================================================
// Selected-character identity helper shared by desktop and mobile shells.
// =============================================================================
// =============================================================================
// Returnér kun den identitet, som skærm-lagene har brug for. På den måde får
// desktop og mobil samme fiktive hovedperson uden at sende fysiologiske
// parametre ind i præsentationslaget.
function getCampaignCharacterDescriptor() {
    const character = typeof getActiveCharacter === 'function'
        ? getActiveCharacter()
        : { id: 'erik', name: 'Erik' };
    return { id: character.id, name: character.name };
}

// Saml de tekstvariabler, som alle kampagnens tekstkanaler skal kende. Dermed
// får både introer, hændelser, popupper og tips karakterens aktuelle navn, og vi
// undgår at en enkelt kanal falder tilbage til "du" som fysiologisk subjekt.
function getCampaignTextVars(extraVars = {}) {
    const character = getCampaignCharacterDescriptor();
    return Object.assign(bgVars(), { characterName: character.name }, extraVars || {});
}

// Safely call the optional external guideSectionForTextKey (defined in ui.js on
// desktop). Returns null when the helper is absent (e.g. on a minimal/mobile
// shell), so callers that map a text key to a guide section degrade gracefully.
function guideSectionForTextKeySafe(textKey) {
    if (typeof guideSectionForTextKey !== 'function') return null;
    return guideSectionForTextKey(textKey);
}

// Map a game-over cause to the relevant guide sections (pure data — the shell
// renders the links from these ids).
function guideSectionsForGameOverDetails(details) {
    switch (details?.type) {
        case 'hypo':
            return ['rapid-iob', 'food'];
        case 'dka':
            return ['ketones', 'basal'];
        case 'weight':
        case 'complications':
            return ['points'];
        default:
            return ['overview'];
    }
}


// =============================================================================
// TIP SESSION STATE — page-load scope (not localStorage)
// =============================================================================
// Counters and flags reset on each page reload, but NOT per game session
// or level change. Used for the "tips-can-be-disabled" meta-tip and music tip roll.
//   _tipsShownCounter: how many tips have been shown in this browser session?
//   _tipsOffShown: has the "tips can be turned off" meta-tip already been shown?
//   _musicTipRolledThisLevel: did we perform the 10% roll for the music tip this level?
//   _educationShown: which category-learning tips have been taught once?
// Must be module-level to survive CampaignCore reconstruction.
// =============================================================================
const tipSessionState = {
    _tipsShownCounter: 0,
    _tipsOffShown: false,
    _musicTipRolledThisLevel: false,
    // Cooldown tracker for GLOBAL_TIPS — separate from CampaignCore.tipsShown so
    // the standalone checker (all modes) can share state with campaign mode.
    globalTipsShown: {},
    // Sim-time when the most recent tip (of any type) was shown. Used to
    // prevent two "general" tips (priority >= 3) from popping up simultaneously.
    // Acute tips (priority 1-2) bypass this rate-limit.
    _lastAnyTipShownAt: -Infinity,
    // Afstand i virkelig tid forhindrer, at høj spilhastighed omdanner 30
    // simulerede minutter til flere tips inden for få sekunder.
    _lastAnyTipShownRealMs: -Infinity,
    // Når ét almindeligt tip er synligt, får kun én kandidat en trængsels-
    // lodtrækning for netop denne viste tilstand. Uden låsen ville spilløkken
    // trække igen ved hvert billede, så 15% hurtigt blev næsten 100%.
    _crowdingRollSignature: null,
    // Chance-roll tracker. Regular tips with chance < 1.0 roll once per
    // session; BG-event tips have a separate episode gate below.
    _chanceConsumed: {},
    // BG-event tips (bgBelow/bgAbove) roll only once per episode.
    // If BG stays below/above the threshold, no re-roll occurs each frame.
    // When BG leaves the threshold, the gate is reset.
    _eventChanceConsumed: {},
    // Et læringstip med firstOccurrenceGuaranteed vises sikkert første gang
    // kategorien opstår. Senere episoder bruger tip.chance som hidtil.
    _educationShown: {},
    // Per-sim-day tip counter (reset at midnight rollover). Used together with
    // MAX_GENERAL_TIPS_PER_SIM_DAY to cap general tips per day.
    // Includes ALL shown tips (acute + general) — so if 2 acute tips fired
    // early in the day, all general tips are blocked for the rest of the day
    // ("no generals if 2 others have already been shown").
    _tipsShownToday: 0,
    _currentSimDay: -1,
};

// Cap on the number of general tips (priority >= 3) per sim-day. Acute tips
// (priority 1-2, e.g. hypo, DKA) are NOT subject to this limit — they may
// still fire when relevant. Counts ALL shown tips (acute + general) against
// the cap, so general tips are suppressed when there has already been tip
// activity that day.
const MAX_GENERAL_TIPS_PER_SIM_DAY = 2;

// Suppress zone before midnight: no tips in the last N sim-min of the day.
// Prevents a tip from appearing right before the day-change popup (Box Challenge
// "Day N complete!" / campaign level-complete) stacks on top and makes the
// tip text unreadable.
const TIP_SUPPRESS_BEFORE_DAY_END_MIN = 60;

// Helper: update the per-day counter on midnight rollover in sim-time.
// Called before checking the MAX_GENERAL_TIPS_PER_SIM_DAY cap.
function _maybeRolloverTipDay(sim) {
    const simDay = Math.floor(sim.totalSimMinutes / 1440);
    if (simDay !== tipSessionState._currentSimDay) {
        tipSessionState._currentSimDay = simDay;
        tipSessionState._tipsShownToday = 0;
    }
}

// When a priority-1 tip is shown, lower-priority tips are faded out quickly.
// This gives the urgent message solo placement without making the rest of the tip system feel noisy.
const URGENT_TIP_SUPPRESS_FADE_MS = 650;

// =============================================================================
// CHANCE-ROLL — Determine whether a tip with tip.chance < 1.0 should be shown
// =============================================================================
// Tips can have an optional chance (0-1) and a sessionDecay flag.
// Contract:
//   - Default chance = 1.0 → no roll, tip always shows when trigger fires.
//   - firstOccurrenceGuaranteed → første relevante episode vises uden lodtrækning.
//   - chance < 1.0 → ONE roll per browser session per tip-id. If the roll fails,
//     the tip is marked "consumed" and will not retry until page reload.
//   - sessionDecay: true → effective chance is reduced by 10 percentage points per
//     tip already shown this session, with a floor at 20% of the original chance.
// Returns true if the tip may be shown, false if the chance roll fails.
function _rollTipChance(tip) {
    const isBgEventTip = [
        'bgBelow',
        'bgAbove',
        'acidosisAbove',
        'symptomVfxActive',
        'weightLossAbove',
        'illnessActive',
        'multipleSymptomsActive',
        'symptomGroupActive',
    ].includes(tip.triggerType);
    let effectiveChance = tip.chance;

    // Kategorier som hypo, hyper og ketoner skal kunne læres pålideligt. Efter
    // første viste tip går de tilbage til den sjældne episode-lodtrækning.
    if (tip.firstOccurrenceGuaranteed && !tipSessionState._educationShown[tip.id]) {
        return true;
    }

    // BG-threshold tips are event messages. They must not fire every time BG
    // crosses a threshold, or the game feels like a textbook. Default: 20%.
    if (effectiveChance === undefined && isBgEventTip) {
        effectiveChance = 0.2;
    }

    if (effectiveChance === undefined || effectiveChance >= 1.0) return true;

    if (isBgEventTip) {
        if (tipSessionState._eventChanceConsumed[tip.id]) return false;
        tipSessionState._eventChanceConsumed[tip.id] = true;
    } else if (tipSessionState._chanceConsumed[tip.id]) {
        return false;
    }

    if (tip.sessionDecay) {
        const decay = Math.max(0.2, 1 - tipSessionState._tipsShownCounter * 0.1);
        effectiveChance *= decay;
    }

    if (!isBgEventTip) {
        tipSessionState._chanceConsumed[tip.id] = true;
    }
    return Math.random() < effectiveChance;
}

function _resetEventChanceIfInactive(tip) {
    if ([
        'bgBelow',
        'bgAbove',
        'acidosisAbove',
        'symptomVfxActive',
        'weightLossAbove',
        'illnessActive',
        'multipleSymptomsActive',
        'symptomGroupActive',
    ].includes(tip.triggerType)) {
        delete tipSessionState._eventChanceConsumed[tip.id];
    }
}

// Whether an urgent (priority 1) tip is currently visible on the graph.
// Reads the passed simulator's graphMessages (rebound from the old global game).
function _isActivePriorityOneTipVisible(sim) {
    if (!sim || !sim.graphMessages) return false;
    return sim.graphMessages.some(msg =>
        (msg.isGameTip || msg.isTutorialTip)
        && !msg._fadingOut
        && (msg.priority !== undefined ? msg.priority : 5) === 1
    );
}

// Fade out lower-priority tips when a priority-1 tip appears, so the urgent
// message gets solo placement. Writes animation flags onto the message objects;
// the renderer (shell) consumes them. performance.now() is not DOM access.
function _fadeLowerPriorityTipsForUrgentTip(sim) {
    if (!sim || !sim.graphMessages) return;
    const now = (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now();

    for (const msg of sim.graphMessages) {
        const priority = msg.priority !== undefined ? msg.priority : 5;
        if ((msg.isGameTip || msg.isTutorialTip) && priority > 1 && !msg._fadingOut) {
            msg._fadingOut = true;
            msg._fadeStartTime = now;
            msg._fadeDurationMs = URGENT_TIP_SUPPRESS_FADE_MS;
        }
    }
}

// Minimum sim-min between two "general" tips (priority >= 3). Acute tips
// (priority 1-2, e.g. hypo, DKA) bypass this threshold and may still
// arrive immediately.
// 90 sim-min = ~16 tips per 24h max — sufficient for 3-day levels and
// prevents global UI hints from clustering in the first few hours.
const TIP_MIN_SPACING_SIM_MIN = 90;

// Tiprytmen skal også fungere ved høj spilhastighed, hvor mange simulerede
// minutter kan passere på få sekunder. Almindelige tips får derfor mindst 6
// sekunders afstand i virkelig tid. Hvis ét tip allerede er synligt, har den
// næste kandidat kun 15% af sin normale mulighed; ved to synlige tips stoppes
// nye almindelige tips helt. Prioritet 1 er akutte beskeder og er undtaget.
const TIP_MIN_SPACING_REAL_MS = 6000;
const TIP_SECOND_VISIBLE_CHANCE = 0.15;

function _tipRealNowMs() {
    return (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now();
}

function _tipPassesCrowdingGate(tip, sim) {
    const priority = tip.priority !== undefined ? tip.priority : 5;
    if (priority === 1) return true;

    const nowRealMs = _tipRealNowMs();
    if ((nowRealMs - tipSessionState._lastAnyTipShownRealMs) < TIP_MIN_SPACING_REAL_MS) {
        return false;
    }

    const visibleTips = (sim && Array.isArray(sim.graphMessages))
        ? sim.graphMessages.filter(message =>
            (message.isGameTip || message.isTutorialTip)
            && !message._fadingOut
        )
        : [];

    if (visibleTips.length === 0) {
        tipSessionState._crowdingRollSignature = null;
        return true;
    }
    if (visibleTips.length >= 2) return false;

    const visible = visibleTips[0];
    const signature = `${visible.id || 'tip'}:${visible.createdAt || 0}`;
    if (tipSessionState._crowdingRollSignature === signature) return false;

    tipSessionState._crowdingRollSignature = signature;
    return Math.random() < TIP_SECOND_VISIBLE_CHANCE;
}


// =============================================================================
// CAMPAIGN EVENT DIRECTOR — Randomised events for harder levels
// =============================================================================
//
// EventDirector converts a randomEventDirector configuration in levels.js into
// ordinary scheduledEvents and timeline markers. This keeps the rest of the
// campaign system simple: once events are planned, they are executed via the
// existing scheduledEvents engine.
//
// The design is generic enough to be used in sandbox scenarios later:
// input = an event pool, output = concrete events + graph markers.
// =============================================================================
function _clonePlain(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
}

function _randomInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

class CampaignEventDirector {
    resolve(levelConfig) {
        const scheduledEvents = [...(levelConfig.scheduledEvents || [])];
        const markers = [...(levelConfig.markers || [])];
        const cfg = levelConfig.randomEventDirector;
        if (!cfg || !Array.isArray(cfg.pool) || cfg.pool.length === 0) {
            return { scheduledEvents, markers };
        }

        const usedTemplateIds = new Set();
        const categoryCounts = {};
        const plannedTimes = [];
        // Obligatoriske hændelser tæller med i den daglige kvote. Ellers ville
        // fx bane 10's obligatoriske sensorsvigt komme oven i de planlagte
        // 2 + 3 + 2 hændelser og give otte hændelser i alt.
        const plannedCountByDay = {};
        const minSpacing = cfg.minSpacingMinutes || 180;

        (cfg.requiredTemplates || []).forEach((templateId, idx) => {
            const template = cfg.pool.find(item => item.id === templateId);
            if (!template || !_clonePlain(template.event)) return;

            const planned = this._chooseSpecificPlannedEvent({
                cfg, template, minSpacing, plannedTimes
            });
            if (!planned) return;

            plannedTimes.push(planned.timeMinutes);
            plannedCountByDay[planned.day] = (plannedCountByDay[planned.day] || 0) + 1;
            if (template.oncePerLevel) usedTemplateIds.add(template.id);
            const category = template.category || 'default';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;

            const event = this._buildScheduledEvent(template, planned.timeMinutes, planned.day, idx);
            scheduledEvents.push(event);
            markers.push(...this._buildMarkers(template, planned.timeMinutes, event));
        });

        (cfg.dayPlans || []).forEach(dayPlan => {
            const day = dayPlan.day || 0;
            const dailyQuota = dayPlan.count || 0;
            const count = Math.max(0, dailyQuota - (plannedCountByDay[day] || 0));

            for (let slot = 0; slot < count; slot++) {
                const planned = this._choosePlannedEvent({
                    cfg, dayPlan, day, slot, minSpacing,
                    usedTemplateIds, categoryCounts, plannedTimes
                });
                if (!planned) continue;

                plannedTimes.push(planned.timeMinutes);
                if (planned.template.oncePerLevel) usedTemplateIds.add(planned.template.id);
                const category = planned.template.category || 'default';
                categoryCounts[category] = (categoryCounts[category] || 0) + 1;

                const event = this._buildScheduledEvent(planned.template, planned.timeMinutes, day, slot);
                scheduledEvents.push(event);
                markers.push(...this._buildMarkers(planned.template, planned.timeMinutes, event));
            }
        });

        scheduledEvents.sort((a, b) => (a.timeMinutes || 0) - (b.timeMinutes || 0));
        markers.sort((a, b) => {
            const aTime = a.timeMinutes ?? a.startMinutes ?? 0;
            const bTime = b.timeMinutes ?? b.startMinutes ?? 0;
            return aTime - bTime;
        });

        return { scheduledEvents, markers };
    }

    _choosePlannedEvent(ctx) {
        for (let attempt = 0; attempt < 120; attempt++) {
            const candidates = ctx.cfg.pool.filter(template =>
                this._templateAllowed(template, ctx)
            );
            if (candidates.length === 0) return null;

            const template = this._weightedPick(candidates);
            const windows = this._windowsForTemplate(template, ctx.dayPlan);
            if (windows.length === 0) continue;

            const window = windows[_randomInt(0, windows.length - 1)];
            const localMinutes = _randomInt(window[0], window[1]);
            const timeMinutes = ctx.day * 1440 + localMinutes;
            const hasSpacing = ctx.plannedTimes.every(t => Math.abs(t - timeMinutes) >= ctx.minSpacing);
            if (!hasSpacing) continue;

            return { template, timeMinutes };
        }

        return null;
    }

    _chooseSpecificPlannedEvent(ctx) {
        const allowedDays = Array.isArray(ctx.template.allowedDays)
            ? ctx.template.allowedDays
            : (ctx.cfg.dayPlans || []).map(plan => plan.day || 0);

        for (let attempt = 0; attempt < 120; attempt++) {
            const day = allowedDays[_randomInt(0, allowedDays.length - 1)] || 0;
            const dayPlan = (ctx.cfg.dayPlans || []).find(plan => (plan.day || 0) === day) || { day };
            const windows = this._windowsForTemplate(ctx.template, dayPlan);
            if (windows.length === 0) continue;

            const window = windows[_randomInt(0, windows.length - 1)];
            const localMinutes = _randomInt(window[0], window[1]);
            const timeMinutes = day * 1440 + localMinutes;
            const hasSpacing = ctx.plannedTimes.every(t => Math.abs(t - timeMinutes) >= ctx.minSpacing);
            if (!hasSpacing) continue;

            return { template: ctx.template, timeMinutes, day };
        }

        return null;
    }

    _templateAllowed(template, ctx) {
        if (!template || !template.id || !template.event) return false;
        if (template.oncePerLevel && ctx.usedTemplateIds.has(template.id)) return false;
        if (Array.isArray(template.allowedDays) && !template.allowedDays.includes(ctx.day)) return false;

        const category = template.category || 'default';
        const maxForCategory = ctx.cfg.maxPerCategory?.[category];
        if (maxForCategory !== undefined && (ctx.categoryCounts[category] || 0) >= maxForCategory) {
            return false;
        }

        return this._windowsForTemplate(template, ctx.dayPlan).length > 0;
    }

    _windowsForTemplate(template, dayPlan) {
        const windows = template.windows || dayPlan.windows || [];
        return windows
            .filter(w => Array.isArray(w) && w.length >= 2)
            .map(w => [
                Math.max(0, Math.min(1439, w[0])),
                Math.max(0, Math.min(1439, w[1])),
            ])
            .filter(w => w[1] >= w[0]);
    }

    _weightedPick(templates) {
        const total = templates.reduce((sum, template) => sum + (template.weight || 1), 0);
        let roll = Math.random() * total;
        for (const template of templates) {
            roll -= (template.weight || 1);
            if (roll <= 0) return template;
        }
        return templates[templates.length - 1];
    }

    _buildScheduledEvent(template, timeMinutes, day, slot) {
        const event = _clonePlain(template.event);
        event.id = `random_${template.id}_d${day + 1}_${slot + 1}`;
        event.timeMinutes = timeMinutes + (event.offsetMinutes || 0);
        delete event.offsetMinutes;
        if (template.messageKey && !event.messageKey) event.messageKey = template.messageKey;
        if (template.textVars) event.textVars = Object.assign({}, template.textVars, event.textVars || {});
        if (template.priority !== undefined && event.priority === undefined) event.priority = template.priority;
        if (template.eventStyle !== undefined && event.eventStyle === undefined) event.eventStyle = template.eventStyle;
        return event;
    }

    _buildMarkers(template, timeMinutes, event) {
        if (!Array.isArray(template.markers)) return [];

        return template.markers.map((markerDef, idx) => {
            const marker = _clonePlain(markerDef);
            marker.id = `${event.id}_marker_${idx + 1}`;
            marker.sourceEventId = event.id;

            if (marker.type === 'interval') {
                const start = timeMinutes + (marker.startOffsetMinutes || 0);
                marker.startMinutes = start;
                marker.endMinutes = marker.endMinutes ?? (start + (marker.durationMinutes || 60));
                delete marker.startOffsetMinutes;
                delete marker.durationMinutes;
            } else {
                marker.timeMinutes = timeMinutes + (marker.offsetMinutes || 0);
                delete marker.offsetMinutes;
            }

            if (marker.reveal === 'event') {
                marker.revealTimeMinutes = timeMinutes;
            } else if (marker.reveal === 'after') {
                marker.revealTimeMinutes = timeMinutes + (marker.revealDelayMinutes || 30);
            }
            delete marker.reveal;
            delete marker.revealDelayMinutes;

            // Unexpected events must be visible retrospectively. The player
            // discovers some events after they have occurred, so the graph must
            // retain the marker the same way as historical food/exercise icons.
            if (template.eventStyle === true && marker.persistAfterPast === undefined) {
                marker.persistAfterPast = true;
                marker.pastAlpha = marker.pastAlpha ?? (marker.type === 'interval' ? 0.55 : 0.8);
            }

            return marker;
        });
    }
}


// =============================================================================
// CAMPAIGN PROGRESS — localStorage key and default structure
// =============================================================================
const CAMPAIGN_PROGRESS_KEY = 't1dSimCampaignProgress';

// Bonus points awarded per earned star on level completion. Total level score =
// base normo-points + stars * STAR_BONUS. TIR is already reflected in the star
// count (stars are granted from TIR thresholds), so it is not bonused separately.
const STAR_BONUS = 5.0;

function getDefaultCampaignProgress() {
    return {
        version: '1.0',
        levels: {},                 // { levelId: { completed, stars, bestPoints, attempts } }
        currentLevel: 0,            // Index of the highest unlocked level (0-indexed)
        tutorialTipsSeen: [],       // Permanent list of seen tutorial tips
    };
}


// =============================================================================
// CampaignCore — Pure, DOM-free engine orchestrating the campaign game state
// =============================================================================
class CampaignCore {

    // @param {object} host — the shell adapter (see HOST CONTRACT at top of file)
    constructor(host) {
        this.host = host || {};

        // --- Level state (reset on loadLevel) ---
        this.currentLevelIndex = 0;     // Index into CAMPAIGN_LEVELS
        this.levelConfig = null;        // Reference to the active level configuration
        this.levelActive = false;       // Whether a level is currently running
        this.levelStartSimTime = 0;     // totalSimMinutes at level start

        // --- Objective tracking ---
        this.objectiveStatus = {};      // { objId: { completed: bool, progress: number } }
        this.actionCounts = {};         // { actionType: count } — total player action counter
        this.actionCountsPerDay = {};   // { actionType: { dayIndex: count } } — per-day counter for minActionsPerDay
        this.exerciseMinutesPerDay = {};        // { dayIndex: minutes } — per-day activity time
        this._lastExerciseMinutesSnapshot = 0;  // Last recorded sim.totalExerciseMinutes (for delta tracking)
        this._lastExerciseTrackSimTime = 0;      // Last sim-time when exercise minutes were allocated to days
        this._dailyObjectiveDaysChecked = 0;     // Number of completed days where daily requirements have already been checked
        this.failedObjectiveId = null;           // If the level fails on one specific requirement, its id is stored for popup explanation

        // --- Event tracking ---
        this.scheduledEventsFired = new Set();  // Which auto-events have been fired
        this.eventDirector = new CampaignEventDirector();
        this.resolvedScheduledEvents = [];
        this.resolvedTimelineMarkers = [];
        this.pendingEventAlerts = [];   // Events discovered later, e.g. CGM alarm after sensor press

        // --- Tip tracking ---
        this.tipsShown = {};            // { tipId: lastShownSimTime } — cooldown
        this.tutorialTipsPending = [];  // Tutorial tips waiting to be shown
        this.tutorialTipActive = null;  // Currently displayed tutorial tip

        // --- Delayed tips (shown N sim-min after an event) ---
        this.pendingDelayedTips = [];   // { fireAtSimTime, textKey, priority, id }

        // --- Persistence ---
        this.progress = this.loadCampaignProgress();
    }

    // -------------------------------------------------------------------------
    // Host helpers — settings + side-effect callbacks (all guarded as no-ops)
    // -------------------------------------------------------------------------
    _settings() {
        return (this.host && typeof this.host.getSettings === 'function')
            ? (this.host.getSettings() || {})
            : {};
    }
    _game() {
        return (this.host && typeof this.host.getGame === 'function')
            ? this.host.getGame()
            : null;
    }
    _playSound(type) {
        if (this.host && typeof this.host.playSound === 'function') this.host.playSound(type);
    }
    _flyIconToGraph(icon, panelId, sub) {
        if (this.host && typeof this.host.flyIconToGraph === 'function') this.host.flyIconToGraph(icon, panelId, sub);
    }
    _showActivityActive(type, intensity, durationMin) {
        if (this.host && typeof this.host.showActivityActive === 'function') this.host.showActivityActive(type, intensity, durationMin);
    }
    _isPopupOpen() {
        return !!(this.host && typeof this.host.isPopupOpen === 'function' && this.host.isPopupOpen());
    }
    _emitGating(state) {
        if (this.host && typeof this.host.emitGating === 'function') this.host.emitGating(state);
    }
    _emitPopup(descriptor) {
        if (this.host && typeof this.host.emitPopup === 'function') return !!this.host.emitPopup(descriptor);
        return false;
    }
    _emitScreen(descriptor) {
        if (this.host && typeof this.host.emitScreen === 'function') this.host.emitScreen(descriptor);
    }
    _highlightElement(selector) {
        if (this.host && typeof this.host.highlightElement === 'function') this.host.highlightElement(selector);
    }


    // =========================================================================
    // loadLevel — Load and initialise a campaign level
    // =========================================================================
    // Called from startGameWithProfile() when mode === 'campaign'.
    // Configures CampaignCore state. (The intro screen is emitted later by
    // startCampaignLevel(), once the Simulator exists.)
    //
    // @param {number} levelIndex — index into CAMPAIGN_LEVELS (0-indexed)
    // =========================================================================
    loadLevel(levelIndex) {
        const level = CAMPAIGN_LEVELS[levelIndex];
        if (!level) return;

        this.currentLevelIndex = levelIndex;
        this.levelConfig = level;
        this.levelActive = true;
        this.levelStartSimTime = 0;  // Set correctly in startCampaignLevel()

        // Reset tracking
        this.objectiveStatus = {};
        this.actionCounts = {};
        this.actionCountsPerDay = {};
        this.exerciseMinutesPerDay = {};
        this._lastExerciseMinutesSnapshot = 0;
        this._lastExerciseTrackSimTime = 0;
        this._dailyObjectiveDaysChecked = 0;
        this.failedObjectiveId = null;
        this.scheduledEventsFired = new Set();
        const resolvedEvents = this.eventDirector.resolve(level);
        this.resolvedScheduledEvents = resolvedEvents.scheduledEvents;
        this.resolvedTimelineMarkers = resolvedEvents.markers;
        this.pendingEventAlerts = [];
        this.tipsShown = {};
        this.tutorialTipsPending = [];
        this.tutorialTipActive = null;

        // Initialise objective tracking
        level.objectives.forEach(obj => {
            this.objectiveStatus[obj.id] = { completed: false, progress: 0 };
        });

        // Prepare tutorial tips (only those not already seen)
        if (level.tutorialTips) {
            const seen = this.progress.tutorialTipsSeen || [];
            this.tutorialTipsPending = level.tutorialTips.filter(
                tip => !seen.includes(tip.id)
            );
        }

        // Update attempt counter
        const levelProgress = this.progress.levels[level.id] || { completed: false, stars: 0, bestPoints: 0, attempts: 0 };
        levelProgress.attempts++;
        this.progress.levels[level.id] = levelProgress;
        this.saveCampaignProgress();
    }


    // =========================================================================
    // startCampaignLevel — Called AFTER the Simulator has been created
    // =========================================================================
    // Sets levelStartSimTime, emits the initial gating state, and emits the
    // intro screen. Must be called from startGameWithProfile() after the
    // Simulator exists.
    // =========================================================================
    startCampaignLevel() {
        const game = this._game();
        if (!this.levelConfig || !game) return;
        this.levelStartSimTime = game.totalSimMinutes;
        this._lastExerciseTrackSimTime = game.totalSimMinutes;

        // Emit dock-panel availability (shell renders the actual UI)
        this._emitGating(this.getGatingState());

        // Emit level-intro screen (shell pauses the game while it is displayed)
        this._emitScreen(this.buildIntroDescriptor(false));
    }


    // =========================================================================
    // update — Called every tick from the game loop (after game.update())
    // =========================================================================
    // Checks scheduled events, evaluates tips and objectives, and detects
    // whether the level is complete.
    //
    // @param {Simulator} sim — the active Simulator instance
    // =========================================================================
    update(sim) {
        if (!this.levelActive || !this.levelConfig) return;

        // Track exercise minutes per day via delta snapshot on sim.totalExerciseMinutes.
        // The simulator accumulates a cumulative total; we distribute the deltas onto the day index.
        const totalExMin = sim.totalExerciseMinutes || 0;
        const exDelta = totalExMin - this._lastExerciseMinutesSnapshot;
        if (exDelta > 0) {
            this._addExerciseMinutesAcrossDays(
                this._lastExerciseTrackSimTime,
                sim.totalSimMinutes,
                exDelta
            );
        }
        this._lastExerciseMinutesSnapshot = totalExMin;
        this._lastExerciseTrackSimTime = sim.totalSimMinutes;

        this.checkScheduledEvents(sim);
        this.checkPendingEventAlerts(sim);
        this.checkDelayedTips(sim);
        this.checkTutorialTips(sim);
        this.checkGameTips(sim);
        // GLOBAL_TIPS are evaluated by checkGlobalTipsForAllModes() — called from
        // the game loop independently of the core, so they work in all modes.
        this.checkObjectives(sim);
        if (this.checkDailyObjectiveFailures(sim)) return;
        this.checkLevelComplete(sim);
    }


    // =========================================================================
    // _addExerciseMinutesAcrossDays — Distribute new exercise minutes across sim-days
    // =========================================================================
    // totalExerciseMinutes is a cumulative counter in Simulator. Here the delta is
    // distributed across campaign days so that activity spanning midnight is not
    // counted on the wrong day. This matters for objectives like "at least 2 hours
    // of activity every day".
    //
    // @param {number} fromSimTime — totalSimMinutes at last tracking
    // @param {number} toSimTime — current totalSimMinutes
    // @param {number} minutesToAdd — new exercise minutes since last tracking
    // =========================================================================
    _addExerciseMinutesAcrossDays(fromSimTime, toSimTime, minutesToAdd) {
        if (minutesToAdd <= 0 || toSimTime <= fromSimTime) return;

        const startElapsed = Math.max(0, fromSimTime - this.levelStartSimTime);
        const endElapsed = Math.max(0, toSimTime - this.levelStartSimTime);
        const elapsedSpan = endElapsed - startElapsed;
        if (elapsedSpan <= 0) return;

        let remainingExercise = minutesToAdd;
        let cursor = startElapsed;

        while (remainingExercise > 0.0001 && cursor < endElapsed) {
            const day = Math.floor(cursor / 1440);
            const nextDayStart = (day + 1) * 1440;
            const spanToNextBoundary = Math.min(nextDayStart, endElapsed) - cursor;
            if (spanToNextBoundary <= 0) break;

            // If the update interval only partially contains activity, distribute
            // the delta proportionally over the interval. Ratio is normally 1.0 during active exercise.
            const proportionalExercise = Math.min(
                remainingExercise,
                minutesToAdd * (spanToNextBoundary / elapsedSpan)
            );
            this.exerciseMinutesPerDay[day] =
                (this.exerciseMinutesPerDay[day] || 0) + proportionalExercise;

            remainingExercise -= proportionalExercise;
            cursor += spanToNextBoundary;
        }

        if (remainingExercise > 0.0001) {
            const fallbackDay = Math.floor(Math.max(0, endElapsed - 0.001) / 1440);
            this.exerciseMinutesPerDay[fallbackDay] =
                (this.exerciseMinutesPerDay[fallbackDay] || 0) + remainingExercise;
        }
    }


    // =========================================================================
    // ACTION GATING — Restrict player actions per level
    // =========================================================================

    // Check whether an action is allowed in the active level
    // @param {string} actionType — 'food', 'fastInsulin', 'basalInsulin', 'exercise', 'kit'
    // @returns {boolean}
    isActionAllowed(actionType) {
        if (!this.levelConfig || !this.levelActive) return true;
        return this.levelConfig.enabledActions[actionType] !== false;
    }

    // Return the maximum permitted bolus dose (fast insulin) for the active level.
    // Used to hide oversized preset buttons and constrain the slider/keyboard.
    // Returns Infinity if no limit is set (default).
    getMaxBolusDose() {
        if (!this.levelConfig || !this.levelActive) return Infinity;
        return this.levelConfig.maxBolusDose ?? Infinity;
    }

    // Record that the player has performed an action (for objective tracking)
    // @param {string} actionType — the type of action
    // @param {number} [simMinutes] — sim-time at the action (for per-day counter)
    recordAction(actionType, simMinutes) {
        this.actionCounts[actionType] = (this.actionCounts[actionType] || 0) + 1;
        // Per-day counter: used by minActionsPerDay objectives
        if (simMinutes !== undefined) {
            const day = Math.floor((simMinutes - this.levelStartSimTime) / 1440);
            if (!this.actionCountsPerDay[actionType]) this.actionCountsPerDay[actionType] = {};
            this.actionCountsPerDay[actionType][day] = (this.actionCountsPerDay[actionType][day] || 0) + 1;
        }
    }

    // =========================================================================
    // getGatingState — PURE data snapshot of all dock/gating restrictions
    // =========================================================================
    // Replaces the data-derivation half of the old updateDockState. The DOM-
    // writing half lives in the shell's emitGating handler. The shell maps this
    // plain-data state to its own UI (classList toggles, slider clamps, etc.).
    //
    // @returns {{
    //   actions: { food, fastInsulin, basalInsulin, exercise, kit },  // booleans
    //   enabledFoodRows: string[]|null,
    //   lockedIntensity: string|null,
    //   maxBolusDose: number    // Infinity if no limit
    // }}
    // =========================================================================
    getGatingState() {
        if (!this.levelConfig) {
            // No active level: everything allowed, no restrictions.
            return {
                actions: { food: true, fastInsulin: true, basalInsulin: true, exercise: true, kit: true },
                enabledFoodRows: null,
                lockedIntensity: null,
                maxBolusDose: Infinity,
            };
        }
        return {
            actions: {
                food: this.isActionAllowed('food'),
                fastInsulin: this.isActionAllowed('fastInsulin'),
                basalInsulin: this.isActionAllowed('basalInsulin'),
                exercise: this.isActionAllowed('exercise'),
                kit: this.isActionAllowed('kit'),
            },
            enabledFoodRows: this.levelConfig.enabledFoodRows || null,
            lockedIntensity: this.levelConfig.lockedIntensity || null,
            maxBolusDose: this.getMaxBolusDose(),
        };
    }


    // =========================================================================
    // SCHEDULED EVENTS — Automatic events at specific times
    // =========================================================================

    checkScheduledEvents(sim) {
        const events = this.resolvedScheduledEvents || this.levelConfig.scheduledEvents;
        if (!events || events.length === 0) return;

        events.forEach((evt, i) => {
            const evtKey = evt.id || `${evt.type}_${i}`;
            if (this.scheduledEventsFired.has(evtKey)) return;

            // Check whether sim-time has reached the event time
            const eventTime = this.levelStartSimTime + (evt.timeMinutes || 0);
            if (sim.totalSimMinutes >= eventTime) {
                this.scheduledEventsFired.add(evtKey);
                this.executeScheduledEvent(evt, sim);
            }
        });
    }

    _showScheduledEventTip(evt, sim) {
        if (!evt.messageKey || !sim.graphMessages || typeof t !== 'function') return;
        sim.graphMessages.push({
            id: `scheduled_${evt.id || evt.type}`,
            text: t(evt.messageKey, getCampaignTextVars(evt.textVars)),
            expireTime: sim.totalSimMinutes + (evt.messageDurationMinutes || 120),
            isGameTip: true,
            isEventTip: evt.eventStyle === true,
            priority: evt.priority !== undefined ? evt.priority : 3,
            guideSection: guideSectionForTextKeySafe(evt.messageKey),
            tipScope: 'level',
            createdAt: sim.totalSimMinutes,
        });
    }

    // =========================================================================
    // DELAYED TIPS — Shown N sim-min after an event (e.g. CGM explanation)
    // =========================================================================
    // Used to explain CGM events the player only discovers later:
    // sensor loss, self-tests, etc. The tip appears with a delay
    // (typically 30 sim-min), simulating the player noticing what happened.
    // =========================================================================

    queueDelayedTip(config) {
        // config: { delayMinutes, textKey, priority, id, eventStyle }
        const game = this._game();
        const fireAt = (game ? game.totalSimMinutes : 0) + (config.delayMinutes || 30);
        // Avoid duplicates: if the same id is already queued, update it instead
        const existing = this.pendingDelayedTips.find(t => t.id === config.id);
        if (existing) {
            existing.fireAtSimTime = fireAt;
            return;
        }
        this.pendingDelayedTips.push({
            fireAtSimTime: fireAt,
            textKey: config.textKey,
            priority: config.priority !== undefined ? config.priority : 3,
            id: config.id,
            eventStyle: config.eventStyle !== false,
        });
    }

    checkDelayedTips(sim) {
        if (this.pendingDelayedTips.length === 0) return;
        if (!sim.graphMessages) return;

        this.pendingDelayedTips = this.pendingDelayedTips.filter(delayed => {
            if (sim.totalSimMinutes < delayed.fireAtSimTime) return true; // Not yet time

            // Check whether already shown
            if (sim.graphMessages) {
                const existing = sim.graphMessages.find(m => m.id === `delayed_${delayed.id}`);
                if (existing) return false;
            }

            if (typeof t === 'function') {
                sim.graphMessages.push({
                    id: `delayed_${delayed.id}`,
                    text: t(delayed.textKey, getCampaignTextVars(delayed.textVars)),
                    expireTime: sim.totalSimMinutes + 120,
                    isGameTip: true,
                    isEventTip: delayed.eventStyle,
                    priority: delayed.priority !== undefined ? delayed.priority : 3,
                    guideSection: guideSectionForTextKeySafe(delayed.textKey),
                    tipScope: 'level',
                    createdAt: sim.totalSimMinutes,
                });
            }
            return false; // Remove from queue
        });
    }

    // Build a plain-data descriptor for an event popup and emit it to the host.
    // Returns true if the host showed a popup. The shell builds all HTML.
    _showScheduledEventPopup(evt) {
        if (!evt.popupTitleKey || !evt.popupMessageKey) return false;
        if (typeof t !== 'function') return false;
        // Re-entrancy guard: don't stack on top of an open popup.
        if (this._isPopupOpen()) return false;

        const guideSection = guideSectionForTextKeySafe(evt.popupMessageKey || evt.messageKey);

        // Build the plain-data descriptor. The shell renders title/message and,
        // for autoFood events, a food card from the foodCard sub-object.
        const descriptor = {
            kind: 'event',
            eventType: evt.type,
            titleKey: evt.popupTitleKey,
            messageKey: evt.popupMessageKey,
            textVars: getCampaignTextVars(evt.textVars),
            guideSections: guideSection ? [guideSection] : [],
            shouldPause: evt.popupShouldPause !== false,
            foodCard: null,
        };

        // autoFood events: provide food-card data (icon, name, weight, kcal, macros).
        // The shell builds the actual card HTML.
        if (evt.type === 'autoFood' && evt.carbs != null) {
            const carbs = evt.carbs || 0;
            const protein = evt.protein || 0;
            const fat = evt.fat || 0;
            descriptor.foodCard = {
                icon: evt.icon || '🍲',
                nameKey: evt.popupFoodNameKey || null,
                weight: evt.weight || 0,
                carbs,
                protein,
                fat,
                kcal: carbs * 4 + protein * 4 + fat * 9,
            };
        }

        return this._emitPopup(descriptor);
    }

    queueCgmCompressionAlarm(evt, sim) {
        const threshold = evt.alarmThresholdMmol || 4.0;
        const durationMinutes = evt.durationMinutes || 45;
        this.pendingEventAlerts.push({
            id: `cgm_alarm_${evt.id || sim.totalSimMinutes}`,
            type: 'cgmCompressionAlarm',
            event: _clonePlain(evt),
            thresholdMmol: threshold,
            expireTime: sim.totalSimMinutes + durationMinutes + 30,
        });
    }

    checkPendingEventAlerts(sim) {
        if (!Array.isArray(this.pendingEventAlerts) || this.pendingEventAlerts.length === 0) return;

        this.pendingEventAlerts = this.pendingEventAlerts.filter(alert => {
            if (sim.totalSimMinutes > alert.expireTime) return false;
            if (alert.type !== 'cgmCompressionAlarm') return true;

            const cgm = Number.isFinite(sim.cgmBG) ? sim.cgmBG : sim.trueBG;
            if (cgm > alert.thresholdMmol) return true;

            // If another popup is open, wait until it is closed. Otherwise the
            // player may miss the explanatory narrative behind the alarm.
            if (this._isPopupOpen()) return true;

            if (typeof sim.handleNightIntervention === 'function') {
                sim.handleNightIntervention();
            }
            this._playSound(alert.event.soundType || 'cgmAlarm');
            if (!this._showScheduledEventPopup(alert.event)) {
                this._showScheduledEventTip(alert.event, sim);
            }
            return false;
        });
    }

    executeScheduledEvent(evt, sim) {
        const showEventTip = () => this._showScheduledEventTip(evt, sim);
        const showEventPopup = () => this._showScheduledEventPopup(evt);

        switch (evt.type) {
            case 'autoFood': {
                const ate = sim.addFood(evt.carbs, evt.protein || 0, evt.fat || 0, evt.icon || '🍲',
                    evt.weight || 0, evt.carbType || 'mixed', evt.eatTimeMin);
                // Flying icon animation (same as when the player eats)
                if (ate) {
                    this._flyIconToGraph(evt.icon || '🍲', 'dock-panel-food');
                }
                if (!showEventPopup()) {
                    showEventTip();
                }
                break;
            }

            case 'autoBasal':
                sim.addLongInsulin(evt.dose || sim.basalDose);
                this._flyIconToGraph('💉', 'dock-panel-insulin', 'basal');
                if (!showEventPopup()) {
                    showEventTip();
                }
                break;

            case 'autoMotion': {
                const activityType = evt.activityType || 'cardio';
                const intensity = evt.intensity || 'Medium';
                const durationMinutes = evt.durationMinutes || 30;
                const ok = sim.startAktivitet(activityType, intensity, durationMinutes);
                if (ok) {
                    const typeDef = typeof AKTIVITETSTYPER !== 'undefined'
                        ? AKTIVITETSTYPER[activityType]
                        : null;
                    this._flyIconToGraph(evt.icon || typeDef?.icon || '🏃', 'dock-panel-motion');
                    this._showActivityActive(activityType, intensity, durationMinutes);
                    if (!showEventPopup()) {
                        showEventTip();
                    }
                }
                break;
            }

            case 'acuteStress':
                sim.addAcuteStress(evt.amount || 0.30);
                if (!showEventPopup()) {
                    showEventTip();
                }
                break;

            case 'chronicStress':
                sim.addChronicStress(evt.amount || 0.40);
                if (evt.illnessSymptoms && typeof sim.startIllnessSymptoms === 'function') {
                    sim.startIllnessSymptoms(evt.symptomDurationMinutes || evt.durationMinutes || 720);
                }
                if (evt.soundType) {
                    this._playSound(evt.soundType);
                }
                if (!showEventPopup()) {
                    showEventTip();
                }
                break;

            case 'cgmCompressionAlarm': {
                if (typeof sim.startCgmCompression === 'function') {
                    sim.startCgmCompression(evt.dropMmol || 2.7, evt.durationMinutes || 45);
                }
                this.queueCgmCompressionAlarm(evt, sim);
                break;
            }

            case 'cgmSensorLoss': {
                if (typeof sim.startCgmSensorLoss === 'function') {
                    sim.startCgmSensorLoss(evt.offlineMinutes || 45, evt.warmupMinutes || 60);
                }
                // Show popup now (full explanation), queue delayed tip with 30 sim-min delay
                showEventPopup();
                this.queueDelayedTip({
                    delayMinutes: 30,
                    textKey: evt.delayedTipKey || evt.messageKey,
                    priority: evt.priority !== undefined ? evt.priority : 3,
                    id: `delayed_${evt.id || evt.type}`,
                    eventStyle: true,
                });
                break;
            }

            case 'cgmSelfTest': {
                if (typeof sim.startCgmSelfTest === 'function') {
                    sim.startCgmSelfTest(evt.durationMinutes || 20);
                }
                // Show popup now (full explanation), queue delayed tip with 30 sim-min delay
                showEventPopup();
                this.queueDelayedTip({
                    delayMinutes: 30,
                    textKey: evt.delayedTipKey || evt.messageKey,
                    priority: evt.priority !== undefined ? evt.priority : 3,
                    id: `delayed_${evt.id || evt.type}`,
                    eventStyle: true,
                });
                break;
            }
        }
    }


    // =========================================================================
    // TUTORIAL TIPS — Shown ONLY once (permanently "seen" in localStorage)
    // =========================================================================
    // Discrete, non-blocking overlays. Maximum 2-3 per level.
    // Explain UI elements: "Press here", "Speed up with ⏩"
    // =========================================================================

    checkTutorialTips(sim) {
        const settings = this._settings();
        // Check whether level tips are disabled in settings
        // (tutorial popups belong to the active level and are therefore governed by the same toggle as level.tips)
        if (settings.levelTipsEnabled === false) return;
        if (this.tutorialTipsPending.length === 0) return;
        if (this.tutorialTipActive) return;  // One tip at a time

        const tip = this.tutorialTipsPending[0];
        let shouldShow = false;

        switch (tip.triggerType) {
            case 'levelStart':
                // Show immediately (after the intro popup is closed)
                shouldShow = sim.totalSimMinutes > this.levelStartSimTime;
                break;

            case 'afterAction':
                shouldShow = (this.actionCounts[tip.afterAction] || 0) > 0;
                break;  // Tutorial tips are one-shot; cumulative check is fine here

            case 'panelOpen':
                // Show when a specific panel is opened. Panel visibility is a
                // DOM concern, so the core asks the shell via the optional
                // host.isPanelOpen callback (no-op -> false on a minimal host).
                shouldShow = (this.host && typeof this.host.isPanelOpen === 'function')
                    ? !!this.host.isPanelOpen(tip.panel)
                    : false;
                break;

            case 'time':
                shouldShow = sim.timeInMinutes >= tip.triggerValue;
                break;
        }

        if (shouldShow) {
            this.showTutorialTip(tip, sim);
        }
    }

    showTutorialTip(tip, sim) {
        const game = sim || this._game();
        this.tutorialTipActive = tip;
        this.tutorialTipsPending.shift();  // Remove from queue
        tipSessionState._tipsShownCounter++;
        tipSessionState._tipsShownToday++;

        // Mark as permanently seen
        if (!this.progress.tutorialTipsSeen.includes(tip.id)) {
            this.progress.tutorialTipsSeen.push(tip.id);
            this.saveCampaignProgress();
        }

        // Vis som en neutral grafbesked. Skallen tilføjer pæreikonet.
        if (game && game.graphMessages) {
            game.graphMessages.push({
                id: `tutorial_${tip.id}`,
                text: t(tip.textKey, getCampaignTextVars(tip.textVars)),
                expireTime: game.totalSimMinutes + 120,  // Show for 2 sim-hours
                isTutorialTip: true,
                priority: tip.priority !== undefined ? tip.priority : 2,  // Tutorial popups = level-important
                guideSection: guideSectionForTextKeySafe(tip.textKey),
                tipScope: 'level',
                createdAt: game.totalSimMinutes,
            });
        }

        // Highlight the relevant UI element (pulsing glow). DOM access lives in
        // the shell via the optional host.highlightElement; no-op otherwise.
        if (tip.highlightElement) {
            this._highlightElement(tip.highlightElement);
        }

        // Release to next tip after a short delay
        setTimeout(() => {
            this.tutorialTipActive = null;
        }, 5000);
    }


    // =========================================================================
    // GAME TIPS — Contextual physiology tips with cooldown
    // =========================================================================
    // Vises med et neutralt pæreikon. 60 sim-minutters cooldown mellem gentagelser.
    // Can be disabled in settings.
    // =========================================================================

    checkGameTips(sim) {
        const settings = this._settings();
        // Level-specific tips (defined in level.tips[]) are gated by levelTipsEnabled.
        if (settings.levelTipsEnabled === false) return;
        if (!this.levelConfig.tips) return;

        // Level scope: cooldowns live in this.tipsShown, action checks read the
        // per-level actionCounts, and the 'time' trigger counts from level start.
        const ctx = {
            scope: 'level',
            cooldownStore: this.tipsShown,
            timeOrigin: this.levelStartSimTime,
            hasAction: (key) => _tipHasActionFromCounts(this, key),
        };
        for (const tip of this.levelConfig.tips) {
            if (_tipShouldShow(tip, sim, ctx)) _tipCommitShown(tip, sim, ctx);
        }
    }


    // =========================================================================
    // OBJECTIVES — Evaluate objective progress
    // =========================================================================

    checkObjectives(sim) {
        if (!this.levelConfig.objectives) return;

        for (const obj of this.levelConfig.objectives) {
            if (this.objectiveStatus[obj.id].completed) continue;

            let completed = false;

            switch (obj.type) {
                case 'actionRequired':
                    // The player must have performed at least 1 action of this type
                    completed = (this.actionCounts[obj.actionType] || 0) >= 1;
                    break;

                case 'actionCount':
                    // The player must have performed at least N actions
                    const count = this.actionCounts[obj.actionType] || 0;
                    this.objectiveStatus[obj.id].progress = count;
                    completed = count >= obj.minCount;
                    break;

                case 'minCalories': {
                    // The player must be in calorie surplus (or balance) by level end.
                    // Checked only when the level is complete — during play, only progress
                    // (net kcal) is shown. Live evaluation would lock the objective too early
                    // or flip back and forth; status is frozen at level-end (in checkLevelComplete).
                    const netKcal = (sim.totalKcalConsumed || 0)
                                  - (sim.totalKcalBurnedBase || 0)
                                  - (sim.totalKcalBurnedMotion || 0);
                    this.objectiveStatus[obj.id].progress = netKcal;
                    this.objectiveStatus[obj.id].target = 0;
                    // 'completed' is set only at level-end
                    break;
                }

                case 'minActionsPerDay': {
                    // The player must perform at least minPerDay actions on EVERY day.
                    // Only checks fully completed days — the level is passed once all
                    // days have been checked and all meet the requirement.
                    const levelElapsed = sim.totalSimMinutes - this.levelStartSimTime;
                    const totalDays = Math.ceil(this.levelConfig.durationMinutes / 1440);
                    const daysDone = Math.min(Math.floor(levelElapsed / 1440), totalDays);
                    const dayCountsObj = this.actionCountsPerDay[obj.actionType] || {};
                    const minAcrossDays = daysDone > 0
                        ? Math.min(...Array.from({ length: daysDone }, (_, d) => dayCountsObj[d] || 0))
                        : 0;
                    this.objectiveStatus[obj.id].progress = minAcrossDays;
                    this.objectiveStatus[obj.id].target = obj.minPerDay;
                    completed = daysDone === totalDays && minAcrossDays >= obj.minPerDay;
                    break;
                }

                case 'minExerciseMinutesPerDay': {
                    // The player must be active for at least minPerDay minutes on EVERY day.
                    // Same logic as minActionsPerDay but operating on exerciseMinutesPerDay.
                    const levelElapsed2 = sim.totalSimMinutes - this.levelStartSimTime;
                    const totalDays2 = Math.ceil(this.levelConfig.durationMinutes / 1440);
                    const daysDone2 = Math.min(Math.floor(levelElapsed2 / 1440), totalDays2);
                    const minAcrossDays2 = daysDone2 > 0
                        ? Math.min(...Array.from({ length: daysDone2 }, (_, d) => this.exerciseMinutesPerDay[d] || 0))
                        : 0;
                    this.objectiveStatus[obj.id].progress = Math.round(minAcrossDays2);
                    this.objectiveStatus[obj.id].target = obj.minPerDay;
                    completed = daysDone2 === totalDays2 && minAcrossDays2 >= obj.minPerDay;
                    break;
                }

                case 'survive':
                    // Completed automatically if the player has not died
                    // (marked completed only at level-end)
                    break;
            }

            if (completed) {
                this.objectiveStatus[obj.id].completed = true;
            }
        }
    }


    // =========================================================================
    // checkDailyObjectiveFailures — Fail the level immediately after a missed daily quota
    // =========================================================================
    // Some requirements apply per day, e.g. "at least 2 hours of activity every day".
    // These must not wait until the whole level is done: once day 1 ends without
    // the requirement met, the player can no longer recover it. The level therefore
    // fails immediately after each completed day.
    //
    // @param {Simulator} sim — the active Simulator instance
    // @returns {boolean} true if the level was failed and update() should stop
    // =========================================================================
    checkDailyObjectiveFailures(sim) {
        if (!this.levelActive || !this.levelConfig.objectives) return false;

        const levelElapsed = sim.totalSimMinutes - this.levelStartSimTime;
        const totalDays = Math.ceil(this.levelConfig.durationMinutes / 1440);
        const daysDone = Math.min(Math.floor(levelElapsed / 1440), totalDays);
        if (daysDone <= this._dailyObjectiveDaysChecked) return false;

        for (let day = this._dailyObjectiveDaysChecked; day < daysDone; day++) {
            for (const obj of this.levelConfig.objectives) {
                if (obj.type === 'minActionsPerDay') {
                    const dayCountsObj = this.actionCountsPerDay[obj.actionType] || {};
                    const count = dayCountsObj[day] || 0;
                    this.objectiveStatus[obj.id].progress = count;
                    this.objectiveStatus[obj.id].target = obj.minPerDay;
                    if (count < obj.minPerDay) {
                        this.failCurrentLevel(sim, obj.id);
                        return true;
                    }
                } else if (obj.type === 'minExerciseMinutesPerDay') {
                    const minutes = this.exerciseMinutesPerDay[day] || 0;
                    this.objectiveStatus[obj.id].progress = Math.round(minutes);
                    this.objectiveStatus[obj.id].target = obj.minPerDay;
                    if (minutes < obj.minPerDay) {
                        this.failCurrentLevel(sim, obj.id);
                        return true;
                    }
                }
            }
            this._dailyObjectiveDaysChecked = day + 1;
        }

        return false;
    }


    // =========================================================================
    // failCurrentLevel — End the active campaign level as failed
    // =========================================================================
    // Used both when time runs out without all requirements met, and when a
    // daily requirement can no longer be recovered after a completed day.
    //
    // @param {Simulator} sim — the active Simulator instance
    // =========================================================================
    failCurrentLevel(sim, failedObjectiveId = null) {
        if (!this.levelActive) return;
        this.failedObjectiveId = failedObjectiveId;
        this.levelActive = false;
        this._emitScreen(this.buildFailedDescriptor(sim));
    }


    // =========================================================================
    // LEVEL COMPLETION — Check whether the level is complete
    // =========================================================================

    checkLevelComplete(sim) {
        if (!this.levelActive) return;

        // Check whether sim-time has reached the level end
        const levelElapsed = sim.totalSimMinutes - this.levelStartSimTime;
        if (levelElapsed < this.levelConfig.durationMinutes) return;

        // Mark 'survive' objective as completed (the player has survived!)
        // Evaluate 'minCalories' here — requires net surplus at end (>= 0).
        for (const obj of this.levelConfig.objectives) {
            if (obj.type === 'survive') {
                this.objectiveStatus[obj.id].completed = true;
            } else if (obj.type === 'minCalories') {
                const netKcal = (sim.totalKcalConsumed || 0)
                              - (sim.totalKcalBurnedBase || 0)
                              - (sim.totalKcalBurnedMotion || 0);
                this.objectiveStatus[obj.id].completed = netKcal >= 0;
            }
        }

        // Check whether ALL objectives are met
        const allMet = this.levelConfig.objectives.every(
            obj => this.objectiveStatus[obj.id].completed
        );

        if (allMet) {
            this.levelActive = false;

            // Calculate stars and save result.
            // Total = base points + star bonus (5.0 per star).
            // TIR bonus is NO LONGER counted separately — TIR is already
            // reflected in the star count (stars are awarded from TIR thresholds).
            const stars = this.calculateStars(sim);
            const points = sim.normoPoints || 0;
            const totalPoints = points + stars * STAR_BONUS;
            // Physiology viewing = practice run: the host reports the score blocked, so
            // the level's stars/best score are NOT recorded (same rule as the sandbox
            // highscore). Progression (completed + unlock) still happens — the player
            // did finish the level — but the leaderboard/rating is not earned this way.
            const scoreBlocked = !!(this.host.isScoreBlocked && this.host.isScoreBlocked());
            this.saveLevelResult(stars, totalPoints, scoreBlocked);

            // Unlock the next level
            if (this.currentLevelIndex + 1 < CAMPAIGN_LEVELS.length) {
                if (this.progress.currentLevel <= this.currentLevelIndex) {
                    this.progress.currentLevel = this.currentLevelIndex + 1;
                    this.saveCampaignProgress();
                }
            }

            // Emit level-complete screen
            this._emitScreen(this.buildCompleteDescriptor(stars, points, sim, scoreBlocked));
        } else {
            // Time expired but objectives not met
            this.failCurrentLevel(sim);
        }
    }

    // Calculate the star rating (0-3) from TIR% during the level window.
    calculateStars(sim) {
        if (!this.levelConfig.stars) return 1;

        // TIR% from BG history during this level (shared with calculateTIR).
        const tir = this.calculateTIR(sim);

        // calculateTIR returns 0 when there is too little data (<10 samples);
        // award 0 stars in that case (matches the original guard).
        const levelData = (sim.bgHistoryForStats || []).filter(
            p => p.time >= this.levelStartSimTime
        );
        if (levelData.length < 10) return 0;

        if (this.levelConfig.stars.three && tir >= this.levelConfig.stars.three.minTIR) return 3;
        if (this.levelConfig.stars.two && tir >= this.levelConfig.stars.two.minTIR) return 2;
        if (this.levelConfig.stars.one && tir >= this.levelConfig.stars.one.minTIR) return 1;
        // 0 stars: player survived but TIR < 1-star threshold.
        // Triggers "poor pass" illustration in the level-complete popup.
        return 0;
    }

    // Calculate TIR% (time in range 4-10 mmol/L) for the active level window.
    calculateTIR(sim) {
        const data = (sim.bgHistoryForStats || []).filter(
            p => p.time >= this.levelStartSimTime
        );
        if (data.length < 10) return 0;
        const inRange = data.filter(p => p.trueBG >= 4 && p.trueBG <= 10).length;
        return (inRange / data.length) * 100;
    }


    // =========================================================================
    // GAME OVER IN CAMPAIGN
    // =========================================================================
    // Called from checkGameOverConditions() in simulator.js when the player dies.
    // Emits an encouraging game-over screen descriptor (not the standard game over).
    // =========================================================================

    handleCampaignGameOver(title, details) {
        this.levelActive = false;
        this._emitScreen(this.buildGameOverDescriptor(title, details));
    }


    // =========================================================================
    // DESCRIPTOR BUILDERS — pure-data screen payloads consumed by the shell
    // =========================================================================
    // Each descriptor is plain data (NO HTML strings). The shell turns it into
    // the actual popup/screen. Field shapes are documented in the return report.
    // =========================================================================

    // Level intro. isReopen=true when the user reopens it mid-level via the info
    // button (start button label then switches to "Back to level").
    buildIntroDescriptor(isReopen = false) {
        const level = this.levelConfig;
        if (!level) return null;
        const game = this._game();
        const guideLinks = (typeof GUIDE_LEVEL_LINKS !== 'undefined' && GUIDE_LEVEL_LINKS[level.number])
            ? GUIDE_LEVEL_LINKS[level.number]
            : [];

        // Kampagnen handler om en fast fiktiv karakter. Karakteren er scenariets
        // subjekt - ikke en medicinsk guide eller en skjult patientprofil.
        const character = typeof getActiveCharacter === 'function'
            ? getActiveCharacter()
            : { id: 'erik', name: 'Erik' };
        return {
            kind: 'intro',
            isReopen,
            character: { id: character.id, name: character.name },
            level: { number: level.number, titleKey: level.titleKey, descriptionKey: level.descriptionKey },
            objectives: level.objectives.map(obj => ({
                id: obj.id,
                descriptionKey: obj.descriptionKey,
                completed: !!(this.objectiveStatus[obj.id] || {}).completed,
            })),
            guideSections: guideLinks,
            // Genbrug de samme enhedsafhængige BG-grænser som grafens pointsystem,
            // så introen viser 5-6 mmol/L eller de tilsvarende mg/dL-værdier.
            textVars: Object.assign(bgVars(), {
                icr: Math.round((game && game.ICR) || 10),
                characterName: character.name,
            }),
        };
    }

    // Level complete. Includes TIR, stars, points breakdown and animation inputs.
    buildCompleteDescriptor(stars, points, sim, scoreBlocked) {
        const level = this.levelConfig;
        const starBonus = stars * STAR_BONUS;
        const tir = this.calculateTIR(sim);
        const total = points + starBonus;
        return {
            kind: 'complete',
            character: getCampaignCharacterDescriptor(),
            level: { number: level.number, titleKey: level.titleKey },
            stars,
            tir,
            points,
            starBonus,
            total,
            scoreBlocked: !!scoreBlocked,   // physiology/practice run — stars/best not recorded
            hasNext: this.currentLevelIndex + 1 < CAMPAIGN_LEVELS.length,
        };
    }

    // Level failed (time expired or unrecoverable daily quota missed).
    buildFailedDescriptor(sim) {
        const level = this.levelConfig;
        const character = getCampaignCharacterDescriptor();
        const missingObjectives = this.failedObjectiveId
            ? level.objectives.filter(obj => obj.id === this.failedObjectiveId)
            : level.objectives.filter(obj => !(this.objectiveStatus[obj.id] || {}).completed);
        const levelGuideLinks = (typeof GUIDE_LEVEL_LINKS !== 'undefined' && GUIDE_LEVEL_LINKS[level.number])
            ? GUIDE_LEVEL_LINKS[level.number]
            : [];
        return {
            kind: 'failed',
            character,
            level: { number: level.number, titleKey: level.titleKey },
            failedObjectiveId: this.failedObjectiveId,
            missingObjectives: missingObjectives.map(obj => {
                const status = this.objectiveStatus[obj.id] || {};
                const hasProgress = status.progress !== undefined && status.target !== undefined;
                return {
                    id: obj.id,
                    descriptionKey: obj.descriptionKey,
                    progress: hasProgress ? Math.round(status.progress) : null,
                    target: hasProgress ? status.target : null,
                };
            }),
            guideSections: ['points', ...levelGuideLinks.slice(0, 2)],
            textVars: { characterName: character.name },
        };
    }

    // Game over (player died mid-level). title + details from the simulator.
    buildGameOverDescriptor(title, details) {
        return {
            kind: 'gameover',
            character: getCampaignCharacterDescriptor(),
            level: { number: this.levelConfig ? this.levelConfig.number : '' },
            title,
            cause: details.cause || '',
            explanation: details.explanation || '',
            tips: details.tips || [],
            guideSections: guideSectionsForGameOverDetails(details),
        };
    }

    // Level-select. Pure data for the grid (the shell renders cards). Mirrors
    // the unlock/state logic from the old _buildLevelCardsHtml.
    buildLevelSelectDescriptor() {
        const TOTAL_SLOTS = 10;
        const slots = [];
        for (let i = 0; i < TOTAL_SLOTS; i++) {
            const level = CAMPAIGN_LEVELS[i];
            if (level) {
                const lp = this.progress.levels[level.id] || { completed: false, stars: 0, bestPoints: 0, attempts: 0 };
                const unlocked = this.isLevelUnlocked(i);
                slots.push({
                    index: i,
                    exists: true,
                    number: level.number,
                    titleKey: level.titleKey,
                    unlocked,
                    completed: !!lp.completed,
                    stars: lp.stars || 0,
                    bestPoints: lp.bestPoints || 0,
                    bestName: lp.bestName || null,
                    // A4f: the character that set the best score, so a leaderboard can
                    // tag the record run (mirrors the per-row character tag).
                    bestCharacter: lp.bestCharacter || null,
                });
            } else {
                slots.push({
                    index: i,
                    exists: false,
                    number: i + 1,
                    titleKey: `campaign.level${i + 1}.title`,
                    unlocked: false,
                    completed: false,
                    stars: 0,
                    bestPoints: 0,
                    bestName: null,
                });
            }
        }
        return { kind: 'levelSelect', slots };
    }

    // Emit the level-select screen to the host (re-opened via the desktop adapter).
    showLevelSelectScreen(onSelect) {
        this._emitScreen(Object.assign(this.buildLevelSelectDescriptor(), { onSelect }));
    }


    // =========================================================================
    // TIMELINE MARKERS — Retrieve markers for the graph
    // =========================================================================

    // @param {Simulator} sim — used for totalSimMinutes (was the global game)
    getTimelineMarkers(sim) {
        if (!this.levelConfig) return [];
        const markers = this.resolvedTimelineMarkers || this.levelConfig.markers || [];
        const game = sim || this._game();
        if (!game) return markers;

        return markers.filter(marker => {
            if (marker.revealTimeMinutes === undefined) return true;
            return game.totalSimMinutes >= this.levelStartSimTime + marker.revealTimeMinutes;
        });
    }

    // Returnér de fysiologiske banehændelser, som skal genafspilles låst i
    // Hvad Nu Hvis. De er en del af banens situation - ikke spillerens valg - og
    // må derfor hverken kunne flyttes, slettes eller varieres i editoren.
    getInsightsLockedEvents(sim) {
        const game = sim || this._game();
        if (!game || !this.levelConfig) return [];

        const supportedTypes = new Set(['acuteStress', 'chronicStress']);
        const scheduledEvents = this.resolvedScheduledEvents || this.levelConfig.scheduledEvents || [];
        const markers = this.resolvedTimelineMarkers || this.levelConfig.markers || [];

        return scheduledEvents
            .filter(event => event && event.lockInInsights === true &&
                supportedTypes.has(event.type) && this.scheduledEventsFired.has(event.id))
            .map(event => {
                const absoluteEventTime = this.levelStartSimTime + event.timeMinutes;
                const linkedMarker = markers.find(marker => marker.sourceEventId === event.id);
                let marker = null;

                if (linkedMarker) {
                    marker = _clonePlain(linkedMarker);
                    if (marker.type === 'interval') {
                        marker.startMin = this.levelStartSimTime + marker.startMinutes;
                        marker.endMin = this.levelStartSimTime + marker.endMinutes;
                        delete marker.startMinutes;
                        delete marker.endMinutes;
                    } else {
                        marker.timeMin = this.levelStartSimTime + marker.timeMinutes;
                        delete marker.timeMinutes;
                    }
                }

                return {
                    t: absoluteEventTime,
                    kind: event.type,
                    amount: event.amount,
                    marker
                };
            });
    }


    // =========================================================================
    // LEVEL FLOW — start / retry (boot the run via the host)
    // =========================================================================

    // Start a specific level (used by level-select and "next level"). The host
    // boots the actual run (desktop: resetGame()+startGame), then loadLevel runs.
    startLevel(levelIndex) {
        this.currentLevelIndex = levelIndex;
        if (this.host && typeof this.host.requestStart === 'function') {
            // The host is responsible for resetting + loading + starting. Desktop
            // requestStart calls resetGame() then startGame('campaign'); loadLevel
            // is invoked by the host between those (see desktop adapter).
            this.host.requestStart('campaign');
        }
    }

    // Restart the current level
    retryCurrentLevel() {
        this.startLevel(this.currentLevelIndex);
    }


    // =========================================================================
    // PROGRESSION / PERSISTENCE — uses host.storage, falls back to localStorage
    // =========================================================================

    // Is the level at index i unlocked? (debug toggle or reached in progress)
    isLevelUnlocked(i) {
        const settings = this._settings();
        const level = CAMPAIGN_LEVELS[i];
        if (!level) return false;
        return !!(settings && settings.debugUnlockAllLevels)
            || !!level.forceUnlocked
            || i <= (this.progress.currentLevel || 0);
    }

    // Return the current progress object (for shells that render highscore/grid).
    getProgress() {
        return this.progress;
    }

    _storageGet(key) {
        if (this.host && this.host.storage && typeof this.host.storage.get === 'function') {
            return this.host.storage.get(key);
        }
        if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
        return null;
    }
    _storageSet(key, value) {
        if (this.host && this.host.storage && typeof this.host.storage.set === 'function') {
            this.host.storage.set(key, value);
            return;
        }
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    }

    saveCampaignProgress() {
        try {
            this._storageSet(CAMPAIGN_PROGRESS_KEY, JSON.stringify(this.progress));
        } catch (e) { /* storage unavailable */ }
    }

    loadCampaignProgress() {
        try {
            const stored = this._storageGet(CAMPAIGN_PROGRESS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Merge with defaults (ensures new fields exist)
                return { ...getDefaultCampaignProgress(), ...parsed };
            }
        } catch (e) { /* storage unavailable */ }
        return getDefaultCampaignProgress();
    }

    // @param {boolean} scoreBlocked — physiology/practice run: record completion +
    //   unlock progression, but do NOT update the recorded stars/best score (the
    //   campaign "highscore"). Mirrors the sandbox highscore block.
    saveLevelResult(stars, points, scoreBlocked) {
        const level = this.levelConfig;
        const existing = this.progress.levels[level.id] || { completed: false, stars: 0, bestPoints: 0, attempts: 0 };

        existing.completed = true;                                // progression: the level was finished

        if (!scoreBlocked) {
            existing.stars = Math.max(existing.stars, stars);    // Keep best star count

            // Save player signature + character when a new best score is set.
            // A4: the name is the player's SIGNATURE (kept separate from the
            // character on its own storage key), not a field on the profile.
            if (points > existing.bestPoints) {
                existing.bestPoints = points;
                let sig = '';
                try { sig = (this._storageGet('ddPlayerSignature') || '').trim(); } catch (e) { /* unavailable */ }
                existing.bestName = sig || t('stats.player.anonymous');
                // A4f: tag the best run with the character that achieved it.
                try {
                    const profile = JSON.parse(this._storageGet('diabetesDystenProfile') || '{}');
                    const cid = (typeof resolveCharacterId === 'function') ? resolveCharacterId(profile) : null;
                    if (cid && typeof getCharacter === 'function') {
                        const c = getCharacter(cid);
                        existing.bestCharacter = { id: c.id, name: c.name };
                    }
                } catch (e) { /* leave bestCharacter unset */ }
            }
        }

        this.progress.levels[level.id] = existing;
        this.saveCampaignProgress();
    }

    // =========================================================================
    // updateBestNameForCurrentLevel — set the just-completed level's saved name
    // =========================================================================
    // Called when the player signs the score on the level-complete popup (A4d).
    // saveLevelResult() already stored the name from the existing signature; this
    // lets the player type/confirm a name there (e.g. first-ever run, where no
    // signature existed yet) and have the campaign grid reflect it.
    // =========================================================================
    updateBestNameForCurrentLevel(signature) {
        const level = this.levelConfig;
        if (!level) return;
        const lp = this.progress.levels[level.id];
        if (!lp) return;
        lp.bestName = (signature || '').trim() || t('stats.player.anonymous');
        this.saveCampaignProgress();
    }
}


// =============================================================================
// UNIFIED TIP EVALUATION
// =============================================================================
// Level tips (CampaignCore.checkGameTips, level.tips[]) and global tips
// (checkGlobalTipsForAllModes, GLOBAL_TIPS) share one pipeline: the same
// pre-gates, trigger switch, condition check, priority-1 solo rule, rate-limit,
// daily cap and chance-roll. Only a few pieces depend on scope, and those are
// captured in a small ctx descriptor built by each caller:
//   ctx.scope          'level' | 'global' — tags the graph message. The
//                      global-only pre-gates (skipInCampaign, requiresPhysics)
//                      are no-ops for level tips, which never set them.
//   ctx.cooldownStore  object mapping tip.id -> last-shown sim-min. Level tips
//                      use CampaignCore.tipsShown; global tips use
//                      tipSessionState.globalTipsShown (separate stores so a
//                      level tip and a global tip never share a cooldown slot).
//   ctx.timeOrigin     sim-min offset for the 'time' trigger when triggerValue
//                      >= 1440 ("day N at HH:MM"): level start vs absolute 0.
//   ctx.hasAction(key) whether the player performed an action. Level scope reads
//                      CampaignCore.actionCounts (per-level); global scope
//                      reads sim.logHistory (mode-independent).
//   ctx.core           the active CampaignCore instance (or null in pure global
//                      sandbox mode). Used for level-active pre-gates.
// tipSessionState holds the trackers shared across both scopes (counters,
// last-shown timestamp, the musicRoll/tipsCount one-shots).
//
// All `game` reach-ins are rebound to the passed `sim` (sim === game in
// practice in both shells). The pipeline is fully DOM-free.
// =============================================================================

// Resolve the active CampaignCore instance regardless of caller. The desktop/
// mobile shells assign the constructed core to a global `campaignEngine`; the
// pipeline reaches it via ctx.core when present, falling back to that global.
function _activeCampaignCore(ctx) {
    if (ctx && ctx.core) return ctx.core;
    return (typeof campaignEngine !== 'undefined') ? campaignEngine : null;
}

// shouldShowCalorieBalanceUI — whether the kcal/energy-balance readout is relevant.
// Pure policy predicate (no DOM), so it lives in the shared core and BOTH shells use
// it: desktop ui.js and mobile updateHud. In campaign the energy objective is not
// introduced until a level carries a 'minCalories' objective (~level 4); before that
// the kcal number is noise while the player learns basal, dawn and fast carbs. In
// sandbox / Box Challenge it is always shown (no step-by-step learning progression).
function shouldShowCalorieBalanceUI() {
    if (typeof game === 'undefined' || !game || game.gameMode !== 'campaign') return true;
    const level = (typeof campaignEngine !== 'undefined' && campaignEngine)
        ? campaignEngine.levelConfig
        : null;
    return !!(level && Array.isArray(level.objectives)
        && level.objectives.some(obj => obj.type === 'minCalories'));
}

function checkGlobalTipsForAllModes(sim) {
    if (!sim) return;
    if (typeof GLOBAL_TIPS === 'undefined') return;

    const core = (typeof campaignEngine !== 'undefined') ? campaignEngine : null;

    // Read the globalTipsEnabled toggle through the host (shell-agnostic). The
    // bare `appSettings` global is only a last-resort fallback for the unlikely
    // case where the loop runs before a core/host is wired; both shells define
    // appSettings, so this stays correct on desktop and mobile alike.
    const settings = (core && core.host && typeof core.host.getSettings === 'function')
        ? core.host.getSettings()
        : ((typeof appSettings !== 'undefined') ? appSettings : null);
    if (settings && settings.globalTipsEnabled === false) return;

    // Global scope: cooldowns live in tipSessionState.globalTipsShown, action
    // checks read sim.logHistory, and the 'time' trigger uses absolute sim-time.
    const ctx = {
        scope: 'global',
        cooldownStore: tipSessionState.globalTipsShown,
        timeOrigin: 0,
        core,
        hasAction: (key) => _tipHasActionFromLog(sim, key),
    };
    for (const tip of GLOBAL_TIPS) {
        if (_tipShouldShow(tip, sim, ctx)) _tipCommitShown(tip, sim, ctx);
    }
}

// Map a campaign-style action key to its sim.logHistory event type.
const TIP_ACTION_LOG_TYPE = {
    food: 'food',
    fastInsulin: 'insulin-fast',
    basalInsulin: 'insulin-basal',
    exercise: 'motion',
    ketoneTest: 'ketone-test',
};

// Level scope: has the player performed this action in the current level?
function _tipHasActionFromCounts(core, key) {
    return !!(core && core.actionCounts && (core.actionCounts[key] || 0));
}

// Global scope: has the player performed this action at all (mode-independent)?
function _tipHasActionFromLog(sim, key) {
    const logType = TIP_ACTION_LOG_TYPE[key] || key;
    return !!(sim && sim.logHistory && sim.logHistory.some(e => e.type === logType));
}

function _tipShouldShow(tip, sim, ctx) {
    const core = _activeCampaignCore(ctx);

    // pcOnly tips only on non-touch devices (pure PC/keyboard).
    if (tip.pcOnly && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return false;

    // Skip a tip that has a level-specific variant while a level is active
    // (avoids showing both the generic and the tailored tip). No-op for level
    // tips, which never set skipInCampaign.
    if (tip.skipInCampaign && core && core.levelActive) return false;

    // requiredAction: suppress if the action is locked in the active level.
    // checkGameTips only runs while a level is active, so for scope 'level' the
    // levelActive guard is always true and this reduces to the plain check.
    if (tip.requiredAction && core && core.levelActive) {
        if (!core.isActionAllowed(tip.requiredAction)) return false;
    }

    // requiresPhysics: suppress if the level disables the relevant physics.
    // Maps 'dawnEffect' -> level.physics.dawnEffectEnabled (=== false means off).
    // No-op for level tips, which never set requiresPhysics.
    if (tip.requiresPhysics && core && core.levelActive
        && core.levelConfig && core.levelConfig.physics) {
        const required = Array.isArray(tip.requiresPhysics) ? tip.requiresPhysics : [tip.requiresPhysics];
        const physics = core.levelConfig.physics;
        for (const phys of required) {
            if (physics[phys + 'Enabled'] === false) return false;
        }
    }

    // Per-day rollover: reset the daily tip counter when sim-time crosses midnight.
    _maybeRolloverTipDay(sim);

    const prio = tip.priority !== undefined ? tip.priority : 5;

    // Suppress tips in the last TIP_SUPPRESS_BEFORE_DAY_END_MIN sim-min before
    // midnight so they don't collide with the day-change popup.
    const minutesUntilDayEnd = 1440 - (sim.totalSimMinutes % 1440);
    if (minutesUntilDayEnd < TIP_SUPPRESS_BEFORE_DAY_END_MIN) return false;

    // Cooldown.
    const cooldown = tip.cooldownMinutes || 60;
    const lastShown = ctx.cooldownStore[tip.id];
    if (lastShown !== undefined && (sim.totalSimMinutes - lastShown) < cooldown) return false;

    // Already showing on the graph?
    if (sim && sim.graphMessages) {
        if (sim.graphMessages.find(m => m.id === `tip_${tip.id}`)) return false;
    }

    let triggered = false;
    switch (tip.triggerType) {
        case 'time':
            // triggerValue < 1440: time-of-day (0-1440), fires every day at HH:MM.
            // triggerValue >= 1440: elapsed minutes since ctx.timeOrigin ("day N").
            if (tip.triggerValue < 1440) {
                triggered = sim.timeInMinutes >= tip.triggerValue &&
                            sim.timeInMinutes < tip.triggerValue + 30;
            } else {
                const elapsed = sim.totalSimMinutes - ctx.timeOrigin;
                triggered = elapsed >= tip.triggerValue && elapsed < tip.triggerValue + 30;
            }
            break;
        case 'bgAbove':
            triggered = sim.cgmBG > tip.triggerValue;
            break;
        case 'bgBelow':
            triggered = sim.cgmBG < tip.triggerValue;
            break;
        case 'kcalDeficit': {
            // Fires when net kcal is below triggerValue (typically a negative
            // threshold such as -800).
            const net = (sim.totalKcalConsumed || 0)
                      - (sim.totalKcalBurnedBase || 0)
                      - (sim.totalKcalBurnedMotion || 0);
            triggered = net < tip.triggerValue;
            break;
        }
        case 'afterAction': {
            // Trigger only if the action happened recently (within 30 sim-min),
            // so the tip doesn't fire long after the action.
            const logType = TIP_ACTION_LOG_TYPE[tip.afterAction] || tip.afterAction;
            triggered = !!(sim.logHistory && sim.logHistory.some(
                e => e.type === logType && (sim.totalSimMinutes - e.time) < 30
            ));
            break;
        }
        case 'nightAwakening': {
            // Motorens sammenlagte vågenhistorik er fælles for tips og UI.
            const awakenings = sim.sleepAwakeIntervals;
            if (awakenings && awakenings.length) {
                const last = awakenings[awakenings.length - 1];
                triggered = (sim.totalSimMinutes - last.startMin) < 30;
            }
            break;
        }
        case 'noAction':
            triggered = !ctx.hasAction(tip.actionType);
            break;
        case 'basalLow': {
            // Den interne basalrate er ikke synlig uden fysiologi-visningen.
            // Vis derfor først tippet, når den lave dækning også kan ses som en
            // stigende CGM-trend. 30-minuttersraten bruger samme +0,02 mmol/L/min
            // grænse som grafens langsomt stigende trendpil.
            const required = sim.hovorkaSteadyStateBasalRate || 0;
            if (required <= 0) { triggered = false; break; }
            const actual = sim.basalInsulinRate || 0;
            const history = sim.bgHistoryForStats || [];
            const currentTime = sim.totalSimMinutes || 0;
            const currentBG = Number.isFinite(sim.cgmBG) ? sim.cgmBG : sim.trueBG;
            let earlierPoint = null;
            for (let i = history.length - 1; i >= 0; i--) {
                if (history[i].time <= currentTime - 30) {
                    earlierPoint = history[i];
                    break;
                }
            }
            const earlierBG = earlierPoint && Number.isFinite(earlierPoint.cgmBG)
                ? earlierPoint.cgmBG
                : earlierPoint && earlierPoint.trueBG;
            const elapsed = earlierPoint ? currentTime - earlierPoint.time : 0;
            const riseRate = elapsed > 0 && Number.isFinite(currentBG) && Number.isFinite(earlierBG)
                ? (currentBG - earlierBG) / elapsed
                : 0;
            triggered = actual < (tip.triggerValue * required) && riseRate > 0.02;
            break;
        }
        case 'noSpeedUsed':
            triggered = !sim._speedEverChanged && sim.totalSimMinutes >= tip.triggerValue;
            break;
        case 'noPauseUsed':
            triggered = sim.lastPauseTime === -Infinity && sim.totalSimMinutes >= tip.triggerValue;
            break;
        case 'idle': {
            // Idle = no player action for triggerValue sim-min, AND speed unused
            // (if speed is already used the player knows the shortcut).
            if (sim._speedEverChanged) { triggered = false; break; }
            const lastAction = (sim && sim.lastActionTime) || 0;
            triggered = (sim.totalSimMinutes - lastAction) >= tip.triggerValue;
            break;
        }
        case 'musicRoll':
            // One-shot roll per level: triggerValue = probability (0-1).
            if (tipSessionState._musicTipRolledThisLevel) { triggered = false; break; }
            tipSessionState._musicTipRolledThisLevel = true;  // consume the roll
            triggered = Math.random() < tip.triggerValue;
            break;
        case 'tipsCount':
            // Fires once per browser session after triggerValue tips were shown.
            if (tipSessionState._tipsOffShown) { triggered = false; break; }
            triggered = tipSessionState._tipsShownCounter >= tip.triggerValue;
            if (triggered) tipSessionState._tipsOffShown = true;
            break;
        case 'acidosisAbove':
            triggered = _tipAcidosisRatio(sim) > tip.triggerValue;
            break;
        case 'symptomVfxActive':
            triggered = _tipVfxActive(sim, ctx);
            break;
        case 'symptomGroupActive':
            triggered = typeof isSymptomGroupActive === 'function'
                && isSymptomGroupActive(sim, tip.symptomGroup, tip.minimumGroupValue);
            break;
        case 'weightLossAbove':
            triggered = -(sim.weightChangeKg || 0) > tip.triggerValue;
            break;
        case 'illnessActive':
            triggered = !!(sim.illnessSymptomsUntil && sim.totalSimMinutes < sim.illnessSymptomsUntil);
            break;
        case 'multipleSymptomsActive':
            triggered = _tipCountActiveSymptomGroups(sim) >= tip.triggerValue;
            break;
        case 'physiologyOn':
            triggered = !!(typeof showISFLine !== 'undefined' && showISFLine);
            break;
    }

    // Time-window filter (optional).
    if (triggered && tip.timeWindow) {
        const hour = sim.timeInMinutes / 60;
        if (hour < tip.timeWindow.startHour || hour >= tip.timeWindow.endHour) triggered = false;
    }

    // Condition check (optional). Accepts a single condition string or an array
    // of conditions (all must hold).
    if (triggered && tip.condition) {
        const conditions = Array.isArray(tip.condition) ? tip.condition : [tip.condition];
        triggered = conditions.every(c => _tipEvaluateCondition(c, sim, ctx));
    }

    if (!triggered) _resetEventChanceIfInactive(tip);

    // A visible acute priority-1 tip gets solo placement; a lower tip that would
    // otherwise fire is put on cooldown so it doesn't pop up right after it.
    if (triggered && prio > 1 && _isActivePriorityOneTipVisible(sim)) {
        ctx.cooldownStore[tip.id] = sim.totalSimMinutes;
        return false;
    }

    // Global rate-limit: keep at least TIP_MIN_SPACING_SIM_MIN between tips.
    // Acute tips (priority 1-2) use shorter spacing so they still arrive quickly.
    const minSpacing = prio <= 2 ? 30 : TIP_MIN_SPACING_SIM_MIN;
    if ((sim.totalSimMinutes - tipSessionState._lastAnyTipShownAt) < minSpacing) return false;

    // Per-day cap: block general tips (priority >= 3) once the daily budget is
    // hit. Acute tips (priority 1-2) are exempt.
    const firstEducationPending = tip.firstOccurrenceGuaranteed
        && !tipSessionState._educationShown[tip.id];
    if (prio >= 3
        && tipSessionState._tipsShownToday >= MAX_GENERAL_TIPS_PER_SIM_DAY
        && !firstEducationPending) return false;

    // Hold grafen læsbar ved alle spilhastigheder. Reglen ligger efter de faste
    // betingelser, så kun en kandidat, der ellers kunne vises, bruger den ene
    // trængselslodtrækning for den aktuelle synlige tiptilstand.
    if (triggered && !_tipPassesCrowdingGate(tip, sim)) return false;

    // Chance-roll (optional, default 100%). Last gate, so we don't "spend" the
    // roll on tips that couldn't show anyway (cooldown, condition, etc.).
    if (triggered && !_rollTipChance(tip)) triggered = false;

    return triggered;
}

function _tipEvaluateCondition(condition, sim, ctx) {
    switch (condition) {
        case 'noBasalGiven':
            return !ctx.hasAction('basalInsulin');
        case 'hasGivenBasal':
            // Only true once the player has given basal at least once. Used e.g.
            // by the split-dose tip that only makes sense after the first basal.
            return ctx.hasAction('basalInsulin');
        case 'noFastInsulinGiven':
            // Player hasn't used fast insulin yet. Used in level 1 to suggest a
            // correction when BG is too high.
            return !ctx.hasAction('fastInsulin');
        case 'noFoodGiven':
            return !ctx.hasAction('food');
        case 'lastKetoneTestHigh':
            // Last ketone reading >= 0.6 mmol/L (above normal). Used by the tip
            // that explains a high reading means insulin shortage.
            return sim.ketoneTestLastValue !== null && sim.ketoneTestLastValue >= 0.6;
        case 'noRecentBolus': {
            // Suppress the tip in two situations:
            //  1) A bolus sits within +-60 min of the most recent meal (covers
            //     pre-meal -60..0 and post-meal 0..+60, e.g. the late split bolus
            //     for fatty meals / the pizza effect).
            //  2) BG is low (< 5 mmol/L) — likely a hypo correction with sugar,
            //     where no bolus should be taken.
            // With no recent meal: a plain 30-min look-back.
            if (!sim || !sim.logHistory) return true;
            if (sim.cgmBG !== undefined && sim.cgmBG < 5.0) return false;
            const recentMeal = sim.logHistory.findLast
                ? sim.logHistory.findLast(e => e.type === 'food' && e.time > sim.totalSimMinutes - 30)
                : [...sim.logHistory].reverse().find(e => e.type === 'food' && e.time > sim.totalSimMinutes - 30);
            if (!recentMeal) {
                return !sim.logHistory.find(e =>
                    e.type === 'insulin-fast' && e.time > sim.totalSimMinutes - 30);
            }
            const winStart = recentMeal.time - 60;
            const winEnd = recentMeal.time + 60;
            return !sim.logHistory.find(
                e => e.type === 'insulin-fast' && e.time >= winStart && e.time <= winEnd);
        }
        case 'bgStable':
            // BG within ~normal zone (5-9 mmol/L) — used by the idle tip.
            return sim.cgmBG >= 5.0 && sim.cgmBG <= 9.0;
        case 'hasAnyAction':
            // At least one player action is logged (basal, bolus, food, exercise
            // or kit). Used by gameplay hints (e.g. the pause tip) that only make
            // sense once the player has started interacting.
            return !!(sim && sim.logHistory && sim.logHistory.length > 0);
        case 'physiologyOff':
            return !(typeof showISFLine !== 'undefined' && showISFLine);
        case 'physiologyOn':
            return !!(typeof showISFLine !== 'undefined' && showISFLine);
        default:
            return true;
    }
}

function _tipAcidosisRatio(sim) {
    const threshold = sim && sim.ACIDOSIS_THRESHOLD ? sim.ACIDOSIS_THRESHOLD : 600;
    if (!threshold) return 0;
    return (sim.acidosisLoad || 0) / threshold;
}

function _tipVfxActive(sim, ctx) {
    if (!sim) return false;
    const core = _activeCampaignCore(ctx);
    const settings = core && core.host && typeof core.host.getSettings === 'function'
        ? core.host.getSettings()
        : null;
    if (settings && settings.vfxEnabled === false) return false;
    return typeof resolveSymptomVfxState === 'function'
        && resolveSymptomVfxState(sim).active;
}

function _tipCountActiveSymptomGroups(sim) {
    return typeof countActiveSymptomGroups === 'function'
        ? countActiveSymptomGroups(sim)
        : 0;
}

function _tipCommitShown(tip, sim, ctx) {
    if ((tip.priority !== undefined ? tip.priority : 5) === 1) {
        _fadeLowerPriorityTipsForUrgentTip(sim);
    }

    ctx.cooldownStore[tip.id] = sim.totalSimMinutes;
    if (tip.firstOccurrenceGuaranteed) {
        tipSessionState._educationShown[tip.id] = true;
        // Første sikre visning tæller som denne episodes ene chance. En ny
        // lodtrækning bliver først mulig, når tilstanden har været inaktiv.
        tipSessionState._eventChanceConsumed[tip.id] = true;
    }
    tipSessionState._tipsShownCounter++;
    tipSessionState._tipsShownToday++;
    tipSessionState._lastAnyTipShownAt = sim.totalSimMinutes;
    tipSessionState._lastAnyTipShownRealMs = _tipRealNowMs();

    if (sim && sim.graphMessages && typeof t === 'function') {
        // Basaltippet fortæller om noget spilleren kan kontrollere: tiden siden
        // den seneste dosis. Den interne basalrate nævnes ikke i spillerteksten.
        const runtimeVars = {};
        // Tips må bruge den valgte fiktive karakter som grammatisk subjekt. Det
        // gør korte tekster konkrete uden at gentage en disclaimer. Fallbacken
        // holder den delte tipmotor brugbar i isolerede tests uden archetypes.js.
        const activeCharacter = typeof getActiveCharacter === 'function'
            ? getActiveCharacter()
            : { name: 'Erik' };
        runtimeVars.characterName = activeCharacter.name;
        if (tip.triggerType === 'basalLow') {
            const basalDoses = sim.activeLongInsulin || [];
            const latestInjection = basalDoses.reduce((latest, dose) =>
                Number.isFinite(dose.injectionTime) ? Math.max(latest, dose.injectionTime) : latest,
            -Infinity);
            runtimeVars.hoursSinceBasal = Number.isFinite(latestInjection)
                ? Math.max(0, Math.round((sim.totalSimMinutes - latestInjection) / 60))
                : '?';
        }
        sim.graphMessages.push({
            id: `tip_${tip.id}`,
            text: t(tip.textKey, Object.assign(bgVars(), runtimeVars, tip.textVars || {})),
            expireTime: sim.totalSimMinutes + 90,  // show for 1.5 sim-hours
            isGameTip: true,
            isEventTip: tip.eventStyle === true,
            priority: tip.priority !== undefined ? tip.priority : 5,
            guideSection: guideSectionForTextKeySafe(tip.textKey),
            tipScope: ctx.scope,
            createdAt: sim.totalSimMinutes,
        });
    }
}
