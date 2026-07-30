// =============================================================================
// GUIDE-DATA.JS — In-game guide: middle layer between short tips and BG-SCIENCE
// =============================================================================
//
// This file contains the lay-person-friendly in-game guide, which can be opened
// as a full document or linked directly to a relevant section from tips, level
// intros and popups. It is intentionally less technical than docs/BG-SCIENCE.md
// and more practical than the short graph tips.
//
// Structure:
//   - GUIDE_SECTIONS: Section objects with matching ids in English and Danish.
//   - GUIDE_SECTION_ICONS: Icons from assets/icons/app for each guide section.
//   - GUIDE_LEVEL_LINKS: Which sections are suggested in level intros.
//   - guideSectionForTextKey(): Central mapping from tip/event text keys to
//     guide sections, so guideLink does not have to be duplicated in every tip.
//   - <button class="guide-term"> in body text is rendered as passive bold text
//     in ui.js, not as clickable links. This preserves emphasis without extra UI
//     noise.
//   - .guide-control-demo are static miniature examples of known UI controls.
//
// Language:
//   English text comes first and serves as the sync reference. Danish follows
//   the same id structure so deep links are not broken on language switch.
//
// Dependencies: appSettings (from sounds.js), t() not required.
// Exports (global): GUIDE_SECTIONS, GUIDE_SECTION_ICONS, GUIDE_LEVEL_LINKS,
//   guideSectionForTextKey(), guideTitleForSection(), guideIconForSection()
// =============================================================================

const GUIDE_SECTION_ICONS = {
    overview: 'assets/icons/app/event-note.png',
    modes: 'assets/icons/app/mode-campaign.png',
    controls: 'assets/icons/app/settings-statistics.png',
    basal: 'assets/icons/app/basal-syringe-clock.png',
    'rapid-iob': 'assets/icons/app/rapid-syringe.png',
    food: 'assets/icons/app/meal-plate.png',
    'low-bg-kit': 'assets/icons/app/t1d-kit-pouch.png',
    activity: 'assets/icons/app/activity-shoe.png',
    cgm: 'assets/icons/app/event-cgm-alarm.png',
    'stress-dawn-illness': 'assets/icons/app/event-illness.png',
    ketones: 'assets/icons/app/status-ketone.png',
    'body-signals': 'assets/icons/app/blood-drop.png',
    energy: 'assets/icons/app/status-calorie-balance.png',
    points: 'assets/icons/app/mode-campaign.png',
    levelend: 'assets/icons/app/event-surprise.png',
};

