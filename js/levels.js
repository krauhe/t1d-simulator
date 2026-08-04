// =============================================================================
// LEVELS.JS — Level definitions for the campaign mode
// =============================================================================
//
// This file defines all campaign levels in a human-readable format.
// Each level is a JS object with configuration for:
//   - Which actions the player has access to
//   - Automatic events (e.g. auto-food)
//   - Physics overrides (simplified simulation)
//   - Objectives that must be met
//   - Timeline markers on the graph
//   - Tutorial tips (first time only) and gameplay tips (always relevant)
//
// The goal is to introduce game mechanics gradually (RTS-inspired).
// The first levels follow this learning progression:
//   Level 1: "Basal insulin"        — basal only, learn the UI and daily rhythm
//   Level 2: "The dawn effect"      — fast insulin introduced for dawn correction
//   Level 3: "Fast carbohydrates"   — ICR introduced, dosing snacks/drinks
// Later levels expand to low-carb, meals, exercise, illness, etc.
// Actual titles and content are in the CAMPAIGN_LEVELS array below.
//
// The file is designed so levels can easily be added, changed, and reordered
// based on player feedback. Change the order in the CAMPAIGN_LEVELS array
// to change the progression.
//
// Dependencies: none — this is a pure data file
// Exports (global): CAMPAIGN_LEVELS, GLOBAL_TIPS
// =============================================================================


// =============================================================================
// CAMPAIGN_LEVELS — All campaign levels in order
// =============================================================================
//
// Each object describes one campaign level. Fields:
//
//   id:                  Unique identifier (used in localStorage)
//   number:              Level number (shown in UI)
//   titleKey:            i18n key for the level title
//   descriptionKey:      i18n key for the intro description
//   startTimeMinutes:    Simulation start time (0-1440, e.g. 420 = 07:00)
//   durationMinutes:     Level duration (typically 1440 = 24 hours)
//   startBG:             Starting blood glucose in mmol/L
//
//   physics:             Physics overrides that simplify the simulation
//     weightTrackingEnabled: false → no game over from calorie deficit
//     dawnEffectEnabled:     false → no circadian cortisol (flat morning)
//     basalPreInjected:      true  → basal already given at start
//     basalPreInjectedAgeHours:      age of pre-injected basal at start
//     basalPreInjectedDurationHours: fixed duration for pre-injected basal
//     (maxSpeed removed — player controls speed themselves)
//
//   enabledActions:      Which dock-panel actions are available
//     food, fastInsulin, basalInsulin, exercise, kit: true/false
//
//   enabledFoodRows:     (Optional) Which rows in the food panel are active.
//     Array of row IDs: 'lowCarb', 'meals', 'adjustments'.
//     If not set → all rows are active (default for most levels).
//     If set → only the listed rows are clickable; the rest are dimmed.
//
//   scheduledEvents:     Automatic events that occur at specific times
//     type: 'autoFood' → game.addFood() with given macros
//     type: 'acuteStress' / 'chronicStress' → stress/illness events
//     timeMinutes: minutes since level start (0-4320 for 3 days)
//
//   markers:             Visual markers on the graph (dashed line + icon)
//     type: 'action' (something the player must do) or 'info' (observation)
//
//   objectives:          Goals that must be met to complete the level
//     type: 'actionRequired' → player must perform an action
//     type: 'actionCount'    → player must perform N actions
//     type: 'survive'        → player must survive the entire level
//
//   stars:               Star rating based on TIR% (Time In Range)
//     Stars grant bonus points (as in Box Challenge)
//
//   tutorialTips:        Tips shown ONLY the first time (permanently "seen")
//     Explain UI elements: "Press here", "Speed up with ⏩"
//     Max 2-3 per level — never popup spam!
//
//   tips:                Gameplay tips shown with cooldown (60 sim-min)
//     Explain physiology or give contextual advice
// =============================================================================

