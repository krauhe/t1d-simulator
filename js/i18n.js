// =============================================================================
// I18N.JS — Internationalisering: dansk og engelsk sprogunderstøttelse
// =============================================================================
//
// Denne fil indeholder hele sprogsystemet for T1D Simulator:
//
//   1. I18N-objekt med ordbøger for dansk ('da') og engelsk ('en')
//   2. t(key, vars) — global oversættelsesfunktion med {var}-interpolation
//   3. translateDOM() — scanner data-i18n og data-i18n-title attributter i DOM
//
// Loaded efter sounds.js (som definerer appSettings), før alt andet:
//   sounds.js → i18n.js → hovorka.js → simulator.js → ui.js → game.js → main.js
//
// Sprogvalget gemmes i appSettings.language ('da' eller 'en') og persisteres
// via localStorage. Sproget kan skiftes live uden reload.
//
// Konventioner:
//   - Nøgler bruger punktnotation: 'ui.btn.start', 'log.food', 'game.over.hypo.name'
//   - Variabler indsættes med {variabelNavn}: t('log.food', {carbs: 50, protein: 10})
//   - Dansk er fallback — hvis en engelsk streng mangler, vises den danske
//   - Brand-tekst ("T1D SIMULATOR", "Play it safe...") oversættes IKKE
//   - Tastatur-genveje (Z, X, C, V) oversættes IKKE (fysiske taster)
//   - Debug-panel forbliver på dansk/teknisk (dev-værktøj)
//
// Dependencies: appSettings (fra sounds.js)
// Exports (global): I18N, t(), translateDOM()
// =============================================================================


// =============================================================================
// I18N ORDBOG — Alle oversættelige strenge samlet i ét objekt
// =============================================================================
//
// Struktureret med nøgle-præfikser efter kategori:
//   ui.btn.*      — Knapper
//   ui.dock.*     — Dock-labels
//   stats.*       — Statistik-panel
//   activity.*    — Aktiviteter
//   food.*        — Madnavne
//   log.*         — Event-log beskeder
//   game.over.*   — Game over tekster
//   profile.*     — Profil-popup
//   highscore.*   — Highscore-popup
//   graph.*       — Graf-tekster
//   unit.*        — Enheder (E/U, kcal)
//   help.*        — Hjælp-popup
//   popup.*       — Generelle popup-knapper
//   ketone.*      — Keton-statusser
// =============================================================================