const GUIDE_SECTIONS = [
    {
        id: 'overview',
        title: {
            en: 'Quick start',
            da: 'Kom godt i gang',
        },
        body: {
            en: `
                <p>You help a fixed fictional character and explore how food, insulin, activity, sleep and stress affect the character's blood sugar. If you are new, start with the campaign: each level isolates one physiological topic.</p>
                <p>Use the simulator as a practice room. Change one thing at a time, then watch what happens to the character's curve.</p>
                <p><button class="guide-term" data-guide-term="bg">Blood sugar</button> is the number and dots on the graph. Read the latest value together with the trend arrow and what happened in the last few hours — food, insulin and activity.</p>
                <p>If something surprises you, slow down or pause before you add another action. Then check those last few hours again.</p>
            `,
            da: `
                <p>Du hjælper en fast, fiktiv karakter og udforsker, hvordan mad, insulin, aktivitet, søvn og stress påvirker karakterens blodsukker. Er du ny, så start med kampagnen: hver bane undersøger ét fysiologisk emne.</p>
                <p>Brug simulatoren som et øverum. Skift én ting ad gangen, og se derefter hvad der sker med karakterens kurve.</p>
                <p><button class="guide-term" data-guide-term="bg">Blodsukker</button> er tallet og punkterne på grafen. Læs den nyeste værdi sammen med trendpilen og det, der er sket de sidste par timer — mad, insulin og aktivitet.</p>
                <p>Hvis noget overrasker dig, så sæt tempoet ned eller sæt spillet på pause før du lægger en ny handling oveni. Tjek derefter de sidste par timer igen.</p>
            `,
        },
    },
    {
        id: 'modes',
        title: {
            en: 'Game modes',
            da: 'Spiltilstande',
        },
        body: {
            en: `
                <p>The public game has two modes. New players usually start with the campaign.</p>
                <p><strong>Campaign</strong> isolates one topic per level and is the best place to start.</p>
                <p><strong>Box Challenge</strong> is a daily run: keep the blood sugar curve out of the coloured boxes. You have three lives, and you earn points and stars.</p>
            `,
            da: `
                <p>Det offentlige spil har to tilstande. Nye spillere starter som regel med kampagnen.</p>
                <p><strong>Kampagne</strong> undersøger ét emne per bane. Det er det bedste sted at starte.</p>
                <p><strong>Box Challenge</strong> er en daglig udfordring: hold blodsukker-kurven fri af de farvede bokse. Du har tre liv og optjener points og stjerner.</p>
            `,
        },
    },
    {
        id: 'controls',
        title: {
            en: 'Controls, shortcuts and physiology view',
            da: 'Kontroller, genveje og fysiologi-visning',
        },
        body: {
            en: `
                <p>The speed controls change how fast simulated time runs. Slow down, or pause completely, when you need more time to choose your next action. Speed up when you are waiting for a delayed effect.</p>
                <div class="guide-control-demo" aria-hidden="true">
                    <span class="guide-mini-speed">
                        <span class="guide-mini-btn">◀</span>
                        <span class="guide-mini-current"><span>▶</span><span>4t/min</span></span>
                        <span class="guide-mini-btn">▶</span>
                    </span>
                </div>
                <p>Before giving insulin or food, or starting an activity, compare blood sugar, the trend arrow, active insulin (<button class="guide-term" data-guide-term="iob">IOB</button>) and recent food.</p>
                <p>Physiology view reveals hidden model layers: insulin action, carbohydrate absorption and current insulin sensitivity. Using it pauses scoring, because it shows information you would not normally have.</p>
                <p>On PC, keyboard shortcuts make repeated practice faster: arrow keys change speed, space pauses, number keys give rapid insulin, and the T1D kit has its own shortcuts.</p>
                <p>The full set on PC: <strong>Space</strong> starts, pauses and resumes; <strong>&larr;</strong> and <strong>&rarr;</strong> change speed; <strong>&frac12; and 1&ndash;9</strong> give that many units of rapid insulin; <strong>Z</strong> opens insulin, <strong>X</strong> food, <strong>C</strong> exercise and <strong>V</strong> the T1D kit; <strong>Escape</strong> closes an open panel.</p>
                <p>When a panel is open, the letter keys pick the buttons inside it. You can also press two keys quickly in a row, so <strong>X</strong> then <strong>Z</strong> opens food and eats glucose tablets in one move.</p>
            `,
            da: `
                <p>Hastighedskontrollen ændrer hvor hurtigt simulationstiden går. Sæt tempoet ned, eller sæt spillet helt på pause, når du har brug for mere tid til at vælge næste handling. Skru op når du venter på en forsinket effekt.</p>
                <div class="guide-control-demo" aria-hidden="true">
                    <span class="guide-mini-speed">
                        <span class="guide-mini-btn">◀</span>
                        <span class="guide-mini-current"><span>▶</span><span>4t/min</span></span>
                        <span class="guide-mini-btn">▶</span>
                    </span>
                </div>
                <p>Før du giver insulin eller mad eller vælger aktivitet, så sammenlign blodsukker, trendpil, aktiv insulin (<button class="guide-term" data-guide-term="iob">IOB</button>) og nylig mad.</p>
                <p>Fysiologi-visning afslører skjulte modellag: insulinvirkning, kulhydratoptag og aktuel insulinfølsomhed. Når du bruger den, tæller runden ikke med, fordi den viser information du normalt ikke kan se.</p>
                <p>På PC gør genveje gentagen øvning hurtigere: piletaster skifter hastighed, mellemrum pauser, taltaster giver hurtiginsulin, og T1D-kittet har sine egne genveje.</p>
                <p>Hele sættet på PC: <strong>Mellemrum</strong> starter, pauser og fortsætter; <strong>&larr;</strong> og <strong>&rarr;</strong> skifter hastighed; <strong>&frac12; og 1&ndash;9</strong> giver så mange enheder hurtiginsulin; <strong>Z</strong> åbner insulin, <strong>X</strong> mad, <strong>C</strong> motion og <strong>V</strong> T1D-kittet; <strong>Escape</strong> lukker et åbent panel.</p>
                <p>Når et panel er åbent, vælger bogstavtasterne knapperne i det. Du kan også lynhurtigt trykke to taster efter hinanden, så <strong>X</strong> og derefter <strong>Z</strong> åbner mad og spiser druesukker i én bevægelse.</p>
            `,
        },
    },
    {
        id: 'basal',
        title: {
            en: 'Basal insulin',
            da: 'Basalinsulin',
        },
        body: {
            en: `
                <p><button class="guide-term" data-guide-term="basal">Basal insulin</button> is the slow insulin working in the background all day and night. Its effect on the character's curve is easiest to judge during quiet periods: overnight, before breakfast, or several hours after food and rapid insulin.</p>
                <p>Do not expect basal to fix a high number right away. Its effect builds over hours and fades slowly.</p>
                <p>If blood sugar drifts up during those quiet periods, basal may be low or wearing off. If blood sugar drifts down without rapid insulin or activity, basal may be too strong.</p>
                <p>In basal levels, practice thinking in hours rather than minutes. Splitting a dose or changing timing should make the later curve steadier, not create an instant correction.</p>
            `,
            da: `
                <p><button class="guide-term" data-guide-term="basal">Basalinsulin</button> er den langsomme insulin, der virker i baggrunden hele døgnet. Effekten på karakterens kurve er lettest at vurdere i rolige perioder: om natten, før morgenmad eller flere timer efter mad og hurtiginsulin.</p>
                <p>Forvent ikke at basal retter et højt tal med det samme. Effekten bygges op over timer og aftager langsomt.</p>
                <p>Hvis blodsukker driver opad i de rolige perioder, kan basal være lav eller ved at slippe. Hvis blodsukker driver nedad uden hurtiginsulin eller aktivitet, kan basal være for stærk.</p>
                <p>I basalbaner er det nyttigt at tænke i timer frem for minutter. Opdeling eller ændret timing skal gøre den senere kurve mere stabil, ikke give en øjeblikkelig korrektion.</p>
            `,
        },
    },
    {
        id: 'rapid-iob',
        title: {
            en: 'Rapid insulin, IOB and timing',
            da: 'Hurtiginsulin, IOB og timing',
        },
        body: {
            en: `
                <p><button class="guide-term" data-guide-term="rapid">Rapid insulin</button> is used with meals and to lower high blood sugar in the game, but it is still slow compared with food. A dose given to the character can look too weak while blood sugar is still rising after the meal.</p>
                <p><button class="guide-term" data-guide-term="iob">Insulin on board (IOB)</button> is the character's rapid insulin that is still active. If the character receives another dose while IOB is high, the effects can overlap. That is <button class="guide-term" data-guide-term="stacking">stacking</button>.</p>
                <p><button class="guide-term" data-guide-term="isf">Insulin sensitivity factor (ISF)</button> describes how strongly rapid insulin affects the character's blood sugar in the model. It changes with sleep, stress, activity and time of day.</p>
                <p>When the character's blood sugar stays high for a long time, insulin can work a little less well for a while (<button class="guide-term" data-guide-term="glucotoxicity">glucotoxicity</button>). A correction during a long high spell may therefore look weaker. After blood sugar returns to the target range, insulin sensitivity gradually moves back toward normal.</p>
                <p>Timing matters. Give the character the same snack with insulin at different times and compare the peak. Fast carbohydrates often produce an earlier rise than slow or fatty meals.</p>
            `,
            da: `
                <p><button class="guide-term" data-guide-term="rapid">Hurtiginsulin</button> bruges til måltider og til at sænke højt blodsukker i spillet, men den er stadig langsom sammenlignet med mad. En dosis givet til karakteren kan se for svag ud, mens blodsukkeret stadig stiger efter måltidet.</p>
                <p><button class="guide-term" data-guide-term="iob">Aktiv insulin (IOB)</button> er karakterens hurtiginsulin, der stadig virker. Hvis karakteren får en ny dosis, mens IOB er høj, kan virkningerne overlappe. Det er <button class="guide-term" data-guide-term="stacking">stacking</button>.</p>
                <p><button class="guide-term" data-guide-term="isf">Insulinfølsomhedsfaktor (ISF)</button> beskriver hvor kraftigt hurtiginsulin påvirker karakterens blodsukker i modellen. Den ændrer sig med søvn, stress, aktivitet og tidspunkt på dagen.</p>
                <p>Når karakterens blodsukker ligger højt i lang tid, kan insulin virke lidt dårligere i en periode (<button class="guide-term" data-guide-term="glucotoxicity">glukotoksicitet</button>). En korrektion under en lang høj-periode kan derfor se svagere ud. Når blodsukker er tilbage i målområdet, bevæger insulinfølsomheden sig gradvist mod normalen igen.</p>
                <p>Timing betyder meget. Giv karakteren samme snack med insulin på forskellige tidspunkter, og sammenlign toppen. Hurtige kulhydrater giver ofte en tidligere stigning end langsomme eller fede måltider.</p>
            `,
        },
    },
    {
        id: 'food',
        title: {
            en: 'Food: fast, slow and delayed effects',
            da: 'Mad: hurtig, langsom og forsinket effekt',
        },
        body: {
            en: `
                <p>Food is not just grams of carbohydrate. The same grams of carbohydrate raise blood sugar differently depending on the food — juice, bread, pasta and pizza each have their own timing and peak.</p>
                <p>Juice, dextrose and sweet drinks usually raise blood sugar quickly. Solid food and mixed meals often raise it more slowly.</p>
                <p>Fat and protein can stretch the rise out (<button class="guide-term" data-guide-term="fatproteineffect">the fat-protein effect</button>). Pizza is the obvious example: first the carbohydrate, later the delayed effect from fat and protein.</p>
                <p>Fatty meals can also make insulin work a little less well for a few hours afterwards (<button class="guide-term" data-guide-term="ffaresistance">fat-induced insulin resistance</button>), not only delay the rise. So a big, fatty meal sometimes needs a second look later in the evening, not just at the table.</p>
                <p><button class="guide-term" data-guide-term="icr">Insulin-to-carb ratio (ICR)</button> is a fixed parameter in the character's model that links carbohydrate and rapid insulin. The game uses it to create different responses to meals; the type of food still affects when blood sugar starts to rise, how high it climbs and how long the rise lasts.</p>
                <p>A large amount of protein can raise blood sugar slowly over 2–4 hours because amino acids stimulate glucagon and hepatic glucose production. Compare two meals with the same amount of carbohydrate but different amounts of protein, then inspect the later part of the curve.</p>
            `,
            da: `
                <p>Mad er ikke kun gram kulhydrat. Den samme mængde kulhydrat hæver blodsukkeret forskelligt alt efter maden — juice, brød, pasta og pizza har hver deres timing og top.</p>
                <p>Juice, druesukker og søde drikke hæver som regel blodsukkeret hurtigt. Ikke-flydende mad og blandede måltider hæver det ofte langsommere.</p>
                <p>Fedt og protein kan trække stigningen ud (<button class="guide-term" data-guide-term="fatproteineffect">fedt-protein-effekten</button>). Pizza er det tydelige eksempel: først kulhydratet, senere den forsinkede effekt fra fedt og protein.</p>
                <p>Fede måltider kan også få insulin til at virke lidt dårligere i nogle timer bagefter (<button class="guide-term" data-guide-term="ffaresistance">fedt-induceret insulinresistens</button>) — ikke kun forsinke stigningen. Et stort, fedt måltid kan derfor kræve et ekstra kig senere på aftenen, ikke kun ved bordet.</p>
                <p><button class="guide-term" data-guide-term="icr">Insulin-til-kulhydrat-forhold (ICR)</button> er en fast parameter i karakterens model, som forbinder kulhydrat og hurtiginsulin. Spillet bruger den til at skabe forskellige reaktioner på måltider; madtypen påvirker stadig, hvornår blodsukkeret begynder at stige, hvor højt det når op, og hvor længe stigningen varer.</p>
                <p>En stor portion protein kan hæve blodsukkeret langsomt over 2–4 timer, fordi aminosyrer stimulerer glukagon og leverens glukoseproduktion. Sammenlign to måltider med samme mængde kulhydrat, men forskelligt proteinindhold, og se på den sene del af kurven.</p>
            `,
        },
    },
    {
        id: 'low-bg-kit',
        title: {
            en: 'Low blood sugar, dextrose and the T1D kit',
            da: 'Lavt blodsukker, druesukker og T1D-kit',
        },
        body: {
            en: `
                <p>When the character's blood sugar is low in the game, dextrose tablets, juice and sugary drinks raise it faster than bread, pasta or pizza.</p>
                <p>The T1D kit contains tools for checks and low blood sugar in the game: dextrose, fingerprick, ketone test and glucagon. Glucagon is a backup for the character at very low blood sugar or during a fast downward trend. It has a long cooldown, so it is not a normal food choice.</p>
                <p>Glucagon stimulates the liver to release stored glucose (<button class="guide-term" data-guide-term="glycogenolysis">glycogenolysis</button>). It works best when liver stores are available. Right after hard exercise or a long time without food, the effect can be smaller.</p>
            `,
            da: `
                <p>Når karakterens blodsukker er lavt i spillet, hæver druesukker, juice og søde drikke det hurtigere end brød, pasta eller pizza.</p>
                <p>T1D-kittet indeholder værktøjer til målinger og lavt blodsukker i spillet: druesukker, fingerprik, keton-stik og glukagon. Glukagon er backup til karakteren ved meget lavt blodsukker eller et hurtigt fald. Det har lang cooldown, så det er ikke et almindeligt madvalg.</p>
                <p>Glukagon stimulerer leveren til at frigive lagret glukose (<button class="guide-term" data-guide-term="glycogenolysis">glykogenolyse</button>). Det virker bedst når leverens lager er tilgængeligt. Lige efter hård motion eller lang tid uden mad kan effekten være mindre.</p>
            `,
        },
    },
    {
        id: 'activity',
        title: {
            en: 'Activity and exercise',
            da: 'Aktivitet og motion',
        },
        body: {
            en: `
                <p>Activity can lower blood sugar, especially when rapid insulin is still active. The same run lowers blood sugar much more when active insulin (<button class="guide-term" data-guide-term="iob">IOB</button>) is high than when there is almost none.</p>
                <p>Cardio such as running or cycling often lowers blood sugar during the activity. The effect can continue afterwards, so check the curve again later.</p>
                <p>After activity, insulin can stay more effective for several hours, and muscles can keep taking glucose from the blood. Together that can pull blood sugar down later, sometimes overnight after evening exercise. If the character trains in the evening, check the curve before bedtime.</p>
                <p>Strength training and high intensity can sometimes push blood sugar up briefly first (<button class="guide-term" data-guide-term="adrenaline">adrenaline response</button>). Do not judge the whole activity from the first small rise; look again 1-3 hours later.</p>
                <p>Try the same activity with different starting blood sugar, different IOB and different timing after food. Compare how early the drop starts and how long it continues.</p>
            `,
            da: `
                <p>Aktivitet kan sænke blodsukker, især når der stadig er hurtiginsulin aktiv. Den samme løbetur sænker blodsukkeret meget mere når den aktive insulin (<button class="guide-term" data-guide-term="iob">IOB</button>) er høj, end når der næsten ingen er.</p>
                <p>Cardio som løb eller cykling sænker ofte blodsukker under aktiviteten. Effekten kan fortsætte bagefter, så tjek kurven igen senere.</p>
                <p>Efter aktivitet kan insulin blive ved med at virke kraftigere i flere timer, og musklerne kan fortsætte med at tage glukose fra blodet. Tilsammen kan det trække blodsukker ned senere — nogle gange om natten efter aftenmotion. Hvis karakteren træner om aftenen, så tjek kurven før sengetid.</p>
                <p>Styrketræning og høj intensitet kan nogle gange skubbe blodsukker kortvarigt op først (<button class="guide-term" data-guide-term="adrenaline">adrenalin-respons</button>). Vurder ikke hele aktiviteten ud fra den første lille stigning; kig igen 1-3 timer senere.</p>
                <p>Prøv samme aktivitet med forskelligt start-blodsukker, forskellig IOB og forskellig timing efter mad. Sammenlign hvor tidligt faldet starter, og hvor længe det fortsætter.</p>
            `,
        },
    },
    {
        id: 'cgm',
        title: {
            en: 'CGM, fingerprick and sensor surprises',
            da: 'CGM, fingerprik og sensor-overraskelser',
        },
        body: {
            en: `
                <p><button class="guide-term" data-guide-term="cgm">CGM</button> estimates the character's glucose under the skin, so it is delayed compared with blood sugar — about 10–15 minutes behind, and it can read 10–15% off. The delay is easiest to notice when blood sugar is rising or falling quickly.</p>
                <p>In the game, a <button class="guide-term" data-guide-term="fingerprick">fingerprick</button> shows the character's current blood sugar more precisely than CGM. In later levels, pressure on the sensor, signal checks and sensor loss can also affect the CGM value.</p>
                <p>Sensor problems change the information on the screen; they do not directly change the character's blood sugar. Compare the two measurements and recent events to understand the difference.</p>
                <p>If the CGM curve suddenly surprises you, pause and compare the trend with the character's IOB, recent food and activity.</p>
            `,
            da: `
                <p><button class="guide-term" data-guide-term="cgm">CGM</button> estimerer karakterens glukose under huden og er derfor forsinket i forhold til blodsukker — ca. 10-15 minutter bagud, og den kan vise 10-15% forkert. Forsinkelsen er lettest at se, når blodsukker stiger eller falder hurtigt.</p>
                <p>I spillet viser en <button class="guide-term" data-guide-term="fingerprick">fingerprik</button> karakterens aktuelle blodsukker mere præcist end CGM. I senere baner kan tryk på sensoren, signaltjek og sensor-tab også påvirke CGM-værdien.</p>
                <p>Sensorproblemer ændrer informationen på skærmen; de ændrer ikke direkte karakterens blodsukker. Sammenlign de to målinger og de seneste hændelser for at forstå forskellen.</p>
                <p>Hvis CGM-kurven pludselig overrasker, så sæt spillet på pause og sammenlign trenden med karakterens IOB, nylige mad og aktivitet.</p>
            `,
        },
    },
    {
        id: 'stress-dawn-illness',
        title: {
            en: 'Dawn effect, stress and illness',
            da: 'Dawn-effekt, stress og sygdom',
        },
        body: {
            en: `
                <p><button class="guide-term" data-guide-term="dawn">Dawn effect</button> means blood sugar can rise in the morning before breakfast. The same breakfast dose can therefore leave blood sugar higher in the morning than it would later in the day.</p>
                <p>Stress can raise blood sugar for a while even without food. Poor sleep can make the next day harder because insulin may act more weakly.</p>
                <p>Illness can raise insulin needs for many hours. In illness levels, keep an extra eye on blood sugar, active insulin (IOB) and ketones if blood sugar runs high.</p>
                <p>To find the cause, look at when the rise happens. A rise at the same time each day points to timing or dose. A rise right after illness, stress or a short night points to that, not to the meal.</p>
            `,
            da: `
                <p><button class="guide-term" data-guide-term="dawn">Dawn-effekten</button> betyder at blodsukker kan stige om morgenen før morgenmad. Den samme morgenmadsdosis kan derfor efterlade blodsukkeret højere om morgenen end den ville senere på dagen.</p>
                <p>Stress kan hæve blodsukker i en periode selv uden mad. Dårlig søvn kan gøre næste dag sværere, fordi insulin kan virke svagere.</p>
                <p>Sygdom kan øge insulinbehovet i mange timer. I sygdomsbaner er det ekstra nyttigt at holde øje med blodsukker, aktiv insulin (IOB) og ketoner hvis blodsukker ligger højt.</p>
                <p>Find årsagen ved at se på hvornår stigningen sker. En stigning på samme tid hver dag peger på timing eller dosis. En stigning lige efter sygdom, stress eller en kort nat peger på det — ikke på måltidet.</p>
            `,
        },
    },
    {
        id: 'ketones',
        title: {
            en: 'Ketones and insulin deficiency',
            da: 'Ketoner og insulinmangel',
        },
        body: {
            en: `
                <p><button class="guide-term" data-guide-term="ketones">Ketones</button> appear when the body has too little usable insulin for a while.</p>
                <p>High blood sugar after food is one thing. High blood sugar together with rising ketones is different, because it points more clearly toward insulin shortage.</p>
                <p>In the game, a ketone test adds information when the character's blood sugar has been high for several hours, especially during illness or after missed insulin.</p>
                <p>If ketones rise, give the character insulin and watch blood sugar and ketones over time. Serious events pause the game, so you can read the message before choosing your next step.</p>
            `,
            da: `
                <p><button class="guide-term" data-guide-term="ketones">Ketoner</button> opstår når kroppen har haft for lidt brugbar insulin i et stykke tid.</p>
                <p>Højt blodsukker efter mad er én ting. Højt blodsukker sammen med stigende ketoner er noget andet, fordi det tydeligere peger mod insulinmangel.</p>
                <p>I spillet giver en ketonmåling ekstra information, når karakterens blodsukker har ligget højt i flere timer, især ved sygdom eller efter manglende insulin.</p>
                <p>Hvis ketoner stiger, så giv karakteren insulin og følg blodsukker og ketoner over tid. Alvorlige hændelser sætter spillet på pause, så du kan læse beskeden før du vælger næste trin.</p>
            `,
        },
    },
    {
        id: 'body-signals',
        title: {
            en: 'Body signals and visual symptoms',
            da: 'Kroppens signaler og visuelle symptomer',
        },
        body: {
            en: `
                <p>The character's symptoms are clues. Compare them with the curve and recent events in the game, because one symptom can have several causes.</p>
                <ul>
                    <li><strong>Low blood sugar:</strong> sweating, palpitations, trembling, dizziness and later confusion or blurred vision.</li>
                    <li><strong>High blood sugar:</strong> thirst, frequent urination, fatigue, dry mouth and blurred vision.</li>
                    <li><strong>Rising ketones and acid load:</strong> thirst, frequent urination, nausea, stomach pain, vomiting, acetone smell and deep, rapid breathing.</li>
                    <li><strong>Illness:</strong> sore throat, sneezing, headache and fatigue.</li>
                    <li><strong>Energy deficit:</strong> hunger, weakness, irritability and headache.</li>
                </ul>
                <p>Blurred vision, fatigue, nausea, confusion and headache appear in more than one group. One signal alone does not identify the cause.</p>
                <p>When blood sugar drops, stress hormones can push blood sugar upward (<button class="guide-term" data-guide-term="counterregulation">counter-regulation</button>). Repeated lows can make that response weaker for a while, so later lows may give fewer warning signs (<button class="guide-term" data-guide-term="hypoawareness">impaired hypo awareness</button>).</p>
                <p>Blur, desaturation and tunnel vision are visual learning cues. They can be changed in Settings.</p>
                <p>If the character's symptoms and CGM disagree, use a fingerprick when the tool is available.</p>
            `,
            da: `
                <p>Karakterens symptomer er ledetråde. Sammenlign dem med kurven og de seneste hændelser i spillet, fordi ét symptom kan have flere årsager.</p>
                <ul>
                    <li><strong>Lavt blodsukker:</strong> sved, hjertebanken, rysten, svimmelhed og senere forvirring eller sløret syn.</li>
                    <li><strong>Højt blodsukker:</strong> tørst, hyppig vandladning, træthed, mundtørhed og sløret syn.</li>
                    <li><strong>Stigende ketoner og syrebelastning:</strong> tørst, hyppig vandladning, kvalme, mavesmerter, opkastning, acetonlugt og dyb, hurtig vejrtrækning.</li>
                    <li><strong>Sygdom:</strong> ondt i halsen, nys, hovedpine og træthed.</li>
                    <li><strong>Energiunderskud:</strong> sult, svaghed, irritabilitet og hovedpine.</li>
                </ul>
                <p>Sløret syn, træthed, kvalme, forvirring og hovedpine findes i mere end én gruppe. Ét signal alene viser derfor ikke årsagen.</p>
                <p>Når blodsukker falder, kan stresshormoner skubbe blodsukker opad (<button class="guide-term" data-guide-term="counterregulation">modregulation</button>). Gentagne lave blodsukker kan svække den respons i en periode, så senere lave værdier kan give færre advarselstegn (<button class="guide-term" data-guide-term="hypoawareness">nedsat hypo-fornemmelse</button>).</p>
                <p>Slør, afmætning og tunnelsyn er visuelle læringssignaler. De kan ændres under Settings.</p>
                <p>Hvis karakterens symptomer og CGM ikke passer sammen, så brug fingerprik, når værktøjet er tilgængeligt.</p>
            `,
        },
    },
    {
        id: 'energy',
        title: {
            en: 'Energy, calories and longer runs',
            da: 'Energi, kalorier og længere gennemspilninger',
        },
        body: {
            en: `
                <p>Some levels track the character's calorie balance: energy from food compared with energy expenditure.</p>
                <p>A negative balance means the character has used more energy than the food provided in the level. If blood sugar is not low, a normal meal may fit better than dextrose or juice.</p>
                <p>Activity increases energy use. If a level asks for positive calorie balance, plan food around exercise instead of only reacting near the end.</p>
                <p>Symptoms such as hunger, weakness or headache can point to low calorie balance, especially after long activity or skipped meals.</p>
            `,
            da: `
                <p>Nogle baner følger karakterens kaloriebalance: energi fra mad sammenlignet med energiforbrug.</p>
                <p>Negativ balance betyder, at karakteren har brugt mere energi, end maden i banen har givet. Hvis blodsukkeret ikke er lavt, passer et almindeligt måltid ofte bedre end druesukker eller juice.</p>
                <p>Aktivitet øger energiforbruget. Hvis en bane kræver positiv kaloriebalance, så planlæg mad omkring motion i stedet for kun at reagere tæt på slutningen.</p>
                <p>Symptomer som sult, svaghed eller hovedpine kan pege på lav kaloriebalance, især efter lang aktivitet eller oversprungne måltider.</p>
            `,
        },
    },
    {
        id: 'points',
        title: {
            en: 'Points, stars and level goals',
            da: 'Points, stjerner og banemål',
        },
        body: {
            en: `
                <p>Points and stars show how much time blood sugar spent in the target range.</p>
                <p>Stars use <button class="guide-term" data-guide-term="tir">TIR</button>, which means time in range. A low score points to what you can replay: timing, dose, food or activity.</p>
                <p>Each campaign level has a theme. Use the goal as the main thing to practice in that run.</p>
                <p>Do not chase every tiny CGM movement for points. Stable decisions usually beat many rushed corrections.</p>
            `,
            da: `
                <p>Points og stjerner viser hvor meget tid blodsukker lå i målområdet.</p>
                <p>Stjerner bygger på <button class="guide-term" data-guide-term="tir">TIR</button>, altså tid i målområdet. En lav score peger på hvad du kan spille igen: timing, dosis, mad eller aktivitet.</p>
                <p>Hver kampagnebane har et tema. Brug målet som det vigtigste at øve i den gennemspilning.</p>
                <p>Jag ikke hver lille CGM-bevægelse for points. Rolige beslutninger slår som regel mange forhastede korrektioner.</p>
            `,
        },
    },
    {
        id: 'levelend',
        title: {
            en: 'How a run ends',
            da: 'Hvordan en gennemspilning ender',
        },
        body: {
            en: `
                <p>A few situations end a run, so you can see where the limits are and learn to stay clear of them.</p>
                <p><strong>Severe low blood sugar:</strong> if blood sugar stays below about 2.5 mmol/L too long, the brain runs out of its reserve. In the game, give the character fast sugar before it remains that low.</p>
                <p><strong>Ketoacidosis (DKA):</strong> high blood sugar for a long time without enough insulin lets ketone acids build up. In the game, give the character insulin and follow both blood sugar and ketones.</p>
                <p><strong>Large weight change:</strong> a total change of about 7% of the character's starting weight means nutrition was badly out of balance. The limit scales with body size, so it is the same challenge for a child and an adult.</p>
                <p><strong>Long-term high blood sugar:</strong> a 7-day average above 15 mmol/L (after day 7) stands in for the slow damage that real long-term highs cause.</p>
                <p><strong>Campaign goals:</strong> in the campaign, a level is also lost if its tasks are not finished before time runs out.</p>
            `,
            da: `
                <p>Nogle få situationer afslutter en gennemspilning, så du kan se hvor grænserne er og lære at holde dig fri af dem.</p>
                <p><strong>Svært lavt blodsukker:</strong> hvis blodsukker ligger under ca. 2,5 mmol/L for længe, løber hjernens reserve tør. Giv karakteren hurtigt sukker i spillet, før blodsukkeret ligger så lavt for længe.</p>
                <p><strong>Ketoacidose (DKA):</strong> højt blodsukker i lang tid uden nok insulin lader ketonsyrer hobe sig op. Giv karakteren insulin i spillet, og følg både blodsukker og ketoner.</p>
                <p><strong>Stor vægtændring:</strong> en samlet ændring på ca. 7% af karakterens startvægt betyder, at ernæringen var voldsomt ude af balance. Grænsen skalerer med kropsstørrelsen, så det er samme udfordring for et barn og en voksen.</p>
                <p><strong>Vedvarende højt blodsukker:</strong> et 7-dages gennemsnit over 15 mmol/L (efter dag 7) står for den langsomme skade som vedvarende høje værdier giver i virkeligheden.</p>
                <p><strong>Banemål:</strong> i kampagnen tabes en bane også hvis opgaverne ikke er udført inden tiden løber ud.</p>
            `,
        },
    },
];