const CAMPAIGN_LEVELS = [

    // =========================================================================
    // LEVEL 1 — BASAL INSULIN
    // =========================================================================
    // The player's very first experience. Focus: learn the UI.
    //   - Basal insulin + small doses of fast insulin (max 2 U)
    //   - No food, no dawn effect — pure focus on basal
    //   - Player learns to navigate the UI and administer basal insulin
    //   - Fast insulin as a correction tool for high BG
    //   - Goal: give basal insulin and optimize TIR via timing
    // =========================================================================
    {
        id: 'dag1_basal',
        number: 1,
        titleKey: 'campaign.level1.title',
        descriptionKey: 'campaign.level1.desc',

        // Simulation starts at midnight, runs for 3 days (72 hours)
        startTimeMinutes: 0,
        durationMinutes: 4320,
        startBG: 6.0,  // Clinically normal starting BG — consistent across all levels

        // Physics overrides: highly simplified
        physics: {
            weightTrackingEnabled: false,  // No calorie deficit game over
            dawnEffectEnabled: false,      // No circadian variation (flat day)
            basalPreInjected: true,        // Basal given at 08:00 yesterday — covers until late morning
            // Fixed level-1 profile without basal duration randomness.
            // Given 16 hours before start with total duration 30.5h means:
            // plateau ends around 08:30, and the tail phase ends around 14:30.
            basalPreInjectedAgeHours: 16,
            basalPreInjectedDurationHours: 30.5,

        },

        // Basal insulin + small fast-insulin doses + emergency supplies (sugar, kit)
        // Fast insulin is capped at max 2 U per injection to keep focus
        // on basal — but the player can still correct down if needed.
        enabledActions: {
            food: true,
            fastInsulin: true,
            basalInsulin: true,
            exercise: false,
            kit: true,
        },
        maxBolusDose: 2,  // Max 2 U fast insulin per injection

        // Restrict food panel rows: only "Fast carbohydrates" is
        // active on level 1 — meals and low-carb are irrelevant without
        // bolus insulin and distract from the basal-learning focus.
        enabledFoodRows: ['adjustments'],

        // No automatic events — pure basal level
        scheduledEvents: [],

        // No time markers — the player must find the basal rhythm themselves.
        // The tip 'tip_dag1_basal_low' (triggerType: basalLow) warns when
        // the basal level drops, so the player gets to experiment.
        markers: [],

        objectives: [
            {
                id: 'obj_level1_complete',
                type: 'survive',
                descriptionKey: 'campaign.level1.obj.complete',
            },
        ],

        // Star rating (TIR% = time in 4-10 mmol/L)
        // 70% = clinically recommended target (1 star)
        // 85% / 95% = ambitious targets
        // < 70%: 0 stars and "poor pass" illustration
        stars: {
            one:   { minTIR: 70 },
            two:   { minTIR: 85 },
            three: { minTIR: 95 },
        },

        // Tutorial tips: shown ONLY the first time, explain the UI
        // Max 2-3 per level! Unobtrusive, non-blocking.
        tutorialTips: [
            {
                id: 'tut_dag1_dock',
                triggerType: 'levelStart',
                textKey: 'tutorial.level1.openDock',
                // Points to the insulin dock item
                highlightElement: '.dock-item[data-panel="dock-panel-insulin"]',
            },
            {
                id: 'tut_dag1_speed',
                triggerType: 'afterAction',
                afterAction: 'basalInsulin',
                textKey: 'tutorial.level1.speedUp',
                highlightElement: '#speedStepper',
            },
        ],

        // Gameplay tips: shown with cooldown, physiologically relevant
        tips: [
            {
                id: 'tip_level1_more_info_icons',
                triggerType: 'time',
                triggerValue: 570,          // 09:30 — after the first basal checks
                textKey: 'campaign.level1.tip.moreInfoIcons',
                cooldownMinutes: 99999,
                priority: 5,
            },
            {
                id: 'tip_dag1_no_basal',
                triggerType: 'time',
                triggerValue: 480,          // 08:00 — 1 hour after game start
                condition: 'noBasalGiven',
                textKey: 'campaign.level1.tip.noBasal',
                priority: 2,                  // Core learning objective for this level
            },
            {
                id: 'tip_dag1_bg_rising',
                triggerType: 'bgAbove',
                triggerValue: 14.0,
                condition: 'noBasalGiven',
                textKey: 'campaign.level1.tip.bgRising',
                priority: 1,                  // Acute: critical hyperglycemia
            },
            {
                // Escalation 1/2: symptoms of elevated ketones.
                // Triggers at BG >= 16 where ketone production becomes clinically
                // concerning. Kept brief — players do not read a novel.
                id: 'tip_dag1_ketone_symptoms',
                triggerType: 'bgAbove',
                triggerValue: 16.0,
                condition: 'noBasalGiven',
                textKey: 'campaign.level1.tip.ketoneSymptoms',
                cooldownMinutes: 360,         // 6 sim-hours (matches kit ketone cooldown)
                priority: 1,                  // Acute: signs of early DKA
            },
            {
                // Escalation 2/2: prompt to measure ketones.
                // Same trigger, lower priority — fires second via
                // TIP_MIN_SPACING_SIM_MIN (90 min between tips).
                id: 'tip_dag1_ketone_measure',
                triggerType: 'bgAbove',
                triggerValue: 16.0,
                condition: 'noBasalGiven',
                textKey: 'campaign.level1.tip.ketoneMeasure',
                cooldownMinutes: 360,
                priority: 2,                  // Secondary — fires after the symptoms tip
            },
            {
                // Fires when the player actually measures ketones AND the result is
                // elevated (>= 0.6 mmol/L). Explains that a high reading = insulin deficiency.
                // 50% chance — not every elevated reading should trigger the tip,
                // but it should occur frequently enough to teach the player the connection.
                id: 'tip_dag1_ketone_high',
                triggerType: 'afterAction',
                afterAction: 'ketoneTest',
                condition: 'lastKetoneTestHigh',
                chance: 0.5,
                textKey: 'campaign.level1.tip.ketoneHigh',
                cooldownMinutes: 360,         // 6 sim-hours
                priority: 1,                  // Pedagogically important
            },
            {
                // Correction dose tip: shown when BG is above 11 and the player
                // has given basal but has not yet tried fast insulin.
                // Explains that fast insulin can be used to lower BG.
                id: 'tip_dag1_use_rapid',
                triggerType: 'bgAbove',
                triggerValue: 9.0,
                condition: ['hasGivenBasal', 'noFastInsulinGiven'],
                textKey: 'campaign.level1.tip.useRapid',
                cooldownMinutes: 99999,       // Show only once
                priority: 2,
            },
            {
                // Fires when active basal infusion rate falls below 70% of
                // the required steady-state level. Reused in level 2.
                id: 'tip_dag1_basal_low',
                triggerType: 'basalLow',
                triggerValue: 0.7,            // Threshold: rate < 0.7 x steady-state
                // Only shown while the player is awake (07-22). If the basal
                // trapezoid drops at 04:00 at night, the tip waits until the morning alarm.
                timeWindow: { startHour: 7, endHour: 22 },
                textKey: 'campaign.tip.basalLow',
                cooldownMinutes: 240,         // Long cooldown (4 sim-hours) — no spam
                priority: 1,                  // Acute: basal expiry threatens DKA
            },
            {
                // Experiment tip: appears on day 2 in the morning, if the player
                // has given basal at least once. Invites the player to try a split dose
                // instead of one full dose. Moved from day 1 (afterAction) to
                // day 2 (time) to reduce info overload at level start.
                id: 'tip_dag1_split_dose',
                triggerType: 'time',
                triggerValue: 1920,           // Day 2 at 08:00 (24h + 8h from start)
                condition: 'hasGivenBasal',
                textKey: 'campaign.level1.tip.splitDose',
                cooldownMinutes: 99999,       // Show only once per level play
                priority: 4,                  // Gameplay hint, not acute
            },
            {
                // Basal PK tip 1: onset/ramp-up. Shown mid-morning (09:00) so
                // the player understands why BG does not drop immediately after
                // the first basal dose — Lantus/Glargine reaches full effect
                // only after approximately 2-4 hours.
                id: 'tip_dag1_basal_onset',
                triggerType: 'time',
                triggerValue: 540,            // 09:00
                textKey: 'campaign.level1.tip.basalOnset',
                cooldownMinutes: 99999,       // Show only once per level play
                priority: 4,                  // Gameplay hint
            },
            {
                // Basal PK tip 2: duration. Shown late afternoon (17:00) when the
                // player may start wondering when the next dose is due —
                // 22-32 hours of coverage.
                id: 'tip_dag1_basal_duration',
                triggerType: 'time',
                triggerValue: 1020,           // 17:00
                textKey: 'campaign.level1.tip.basalDuration',
                cooldownMinutes: 99999,
                priority: 4,
            },
            {
                // Physiology view: sits in the pool and shows randomly from day 2.
                // Chance 0.2 — not something the player MUST see, but useful if
                // there is room in the day's tip quota.
                id: 'tip_dag1_physiology_mode',
                triggerType: 'time',
                triggerValue: 1440,           // Earliest day 2 (not day 1)
                chance: 0.2,
                textKey: 'campaign.level1.tip.physiologyMode',
                cooldownMinutes: 99999,
                priority: 4,
            },
        ],
    },

    // =========================================================================
    // LEVEL 2 — THE DAWN EFFECT
    // =========================================================================
    // The dawn effect is enabled — the player learns to correct the morning BG rise.
    // Fast insulin is now available in all doses (no maxBolusDose limit).
    // In level 1 fast insulin was capped at 2 U — here all doses are open.
    // Focus: understand that BG rises in the morning due to stress hormones, and that
    // fast insulin can be used to counteract the rise.
    // The ISF concept is introduced via tips.
    // =========================================================================
    {
        id: 'dag2_dawn',
        number: 2,
        titleKey: 'campaign.level2.title',
        descriptionKey: 'campaign.level2.desc',

        // Starts at midnight, runs 3 days — player experiences the dawn effect at 05:00-09:00
        startTimeMinutes: 0,
        durationMinutes: 4320,
        startBG: 6.0,

        physics: {
            weightTrackingEnabled: false,
            basalPreInjected: false,       // Player still administers basal themselves

        },

        // Basal + fast insulin + emergency supplies (sugar, kit) — no exercise
        enabledActions: {
            food: true,                    // Sugar for hypo correction
            fastInsulin: true,             // Fast insulin for dawn correction
            basalInsulin: true,
            exercise: false,
            kit: true,
        },

        // Only adjustments (sugar, fruit, snacks) — same as level 1.
        // Meals are not introduced until level 3 together with bolus timing.
        enabledFoodRows: ['adjustments'],

        // No automatic events
        scheduledEvents: [],

        // No time markers — the player manages the basal rhythm themselves.
        markers: [],

        objectives: [
            {
                id: 'obj_level2_complete',
                type: 'survive',
                descriptionKey: 'campaign.level2.obj.complete',
            },
        ],

        // Star rating: 70% = clinically recommended (1 star).
        // Dawn makes it slightly harder, but requirements are kept consistent across levels.
        stars: {
            one:   { minTIR: 70 },
            two:   { minTIR: 85 },
            three: { minTIR: 95 },
        },

        tutorialTips: [
            {
                id: 'tut_dag2_dawn',
                triggerType: 'levelStart',
                textKey: 'tutorial.level2.dawn',
            },
        ],

        tips: [
            {
                // Reminder: basal is still required (as in level 1)
                id: 'tip_dag2_remember_basal',
                triggerType: 'time',
                triggerValue: 480,            // 08:00 day 1
                condition: 'noBasalGiven',
                textKey: 'campaign.level2.tip.rememberBasal',
                cooldownMinutes: 99999,       // Show only once
                priority: 2,                  // Important reminder
            },
            {
                id: 'tip_dag2_dawn',
                triggerType: 'bgAbove',
                triggerValue: 8.0,
                timeWindow: { startHour: 5, endHour: 9 },
                textKey: 'campaign.level2.tip.dawn',
                cooldownMinutes: 99999,       // Show only once — player gets it
                priority: 2,
            },
            {
                // Same basal expiry tip as level 1 (waking hours only)
                id: 'tip_dag2_basal_low',
                triggerType: 'basalLow',
                triggerValue: 0.7,
                timeWindow: { startHour: 7, endHour: 22 },
                textKey: 'campaign.tip.basalLow',
                cooldownMinutes: 240,
                priority: 1,                  // Acute: basal expiry threatens DKA
            },
            {
                // ISF intro — day 1 late morning. Explains what ISF is.
                id: 'tip_dag2_isf_intro',
                triggerType: 'time',
                triggerValue: 600,            // 10:00 day 1
                textKey: 'campaign.level2.tip.isfIntro',
                cooldownMinutes: 99999,       // Show only once
                priority: 3,                  // Pedagogical, not acute
            },
            {
                // ISF varies — day 2 late morning. Explains natural variation.
                id: 'tip_dag2_isf_varies',
                triggerType: 'time',
                triggerValue: 2040,           // 10:00 day 2 (24h + 10h)
                textKey: 'campaign.level2.tip.isfVaries',
                cooldownMinutes: 99999,       // Show only once
                priority: 3,                  // Pedagogical
            },
            {
                // Sleep and stress — day 2 afternoon. Links sleep to insulin requirements.
                id: 'tip_dag2_isf_sleep',
                triggerType: 'time',
                triggerValue: 2400,           // 16:00 day 2 (24h + 16h)
                textKey: 'campaign.level2.tip.isfSleep',
                cooldownMinutes: 99999,
                priority: 4,
            },
            {
                // Dawn onset uncertainty: starts and peaks differently from day to day.
                // Shown day 2 late morning — after the player has experienced dawn once.
                id: 'tip_dag2_onset_uncertainty',
                triggerType: 'time',
                triggerValue: 1920,           // Day 2 at 08:00
                chance: 0.3,
                textKey: 'campaign.level2.tip.onsetUncertainty',
                cooldownMinutes: 99999,
                priority: 3,
            },
        ],
    },

    // =========================================================================
    // LEVEL 3 — FAST CARBOHYDRATES
    // =========================================================================
    // Learning objective: the ICR concept via sugar and juice (fast, predictable absorption).
    // Basal is pre-injected at start, but the basal panel remains open
    // because the player already learned basal in level 1.
    // Player controls pace and amount themselves — no markers, no formal objectives.
    // =========================================================================
    {
        id: 'level3_sugar',
        number: 3,
        titleKey: 'campaign.level3.title',
        descriptionKey: 'campaign.level3.desc',

        startTimeMinutes: 0,
        durationMinutes: 4320,
        startBG: 6.0,

        physics: {
            weightTrackingEnabled: false,
            basalPreInjected: true,
        },

        enabledActions: {
            food: true,
            fastInsulin: true,
            basalInsulin: true,
            exercise: false,
            kit: true,                     // Glucagon available
        },

        // Fast carbohydrates only (sugar, juice, fruit)
        enabledFoodRows: ['adjustments'],

        scheduledEvents: [],
        markers: [],
        objectives: [
            {
                id: 'obj_level3_complete',
                type: 'survive',
                descriptionKey: 'campaign.obj.complete3Days',
            },
            {
                id: 'obj_level3_food_3x',
                type: 'minActionsPerDay',
                actionType: 'food',
                minPerDay: 3,
                descriptionKey: 'campaign.level3.obj.food3xPerDay',
            },
        ],

        stars: {
            one:   { minTIR: 70 },
            two:   { minTIR: 85 },
            three: { minTIR: 95 },
        },

        tutorialTips: [
            {
                id: 'tut_level3_food',
                triggerType: 'levelStart',
                textKey: 'tutorial.level3.openFood',
                highlightElement: '.dock-item[data-panel="dock-panel-food"]',
            },
        ],

        tips: [
            {
                // Basal expiry tip (as in levels 1 and 2): fires when basal infusion
                // falls below 70% of steady-state. Basal is pre-injected at
                // start but runs out after ~16-24h — the player must replenish it.
                id: 'tip_level3_basal_low',
                triggerType: 'basalLow',
                triggerValue: 0.7,
                timeWindow: { startHour: 7, endHour: 22 },
                textKey: 'campaign.tip.basalLow',
                cooldownMinutes: 240,
                priority: 1,
            },
            {
                id: 'tip_level3_icr',
                triggerType: 'time',
                triggerValue: 600,             // 10:00 day 1
                textKey: 'campaign.level3.tip.icr',
                cooldownMinutes: 99999,
                priority: 3,
            },
            {
                id: 'tip_level3_bolus_timing',
                triggerType: 'afterAction',
                afterAction: 'food',
                condition: 'noRecentBolus',
                textKey: 'campaign.level3.tip.bolusTiming',
                cooldownMinutes: 99999,
                priority: 2,
            },
            {
                id: 'tip_level3_postmeal',
                triggerType: 'bgAbove',
                triggerValue: 11.0,
                textKey: 'campaign.level3.tip.postmeal',
                cooldownMinutes: 99999,
                priority: 3,
            },
            {
                // Glucagon tip: shown the first time BG drops below 3.5
                id: 'tip_level3_glucagon',
                triggerType: 'bgBelow',
                triggerValue: 3.5,
                textKey: 'campaign.level3.tip.glucagon',
                cooldownMinutes: 99999,
                priority: 1,
            },
            {
                id: 'tip_level3_liquid_faster',
                triggerType: 'time',
                triggerValue: 1920,            // Day 2 at 08:00 — not day 1
                chance: 0.3,
                textKey: 'campaign.level3.tip.liquidFaster',
                cooldownMinutes: 99999,
                priority: 4,
            },
            {
                id: 'tip_level3_sweet_fast',
                triggerType: 'time',
                triggerValue: 2520,            // Day 2 at 18:00
                chance: 0.3,
                textKey: 'campaign.level3.tip.sweetFast',
                cooldownMinutes: 99999,
                priority: 4,
            },
        ],
    },


    // =========================================================================
    // LEVEL 4 — BOLUS FOR MEALS
    // =========================================================================
    // Introduces normal meals and calorie balance. Learning objectives: bolus for
    // real dishes (carbohydrates + protein + fat), understand that fatty meals
    // cause a delayed BG rise (the pizza effect), and eat enough calories
    // (3 meals alone do not cover a full day — supplement with snacks).
    // Exercise and low carb are unavailable — focus is on meal bolus.
    // The basal panel remains open because basal is a continuous skill.
    // =========================================================================
    {
        id: 'level4_meals',
        number: 4,
        titleKey: 'campaign.level4_meals.title',
        descriptionKey: 'campaign.level4_meals.desc',

        startTimeMinutes: 0,
        durationMinutes: 4320,
        startBG: 6.0,

        physics: {
            weightTrackingEnabled: false,
            basalPreInjected: true,
        },

        enabledActions: {
            food: true,
            fastInsulin: true,
            basalInsulin: true,
            exercise: false,
            kit: true,
        },

        enabledFoodRows: ['meals', 'adjustments'],

        scheduledEvents: [],
        markers: [],

        objectives: [
            {
                id: 'obj_level4_meals_complete',
                type: 'survive',
                descriptionKey: 'campaign.level4_meals.obj.complete',
            },
            {
                id: 'obj_level4_meals_kcal',
                type: 'minCalories',
                descriptionKey: 'campaign.level4_meals.obj.eat',
            },
        ],

        stars: {
            one:   { minTIR: 70 },
            two:   { minTIR: 85 },
            three: { minTIR: 95 },
        },

        tutorialTips: [],

        tips: [
            {
                // 10:00 day 1 — bolus timing reminder (after breakfast/dawn window)
                id: 'tip_level4m_bolus_first',
                triggerType: 'time',
                triggerValue: 600,
                textKey: 'campaign.level4_meals.tip.bolusFirst',
                cooldownMinutes: 99999,
                priority: 2,
            },
            {
                // Ate without bolus — show immediately, once
                id: 'tip_level4m_no_bolus',
                triggerType: 'afterAction',
                afterAction: 'food',
                condition: 'noRecentBolus',
                textKey: 'campaign.level4_meals.tip.noBolus',
                cooldownMinutes: 99999,
                priority: 2,
            },
            {
                // Calorie target reminder (11:00 day 1)
                id: 'tip_level4m_kcal_intro',
                triggerType: 'time',
                triggerValue: 660,
                textKey: 'campaign.level4_meals.tip.kcalIntro',
                cooldownMinutes: 99999,
                priority: 2,
            },
            {
                // Contextual deficit warning (active when the burn icon is showing)
                id: 'tip_level4m_kcal_deficit',
                triggerType: 'kcalDeficit',
                triggerValue: -800,
                textKey: 'campaign.level4_meals.tip.kcalDeficit',
                cooldownMinutes: 720,           // At most once every 12 sim-hours
                priority: 2,
            },
        ],
    },


    // =========================================================================
    // LEVEL 5 — LOW CARB
    // =========================================================================
    // Introduces low-carb food. Learning objectives: low carb affects BG more
    // slowly and to a lesser degree, and the time scale fits better with the
    // subcutaneous insulin profile. Protein raises BG via glucagon (delayed).
    // Fat delays absorption.
    // =========================================================================
    {
        id: 'level4_lowcarb',
        number: 5,
        titleKey: 'campaign.level4.title',
        descriptionKey: 'campaign.level4.desc',

        startTimeMinutes: 0,
        durationMinutes: 4320,         // 3 days
        startBG: 6.0,

        physics: {
            weightTrackingEnabled: false,
            basalPreInjected: true,
        },

        enabledActions: {
            food: true,
            fastInsulin: true,
            basalInsulin: true,
            exercise: false,
            kit: true,
        },

        // Low carb + adjustments only — forces the player to explore low carb
        enabledFoodRows: ['lowCarb', 'adjustments'],

        scheduledEvents: [],
        markers: [],

        objectives: [
            {
                id: 'obj_level5_complete',
                type: 'survive',
                descriptionKey: 'campaign.level4.obj.complete',
            },
            {
                id: 'eat_enough',
                type: 'minCalories',
                descriptionKey: 'campaign.level4.obj.eat',
            },
        ],

        stars: {
            one:   { minTIR: 70 },
            two:   { minTIR: 85 },
            three: { minTIR: 95 },
        },

        tutorialTips: [
            {
                // Vises kun første gang bane 5 åbnes. Derefter huskes tippet i
                // kampagnefremskridtet, så forslaget ikke fylder ved genbesøg.
                id: 'tut_level5_physiology',
                triggerType: 'levelStart',
                textKey: 'campaign.level4.tip.physiologyMode',
            },
        ],

        tips: [
            {
                // Den forudgivne basalinsulin løber ud under banen. Påmind først,
                // når den faldende dækning også kan ses som stigende blodsukker.
                id: 'tip_level5_basal_low',
                triggerType: 'basalLow',
                triggerValue: 0.7,
                timeWindow: { startHour: 7, endHour: 22 },
                textKey: 'campaign.tip.basalLow',
                cooldownMinutes: 240,
                priority: 1,
            },
            {
                id: 'tip_level4_lowcarb_intro',
                triggerType: 'time',
                triggerValue: 600,             // 10:00 day 1 (after breakfast/dawn window)
                textKey: 'campaign.level4.tip.lowcarbIntro',
                cooldownMinutes: 99999,
                priority: 2,
            },
            {
                id: 'tip_level4_protein',
                triggerType: 'time',
                triggerValue: 900,             // 15:00 day 1
                textKey: 'campaign.level4.tip.protein',
                cooldownMinutes: 99999,
                priority: 3,
            },
            {
                id: 'tip_level4_fat_delay',
                triggerType: 'time',
                triggerValue: 2040,            // 10:00 day 2
                textKey: 'campaign.level4.tip.fatDelay',
                cooldownMinutes: 99999,
                priority: 3,
            },
            {
                id: 'tip_level4_timescale',
                triggerType: 'time',
                triggerValue: 2520,            // 18:00 day 2
                textKey: 'campaign.level4.tip.timescale',
                cooldownMinutes: 99999,
                priority: 4,
            },
            {
                id: 'tip_level4_low_bg_delay',
                triggerType: 'bgBelow',
                triggerValue: 4.5,
                textKey: 'campaign.level4.tip.lowBgDelay',
                cooldownMinutes: 720,
                priority: 2,
            },
            {
                id: 'tip_level4_split_dose',
                triggerType: 'time',
                triggerValue: 3300,            // Day 3 at 07:00
                textKey: 'campaign.level4.tip.splitDose',
                cooldownMinutes: 99999,
                priority: 4,
            },
            {
                // Calorie target introduced day 1 at 11:00
                id: 'tip_level4_kcal_intro',
                triggerType: 'time',
                triggerValue: 660,
                textKey: 'campaign.level4_meals.tip.kcalIntro',
                cooldownMinutes: 99999,
                priority: 2,
            },
            {
                // Contextual reminder on calorie deficit
                id: 'tip_level4_kcal_deficit',
                triggerType: 'kcalDeficit',
                triggerValue: -800,
                textKey: 'campaign.level4_meals.tip.kcalDeficit',
                cooldownMinutes: 720,
                priority: 2,
            },
        ],
    },


    // =========================================================================
    // LEVEL 6 — BUFFET
    // =========================================================================
    // Player has access to ALL food types — regular dishes, low carb, and snacks.
    // Basal insulin is also active (consolidates all skills from levels 1-5).
    // Learning objective: manage multiple food types simultaneously and find a gameplay strategy.
    // =========================================================================
    {
        id: 'level6_buffet',
        number: 6,
        titleKey: 'campaign.level6_buffet.title',
        descriptionKey: 'campaign.level6_buffet.desc',

        startTimeMinutes: 0,
        durationMinutes: 4320,         // 3 days
        startBG: 6.0,

        physics: {
            weightTrackingEnabled: false,
            basalPreInjected: true,    // First dose pre-injected; player gives subsequent doses
        },

        enabledActions: {
            food: true,
            fastInsulin: true,
            basalInsulin: true,
            exercise: false,
            kit: true,
        },

        enabledFoodRows: ['meals', 'lowCarb', 'adjustments'],

        scheduledEvents: [],
        markers: [],

        objectives: [
            {
                id: 'obj_level6_complete',
                type: 'survive',
                descriptionKey: 'campaign.level6_buffet.obj.complete',
            },
            {
                id: 'eat_enough',
                type: 'minCalories',
                descriptionKey: 'campaign.level6_buffet.obj.eat',
            },
        ],

        stars: {
            one:   { minTIR: 70 },
            two:   { minTIR: 85 },
            three: { minTIR: 95 },
        },

        tutorialTips: [],

        tips: [
            {
                // Contextual calorie deficit warning
                id: 'tip_level6_buffet_kcal_deficit',
                triggerType: 'kcalDeficit',
                triggerValue: -800,
                textKey: 'campaign.level4_meals.tip.kcalDeficit',
                cooldownMinutes: 720,
                priority: 2,
            },
        ],
    },


    // =========================================================================
    // LEVEL 7 — LOW-INTENSITY ACTIVITY
    // =========================================================================
    // Introduces activity as a strategic tool. Learning objective: everyday activity
    // (walking, vacuuming, errands, gardening) lowers BG via GLUT4-mediated
    // muscle uptake and can be used as an alternative or supplement to a correction bolus.
    // Intensity is locked to "Low" so the player is directed toward everyday
    // activity rather than hard exercise.
    // =========================================================================
    {
        id: 'level7_low_activity',
        number: 7,
        titleKey: 'campaign.level7.title',
        descriptionKey: 'campaign.level7.desc',

        startTimeMinutes: 0,
        durationMinutes: 4320,         // 3 days
        startBG: 6.0,

        physics: {
            weightTrackingEnabled: false,
            basalPreInjected: true,
        },

        enabledActions: {
            food: true,
            fastInsulin: true,
            basalInsulin: true,
            exercise: true,
            kit: true,
        },

        enabledFoodRows: ['meals', 'lowCarb', 'adjustments'],

        // Lock intensity to "Lav" — Medium and High are not available
        lockedIntensity: 'Lav',

        scheduledEvents: [],
        markers: [],

        objectives: [
            {
                id: 'obj_level7_complete',
                type: 'survive',
                descriptionKey: 'campaign.level7.obj.complete',
            },
            {
                id: 'eat_enough',
                type: 'minCalories',
                descriptionKey: 'campaign.level7.obj.eat',
            },
            {
                id: 'obj_level7_activity',
                type: 'minExerciseMinutesPerDay',
                minPerDay: 120,           // 2 hours of activity per day (everyday activity)
                descriptionKey: 'campaign.level7.obj.activity',
            },
        ],

        stars: {
            one:   { minTIR: 70 },
            two:   { minTIR: 85 },
            three: { minTIR: 95 },
        },

        tutorialTips: [],

        tips: [
            {
                // Intro at 10:00 day 1
                id: 'tip_level7_intro',
                triggerType: 'time',
                triggerValue: 600,
                textKey: 'campaign.level7.tip.intro',
                cooldownMinutes: 99999,
                priority: 2,
            },
            {
                // Strategic use when BG is mildly elevated (contextual)
                id: 'tip_level7_strategic',
                triggerType: 'bgAbove',
                triggerValue: 9.0,
                textKey: 'campaign.level7.tip.strategic',
                cooldownMinutes: 360,
                priority: 3,
            },
            {
                // Stop button explanation (14:00 day 1)
                id: 'tip_level7_stop_button',
                triggerType: 'time',
                triggerValue: 840,
                textKey: 'campaign.level7.tip.stopButton',
                cooldownMinutes: 99999,
                priority: 3,
            },
            {
                // Strength tip (day 2 at 11:00) — light strength training can acutely raise BG
                id: 'tip_level7_styrke',
                triggerType: 'time',
                triggerValue: 2100,
                textKey: 'campaign.level7.tip.styrke',
                cooldownMinutes: 99999,
                priority: 3,
            },
            {
                // Calorie target reminder at 11:00
                id: 'tip_level7_kcal',
                triggerType: 'time',
                triggerValue: 660,
                textKey: 'campaign.level4_meals.tip.kcalIntro',
                cooldownMinutes: 99999,
                priority: 2,
            },
            {
                // Contextual calorie deficit
                id: 'tip_level7_kcal_deficit',
                triggerType: 'kcalDeficit',
                triggerValue: -800,
                textKey: 'campaign.level4_meals.tip.kcalDeficit',
                cooldownMinutes: 720,
                priority: 2,
            },
        ],
    },


    // =========================================================================
    // LEVEL 8 — SPORT
    // =========================================================================
    // Introduces hard exercise as a planned activity. Learning objective: high-intensity
    // activity can lower BG rapidly during the activity itself, but can also shift
    // insulin requirements in the hours that follow. Intensity is locked to "High"
    // so the daily exercise objective effectively means hard exercise.
    // =========================================================================
    {
        id: 'level8_sport',
        number: 8,
        titleKey: 'campaign.level8.title',
        descriptionKey: 'campaign.level8.desc',

        startTimeMinutes: 0,
        durationMinutes: 4320,         // 3 days
        startBG: 6.0,

        physics: {
            weightTrackingEnabled: false,
            basalPreInjected: true,
        },

        enabledActions: {
            food: true,
            fastInsulin: true,
            basalInsulin: true,
            exercise: true,
            kit: true,
        },

        enabledFoodRows: ['meals', 'lowCarb', 'adjustments'],

        // Lock intensity to "Høj" — the objective therefore specifically means hard exercise.
        lockedIntensity: 'Høj',

        scheduledEvents: [],
        markers: [],

        objectives: [
            {
                id: 'obj_level8_complete',
                type: 'survive',
                descriptionKey: 'campaign.level8.obj.complete',
            },
            {
                id: 'obj_level8_kcal',
                type: 'minCalories',
                descriptionKey: 'campaign.level8.obj.eat',
            },
            {
                id: 'obj_level8_hard_exercise',
                type: 'minExerciseMinutesPerDay',
                minPerDay: 60,            // 1 hour of hard exercise per day
                descriptionKey: 'campaign.level8.obj.hardExercise',
            },
        ],

        stars: {
            one:   { minTIR: 70 },
            two:   { minTIR: 85 },
            three: { minTIR: 95 },
        },

        tutorialTips: [],

        tips: [
            {
                id: 'tip_level8_cardio_iob',
                triggerType: 'time',
                triggerValue: 540,
                textKey: 'campaign.level8.tip.cardioIob',
                cooldownMinutes: 99999,
                priority: 2,
            },
            {
                id: 'tip_level8_strength_later',
                triggerType: 'time',
                triggerValue: 1020,
                textKey: 'campaign.level8.tip.strengthLater',
                cooldownMinutes: 99999,
                priority: 2,
            },
            {
                id: 'tip_level8_kcal_intro',
                triggerType: 'time',
                triggerValue: 660,
                textKey: 'campaign.level4_meals.tip.kcalIntro',
                cooldownMinutes: 99999,
                priority: 2,
            },
            {
                id: 'tip_level8_kcal_deficit',
                triggerType: 'kcalDeficit',
                triggerValue: -800,
                textKey: 'campaign.level4_meals.tip.kcalDeficit',
                cooldownMinutes: 720,
                priority: 2,
            },
        ],
    },


    // =========================================================================
    // LEVEL 9 — ILLNESS AND STRESS
    // =========================================================================
    // Introduces unexpected physiological stressors without adding new actions.
    // Learning objective: a brief stressful situation can raise BG via stress
    // hormones, while illness can weaken insulin action for many hours.
    // =========================================================================
    {
        id: 'level9_illness_stress',
        number: 9,
        titleKey: 'campaign.level9.title',
        descriptionKey: 'campaign.level9.desc',

        startTimeMinutes: 0,
        durationMinutes: 4320,         // 3 days
        startBG: 6.0,

        physics: {
            weightTrackingEnabled: false,
            basalPreInjected: true,
        },

        enabledActions: {
            food: true,
            fastInsulin: true,
            basalInsulin: true,
            exercise: true,
            kit: true,
        },

        enabledFoodRows: ['meals', 'lowCarb', 'adjustments'],

        scheduledEvents: [
            {
                id: 'level9_important_test',
                type: 'acuteStress',
                timeMinutes: 10 * 60 + 30,   // Day 1 at 10:30
                amount: 0.30,
                lockInInsights: true,
                messageKey: 'campaign.level9.tip.stressEvent',
                priority: 2,
            },
            {
                id: 'level9_illness',
                type: 'chronicStress',
                timeMinutes: 1440 + 7 * 60,  // Day 2 at 07:00
                amount: 0.40,
                lockInInsights: true,
                messageKey: 'campaign.level9.tip.illnessEvent',
                priority: 2,
            },
        ],

        markers: [
            {
                type: 'interval',
                sourceEventId: 'level9_important_test',
                startMinutes: 10 * 60 + 30,
                endMinutes: 12 * 60,      // Day 1 10:30-12:00
                icon: 'assets/icons/app/event-note.png',
                labelKey: 'campaign.level9.marker.test',
                bandColor: 'rgba(245, 158, 11, 0.10)',
                lineColor: 'rgba(245, 158, 11, 0.45)',
                labelColor: 'rgba(251, 191, 36, 0.95)',
                labelFontSize: 13,
                labelWeight: '700',
                persistAfterPast: true,
                pastAlpha: 0.55,
            },
            {
                type: 'info',
                sourceEventId: 'level9_illness',
                timeMinutes: 1440 + 7 * 60,
                icon: 'assets/icons/app/event-illness.png',
                labelKey: 'campaign.level9.marker.illness',
                persistAfterPast: true,
                pastAlpha: 0.8,
            },
        ],

        objectives: [
            {
                id: 'obj_level9_complete',
                type: 'survive',
                descriptionKey: 'campaign.level9.obj.complete',
            },
            {
                id: 'obj_level9_kcal',
                type: 'minCalories',
                descriptionKey: 'campaign.level9.obj.eat',
            },
        ],

        stars: {
            one:   { minTIR: 70 },
            two:   { minTIR: 85 },
            three: { minTIR: 95 },
        },

        tutorialTips: [],

        tips: [
            {
                id: 'tip_level9_stress_general',
                triggerType: 'time',
                triggerValue: 9 * 60 + 45,
                textKey: 'campaign.level9.tip.stressGeneral',
                cooldownMinutes: 99999,
                priority: 3,
            },
            {
                id: 'tip_level9_illness_general',
                triggerType: 'time',
                triggerValue: 1440 + 8 * 60,
                textKey: 'campaign.level9.tip.illnessGeneral',
                cooldownMinutes: 99999,
                priority: 3,
            },
            {
                id: 'tip_level9_ketones',
                triggerType: 'bgAbove',
                triggerValue: 12.0,
                textKey: 'campaign.level9.tip.ketones',
                cooldownMinutes: 360,
                priority: 2,
                chance: 0.35,
            },
            {
                id: 'tip_level9_kcal_deficit',
                triggerType: 'kcalDeficit',
                triggerValue: -800,
                textKey: 'campaign.level4_meals.tip.kcalDeficit',
                cooldownMinutes: 720,
                priority: 2,
            },
        ],
    },


    // =========================================================================
    // LEVEL 10 — UNPREDICTABLE EVERYDAY LIFE
    // =========================================================================
    // Final level: all prior tools are available, but events are chosen
    // randomly at level start. The player cannot memorize a fixed replay path.
    // Requirements are intentionally simple; the difficulty lies in everyday
    // unpredictable physiological influences.
    // =========================================================================
    {
        id: 'level10_unpredictable_day',
        number: 10,
        titleKey: 'campaign.level10.title',
        descriptionKey: 'campaign.level10.desc',

        startTimeMinutes: 0,
        durationMinutes: 4320,         // 3 days
        startBG: 6.0,

        physics: {
            weightTrackingEnabled: false,
            basalPreInjected: true,
            // Sensorfejl hører kun til denne bane om uforudsigelighed.
            // Tidligere baner har stadig CGM-forsinkelse og målevariation.
            cgmSensorFaultsEnabled: true,
        },

        enabledActions: {
            food: true,
            fastInsulin: true,
            basalInsulin: true,
            exercise: true,
            kit: true,
        },

        enabledFoodRows: ['meals', 'lowCarb', 'adjustments'],

        scheduledEvents: [],
        markers: [],

        randomEventDirector: {
            minSpacingMinutes: 240,
            maxPerCategory: {
                stress: 3,
                illness: 1,
                sleep: 1,
                sensor: 2,
                food: 2,
                motion: 2,
            },
            requiredTemplates: ['sensor_knockoff'],
            dayPlans: [
                { day: 0, count: 2 },
                { day: 1, count: 3 },
                { day: 2, count: 2 },
            ],
            pool: [
                {
                    id: 'presentation_stress',
                    category: 'stress',
                    weight: 2.0,
                    allowedDays: [0, 1, 2],
                    windows: [[9 * 60, 11 * 60], [13 * 60, 15 * 60]],
                    eventStyle: true,
                    priority: 2,
                    event: {
                        type: 'acuteStress',
                        amount: 0.32,
                        messageKey: 'campaign.level10.event.presentation',
                        popupTitleKey: 'campaign.level10.popup.presentationTitle',
                        popupMessageKey: 'campaign.level10.popup.presentation',
                        messageDurationMinutes: 150,
                    },
                    markers: [{
                        type: 'interval',
                        icon: 'assets/icons/app/event-note.png',
                        labelKey: 'campaign.level10.marker.presentation',
                        durationMinutes: 90,
                        reveal: 'event',
                        bandColor: 'rgba(245, 158, 11, 0.10)',
                        lineColor: 'rgba(245, 158, 11, 0.45)',
                        labelColor: 'rgba(251, 191, 36, 0.95)',
                        labelFontSize: 13,
                        labelWeight: '700',
                        labelPosition: 'top',
                    }],
                },
                {
                    id: 'busy_conflict',
                    category: 'stress',
                    weight: 1.6,
                    allowedDays: [0, 1, 2],
                    windows: [[16 * 60, 19 * 60]],
                    eventStyle: true,
                    priority: 2,
                    event: {
                        type: 'acuteStress',
                        amount: 0.25,
                        messageKey: 'campaign.level10.event.conflict',
                        popupTitleKey: 'campaign.level10.popup.conflictTitle',
                        popupMessageKey: 'campaign.level10.popup.conflict',
                        messageDurationMinutes: 120,
                    },
                    markers: [{
                        type: 'interval',
                        icon: 'assets/icons/app/event-conversation.png',
                        labelKey: 'campaign.level10.marker.stress',
                        durationMinutes: 120,
                        reveal: 'event',
                        bandColor: 'rgba(245, 158, 11, 0.09)',
                        lineColor: 'rgba(245, 158, 11, 0.40)',
                        labelColor: 'rgba(251, 191, 36, 0.92)',
                        labelFontSize: 12,
                        labelWeight: '700',
                        labelPosition: 'top',
                    }],
                },
                {
                    id: 'poor_sleep',
                    category: 'sleep',
                    weight: 1.4,
                    oncePerLevel: true,
                    allowedDays: [1],
                    windows: [[1 * 60, 4 * 60], [23 * 60, 23 * 60 + 30]],
                    eventStyle: true,
                    priority: 2,
                    event: {
                        type: 'cgmCompressionAlarm',
                        dropMmol: 2.7,
                        durationMinutes: 50,
                        alarmThresholdMmol: 4.0,
                        soundType: 'cgmAlarm',
                        messageKey: 'campaign.level10.event.poorSleep',
                        popupTitleKey: 'campaign.level10.popup.sleepAlarmTitle',
                        popupMessageKey: 'campaign.level10.popup.sleepAlarm',
                        messageDurationMinutes: 180,
                    },
                    markers: [{
                        type: 'interval',
                        icon: 'assets/icons/app/event-cgm-alarm.png',
                        labelKey: 'campaign.level10.marker.cgmAlarm',
                        startOffsetMinutes: 8,
                        durationMinutes: 80,
                        reveal: 'after',
                        revealDelayMinutes: 8,
                        bandColor: 'rgba(129, 140, 248, 0.09)',
                        lineColor: 'rgba(129, 140, 248, 0.35)',
                        labelColor: 'rgba(199, 210, 254, 0.90)',
                        labelFontSize: 12,
                        labelWeight: '700',
                        labelPosition: 'top',
                    }],
                },
                {
                    id: 'mild_illness',
                    category: 'illness',
                    weight: 1.2,
                    oncePerLevel: true,
                    allowedDays: [1, 2],
                    windows: [[6 * 60 + 30, 9 * 60]],
                    eventStyle: true,
                    priority: 2,
                    event: {
                        type: 'chronicStress',
                        amount: 0.45,
                        illnessSymptoms: true,
                        symptomDurationMinutes: 900,
                        soundType: 'illnessSymptom',
                        messageKey: 'campaign.level10.event.illness',
                        popupTitleKey: 'campaign.level10.popup.illnessTitle',
                        popupMessageKey: 'campaign.level10.popup.illness',
                        messageDurationMinutes: 240,
                    },
                    markers: [{
                        type: 'interval',
                        icon: 'assets/icons/app/event-illness.png',
                        labelKey: 'campaign.level10.marker.illness',
                        durationMinutes: 720,
                        reveal: 'event',
                        bandColor: 'rgba(248, 113, 113, 0.08)',
                        lineColor: 'rgba(248, 113, 113, 0.35)',
                        labelColor: 'rgba(252, 165, 165, 0.90)',
                        labelFontSize: 12,
                        labelWeight: '700',
                        labelPosition: 'top',
                    }],
                },
                {
                    id: 'sensor_knockoff',
                    category: 'sensor',
                    weight: 2.5,
                    oncePerLevel: true,
                    allowedDays: [0, 1, 2],
                    windows: [[8 * 60, 11 * 60], [15 * 60, 19 * 60]],
                    eventStyle: true,
                    priority: 2,
                    event: {
                        type: 'cgmSensorLoss',
                        offlineMinutes: 120,
                        warmupMinutes: 60,
                        messageKey: 'campaign.level10.event.sensorLoss',
                        popupTitleKey: 'campaign.level10.popup.sensorLossTitle',
                        popupMessageKey: 'campaign.level10.popup.sensorLoss',
                        messageDurationMinutes: 180,
                    },
                    markers: [{
                        type: 'interval',
                        icon: 'assets/icons/app/event-sensor-loss.png',
                        labelKey: 'campaign.level10.marker.sensorLoss',
                        durationMinutes: 105,
                        reveal: 'event',
                        bandColor: 'rgba(59, 130, 246, 0.08)',
                        lineColor: 'rgba(96, 165, 250, 0.38)',
                        labelColor: 'rgba(147, 197, 253, 0.95)',
                        labelFontSize: 12,
                        labelWeight: '700',
                        labelPosition: 'top',
                    }],
                },
                {
                    id: 'sensor_self_test',
                    category: 'sensor',
                    weight: 1.4,
                    allowedDays: [0, 1, 2],
                    windows: [[10 * 60, 13 * 60], [18 * 60, 21 * 60]],
                    eventStyle: true,
                    priority: 2,
                    event: {
                        type: 'cgmSelfTest',
                        durationMinutes: 25,
                        messageKey: 'campaign.level10.event.sensorCheck',
                        popupTitleKey: 'campaign.level10.popup.sensorCheckTitle',
                        popupMessageKey: 'campaign.level10.popup.sensorCheck',
                        messageDurationMinutes: 120,
                    },
                    markers: [{
                        type: 'interval',
                        icon: 'assets/icons/app/event-sensor-check.png',
                        labelKey: 'campaign.level10.marker.sensorCheck',
                        durationMinutes: 25,
                        reveal: 'event',
                        bandColor: 'rgba(251, 191, 36, 0.08)',
                        lineColor: 'rgba(251, 191, 36, 0.38)',
                        labelColor: 'rgba(253, 224, 71, 0.92)',
                        labelFontSize: 12,
                        labelWeight: '700',
                        labelPosition: 'top',
                    }],
                },
                {
                    id: 'cake',
                    category: 'food',
                    weight: 1.5,
                    allowedDays: [0, 1, 2],
                    windows: [[14 * 60, 16 * 60], [19 * 60, 20 * 60]],
                    eventStyle: true,
                    priority: 2,
                    event: {
                        type: 'autoFood',
                        carbs: 45,
                        protein: 4,
                        fat: 18,
                        icon: 'assets/icons/food/cake.png',
                        weight: 110,
                        carbType: 'sukker_fast',
                        messageKey: 'campaign.level10.event.cake',
                        popupTitleKey: 'campaign.level10.popup.foodTitle',
                        popupMessageKey: 'campaign.level10.popup.cake',
                        popupFoodNameKey: 'food.cake',
                        messageDurationMinutes: 150,
                    },
                    markers: [{
                        type: 'info',
                        icon: 'assets/icons/food/cake.png',
                        labelKey: 'campaign.level10.marker.cake',
                        reveal: 'event',
                        labelPosition: 'top',
                        labelColor: 'rgba(253, 224, 71, 0.92)',
                        labelFontSize: 11,
                        labelWeight: '700',
                    }],
                },
                {
                    id: 'pizza',
                    category: 'food',
                    weight: 1.2,
                    allowedDays: [0, 1, 2],
                    windows: [[18 * 60, 20 * 60 + 30]],
                    eventStyle: true,
                    priority: 2,
                    event: {
                        type: 'autoFood',
                        carbs: 55,
                        protein: 20,
                        fat: 25,
                        icon: 'assets/icons/food/pizza.png',
                        weight: 150,
                        carbType: 'hvidt_mel',
                        messageKey: 'campaign.level10.event.pizza',
                        popupTitleKey: 'campaign.level10.popup.foodTitle',
                        popupMessageKey: 'campaign.level10.popup.pizza',
                        popupFoodNameKey: 'food.pizza',
                        messageDurationMinutes: 180,
                    },
                    markers: [{
                        type: 'info',
                        icon: 'assets/icons/food/pizza.png',
                        labelKey: 'campaign.level10.marker.pizza',
                        reveal: 'event',
                        labelPosition: 'top',
                        labelColor: 'rgba(253, 224, 71, 0.92)',
                        labelFontSize: 11,
                        labelWeight: '700',
                    }],
                },
                {
                    id: 'bus_run',
                    category: 'motion',
                    weight: 1.7,
                    allowedDays: [0, 1, 2],
                    windows: [[7 * 60 + 30, 9 * 60], [15 * 60, 17 * 60]],
                    eventStyle: true,
                    priority: 2,
                    event: {
                        type: 'autoMotion',
                        activityType: 'cardio',
                        intensity: 'Høj',
                        durationMinutes: 15,
                        icon: 'assets/icons/app/activity-shoe.png',
                        messageKey: 'campaign.level10.event.busRun',
                        popupTitleKey: 'campaign.level10.popup.busRunTitle',
                        popupMessageKey: 'campaign.level10.popup.busRun',
                        messageDurationMinutes: 120,
                    },
                    markers: [{
                        type: 'interval',
                        icon: 'assets/icons/app/activity-shoe.png',
                        labelKey: 'campaign.level10.marker.busRun',
                        durationMinutes: 15,
                        reveal: 'event',
                        bandColor: 'rgba(16, 185, 129, 0.09)',
                        lineColor: 'rgba(16, 185, 129, 0.35)',
                        labelColor: 'rgba(110, 231, 183, 0.92)',
                        labelPosition: 'top',
                    }],
                },
                {
                    id: 'heavy_lifting',
                    category: 'motion',
                    weight: 1.3,
                    allowedDays: [0, 1, 2],
                    windows: [[10 * 60, 12 * 60], [16 * 60, 18 * 60]],
                    eventStyle: true,
                    priority: 2,
                    event: {
                        type: 'autoMotion',
                        activityType: 'styrke',
                        intensity: 'Medium',
                        durationMinutes: 20,
                        icon: 'assets/icons/app/activity-strength.png',
                        messageKey: 'campaign.level10.event.lifting',
                        popupTitleKey: 'campaign.level10.popup.liftingTitle',
                        popupMessageKey: 'campaign.level10.popup.lifting',
                        messageDurationMinutes: 120,
                    },
                    markers: [{
                        type: 'interval',
                        icon: 'assets/icons/app/activity-strength.png',
                        labelKey: 'campaign.level10.marker.lifting',
                        durationMinutes: 20,
                        reveal: 'event',
                        bandColor: 'rgba(251, 146, 60, 0.09)',
                        lineColor: 'rgba(251, 146, 60, 0.35)',
                        labelColor: 'rgba(253, 186, 116, 0.92)',
                        labelPosition: 'top',
                    }],
                },
            ],
        },

        objectives: [
            {
                id: 'obj_level10_complete',
                type: 'survive',
                descriptionKey: 'campaign.obj.complete3Days',
            },
            {
                id: 'obj_level10_kcal',
                type: 'minCalories',
                descriptionKey: 'campaign.obj.positiveCalorieFood',
            },
        ],

        stars: {
            one:   { minTIR: 70 },
            two:   { minTIR: 85 },
            three: { minTIR: 95 },
        },

        tutorialTips: [],

        tips: [
            {
                id: 'tip_level10_event_mode',
                triggerType: 'time',
                triggerValue: 10,
                textKey: 'campaign.level10.tip.active',
                cooldownMinutes: 99999,
                priority: 2,
                eventStyle: true,
            },
            {
                id: 'tip_level10_cgm_compression',
                triggerType: 'time',
                triggerValue: 30,
                textKey: 'campaign.level10.tip.cgmCompression',
                cooldownMinutes: 99999,
                priority: 2,
                eventStyle: true,
            },
            {
                id: 'tip_level10_sensor_loss',
                triggerType: 'time',
                triggerValue: 360,
                textKey: 'campaign.level10.tip.sensorLoss',
                cooldownMinutes: 99999,
                priority: 2,
                eventStyle: true,
            },
            {
                id: 'tip_level10_sensor_check',
                triggerType: 'time',
                triggerValue: 600,
                textKey: 'campaign.level10.tip.sensorCheck',
                cooldownMinutes: 99999,
                priority: 2,
                eventStyle: true,
            },
            {
                id: 'tip_level10_false_alarms',
                triggerType: 'time',
                triggerValue: 900,
                textKey: 'campaign.level10.tip.falseAlarms',
                cooldownMinutes: 99999,
                priority: 2,
                eventStyle: true,
            },
            {
                id: 'tip_level10_ketones',
                triggerType: 'bgAbove',
                triggerValue: 12.0,
                textKey: 'campaign.level9.tip.ketones',
                cooldownMinutes: 360,
                priority: 2,
                chance: 0.35,
            },
            {
                id: 'tip_level10_kcal_deficit',
                triggerType: 'kcalDeficit',
                triggerValue: -800,
                textKey: 'campaign.level4_meals.tip.kcalDeficit',
                cooldownMinutes: 720,
                priority: 2,
            },
        ],
    },
];


