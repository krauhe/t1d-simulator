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
    version: '0.9.119-beta',
    date: '2026-09-05',
    history: [
        {
            version: '0.9.119-beta',
            date: '2026-09-05',
            fixes: {
                da: [
                    'Projektbeskrivelserne afgrænser nu de offentlige spiltilstande til Campaign og Box Challenge.'
                ],
                en: [
                    'Project descriptions now define Campaign and Box Challenge as the public game modes.'
                ]
            }
        },
        {
            version: '0.9.118-beta',
            date: '2026-08-14',
            features: {
                da: [
                    'Modelvalideringssiden har nu delbare direkte links til hver test.',
                    'En ny test sammenligner hurtige kulhydrater ved 10 g kulhydrat og viser modelrelative respons- og hastighedsindeks.'
                ],
                en: [
                    'The model validation page now has shareable direct links to every test.',
                    'A new test compares fast carbohydrates at 10 g carbohydrate and shows model-relative response and speed indices.'
                ]
            },
            fixes: {
                da: [
                    'Madtestene bruger nu simulatorens aktuelle madikoner og maddata.'
                ],
                en: [
                    'Food tests now use the simulator\'s current food icons and food data.'
                ]
            }
        },
        {
            month: '2026-08',
            summary: {
                da: 'Velkomstturen forklarede de faste karakterer, Hvad Nu Hvis og Insights samlede alternative handlinger og fysiologi, og styrketræningens påvirkning af insulinfølsomheden blev mere gradvis.',
                en: 'The welcome tour introduced the fixed characters, What If and Insights brought alternative actions and physiology together, and the effect of strength training on insulin sensitivity became more gradual.'
            }
        },
        {
            month: '2026-07',
            summary: {
                da: 'Seks faste karakterer med dynamiske navne og stemninger, omskrevne baner og tips samt udbygget motion, søvn og modelkontrol.',
                en: 'Six fixed characters with dynamic names and moods, rewritten levels and tips, plus expanded exercise, sleep and model checks.'
            }
        },
        {
            month: '2026-06',
            summary: {
                da: 'Ny intro-tour med dansk lyd, en guidefigur med flere udtryk og varmere tekster om hypo og DKA.',
                en: 'A new intro tour with Danish audio, a guide character with more expressions and warmer text about hypoglycaemia and DKA.'
            }
        },
        {
            month: '2026-05',
            summary: {
                da: 'Bane 10 tilføjede uventede CGM-hændelser, og tips kunne vises efter en hændelse.',
                en: 'Level 10 added unexpected CGM events, and tips could appear after an event.'
            }
        },
        {
            month: '2026-04',
            summary: {
                da: 'Kampagneprogression, fysiologi-visning, mad-menu, nye madvarer, tips og bedre lyd.',
                en: 'Campaign progression, physiology display, food menu, new foods, tips and improved sound.'
            }
        },
        {
            month: '2026-03',
            summary: {
                da: 'Første udgaver med fysiologimodel, mad, insulin, aktivitet, søvn, stress, CGM og kampagne.',
                en: 'First versions with the physiology model, food, insulin, activity, sleep, stress, CGM and Campaign.'
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
