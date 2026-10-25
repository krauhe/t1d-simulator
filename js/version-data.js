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
    version: '0.9.129-beta',
    date: '2026-10-25',
    history: [
        {
            version: '0.9.129-beta',
            date: '2026-10-25',
            features: {
                da: ['CGM-alarmen gør opmærksom på lave sensorværdier. Om natten vækker den karakteren, og tiden vågen reducerer søvnen.', 'Lav selv har særskilte valg for druesukker og hvidt sukker. Blandede måltider kan give en tidligere blodsukkerstigning med den reviderede madmodel.', 'Spillet har nu én offentlig udgave. Gamle links til testversionen åbner samme spil.'],
                en: ['The CGM alarm signals low sensor readings. At night, it wakes the character, and time awake reduces their sleep.', 'Custom food has separate choices for dextrose and table sugar. Mixed meals can produce an earlier glucose rise with the revised food model.', 'The game now has one public version. Old preview links open the same game.']
            },
            fixes: {
                da: ['Tydelige dagsangivelser gør det lettere at orientere sig, når du ruller gennem Hvad Nu Hvis.', 'Portionsangivelser og kampagnens highscorekort er lettere at læse.'],
                en: ['Clear day labels make it easier to navigate while scrolling through What If.', 'Portion labels and Campaign highscore cards are easier to read.']
            }
        },
        {
            version: '0.9.128-beta',
            date: '2026-10-04',
            features: {
                da: ['Skift mellem den stabile udgave og en tydeligt markeret testversion.', 'Testversionen gemmer indstillinger, fremskridt og highscores separat.'],
                en: ['Switch between the stable release and a clearly labelled preview.', 'The preview keeps settings, progress and highscores separate.']
            }
        },
        {
            month: '2026-09',
            summary: {
                da: 'Madpanelet fik caffè latte, græsk yoghurt med nødder, nye ikoner og små snackportioner. Havregryn kom først i måltidsrækken, og madkort fik kortere mouseover-tekst. Spilguiden blev kortere med Hvad Nu Hvis, bedre tiplinks og rulning. Statistikvalget blev bevaret, introens tekst og tale blev tilpasset, og oplæsningen fulgte det valgte sprog. Projektbeskrivelserne afgrænsede spiltilstandene til Campaign og Box Challenge.',
                en: 'The food panel gained caffè latte, Greek yogurt with nuts, new icons and small snack portions. Oatmeal moved first in the meals row, and food card tooltips became shorter. The shorter guide added What If, better tip links and scrolling. Statistics preferences were preserved, intro text and narration were updated, and audio followed the selected language. Project descriptions defined Campaign and Box Challenge as the game modes.'
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
