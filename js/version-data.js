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
    version: '0.9.125-beta',
    date: '2026-09-22',
    history: [
        {
            version: '0.9.125-beta',
            date: '2026-09-22',
            features: {
                da: ['Græsk yoghurt med nødder erstatter det enkelte æg i madpanelet. Havregryn står nu først i måltidsrækken.'],
                en: ['Greek yogurt with nuts replaces the single egg in the food panel. Oatmeal now comes first in the meals row.']
            },
            fixes: {
                da: ['Madkortenes mouseover-tekst gentager ikke længere kulhydrat, protein og fedt, som allerede vises på kortene.'],
                en: ['Food card tooltips no longer repeat carbohydrate, protein and fat amounts already shown on the cards.']
            }
        },
        {
            version: '0.9.122-beta',
            date: '2026-09-16',
            fixes: {
                da: ['Baggrundsviden om insulin er præciseret; spillets beregninger er uændrede.'],
                en: ['Background information about insulin has been clarified; game calculations are unchanged.']
            }
        },
        {
            month: '2026-09',
            summary: {
                da: 'Madpanelet fik caffè latte, nye ikoner og små snackportioner. Spilguiden blev kortere med Hvad Nu Hvis, bedre tiplinks og rulning. Statistikvalget blev bevaret, introens tekst og tale blev tilpasset, og oplæsningen fulgte det valgte sprog. Projektbeskrivelserne afgrænsede spiltilstandene til Campaign og Box Challenge.',
                en: 'The food panel gained caffè latte, new icons and small snack portions. The shorter guide added What If, better tip links and scrolling. Statistics preferences were preserved, intro text and narration were updated, and audio followed the selected language. Project descriptions defined Campaign and Box Challenge as the game modes.'
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