// =============================================================================
// GLOBAL_TIPS — Gameplay tips active in ALL modes (sandbox, box, campaign)
// =============================================================================
//
// These tips explain physiology and give contextual observations.
// They are shown as unobtrusive text overlays on the graph with a neutral lightbulb icon.
// Cooldown: 60 sim-minutes between repetitions of the same tip.
// Can be disabled in settings.
//
// triggerType:
//   'bgAbove'        — BG above a threshold
//   'bgBelow'        — BG below a threshold
//   'afterAction'    — after a specific player action
//   'time'           — at a specific clock time (timeWindow filters further)
//   'noSpeedUsed'    — after triggerValue sim-min without using the speed buttons
//   'noPauseUsed'    — after triggerValue sim-min without pressing pause
//   'idle'           — triggerValue sim-min since last player action (requires speed=unused)
//   'musicRoll'      — one-time roll at level start, probability=triggerValue (0-1)
//   'tipsCount'      — after triggerValue tips have been shown in this browser session
//   'nightAwakening' — shortly after a night intervention woke the character (sleep loss)
//
// chance (optional, default 1.0):
//   Probability 0-1 that the tip is shown WHEN all other gates are satisfied.
//   ONE roll per browser session per tip-id. If the roll fails, the tip is not
//   retried until page reload. If the roll succeeds, the tip is shown (cooldown
//   governs any repetitions).
//
// sessionDecay (optional, default false):
//   If true, chance is scaled by (1 - 0.1 x tipsShownThisSession), floor 0.2.
//   Tips become progressively rarer the more tips the player has already seen
//   in this browser session.
//
// condition:
//   'noRecentBolus'  — no bolus in the last 30 sim-min
//   'noBasalGiven'   — no basal given yet
//   'noFoodGiven'    — no food eaten yet
//   'bgStable'       — BG within 5-9 mmol/L (stable zone)
//   'physiologyOff'  — physiology view is off
//   'physiologyOn'   — physiology view is on
//
// requiresPhysics:
//   String or array — name(s) of physics flags that MUST be active for the
//   tip to be relevant. If level.physics['disable<Name>'] === true that
//   physics is disabled and the tip is suppressed (prevents e.g. dawn tip
//   in levels where the dawn effect is disabled).
//   Example: requiresPhysics: 'dawnEffect' → checks level.physics.dawnEffectEnabled (=== false → skip)
//
// PRIORITY SCALE (lower number = higher priority, shown at the top of the tip stack):
//   1 = Acute/critical (overrides all — hypo, critical hyper, basal expiry)
//   2 = Core level learning (dawn, bolus timing, tutorial popups)
//   3 = Level/global contextual (info, rare)
//   4 = Global gameplay hint (speed, pause, idle)
//   5 = Global one-time info (music, "tips can be turned off")
// Default if not specified: 5
// =============================================================================