const I18N = {

    // =========================================================================
    // DANSK — Primært sprog og fallback
    // =========================================================================
    da: {
        // --- Slogan ---
        'ui.slogan': 'Spil sikkert, før det virkelig tæller',

        // --- Knapper ---
        'ui.btn.start': '▶ Start',
        'ui.btn.stop': '⏹ Afslut',
        'ui.btn.profile': '👤 Profil',
        'ui.btn.help': 'ℹ️ Hjælp',
        'ui.btn.highscore': '🏆 Highscore',

        // --- Top-bar tooltips ---
        'ui.title.start': 'Start en ny simulation',
        'ui.title.stop': 'Afslut simulationen og se resultater',
        'ui.title.profile': 'Rediger personprofil',
        'ui.title.help': 'Hjælp og information',
        'ui.title.highscore': 'Vis highscore-listen',
        'ui.title.datetime': 'Dag, klokkeslæt og hastighed',
        'ui.title.slower': 'Langsommere (←)',
        'ui.title.faster': 'Hurtigere (→)',
        'ui.title.pause': 'Pause / Resume (Space)',
        'ui.title.daynight': 'Tidspunkt på døgnet',

        // --- Status badges ---
        'ui.badge.day': 'Dag',
        'ui.badge.points.title': 'Normoglykæmi-points: optjenes ved at holde BG i målområdet',

        // --- CGM hero ---
        'ui.iob.title': 'Insulin On Board — aktiv insulin i kroppen',
        'ui.cob.title': 'Carbs On Board — kulhydrater der endnu ikke er optaget',

        // --- Steep drop warning ---
        'ui.steepDrop': '⚠ ADVARSEL: Hurtigt faldende BG!',

        // --- Activity overlay ---
        'ui.activity.stop': '⏹ Stop',
        'ui.activity.kcalBurned': 'kcal forbrændt',

        // --- Stats panel ---
        'stats.toggle.title': 'Fold statistikpanelet ind/ud',
        'stats.player.title': 'Spiller Data',
        'stats.label.weight': 'Vægt',
        'stats.label.icr': 'ICR',
        'stats.label.isf': 'ISF',
        'stats.label.carbEffect': 'Kulh. effekt',
        'stats.label.basalDose': 'Basal dosis',
        'stats.label.restingKcal': 'Hvileforbrug',
        'stats.tooltip.weight': 'Din kropsvægt, indtastet ved spilstart.',
        'stats.tooltip.icr': 'Insulin/Kulhydrat-Ratio: gram kulhydrat dækket af 1 E insulin',
        'stats.tooltip.isf': 'Insulin Sensitivitets-Faktor: hvor meget 1 E insulin sænker BG',
        'stats.tooltip.carbEffect': 'Kulhydrat-Effekt: hvor meget BG stiger pr. gram kulhydrat',
        'stats.tooltip.basalDose': 'Anbefalet daglig basal insulin-dosis (100-reglen)',
        'stats.tooltip.restingKcal': 'Hvileforbrug: basalt kalorieforbrug pr. dag',
        'stats.section.stats': 'Statistik',
        'stats.header.today': 'I dag',
        'stats.header.week': 'Uge',
        'stats.label.tir': 'TIR (4-10)',
        'stats.label.titr': 'TITR (4-8)',
        'stats.label.avgCgm': 'Gns. CGM',
        'stats.label.fastInsulin': 'Hurtig insulin',
        'stats.label.basalInsulin': 'Basal insulin',
        'stats.label.kcalIntake': 'En. indtag',
        'stats.label.kcalBalance': 'En. balance',
        'stats.tooltip.tir': 'Time in Range: procentdel af tiden med BG mellem 4.0-10.0 mmol/L',
        'stats.tooltip.titr': 'Time in Tight Range: procentdel med BG 4.0-8.0 mmol/L (ideelt)',
        'stats.tooltip.avgCgm': 'Gennemsnitlig CGM-værdi over perioden',
        'stats.tooltip.kcalBalance': 'Energibalance: indtag minus forbrug. Negativt = underskud → vægttab.',
        'stats.label.weightChange': 'Vægtændring',
        'stats.tooltip.weightChange': 'Akkumuleret vægtændring baseret på kaloriebalance. Game over ved ±5 kg.',

        // --- Stats units ---
        'stats.unit.kgDay': 'kg',
        'stats.unit.gPerE': 'g/E',
        'stats.unit.mmolPerE': '(mmol/L)/E',
        'stats.unit.gPerMmol': 'g/(mmol/L)',
        'stats.unit.ePerDay': 'E/dag',
        'stats.unit.kcalPerDay': 'kcal/dag',
        'stats.unit.percent': '%',
        'stats.unit.mmolL': 'mmol/L',

        // --- Dock labels ---
        'ui.dock.insulin': 'Insulin',
        'ui.dock.food': 'Mad',
        'ui.dock.activity': 'Aktivitet',
        'ui.dock.kit': 'T1D Kit',
        'ui.dock.insulin.title': 'Giv insulin (Z)',
        'ui.dock.food.title': 'Spis mad (X)',
        'ui.dock.activity.title': 'Aktivitet (C)',
        'ui.dock.kit.title': 'T1D Kit (V)',

        // --- Insulin panel ---
        'insulin.basal': 'Basal',
        'insulin.fast': 'Hurtig',
        'insulin.basalHint': 'Anbefalet:',
        'insulin.basalHintUnit': 'E/dag',
        'insulin.fastHint': 'Tast 1–9 = hurtig insulin 1–9 E',

        // --- Food panel ---
        'food.cake': 'Lagkage',
        'food.salad': 'Salat',
        'food.avocado': 'Avocado',
        'food.chicken': 'Kylling',
        'food.custom': 'Lav selv',
        'food.dextro': 'Druesukker',
        'food.soda': 'Sodavand',
        'food.apple': 'Æble',
        'food.cereal': 'Havregryn',
        'food.burger': 'Burger',
        'food.eat': '🍴 Spis',
        'food.label.carbs': 'Kulhydrat',
        'food.label.protein': 'Protein',
        'food.label.fat': 'Fedt',
        'food.tooltip.carbs': 'Kulhydrater hæver blodsukkeret hurtigst.',
        'food.tooltip.protein': 'Protein bidrager ~25% af kulhydrateffekt.',
        'food.tooltip.fat': 'Fedt forsinker absorption af kulhydrater og protein.',

        // --- Activity panel ---
        'activity.cardio': 'Cardio',
        'activity.strength': 'Styrke',
        'activity.mixed': 'Blandet',
        'activity.relaxation': 'Afslap',
        'activity.intensity.low': 'Lav',
        'activity.intensity.medium': 'Medium',
        'activity.intensity.high': 'Høj',
        'activity.examples.cardio': 'Løb, cykling, svømning',
        'activity.examples.styrke': 'Vægttræning, crossfit, kropsvægt',
        'activity.examples.blandet': 'Fodbold, badminton, håndbold',
        'activity.examples.afslapning': 'Yoga, meditation, udstrækning',
        'activity.title.cardio': 'Cardio: løb, cykling, svømning — sænker BG',
        'activity.title.styrke': 'Styrketræning: vægttræning, crossfit — hæver BG akut',
        'activity.title.blandet': 'Blandet sport: fodbold, badminton — relativt stabilt BG',
        'activity.title.afslapning': 'Afslapning: yoga, meditation — reducerer stress',
        'activity.title.low': 'Lav intensitet',
        'activity.title.medium': 'Medium intensitet',
        'activity.title.high': 'Høj intensitet',
        'activity.duration.15': 'Start 15 min aktivitet',
        'activity.duration.30': 'Start 30 min aktivitet',
        'activity.duration.60': 'Start 60 min aktivitet',
        'activity.duration.open': 'Start åben aktivitet — kører til du trykker Stop',

        // --- T1D Kit ---
        'kit.dextro': 'Druesukker',
        'kit.fingerprick': 'Fingerprik',
        'kit.ketone': 'Keton-stik',
        'kit.glucagon': 'Glukagon',
        'kit.dextro.title': '3g ren glukose — hurtig hypo-korrektion (12 kcal) — tast Z',
        'kit.fingerprick.title': 'Manuel blodsukkermåling. Mere præcis end CGM, men strimler er dyre (~8 kr) og stikket gør ondt. 3t cooldown. — tast X',
        'kit.ketone.title': 'Mål blod-ketoner. Strimler er dyre (~20 kr) — brug kun ved mistanke om insulinmangel. Normal: < 0.6, Farligt: > 1.5. 6t cooldown. — tast C',
        'kit.glucagon.title': 'Glukagon-nødsprøjte. Bruges ved svær hypoglykæmi. 24t cooldown. — tast V',

        // --- Settings ---
        'settings.physiology': 'Fysiologi',
        'settings.debug': 'Debug',
        'settings.sound': 'Lyd',
        'settings.lang': 'DA',

        // --- Debug panel ---
        'debug.title': 'Debug',
        'debug.trueBG': 'Sandt BG',
        'debug.csvLog': 'CSV log',
        'debug.ready': 'Klar',
        'debug.rows': 'rækker',
        'debug.clearAll': 'Ryd al lokal data',
        'debug.clearAll.title': 'Ryd alle gemte data (profil, highscores, indstillinger, disclaimer)',
        'debug.clearAll.confirm': 'Er du sikker? Dette sletter din profil, highscores, indstillinger og disclaimer-accept. Siden genindlæses.',

        // --- Event log ---
        'log.noEvents': 'Ingen hændelser endnu',
        'log.now': 'nu',
        'log.food': 'Mad: {carbs}g K, {protein}g P, {fat}g F',
        'log.fastInsulin': 'Hurtig insulin: {dose}E',
        'log.basalInsulin': 'Basal insulin: {dose}E',
        'log.fingerprick': 'Fingerprik: {value} mmol/L',
        'log.ketoneTest': 'Keton-stik: {value} mmol/L — {status}',
        'log.glucagon': 'Glukagon brugt! BG stiger hurtigt.',
        'log.activityStart': 'Aktivitet: {name} ({intensity}){duration}{kcal}',
        'log.activityEnd': 'Aktivitet slut: {name} ({intensity}), {duration} min, {kcal} kcal',
        'log.acuteStress': 'Akut stresshormon-stigning: +{amount} (fx adrenalin/glukagon)',
        'log.chronicStress': 'Kronisk stressniveau øget: +{amount} (fx kortisol ved sygdom)',
        'log.sleepDisruption': 'Søvnforstyrrelse! Mistet ~{hours} times søvn i nat.',
        'log.sleepDebt': 'Dårlig søvn: {hours}t tabt → insulinresistens øget ~{percent}%',

        // --- Graph messages ---
        'graph.basalReminder': 'Husk basal insulin!',
        'graph.sleepLoss': 'zZzz... -{hours}t søvn',
        'graph.yAxisLabel': 'Blodsukker (mmol/L)',

        // --- Ketone status ---
        'ketone.ok': 'OK',
        'ketone.elevated': 'Forhøjet',
        'ketone.high': 'Høj!',
        'ketone.critical': 'KRITISK!',

        // --- Game over ---
        'game.over.title': 'Game Over',
        'game.over.pointsLabel': 'Normoglykæmi-points',
        'game.over.saveLabel': 'Gem din score:',
        'game.over.namePlaceholder': 'Dit navn',
        'game.over.saveBtn': 'Gem',
        'game.over.savedBtn': 'Gemt',
        'game.over.savedRank': 'Gemt! Du er nr. {rank} på highscore-listen.',
        'game.over.saved': 'Gemt!',
        'game.over.whatHappened': 'Hvad skete der?',
        'game.over.howToAvoid': 'Sådan undgår du det næste gang',
        'game.over.tryAgain': 'Prøv igen',

        // --- Game over causes ---
        'game.over.hypo.name': 'Svær Hypoglykæmi',
        'game.over.hypo.cause': 'Dit blodsukker faldt til {bg} mmol/L — under den kritiske grænse på 1.5 mmol/L.',
        'game.over.hypo.explanation': 'Hjernen er afhængig af glukose som energikilde. Ved meget lavt blodsukker kan hjernen ikke fungere normalt, hvilket fører til kramper, bevidstløshed og i værste fald død.',
        'game.over.hypo.tip1': 'Spis hurtigt sukker (dextrose, juice) ved de første tegn på lavt blodsukker',
        'game.over.hypo.tip2': 'Hold øje med dit CGM — faldende kurve kræver handling',
        'game.over.hypo.tip3': 'Pas på kombinationen af insulin og motion — motion øger insulinens virkning og kan give uventet lavt blodsukker. Reducer dosis eller spis ekstra før motion',
        'game.over.hypo.tip4': 'Brug glukagon (✚) som nødbehandling ved alvorlig hypo',

        'game.over.weight.name': 'Ekstrem Vægtændring',
        'game.over.weight.cause': 'Din vægtændring oversteg 5 kg ({weight} kg).',
        'game.over.weight.explanation': 'En vægtændring over 5 kg på kort tid indikerer alvorlig ubalance mellem kalorieindtag og -forbrug. Ved diabetes kan dette skyldes manglende insulin (kroppen forbrænder fedt og muskler) eller for meget mad i forhold til aktivitetsniveauet.',
        'game.over.weight.tip1': 'Sørg for at spise regelmæssigt og tilstrækkeligt',
        'game.over.weight.tip2': 'Hold øje med din kaloriebalance i statistikken',
        'game.over.weight.tip3': 'Husk din daglige basal-insulin — uden den nedbryder kroppen væv',

        'game.over.dka.name': 'Diabetisk Ketoacidose (DKA)',
        'game.over.dka.cause': 'Ketonniveau: {ketones} mmol/L — ukontrolleret syreophobning i blodet.',
        'game.over.dka.explanation': 'Insulin styrer ikke kun blodsukkeret — det holder også fedtnedbrydningen i skak. Uden insulin nedbryder kroppen fedt ukontrolleret og danner ketonstoffer. I små mængder er ketoner harmløse, men uden insulin hober de sig op, blodet bliver surt (acidose), og organerne svigter.',
        'game.over.dka.tip1': 'Hold øje med dit blodsukker — vedvarende høje værdier er et advarselstegn',
        'game.over.dka.tip2': 'Tag et keton-stik (🧪) hvis dit blodsukker er højt i flere timer',
        'game.over.dka.tip3': 'Giv insulin ved højt blodsukker — det er den vigtigste behandling',
        'game.over.dka.tip4': 'Husk din daglige basal-insulin',

        'game.over.complications.name': 'Sendiabetiske Komplikationer',
        'game.over.complications.cause': 'Dit gennemsnitlige BG over de sidste 7 dage var {avg} mmol/L.',
        'game.over.complications.explanation': 'Vedvarende højt blodsukker skader blodkar og nerver i hele kroppen. Over tid fører det til alvorlige komplikationer som blindhed, nyresvigt, nerveskader og hjerte-kar-sygdom.',
        'game.over.complications.tip1': 'Sigt efter at holde dit blodsukker mellem 4-10 mmol/L så meget som muligt',
        'game.over.complications.tip2': 'Juster din insulin-dosering hvis dit blodsukker konsekvent er for højt',
        'game.over.complications.tip3': 'Husk at basal-insulin er fundamentet for god blodsukker-kontrol',
        'game.over.complications.tip4': 'Spis regelmæssigt og giv bolus-insulin til måltider',

        // --- DKA warning popup ---
        'dka.warning.title': 'Advarsel: Risiko for Ketoacidose!',
        'dka.warning.message': 'Du har haft højt blodsukker i lang tid. Kendte symptomer på ketoacidose:<br><br><strong>Tidlige tegn:</strong> Øget tørst, hyppig vandladning, træthed, mundtørhed.<br><strong>Advarselstegn:</strong> Kvalme, mavesmerter, hurtig vejrtrækning, acetonlugt fra ånde.<br><br>💡 <strong>Tip:</strong> Tag et keton-stik (🧪) for at tjekke dit ketonniveau. Overvej om du har fået nok insulin.',

        // --- Disclaimer popup ---
        'disclaimer.title': '⚠️ Medicinsk ansvarsfraskrivelse',
        'disclaimer.text': 'Denne simulator er <strong>IKKE et medicinsk udstyr</strong> (jf. EU MDR 2017/745).<br><br>Den er udelukkende til <strong>undervisningsbrug</strong>. Brug den ikke til at beregne insulindoser eller træffe behandlingsbeslutninger.<br><br>Rådfør dig altid med dit behandlerteam.',
        'disclaimer.accept': 'Jeg forstår — dette er ikke medicinsk rådgivning',

        // --- Stop confirm popup ---
        'stop.title': 'Stop spil?',
        'stop.message': 'Er du sikker på at du vil stoppe simulationen? Al fremgang går tabt.',
        'stop.yes': 'Ja, stop',
        'stop.cancel': 'Annuller',

        // --- Popup buttons ---
        'popup.ok': 'OK',
        'popup.close': 'Luk',
        'popup.resetGame': 'Reset Spil',

        // --- Highscore popup ---
        'highscore.title': 'Highscores',
        'highscore.noScores': 'Ingen scores endnu. Spil et spil!',
        'highscore.col.rank': '#',
        'highscore.col.name': 'Navn',
        'highscore.col.points': 'Points',
        'highscore.col.day': 'Dag',
        'highscore.col.gameOver': 'Game Over',
        'highscore.col.date': 'Dato',
        'highscore.close': 'Luk',
        'highscore.clearAll': 'Slet alle scores',
        'highscore.confirmClear': 'Slet alle highscores?',

        // --- Profile popup ---
        'profile.title': 'Personprofil',
        'profile.desc': 'Indtast dine diabetes-parametre for en personlig simulation.',
        'profile.weight': 'Vægt',
        'profile.weight.help': 'Din kropsvægt — bruges til beregning af kalorieforbrug.',
        'profile.icr': 'ICR (Insulin-to-Carb Ratio)',
        'profile.icr.help': 'Gram kulhydrat per enhed insulin. Typisk 8–15 for voksne.',
        'profile.isf': 'ISF (Insulin Sensitivity Factor)',
        'profile.isf.help': 'BG-fald per enhed insulin. Typisk 1.5–5.0 mmol/L for voksne.',
        'profile.tdd': 'Total Daily Dose (TDD)',
        'profile.recommendedBasal': 'Anbefalet basal',
        'profile.restingKcal': 'Hvileforbrug',
        'profile.save': 'Gem profil',
        'profile.reset': 'Standard',

        // --- Aktivitetstype navne (til log/overlay) ---
        'activity.name.cardio': 'Cardio',
        'activity.name.styrke': 'Styrketræning',
        'activity.name.blandet': 'Blandet sport',
        'activity.name.afslapning': 'Afslapning',

        // --- Log: aktivitets-formattering ---
        'log.activity.duration.fixed': ', {min} min',
        'log.activity.duration.open': ', åben',
        'log.activity.kcal': ' (~{kcal} kcal)',
    },

    // =========================================================================
    // ENGLISH — Full translation
    // =========================================================================
    en: {
        // --- Slogan ---
        'ui.slogan': 'Play it safe, before it really counts',

        // --- Buttons ---
        'ui.btn.start': '▶ Start',
        'ui.btn.stop': '⏹ End',
        'ui.btn.profile': '👤 Profile',
        'ui.btn.help': 'ℹ️ Help',
        'ui.btn.highscore': '🏆 Highscore',

        // --- Top-bar tooltips ---
        'ui.title.start': 'Start a new simulation',
        'ui.title.stop': 'End the simulation and view results',
        'ui.title.profile': 'Edit personal profile',
        'ui.title.help': 'Help and information',
        'ui.title.highscore': 'View highscore list',
        'ui.title.datetime': 'Day, time and speed',
        'ui.title.slower': 'Slower (←)',
        'ui.title.faster': 'Faster (→)',
        'ui.title.pause': 'Pause / Resume (Space)',
        'ui.title.daynight': 'Time of day',

        // --- Status badges ---
        'ui.badge.day': 'Day',
        'ui.badge.points.title': 'Normoglycemia points: earned by keeping BG in target range',

        // --- CGM hero ---
        'ui.iob.title': 'Insulin On Board — active insulin in the body',
        'ui.cob.title': 'Carbs On Board — carbohydrates not yet absorbed',

        // --- Steep drop warning ---
        'ui.steepDrop': '⚠ WARNING: Rapidly falling BG!',

        // --- Activity overlay ---
        'ui.activity.stop': '⏹ Stop',
        'ui.activity.kcalBurned': 'kcal burned',

        // --- Stats panel ---
        'stats.toggle.title': 'Expand/collapse statistics panel',
        'stats.player.title': 'Player Data',
        'stats.label.weight': 'Weight',
        'stats.label.icr': 'ICR',
        'stats.label.isf': 'ISF',
        'stats.label.carbEffect': 'Carb effect',
        'stats.label.basalDose': 'Basal dose',
        'stats.label.restingKcal': 'Resting burn',
        'stats.tooltip.weight': 'Your body weight, entered at game start.',
        'stats.tooltip.icr': 'Insulin-to-Carb Ratio: grams of carbs covered by 1 U insulin',
        'stats.tooltip.isf': 'Insulin Sensitivity Factor: how much 1 U insulin lowers BG',
        'stats.tooltip.carbEffect': 'Carb Effect: how much BG rises per gram of carbohydrate',
        'stats.tooltip.basalDose': 'Recommended daily basal insulin dose (Rule of 100)',
        'stats.tooltip.restingKcal': 'Resting burn: basal calorie expenditure per day',
        'stats.section.stats': 'Statistics',
        'stats.header.today': 'Today',
        'stats.header.week': 'Week',
        'stats.label.tir': 'TIR (4-10)',
        'stats.label.titr': 'TITR (4-8)',
        'stats.label.avgCgm': 'Avg. CGM',
        'stats.label.fastInsulin': 'Rapid insulin',
        'stats.label.basalInsulin': 'Basal insulin',
        'stats.label.kcalIntake': 'Cal. intake',
        'stats.label.kcalBalance': 'Cal. balance',
        'stats.tooltip.tir': 'Time in Range: percentage of time with BG between 4.0-10.0 mmol/L',
        'stats.tooltip.titr': 'Time in Tight Range: percentage with BG 4.0-8.0 mmol/L (ideal)',
        'stats.tooltip.avgCgm': 'Average CGM value over the period',
        'stats.tooltip.kcalBalance': 'Energy balance: intake minus expenditure. Negative = deficit → weight loss.',
        'stats.label.weightChange': 'Weight change',
        'stats.tooltip.weightChange': 'Accumulated weight change based on calorie balance. Game over at ±5 kg.',

        // --- Stats units ---
        'stats.unit.kgDay': 'kg',
        'stats.unit.gPerE': 'g/U',
        'stats.unit.mmolPerE': '(mmol/L)/U',
        'stats.unit.gPerMmol': 'g/(mmol/L)',
        'stats.unit.ePerDay': 'U/day',
        'stats.unit.kcalPerDay': 'kcal/day',
        'stats.unit.percent': '%',
        'stats.unit.mmolL': 'mmol/L',

        // --- Dock labels ---
        'ui.dock.insulin': 'Insulin',
        'ui.dock.food': 'Food',
        'ui.dock.activity': 'Activity',
        'ui.dock.kit': 'T1D Kit',
        'ui.dock.insulin.title': 'Give insulin (Z)',
        'ui.dock.food.title': 'Eat food (X)',
        'ui.dock.activity.title': 'Activity (C)',
        'ui.dock.kit.title': 'T1D Kit (V)',

        // --- Insulin panel ---
        'insulin.basal': 'Basal',
        'insulin.fast': 'Rapid',
        'insulin.basalHint': 'Recommended:',
        'insulin.basalHintUnit': 'U/day',
        'insulin.fastHint': 'Keys 1–9 = rapid insulin 1–9 U',

        // --- Food panel ---
        'food.cake': 'Cake',
        'food.salad': 'Salad',
        'food.avocado': 'Avocado',
        'food.chicken': 'Chicken',
        'food.custom': 'Custom',
        'food.dextro': 'Dextrose',
        'food.soda': 'Soda',
        'food.apple': 'Apple',
        'food.cereal': 'Oatmeal',
        'food.burger': 'Burger',
        'food.eat': '🍴 Eat',
        'food.label.carbs': 'Carbs',
        'food.label.protein': 'Protein',
        'food.label.fat': 'Fat',
        'food.tooltip.carbs': 'Carbohydrates raise blood sugar fastest.',
        'food.tooltip.protein': 'Protein contributes ~25% of carbohydrate effect.',
        'food.tooltip.fat': 'Fat delays absorption of carbohydrates and protein.',

        // --- Activity panel ---
        'activity.cardio': 'Cardio',
        'activity.strength': 'Strength',
        'activity.mixed': 'Mixed',
        'activity.relaxation': 'Relax',
        'activity.intensity.low': 'Low',
        'activity.intensity.medium': 'Medium',
        'activity.intensity.high': 'High',
        'activity.examples.cardio': 'Running, cycling, swimming',
        'activity.examples.styrke': 'Weightlifting, crossfit, bodyweight',
        'activity.examples.blandet': 'Football, badminton, handball',
        'activity.examples.afslapning': 'Yoga, meditation, stretching',
        'activity.title.cardio': 'Cardio: running, cycling, swimming — lowers BG',
        'activity.title.styrke': 'Strength training: weights, crossfit — raises BG acutely',
        'activity.title.blandet': 'Mixed sport: football, badminton — relatively stable BG',
        'activity.title.afslapning': 'Relaxation: yoga, meditation — reduces stress',
        'activity.title.low': 'Low intensity',
        'activity.title.medium': 'Medium intensity',
        'activity.title.high': 'High intensity',
        'activity.duration.15': 'Start 15 min activity',
        'activity.duration.30': 'Start 30 min activity',
        'activity.duration.60': 'Start 60 min activity',
        'activity.duration.open': 'Start open activity — runs until you press Stop',

        // --- T1D Kit ---
        'kit.dextro': 'Dextrose',
        'kit.fingerprick': 'Fingerprick',
        'kit.ketone': 'Ketone test',
        'kit.glucagon': 'Glucagon',
        'kit.dextro.title': '3g pure glucose — fast hypo correction (12 kcal) — key Z',
        'kit.fingerprick.title': 'Manual blood glucose measurement. More accurate than CGM, but test strips are expensive and the prick hurts. 3h cooldown. — key X',
        'kit.ketone.title': 'Measure blood ketones. Test strips are expensive — only use when suspecting insulin deficiency. Normal: < 0.6, Dangerous: > 1.5. 6h cooldown. — key C',
        'kit.glucagon.title': 'Glucagon emergency injection. Used for severe hypoglycemia. 24h cooldown. — key V',

        // --- Settings ---
        'settings.physiology': 'Physiology',
        'settings.debug': 'Debug',
        'settings.sound': 'Sound',
        'settings.lang': 'EN',

        // --- Debug panel ---
        'debug.title': 'Debug',
        'debug.trueBG': 'True BG',
        'debug.csvLog': 'CSV log',
        'debug.ready': 'Ready',
        'debug.rows': 'rows',
        'debug.clearAll': 'Clear all local data',
        'debug.clearAll.title': 'Clear all saved data (profile, highscores, settings, disclaimer)',
        'debug.clearAll.confirm': 'Are you sure? This deletes your profile, highscores, settings, and disclaimer acceptance. The page will reload.',

        // --- Event log ---
        'log.noEvents': 'No events yet',
        'log.now': 'now',
        'log.food': 'Food: {carbs}g C, {protein}g P, {fat}g F',
        'log.fastInsulin': 'Rapid insulin: {dose}U',
        'log.basalInsulin': 'Basal insulin: {dose}U',
        'log.fingerprick': 'Fingerprick: {value} mmol/L',
        'log.ketoneTest': 'Ketone test: {value} mmol/L — {status}',
        'log.glucagon': 'Glucagon used! BG rising rapidly.',
        'log.activityStart': 'Activity: {name} ({intensity}){duration}{kcal}',
        'log.activityEnd': 'Activity ended: {name} ({intensity}), {duration} min, {kcal} kcal',
        'log.acuteStress': 'Acute stress hormone surge: +{amount} (e.g. adrenaline/glucagon)',
        'log.chronicStress': 'Chronic stress level increased: +{amount} (e.g. cortisol from illness)',
        'log.sleepDisruption': 'Sleep disruption! Lost ~{hours} hours of sleep tonight.',
        'log.sleepDebt': 'Poor sleep: {hours}h lost → insulin resistance increased ~{percent}%',

        // --- Graph messages ---
        'graph.basalReminder': 'Remember basal insulin!',
        'graph.sleepLoss': 'zZzz... -{hours}h sleep',
        'graph.yAxisLabel': 'Blood Glucose (mmol/L)',

        // --- Ketone status ---
        'ketone.ok': 'OK',
        'ketone.elevated': 'Elevated',
        'ketone.high': 'High!',
        'ketone.critical': 'CRITICAL!',

        // --- Game over ---
        'game.over.title': 'Game Over',
        'game.over.pointsLabel': 'Normoglycemia points',
        'game.over.saveLabel': 'Save your score:',
        'game.over.namePlaceholder': 'Your name',
        'game.over.saveBtn': 'Save',
        'game.over.savedBtn': 'Saved',
        'game.over.savedRank': 'Saved! You are #{rank} on the highscore list.',
        'game.over.saved': 'Saved!',
        'game.over.whatHappened': 'What happened?',
        'game.over.howToAvoid': 'How to avoid it next time',
        'game.over.tryAgain': 'Try again',

        // --- Game over causes ---
        'game.over.hypo.name': 'Severe Hypoglycemia',
        'game.over.hypo.cause': 'Your blood sugar dropped to {bg} mmol/L — below the critical threshold of 1.5 mmol/L.',
        'game.over.hypo.explanation': 'The brain depends on glucose as its energy source. At very low blood sugar, the brain cannot function normally, leading to seizures, loss of consciousness, and in the worst case, death.',
        'game.over.hypo.tip1': 'Eat fast-acting sugar (dextrose, juice) at the first signs of low blood sugar',
        'game.over.hypo.tip2': 'Watch your CGM — a falling curve requires action',
        'game.over.hypo.tip3': 'Be careful with the combination of insulin and exercise — exercise increases insulin effect and can cause unexpectedly low blood sugar. Reduce dose or eat extra before exercise',
        'game.over.hypo.tip4': 'Use glucagon (✚) as emergency treatment for severe hypo',

        'game.over.weight.name': 'Extreme Weight Change',
        'game.over.weight.cause': 'Your weight change exceeded 5 kg ({weight} kg).',
        'game.over.weight.explanation': 'A weight change over 5 kg in a short time indicates a serious imbalance between calorie intake and expenditure. With diabetes, this can be caused by insufficient insulin (the body burns fat and muscle) or too much food relative to activity level.',
        'game.over.weight.tip1': 'Make sure to eat regularly and sufficiently',
        'game.over.weight.tip2': 'Monitor your calorie balance in the statistics',
        'game.over.weight.tip3': 'Remember your daily basal insulin — without it, the body breaks down tissue',

        'game.over.dka.name': 'Diabetic Ketoacidosis (DKA)',
        'game.over.dka.cause': 'Ketone level: {ketones} mmol/L — uncontrolled acid buildup in the blood.',
        'game.over.dka.explanation': 'Insulin doesn\'t just control blood sugar — it also keeps fat breakdown in check. Without insulin, the body breaks down fat uncontrollably and produces ketone bodies. In small amounts, ketones are harmless, but without insulin they accumulate, the blood becomes acidic (acidosis), and organs fail.',
        'game.over.dka.tip1': 'Monitor your blood sugar — persistently high values are a warning sign',
        'game.over.dka.tip2': 'Take a ketone test (🧪) if your blood sugar has been high for several hours',
        'game.over.dka.tip3': 'Give insulin when blood sugar is high — it\'s the most important treatment',
        'game.over.dka.tip4': 'Remember your daily basal insulin',

        'game.over.complications.name': 'Late Diabetic Complications',
        'game.over.complications.cause': 'Your average BG over the last 7 days was {avg} mmol/L.',
        'game.over.complications.explanation': 'Persistently high blood sugar damages blood vessels and nerves throughout the body. Over time, this leads to serious complications such as blindness, kidney failure, nerve damage, and cardiovascular disease.',
        'game.over.complications.tip1': 'Aim to keep your blood sugar between 4-10 mmol/L as much as possible',
        'game.over.complications.tip2': 'Adjust your insulin dosing if your blood sugar is consistently too high',
        'game.over.complications.tip3': 'Remember that basal insulin is the foundation of good blood sugar control',
        'game.over.complications.tip4': 'Eat regularly and give bolus insulin with meals',

        // --- DKA warning popup ---
        'dka.warning.title': 'Warning: Risk of Ketoacidosis!',
        'dka.warning.message': 'You have had high blood sugar for a long time. Known symptoms of ketoacidosis:<br><br><strong>Early signs:</strong> Increased thirst, frequent urination, fatigue, dry mouth.<br><strong>Warning signs:</strong> Nausea, abdominal pain, rapid breathing, acetone smell on breath.<br><br>💡 <strong>Tip:</strong> Take a ketone test (🧪) to check your ketone level. Consider whether you have received enough insulin.',

        // --- Disclaimer popup ---
        'disclaimer.title': '⚠️ Medical Disclaimer',
        'disclaimer.text': 'This simulator is <strong>NOT a medical device</strong> (cf. EU MDR 2017/745).<br><br>It is intended solely for <strong>educational purposes</strong>. Do not use it to calculate insulin doses or make treatment decisions.<br><br>Always consult your healthcare team.',
        'disclaimer.accept': 'I understand — this is not medical advice',

        // --- Stop confirm popup ---
        'stop.title': 'Stop game?',
        'stop.message': 'Are you sure you want to stop the simulation? All progress will be lost.',
        'stop.yes': 'Yes, stop',
        'stop.cancel': 'Cancel',

        // --- Popup buttons ---
        'popup.ok': 'OK',
        'popup.close': 'Close',
        'popup.resetGame': 'Reset Game',

        // --- Highscore popup ---
        'highscore.title': 'Highscores',
        'highscore.noScores': 'No scores yet. Play a game!',
        'highscore.col.rank': '#',
        'highscore.col.name': 'Name',
        'highscore.col.points': 'Points',
        'highscore.col.day': 'Day',
        'highscore.col.gameOver': 'Game Over',
        'highscore.col.date': 'Date',
        'highscore.close': 'Close',
        'highscore.clearAll': 'Delete all scores',
        'highscore.confirmClear': 'Delete all highscores?',

        // --- Profile popup ---
        'profile.title': 'Personal Profile',
        'profile.desc': 'Enter your diabetes parameters for a personalized simulation.',
        'profile.weight': 'Weight',
        'profile.weight.help': 'Your body weight — used to calculate calorie expenditure.',
        'profile.icr': 'ICR (Insulin-to-Carb Ratio)',
        'profile.icr.help': 'Grams of carbs per unit of insulin. Typically 8–15 for adults.',
        'profile.isf': 'ISF (Insulin Sensitivity Factor)',
        'profile.isf.help': 'BG drop per unit of insulin. Typically 1.5–5.0 mmol/L for adults.',
        'profile.tdd': 'Total Daily Dose (TDD)',
        'profile.recommendedBasal': 'Recommended basal',
        'profile.restingKcal': 'Resting burn',
        'profile.save': 'Save profile',
        'profile.reset': 'Default',

        // --- Aktivitetstype navne (til log/overlay) ---
        'activity.name.cardio': 'Cardio',
        'activity.name.styrke': 'Strength training',
        'activity.name.blandet': 'Mixed sport',
        'activity.name.afslapning': 'Relaxation',

        // --- Log: aktivitets-formattering ---
        'log.activity.duration.fixed': ', {min} min',
        'log.activity.duration.open': ', open',
        'log.activity.kcal': ' (~{kcal} kcal)',
    }
};


