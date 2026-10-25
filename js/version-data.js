// =============================================================================
// VERSION-DATA.JS - single source of truth for app version and release history
// =============================================================================
//
// This file is the project's SINGLE source of truth for:
//   - the current version number
//   - the current version date
//   - the version history shown in the help popup
// Redaktionel standard: AGENTS.md, "Spiller-vendt versionshistorik".
// Vælg nyheder efter hvad spilleren kan prøve, opleve eller forstå bedre.
//
// Why a JavaScript file and not version.json?
// The app must open directly as index.html without a local web server. Browsers
// often block fetch('version.json') from file://, while a plain <script> loads
// fine. Keeping the data here makes the tooltip and help work locally, on GitHub
// Pages, and via a dev server.
// =============================================================================

const APP_VERSION_INFO = {
    version: '0.9.130-beta',
    date: '2026-10-25',
    history: [
        {
            version: '0.9.130-beta',
            date: '2026-10-25',
            features: {
                da: ['CGM-alarmen vækker nu karakteren ved lave sensorværdier om natten. Tiden vågen tæller med i nattens søvn.', 'I Lav selv kan du vælge druesukker eller hvidt sukker og blande det med fedt og protein.', 'Blodsukkeret kan nu stige tidligere efter blandede måltider. Prøv dine måltider igen, og læg mærke til timingen af mad og insulin.'],
                en: ['The CGM alarm now wakes the character when sensor readings are low at night. Time awake counts towards lost sleep.', 'In Custom food, you can choose dextrose or table sugar and combine it with fat and protein.', 'Blood glucose can now rise earlier after mixed meals. Try your meals again and watch the timing of food and insulin.']
            },
            fixes: {
                da: ['Tydelige dagsangivelser gør det lettere at orientere sig, når du ruller gennem Hvad Nu Hvis.', 'Portionsangivelser og kampagnens highscorekort er lettere at læse.'],
                en: ['Clear day labels make it easier to navigate while scrolling through What If.', 'Portion labels and Campaign highscore cards are easier to read.']
            }
        },
        {
            version: '0.9.126-beta',
            date: '2026-09-22',
            features: {
                da: ['Græsk yoghurt med nødder er kommet i madpanelet som et nyt alternativ til måltider med mange kulhydrater.'],
                en: ['Greek yogurt with nuts has joined the food panel as a new alternative to meals with more carbohydrate.']
            }
        },
        {
            month: '2026-09',
            summary: {
                da: 'Caffè latte og mindre snackportioner gav flere valg i madpanelet. Spilguiden fik hjælp til Hvad Nu Hvis, og tips førte direkte til relevante forklaringer. Velkomstturens tale fulgte det valgte sprog.',
                en: 'Caffè latte and smaller snack portions added more food choices. The game guide added help for What If, and tips linked directly to relevant explanations. Welcome-tour narration followed the selected language.'
            }
        },
        {
            month: '2026-08',
            summary: {
                da: 'Insights samlede Hvad Nu Hvis og fysiologivisningen, så du kunne undersøge et spilforløb og prøve andre handlinger. Styrketræningens påvirkning af insulinfølsomheden blev mere gradvis.',
                en: 'Insights brought What If and the physiology view together, so you could explore a played session and try different actions. Strength training gained a more gradual effect on insulin sensitivity.'
            }
        },
        {
            month: '2026-07',
            summary: {
                da: 'Seks karakterer med forskellige forudsætninger og synlige stemninger. Kampagnebaner og tips blev tilpasset karaktererne.',
                en: 'Six characters with different starting profiles and visible moods. Campaign levels and tips were adapted to the characters.'
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