const GLOBAL_TIPS = [
    {
        id: 'global_more_info_icons',
        triggerType: 'time',
        triggerValue: 570,          // 09:30 — early, but not before first overview
        textKey: 'tips.moreInfoIcons',
        cooldownMinutes: 99999,
        priority: 5,
        skipInCampaign: true,       // Campaign level 1 has its own version.
    },
    {
        id: 'global_food_no_bolus',
        triggerType: 'afterAction',
        afterAction: 'food',
        condition: 'noRecentBolus',
        requiredAction: 'fastInsulin',  // Show only when bolus is available in the level
        skipInCampaign: true,           // Level 3 has its own bolus timing tip.
                                        // In levels 1-2 food is only hypo correction (sugar)
                                        // which does not require a bolus — false alarm.
        textKey: 'tips.foodNoBolus',
        cooldownMinutes: 120,   // Long cooldown — no spam
        priority: 3,            // Contextual info
    },
    {
        id: 'global_hypo_eat',
        triggerType: 'symptomGroupActive',
        symptomGroup: 'hypo',
        textKey: 'tips.symptomHypo',
        cooldownMinutes: 180,
        priority: 1,
        chance: 0.10,
        firstOccurrenceGuaranteed: true,
    },
    {
        id: 'global_hyper_signs',
        triggerType: 'symptomGroupActive',
        symptomGroup: 'hyper',
        textKey: 'tips.symptomHyper',
        cooldownMinutes: 240,
        priority: 2,
        chance: 0.10,
        firstOccurrenceGuaranteed: true,
    },
    {
        id: 'global_ketone_signs',
        triggerType: 'symptomGroupActive',
        symptomGroup: 'ketone',
        minimumGroupValue: 0.25,
        textKey: 'tips.symptomKetone',
        cooldownMinutes: 240,
        priority: 1,
        chance: 0.10,
        firstOccurrenceGuaranteed: true,
    },
    {
        id: 'global_vfx_slow_down',
        triggerType: 'symptomVfxActive',
        textKey: 'tips.symptomVfxSlowDown',
        cooldownMinutes: 240,
        priority: 3,
        chance: 0.10,
        firstOccurrenceGuaranteed: true,
    },
    {
        // Acting at night (food/insulin/activity) wakes the character and costs
        // sleep, which raises next-day insulin resistance. Self-gating: only fires
        // when the sleepDisruption physics is active (then motorens fælles
        // sleepAwakeIntervals udfyldes), så intet requiresPhysics-flag behøves.
        id: 'global_night_action',
        triggerType: 'nightAwakening',
        textKey: 'tips.nightAction',
        cooldownMinutes: 1440,
        priority: 2,
    },
    {
        id: 'global_energy_deficit',
        triggerType: 'symptomGroupActive',
        symptomGroup: 'energy',
        textKey: 'tips.symptomEnergyDeficit',
        cooldownMinutes: 360,
        priority: 3,
        chance: 0.10,
        firstOccurrenceGuaranteed: true,
    },
    {
        id: 'global_illness_symptoms',
        triggerType: 'symptomGroupActive',
        symptomGroup: 'illness',
        textKey: 'tips.symptomIllness',
        cooldownMinutes: 360,
        priority: 2,
        chance: 0.10,
        firstOccurrenceGuaranteed: true,
    },
    {
        id: 'global_multiple_symptoms',
        triggerType: 'multipleSymptomsActive',
        triggerValue: 2,
        textKey: 'tips.symptomMultiple',
        cooldownMinutes: 360,
        priority: 3,
        chance: 0.10,
        firstOccurrenceGuaranteed: true,
    },
    {
        id: 'global_dawn',
        triggerType: 'bgAbove',
        triggerValue: 8.0,
        timeWindow: { startHour: 5, endHour: 9 },
        requiresPhysics: 'dawnEffect',  // Skip in levels where dawnEffectEnabled: false
        skipInCampaign: true,           // Level 2 has its own dawn tip — avoid duplication
        textKey: 'tips.dawnEffect',
        cooldownMinutes: 1440,  // At most once per day
        priority: 3,            // Contextual info
    },

    // --- Global gameplay tips (UI hints, not physiology) ---
    {
        id: 'global_speed_control',
        triggerType: 'noSpeedUsed',
        triggerValue: 360,         // After 6 sim-hours without using ◀▶
                                   // (pushed later so tips do not cluster in the morning hours)
        textKey: 'tips.speedControl',
        cooldownMinutes: 9999,     // Once per session
        priority: 4,               // Gameplay hint
    },
    {
        id: 'global_pause_button',
        triggerType: 'noPauseUsed',
        triggerValue: 720,         // After 12 sim-hours without pause
                                   // (late — pause is not critical in the first few hours)
        condition: 'hasAnyAction', // Only after at least one player action — avoid
                                   // the tip popping up for a completely idle new player
        textKey: 'tips.pauseButton',
        cooldownMinutes: 9999,     // Once per session
        priority: 4,               // Gameplay hint
    },
    {
        id: 'global_physiology_suggestion',
        triggerType: 'time',
        triggerValue: 1260,        // Day 1 at 21:00, after the player has seen some dynamics
        condition: ['hasAnyAction', 'physiologyOff'],
        textKey: 'tips.physiologySuggestion',
        cooldownMinutes: 9999,     // Once per session
        priority: 5,
    },
    {
        id: 'global_physiology_eisf',
        triggerType: 'physiologyOn',
        textKey: 'tips.physiologyEisf',
        cooldownMinutes: 9999,     // Once per session
        priority: 5,
    },
    {
        id: 'global_keyboard_rapid_insulin',
        triggerType: 'time',
        triggerValue: 1980,        // Day 2 at 09:00, after the player has tried multiple panels
        condition: 'hasAnyAction',
        requiredAction: 'fastInsulin',
        pcOnly: true,
        textKey: 'tips.keyboardRapidInsulin',
        cooldownMinutes: 9999,     // Once per session
        priority: 4,               // Gameplay hint
    },
    {
        id: 'global_keyboard_dextrose',
        triggerType: 'time',
        triggerValue: 2160,        // Day 2 at 12:00, separate brief PC tip
        condition: 'hasAnyAction',
        requiredAction: 'kit',
        pcOnly: true,
        textKey: 'tips.keyboardDextrose',
        cooldownMinutes: 9999,     // Once per session
        priority: 4,               // Gameplay hint
    },
    {
        id: 'global_music_settings',
        triggerType: 'musicRoll',
        triggerValue: 0.10,        // 10% chance per level start
        textKey: 'tips.musicSettings',
        cooldownMinutes: 9999,     // Once per session (musicRoll enforces "one roll per level")
        priority: 5,               // One-time info
    },
    {
        id: 'global_tips_off',
        triggerType: 'tipsCount',
        triggerValue: 5,           // After 5+ tips shown this session
                                   // (was 3 — too early; the player has likely not seen
                                   // them all yet, making "turn off tips" feel premature)
        textKey: 'tips.tipsOff',
        cooldownMinutes: 9999,     // Once per session
        priority: 5,               // One-time info
    },
    {
        // Philosophical encouragement: T1D is not an answer key, but an exploration.
        // Shown late on day 2 (sim-min 2160 = 36h), when the player has had time
        // to try things and is ready to think more broadly about strategy.
        // Requires hasAnyAction so it does not pop up for a completely passive player.
        id: 'global_experiment',
        triggerType: 'time',
        triggerValue: 2160,        // 36 sim-hours from start (late day 2)
        condition: 'hasAnyAction',
        textKey: 'tips.experiment',
        cooldownMinutes: 9999,     // Once per session
        priority: 5,               // One-time encouragement
    },

    // --- Point system tips: explains scoring in 3 steps (bonus, zero, stars) ---
    {
        id: 'global_points_system',
        triggerType: 'time',
        triggerValue: 1080,        // Day 1 at 18:00 — late afternoon day 1
        condition: 'hasAnyAction',
        textKey: 'tips.pointsBonus',
        cooldownMinutes: 9999,     // Once per session
        priority: 5,
    },
    {
        id: 'global_points_zero',
        triggerType: 'time',
        triggerValue: 2400,        // Day 2 at 16:00 — after the player has seen the effect
        condition: 'hasAnyAction',
        textKey: 'tips.pointsZero',
        cooldownMinutes: 9999,
        priority: 5,
    },
    {
        id: 'global_points_hypo_zero',
        triggerType: 'bgBelow',
        triggerValue: 4.0,
        textKey: 'tips.pointsHypoZero',
        cooldownMinutes: 9999,
        priority: 2,
    },
    {
        id: 'global_stars_tir',
        triggerType: 'time',
        triggerValue: 3600,        // Day 3 at 12:00 — late in the run
        condition: 'hasAnyAction',
        textKey: 'tips.starsTir',
        cooldownMinutes: 9999,
        priority: 5,
    },

    // --- Ring tips: explains the event icon ring, each focusing on "the opposite" ---
    // Trigger: rapid insulin → tip about timing FOOD. Trigger: food → tip about timing INSULIN.
    // Both roll at 10% chance on the first eligible tick (sessionDecay active).
    {
        id: 'global_ring_after_insulin',
        triggerType: 'afterAction',
        afterAction: 'fastInsulin',
        requiredAction: 'food',         // Show only if food is available in the level
        textKey: 'tips.ringAfterInsulin',
        cooldownMinutes: 9999,
        priority: 4,
        chance: 0.10,
        sessionDecay: true,
    },
    {
        id: 'global_ring_after_food',
        triggerType: 'afterAction',
        afterAction: 'food',
        requiredAction: 'fastInsulin',  // Show only if bolus is available in the level
        textKey: 'tips.ringAfterFood',
        cooldownMinutes: 9999,
        priority: 4,
        chance: 0.10,
        sessionDecay: true,
    },

    // --- Educational tips: CGM, variability ---
    {
        id: 'global_cgm_delay',
        triggerType: 'time',
        triggerValue: 840,             // 14:00 day 1
        condition: 'hasAnyAction',
        textKey: 'tips.cgmDelay',
        cooldownMinutes: 9999,
        priority: 5,
    },
    {
        id: 'global_fingerprick',
        triggerType: 'time',
        triggerValue: 1800,            // 06:00 day 2
        condition: 'hasAnyAction',
        textKey: 'tips.fingerprick',
        cooldownMinutes: 9999,
        priority: 5,
    },
    {
        id: 'global_variability_rapid_insulin',
        triggerType: 'afterAction',
        afterAction: 'fastInsulin',
        requiredAction: 'fastInsulin',
        textKey: 'tips.variabilityRapidInsulin',
        cooldownMinutes: 9999,
        priority: 5,
    },
    {
        id: 'global_variability_basal',
        triggerType: 'time',
        triggerValue: 1920,            // Day 2 at 08:00
        condition: 'hasGivenBasal',
        requiredAction: 'basalInsulin',
        textKey: 'tips.variabilityBasal',
        cooldownMinutes: 9999,
        priority: 5,
    },
    {
        id: 'global_variability_dawn',
        triggerType: 'time',
        triggerValue: 2220,            // Day 2 at 13:00
        condition: 'hasAnyAction',
        requiresPhysics: 'dawnEffect',
        textKey: 'tips.variabilityDawn',
        cooldownMinutes: 9999,
        priority: 5,
    },
    {
        id: 'global_variability_cgm',
        triggerType: 'afterAction',
        afterAction: 'fingerprick',
        textKey: 'tips.variabilityCgm',
        cooldownMinutes: 9999,
        priority: 5,
    },
    {
        id: 'global_variability_food',
        triggerType: 'time',
        triggerValue: 3360,            // Day 3 at 08:00
        condition: 'hasAnyAction',
        requiredAction: 'food',
        textKey: 'tips.variabilityFood',
        cooldownMinutes: 9999,
        priority: 5,
    },
    {
        id: 'global_variability_motion',
        triggerType: 'afterAction',
        afterAction: 'exercise',
        requiredAction: 'exercise',
        textKey: 'tips.variabilityMotion',
        cooldownMinutes: 9999,
        priority: 5,
    },
];
