// =============================================================================
// VERSION-DATA.JS - single source of truth for app version and release history
// =============================================================================
//
// This file is the project's SINGLE source of truth for:
//   - the current version number
//   - the current version date
//   - the version history shown in the help popup
//
// Why a JavaScript file and not version.json?
// The app must open directly as index.html without a local web server. Browsers
// often block fetch('version.json') from file://, while a plain <script> loads
// fine. Keeping the data here makes the tooltip and help work locally, on GitHub
// Pages, and via a dev server.
// =============================================================================

const APP_VERSION_INFO = {
    version: '0.9.114-beta',
    date: '2026-07-30',
    history: [
        {
            version: '0.9.0-beta',
            date: '2026-06-13',
            features: {
                da: [
                    'Ny intro-tour med dansk tale-lyd, der guider gennem grafen, profil, insulin, mad, aktivitet og T1D-kittet (22 trin).'
                ],
                en: [
                    'New intro tour with Danish voice-over guiding you through the graph, profile, insulin, food, activity and the T1D kit (22 steps).'
                ]
            }
        },
        {
            version: '0.8.65-beta',
            date: '2026-06-01',
            features: {
                da: [
                    'Ny visuel guidefigur med 10 følelsesvarianter (erstattede Dr. Byte).',
                    'Akut-advarsler i hypo og DKA omskrevet til en varmere, mindre dramatisk tone.'
                ],
                en: [
                    'New visual guide character with 10 emotional variants (replaced Dr. Byte).',
                    'Acute warnings in hypo and DKA rewritten in a warmer, less dramatic tone.'
                ]
            }
        },
        {
            version: '0.8.53-beta',
            date: '2026-05-24',
            features: {
                da: [
                    'Ny kampagnebane "Uforudsigelighed" med CGM-hændelser (sensor-tab, alarmer, falske udsving).',
                    'Delayed-tip system: tips kan vises et stykke tid efter en hændelse i stedet for med det samme.',
                    'Bane 1 har nu hurtiginsulin (max 2 E) til finjustering.'
                ],
                en: [
                    'New campaign level "Unpredictability" with CGM events (sensor loss, alarms, false readings).',
                    'Delayed-tip system: tips can appear some time after an event instead of immediately.',
                    'Level 1 now offers rapid insulin (max 2 U) for fine adjustments.'
                ]
            }
        },
        {
            version: '0.8.43-beta',
            date: '2026-04-30',
            summary: {
                da: 'Kampagneprogression, fysiologi-diagrammer, BG-SCIENCE review og lever-glykogen-kalibrering',
                en: 'Campaign progression, physiology diagrams, BG-SCIENCE review and hepatic glycogen calibration'
            }
        },
        {
            version: '0.8.30-beta',
            date: '2026-04-19',
            summary: {
                da: 'Tip-popups, lydstabilitet, mad-chips og guide-karakter forbedret',
                en: 'Tip popups, sound stability, food chips and guide character improved'
            }
        },
        {
            version: '0.8.15-beta',
            date: '2026-04-12',
            summary: {
                da: 'Mad-menu, carb-model, nye mad-items og level-skabeloner',
                en: 'Food menu, carb model, new food items and level templates'
            }
        },
        {
            version: '0.8.0-beta',
            date: '2026-04-01',
            summary: {
                da: 'Mad-chips, sprøjteikoner, settings-menu, profil-validering og fuld skærm',
                en: 'Food chips, syringe icons, settings menu, profile validation and fullscreen'
            }
        },
        {
            version: '0.7.0',
            date: '2026-04-01',
            summary: {
                da: 'Campaign-tilstand, VFX-symptomer, settings-menu',
                en: 'Campaign mode, VFX symptoms, settings menu'
            }
        },
        {
            version: '0.6.0',
            date: '2026-03-27',
            summary: {
                da: 'Campaign-system, eHbA1c, søvn-bobler redesign',
                en: 'Campaign system, eHbA1c, sleep bubbles redesign'
            }
        },
        {
            version: '0.5.0',
            date: '2026-03-24',
            summary: {
                da: 'Mad-gitter, insulin-aktionsbånd, baggrundsmusik',
                en: 'Food grid, insulin action band, background music'
            }
        },
        {
            version: '0.4.0',
            date: '2026-03-22',
            summary: {
                da: 'Fysiologi-panel, Box Challenge, søvnsystem, lydsystem',
                en: 'Physiology panel, Box Challenge, sleep system, sound system'
            }
        },
        {
            version: '0.3.0',
            date: '2026-03-18',
            summary: {
                da: 'FFA-insulinresistens, UX-overhaul, donationsmuligheder',
                en: 'FFA insulin resistance, UX overhaul, donation options'
            }
        },
        {
            version: '0.2.0',
            date: '2026-03-12',
            summary: {
                da: 'Fedt/protein-modeller, i18n, highscore, aktivitetssystem',
                en: 'Fat/protein models, i18n, highscore, activity system'
            }
        },
        {
            version: '0.1.0',
            date: '2026-03-04',
            summary: {
                da: 'Første release: Hovorka-model, profil, stress, HAAF, CGM, ketoner',
                en: 'First release: Hovorka model, profile, stress, HAAF, CGM, ketones'
            }
        }
    ]
};

/**
 * loadVersionInfo - returns the version data as a Promise.
 *
 * The UI code uses the Promise form, so the call sites are identical whether the
 * data previously came from fetch or now comes directly from this script file.
 */
function loadVersionInfo() {
    return Promise.resolve(APP_VERSION_INFO);
}
