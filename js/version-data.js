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
    version: '0.9.117-beta',
    date: '2026-08-05',
    history: [
        {
            version: '0.9.117-beta',
            date: '2026-08-05',
            features: {
                da: [
                    'Velkomstturen forklarer nu de faste karakterer og viser tydeligt, hvem du hjælper.',
                    'Styrketræningens påvirkning af insulinfølsomheden begynder nu gradvist under aktiviteten.'
                ],
                en: [
                    'The welcome tour now explains the fixed characters and clearly shows who you are helping.',
                    'The effect of strength training on insulin sensitivity now begins gradually during the activity.'
                ]
            },
            fixes: {
                da: [
                    'Start af bane 1 fra velkomstskærmen åbner nu karaktervalget.',
                    'Karaktervælgeren holder den valgte figur inden for rammen og bruger en roligere fremhævning.',
                    'Hvad Nu Hvis kan nu ændre handlinger fra banens første minut og bruger spillets almindelige nu-markør.',
                    'Offentlige menuer og tekster viser nu kun de tilgængelige spilfunktioner.',
                    'Statistik og kaloriebalance er slået til ved start, men kan stadig slås fra i indstillingerne.'
                ],
                en: [
                    'Starting level 1 from the welcome screen now opens character selection.',
                    'The character picker keeps the selected figure inside its frame and uses a calmer highlight.',
                    'What If can now change actions from the first minute of a level and uses the game\'s standard current-time marker.',
                    'Public menus and text now show only the available game features.',
                    'Statistics and calorie balance are enabled at startup but can still be turned off in Settings.'
                ]
            }
        },
        {
            version: '0.9.115-beta',
            date: '2026-08-04',
            features: {
                da: [
                    'Hvad Nu Hvis lader dig sætte banen på pause og afprøve andre handlinger for den valgte karakter.',
                    'Insights samler fysiologi-visningen og Hvad Nu Hvis ét sted.',
                    'Banehændelser og Box Challenge-kasser følger med som låste dele af det spillede forløb.'
                ],
                en: [
                    'What If lets you pause a level and explore different actions for the selected character.',
                    'Insights brings the physiology view and What If together in one place.',
                    'Level events and Box Challenge obstacles carry over as locked parts of the played scenario.'
                ]
            },
            fixes: {
                da: [
                    'Aktiviteter i Hvad Nu Hvis viser ikke længere et fastlåst Stop-panel.',
                    'Grafmarkeringer, tips og karaktervalg er gjort tydeligere og mindre påtrængende.'
                ],
                en: [
                    'Activities in What If no longer show a stuck Stop panel.',
                    'Graph markers, tips and character selection are clearer and less intrusive.'
                ]
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