// =============================================================================
// t() — Global oversættelsesfunktion
// =============================================================================
//
// Slår en nøgle op i den aktive ordbog. Understøtter {variabel}-interpolation.
// Fallback-kæde: valgt sprog → dansk → "[nøgle]" (fejlvisning).
//
// Brug:
//   t('ui.btn.start')                        → "▶ Start"
//   t('log.food', {carbs: 50, protein: 10})  → "Mad: 50g K, 10g P, 5g F"
//
// @param {string} key   - Oversættelsesnøgle (fx 'ui.btn.start')
// @param {object} vars  - Valgfri variabler til interpolation
// @returns {string} Den oversatte streng
// =============================================================================
function t(key, vars) {
    const lang = appSettings.language || 'da';
    let text = (I18N[lang] || I18N['da'])[key] ?? I18N['da'][key] ?? `[${key}]`;
    if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
            text = text.replaceAll(`{${k}}`, v);
        });
    }
    return text;
}


// =============================================================================
// translateDOM() — Oversæt alle statiske HTML-elementer med data-i18n attributter
// =============================================================================
//
// Scanner hele DOM'en for elementer med:
//   data-i18n="key"       → erstatter textContent
//   data-i18n-title="key" → erstatter title-attribut
//   data-i18n-placeholder="key" → erstatter placeholder-attribut
//
// Kaldt ved:
//   1. App-initialisering (initializeApp i main.js)
//   2. Sprogskift (click handler på sprogskifter-knappen)
//
// Dansk tekst forbliver hardkodet i HTML som fallback — hvis translateDOM()
// ikke kører (fx pga. fejl), ser danske brugere stadig korrekt UI.
// =============================================================================
function translateDOM() {
    // Oversæt textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translated = t(key);
        // Bevar child-elementer (fx <span class="pc-key">Z</span>) ved kun at
        // ændre den første text node, IKKE textContent (som sletter children).
        // Undtagelse: elementer uden children kan bruge textContent direkte.
        if (el.children.length === 0) {
            el.textContent = translated;
        } else {
            // Find den første text node og erstat den
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
            const firstText = walker.nextNode();
            if (firstText) firstText.textContent = translated;
        }
    });

    // Oversæt title-attributter (tooltips)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });

    // Oversæt placeholder-attributter
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });

    // Opdater HTML lang-attribut
    document.documentElement.lang = appSettings.language || 'da';

    // Opdater sprogskifter-label
    const langLabel = document.getElementById('langLabel');
    if (langLabel) langLabel.textContent = t('settings.lang');
}


// =============================================================================
// tInsulinUnit() — Returnerer den korrekte insulin-enhed for aktivt sprog
// =============================================================================
//
// Dansk: "E" (Enheder)
// Engelsk: "U" (Units)
//
// Bruges i steder hvor enhed-teksten er indlejret i dynamisk HTML
// (fx insulin-preset chips, slider-knapper).
// =============================================================================
function tInsulinUnit() {
    return (appSettings.language || 'da') === 'en' ? 'U' : 'E';
}
