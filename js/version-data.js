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
    version: '0.9.121-beta',
    date: '2026-09-15',
    history: [
        {
            version: '0.9.121-beta',
            date: '2026-09-15',
            features: {
                da: [
                    'Madpanelet har fået caffè latte, nye snackikoner og små portioner slik og chokolade på 6 g.',
                    'Spilguiden er kortere og mere konkret på dansk og engelsk, med et nyt afsnit om Hvad Nu Hvis.'
                ],
                en: [
                    'The food panel now includes caffè latte, new snack icons and small 6 g portions of candy and chocolate.',
                    'The game guide is shorter and more concrete in Danish and English, with a new What If section.'
                ]
            },
            fixes: {
                da: [
                    'Tiplinks åbner de relevante guideafsnit, og indholdsfortegnelsen kan rulles på mindre skærme.',
                    'Valget om at skjule statistik bliver gemt, mens kaloriebalancen fortsat vises, når banens mål kræver den.',
                    'Introen har opdateret tale om snacks og Settings på begge sprog. Oplæsningen følger nu kun det valgte sprog, og karakterteksten matcher lydmanuskriptet.'
                ],
                en: [
                    'Tip links open the relevant guide sections, and the table of contents scrolls on smaller screens.',
                    'The choice to hide statistics is remembered, while calorie balance stays visible when required by the level goal.',
                    'The intro has updated snack and Settings narration in both languages. Narration now follows only the selected language, and the character text matches the audio script.'
                ]
            }
        },
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
            month: '2026-08',
            summary: {
                da: 'Velkomstturen forklarede de faste karakterer, Insights samlede Hvad Nu Hvis og fysiologi, og styrketræningens påvirkning af insulinfølsomheden blev mere gradvis. Modelvalideringen fik delbare testlinks og en sammenligning af hurtige kulhydrater med aktuelle maddata og ikoner.',
                en: 'The welcome tour introduced the fixed characters, Insights brought What If and physiology together, and strength training gained a more gradual effect on insulin sensitivity. Model validation gained shareable test links and a fast-carbohydrate comparison using current food data and icons.'
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