const GUIDE_LEVEL_LINKS = {
    1: ['basal', 'rapid-iob', 'low-bg-kit'],
    2: ['stress-dawn-illness', 'rapid-iob', 'basal'],
    3: ['food', 'rapid-iob', 'low-bg-kit'],
    4: ['food', 'rapid-iob', 'energy'],
    5: ['food', 'stress-dawn-illness', 'rapid-iob'],
    6: ['food', 'rapid-iob', 'energy'],
    7: ['activity', 'rapid-iob', 'energy'],
    8: ['activity', 'rapid-iob', 'energy'],
    9: ['stress-dawn-illness', 'ketones', 'body-signals'],
    10: ['cgm', 'stress-dawn-illness', 'food', 'activity'],
};

const GUIDE_KEY_RULES = [
    { section: 'points', includes: ['points', 'stars', 'tir', 'pointsHypoZero'] },
    { section: 'controls', includes: ['openDock', 'speedUp', 'speedControl', 'pauseButton', 'musicSettings', 'tipsOff', 'moreInfoIcons', 'physiologyMode', 'physiologySuggestion', 'physiologyEisf', 'keyboard'] },
    { section: 'energy', includes: ['kcal', 'calorie', 'energyDeficit'] },
    { section: 'low-bg-kit', includes: ['symptomHypo', 'glucagon', 'dextrose', 'lowBgDelay'] },
    { section: 'ketones', includes: ['symptomKetone', 'ketone', 'acidosis'] },
    { section: 'basal', includes: ['basal', 'bgRising'] },
    // activity must come BEFORE rapid-iob: explicit activity fragments
    // (e.g. 'cardioIob') must win over rapid-iob's generic 'iob', so that
    // an activity tip links to the activity section rather than to rapid-iob.
    { section: 'activity', includes: ['activity', 'exercise', 'sport', 'motion', 'busRun', 'lifting', 'styrke', 'strategic', 'stopButton', 'cardioIob', 'strengthLater', 'level7.tip.intro'] },
    { section: 'rapid-iob', includes: ['bolus', 'rapid', 'iob', 'insulin', 'isf', 'icr', 'stack', 'dose', 'onset'] },
    { section: 'food', includes: ['food', 'meal', 'carb', 'pizza', 'cake', 'protein', 'fat', 'lowcarb', 'liquid', 'sweet', 'timescale'] },
    { section: 'cgm', includes: ['cgm', 'sensor', 'fingerprick', 'falseAlarms'] },
    { section: 'stress-dawn-illness', includes: ['dawn', 'stress', 'illness', 'sleep', 'presentation', 'conflict'] },
    { section: 'body-signals', includes: ['symptomHyper', 'symptomMultiple', 'symptomVfxSlowDown'] },
    { section: 'overview', includes: ['experiment', 'active'] },
];

function guideLang() {
    return (typeof appSettings !== 'undefined' && appSettings.language === 'en') ? 'en' : 'da';
}

function guideSectionForTextKey(textKey) {
    const key = String(textKey || '').toLowerCase();
    const rule = GUIDE_KEY_RULES.find(item =>
        item.includes.some(fragment => key.includes(fragment.toLowerCase()))
    );
    return rule ? rule.section : null;
}

function guideTitleForSection(sectionId, lang = guideLang()) {
    const section = GUIDE_SECTIONS.find(item => item.id === sectionId);
    if (!section) return sectionId;
    return section.title[lang] || section.title.en || sectionId;
}

function guideIconForSection(sectionId) {
    return GUIDE_SECTION_ICONS[sectionId] || '';
}
