// =============================================================================
// I18N.JS — Internationalisation: Danish and English language support
// =============================================================================
//
// This file contains the entire language system for T1D Simulator:
//
//   1. I18N object with dictionaries for Danish ('da') and English ('en')
//   2. t(key, vars) — global translation function with {var} interpolation
//   3. translateDOM() — scans data-i18n and data-i18n-title attributes in DOM
//
// Loaded after sounds.js (which defines appSettings), before everything else:
//   sounds.js → i18n.js → hovorka.js → simulator.js → ui.js → game.js → main.js
//
// The language choice is stored in appSettings.language ('da' or 'en') and
// persisted via localStorage. Language can be switched live without reload.
//
// Conventions:
//   - Keys use dot notation: 'ui.btn.start', 'log.food', 'game.over.hypo.name'
//   - Variables are inserted with {variableName}: t('log.food', {carbs: 50, protein: 10})
//   - Danish is the fallback — if an English string is missing, the Danish is shown
//   - Produktnavnet "T1D SIMULATOR" oversættes ikke; sloganet har en særskilt nøgle
//   - Keyboard shortcuts (Z, X, C, V) are NOT translated (physical keys)
//   - Debug panel remains in Danish/technical (dev tool)
//
// Dependencies: appSettings (from sounds.js)
// Exports (global): I18N, t(), translateDOM()
// =============================================================================


// =============================================================================
// I18N DICTIONARY — All translatable strings collected in one object
// =============================================================================
//
// Structured with key prefixes by category:
//   ui.btn.*      — Buttons
//   ui.dock.*     — Dock labels
//   stats.*       — Statistics panel
//   activity.*    — Activities
//   food.*        — Food names
//   log.*         — Event log messages
//   game.over.*   — Game over texts
//   profile.*     — Profile popup
//   highscore.*   — Highscore popup
//   graph.*       — Graph texts
//   unit.*        — Units (E/U, kcal)
//   help.*        — Help popup
//   popup.*       — General popup buttons
//   ketone.*      — Ketone statuses
// =============================================================================

const I18N = {

    // =========================================================================
    // DANISH — Primary language and fallback
    // =========================================================================
    da: {
        // --- Slogan ---
        'ui.slogan': 'Prøv. Lær. Gentag.',

        // --- Knapper ---
        'ui.btn.start': 'Start',
        'ui.btn.stop': 'Afslut',
        'ui.btn.help': 'Hjælp',
        'ui.btn.highscore': 'Highscore',

        // --- Top-bar tooltips ---
        'ui.title.start': 'Start en ny simulation',
        'ui.title.stop': 'Afslut simulationen og se resultater',
        'ui.title.profile': 'Vis eller skift karakter',
        'ui.title.help': 'Hjælp og information',
        'ui.title.highscore': 'Vis highscore-listen',
        'ui.title.datetime': 'Dag, klokkeslæt og hastighed',
        'ui.title.slower': 'Langsommere (←)',
        'ui.title.faster': 'Hurtigere (→)',
        'ui.btn.fullscreen': 'Fuld skærm',
        'ui.title.fullscreen': 'Skift til fuld skærm',
        'ui.title.pause': 'Pause / Resume (Space)',
        'ui.title.daynight': 'Tidspunkt på døgnet',

        // --- Status badges ---
        'ui.badge.day': 'Dag',
        'ui.badge.points.title': 'Points: optjenes ved at holde blodsukker i målområdet',
        'ui.points.total': 'Total',
        'ui.points.today': 'I dag',
        'ui.points.caption': 'points',

        // --- CGM hero ---
        'ui.iob.title': 'Insulin On Board — aktiv insulin i kroppen',
        'ui.cob.title': 'Carbs On Board — kulhydrater der endnu ikke er optaget',

        // --- Steep drop warning ---
        'ui.steepDrop': '⚠ ADVARSEL: Hurtigt faldende blodsukker!',

        // --- Activity overlay ---
        'ui.activity.stop': '⏹ Stop',
        'ui.activity.kcalBurned': 'kcal forbrændt',

        // --- Stats panel ---
        'stats.toggle.title': 'Fold statistikpanelet ind/ud',
        'stats.player.title': 'Karakterprofil',
        'stats.player.anonymous': 'Anonym',
        'stats.label.name': 'Navn',
        'stats.tooltip.name': 'Dit spillernavn (brugt til highscore)',
        'stats.label.weight': 'Vægt',
        'stats.label.restingKcal': 'Hvileforbrug',
        'stats.tooltip.weight': '{characterName}s kropsvægt.',
        'stats.tooltip.restingKcal': 'Hvileforbrug: basalt kalorieforbrug pr. dag',
        'stats.section.stats': 'Statistik',
        'stats.header.today': 'I dag',
        'stats.header.week': 'Uge',
        'stats.label.tir': 'TIR',
        'stats.label.stdBg': 'SD blodsukker',
        'stats.label.avgCgm': 'Gns. CGM',
        'stats.label.eHbA1c': 'eHbA1c',
        'stats.label.fastInsulin': 'Hurtig insulin',
        'stats.label.basalInsulin': 'Basal insulin',
        'stats.label.kcalIntake': 'En. indtag',
        'stats.label.kcalBalance': 'En. balance',
        'stats.tooltip.tir': 'Time in Range: procentdel af tiden med blodsukker mellem {low}-{high} {unit}',
        'stats.tooltip.stdBg': 'Standardafvigelse af sandt blodsukker — mål for glukosvariabilitet. Lavere = mere stabilt.',
        'stats.tooltip.avgCgm': 'Gennemsnitlig CGM-værdi over perioden',
        'stats.tooltip.eHbA1c': 'Modelestimat (GMI) beregnet fra karakterens gennemsnitlige CGM over spilperioden. Kun meningsfuldt efter længere simuleret tid.',
        'stats.tooltip.kcalBalance': 'Energibalance: indtag minus forbrug. Negativt = underskud → vægttab.',
        'stats.label.weightChange': 'Vægtændring',
        'stats.tooltip.weightChange': 'Akkumuleret vægtændring baseret på kaloriebalance. Game over ved ca. 7% af {characterName}s startvægt.',
        // Stats fragment in the capsule bar
        'stats.tir': 'TIR',
        'stats.avgBg': 'Gns blodsukker',
        'stats.avgBgSub': 'gns',
        'stats.bgShort': 'BS',

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
        'ui.dock.food.title': 'Giv mad (X)',
        'ui.dock.activity.title': 'Aktivitet (C)',
        'ui.dock.kit.title': 'T1D Kit (V)',

        // --- Insulin panel ---
        'insulin.basal': 'Basal',
        'insulin.fast': 'Hurtig',
        'insulin.unit': 'E',
        'insulin.fastHint': 'Tast 1–9 = hurtig insulin 1–9 E',

        // --- Food panel (3 rows: low-carb / meals / adjustments+fruit+snacks + custom) ---
        // Row headings
        'food.row.lowCarb': 'Lav-kulhydrat',
        'food.row.meals': 'Måltider',
        'food.row.adjustments': 'Hurtige kulhydrater',
        'food.shortcut': 'Genvej',
        'food.portions.adult': 'voksen portioner',
        'food.portions.child': 'børne portioner',
        // Row 1 — Low-carb
        'food.egg': 'Æg',
        'food.nuts': 'Nødder',
        'food.salad': 'Salat',
        'food.salmonAvocado': 'Laks & avocado',
        'food.eggsBacon': 'Æg & bacon',
        'food.steakBearnaise': 'Bøf & béarnaise',
        // Row 2 — Meals
        'food.curry': 'Karry & ris',
        'food.cereal': 'Havregryn',
        'food.burger': 'Burger',
        'food.pasta': 'Pasta',
        'food.pizza': 'Pizza',
        'food.cake': 'Lagkage',
        // Row 3 — Fast carbs
        'food.dextro': 'Druesukker',
        'food.candy': 'Slik',
        'food.juice': 'Juice',
        'food.cola': 'Cola',
        'food.banana': 'Banan',
        'food.chocolate': 'Chokolade',
        // Custom entry
        'food.custom': 'Lav selv',
        'food.eat': '🍲 Giv',
        'food.label.carbs': 'Kulhydrat',
        'food.label.protein': 'Protein',
        'food.label.fat': 'Fedt',
        'food.tooltip.carbs': 'Kulhydrater hæver blodsukkeret hurtigst.',
        'food.tooltip.protein': 'Protein kan hæve blodsukkeret langsomt, især i store måltider.',
        'food.tooltip.fat': 'Fedt forsinker absorption af kulhydrater og protein.',
        // Carb-type selector in custom popup
        'food.custom.carbType.label': 'Type kulhydrat',
        'food.custom.carbType.mixed': 'Blandet',
        'food.custom.carbType.mixedTitle': 'Blandet måltid (default) — typisk τG ~40 min',
        'food.custom.carbType.sugarSolid': 'Sukker',
        'food.custom.carbType.sugarSolidTitle': 'Rent sukker (druesukker, slik) — hurtig stigning, τG ~25 min',
        'food.custom.carbType.sugarLiquid': 'Drik',
        'food.custom.carbType.sugarLiquidTitle': 'Sukker i drikke (cola, juice) — passerer pylorus hurtigt, τG ~18 min',
        'food.custom.carbType.fruit': 'Frugt',
        'food.custom.carbType.fruitTitle': 'Frugt: simple sukre + skal-fiber, τG ~35 min',
        'food.custom.carbType.whiteFlour': 'Hvidt mel',
        'food.custom.carbType.whiteFlourTitle': 'Hvidt mel (pasta, franskbrød): stivelse, lav fiber, τG ~47 min',
        'food.custom.carbType.wholeGrain': 'Fuldkorn',
        'food.custom.carbType.wholeGrainTitle': 'Fuldkorn (rugbrød, havregryn): stivelse + meget fiber, τG ~59 min',
        'food.custom.carbType.veggie': 'Grønt',
        'food.custom.carbType.veggieTitle': 'Grøntsager: lavt carb-indhold, meget høj fiber',

        // --- Activity panel ---
        'activity.section.type': 'Aktivitetstype',
        'activity.section.intensity': 'Intensitet',
        'activity.section.time': 'Varighed og Start',
        'activity.cardio': 'Cardio',
        'activity.strength': 'Styrke',
        'activity.mixed': 'Blandet',
        'activity.relaxation': 'Afslap',
        'activity.intensity.low': 'Lav',
        'activity.intensity.medium': 'Medium',
        'activity.intensity.high': 'Høj',
        // General examples (fallback)
        'activity.examples.cardio': 'Gåtur, cykling, løb',
        'activity.examples.styrke': 'Bære poser, kropsvægt-øvelser, vægttræning',
        'activity.examples.blandet': 'Bowling, badminton, fodbold',
        'activity.examples.afslapning': 'Vejrtrækning, yoga, tai chi',
        // Intensity-specific examples — shows that "exercise" includes everyday activities
        'activity.examples.cardio.Lav': 'Rolig gåtur, støvsuge, lette gøremål',
        'activity.examples.cardio.Medium': 'Rask gang, cykling, ærinder i byen',
        'activity.examples.cardio.Høj': 'Løb, hård cykling, svømning',
        'activity.examples.styrke.Lav': 'Havearbejde, bære poser, lette løft',
        'activity.examples.styrke.Medium': 'Kropsvægt-øvelser, lette vægte, flytte møbler',
        'activity.examples.styrke.Høj': 'Tung vægttræning, crossfit, bære tungt',
        'activity.examples.blandet.Lav': 'Bowling, golf, langsom dans',
        'activity.examples.blandet.Medium': 'Badminton, fodbold med venner, energisk dans',
        'activity.examples.blandet.Høj': 'Konkurrence-fodbold, håndbold-kamp, kampsport',
        'activity.examples.afslapning.Lav': 'Meditation, dyb vejrtrækning',
        'activity.examples.afslapning.Medium': 'Rolig yoga, udstrækning',
        'activity.examples.afslapning.Høj': 'Dynamisk yoga, tai chi',
        'activity.title.cardio': 'Cardio: løb, cykling, svømning — sænker blodsukker (Q)',
        'activity.title.styrke': 'Styrketræning: vægttræning, crossfit — hæver blodsukker akut (W)',
        'activity.title.blandet': 'Blandet sport: fodbold, badminton — relativt stabilt blodsukker (E)',
        'activity.title.afslapning': 'Afslapning: yoga, meditation — reducerer stress',
        'activity.title.low': 'Lav intensitet (A)',
        'activity.title.medium': 'Medium intensitet (S)',
        'activity.title.high': 'Høj intensitet (D)',
        'activity.duration.15': 'Start 15 min aktivitet (Z)',
        'activity.duration.30': 'Start 30 min aktivitet (X)',
        'activity.duration.60': 'Start 60 min aktivitet (C)',
        'activity.duration.open': 'Start åben aktivitet — kører til du trykker Stop (V)',
        'activity.duration.label.15': '15 min',
        'activity.duration.label.30': '30 min',
        'activity.duration.label.60': '60 min',
        'activity.duration.label.open': 'Åben',

        // --- T1D Kit ---
        'kit.dextro': 'Druesukker',
        'kit.fingerprick': 'Fingerprik',
        'kit.ketone': 'Keton-stik',
        'kit.glucagon': 'Glukagon',
        'kit.dextro.title': '3g ren glukose — hurtig hypo-korrektion (12 kcal) — tast V',
        'kit.fingerprick.title': 'Manuel blodsukkermåling. Mere præcis end CGM, men strimler er dyre (~8 kr) og stikket gør ondt. 3t cooldown. — tast Z',
        'kit.ketone.title': 'Mål blod-ketoner. Strimler er dyre (~20 kr) — brug kun ved mistanke om insulinmangel. Normal: < 0.6, Farligt: > 1.5. 6t cooldown. — tast X',
        'kit.glucagon.title': 'Glukagon-nødsprøjte. Bruges ved svær hypoglykæmi. 24t cooldown. — tast C',

        // --- Settings ---
        'settings.physiology': 'Fysiologi-visning',
        'physiology.insulinBand': 'Insulinlinje',
        'physiology.carbBand': 'Kulhydratoptag',
        'physiology.isfLine': 'Effektiv ISF',
        'physiology.effectsPanel': 'Blodsukkerkræfter',
        'physiology.dashboard': 'Fysiologivindue',
        // Section titles in the physiology effects panel
        'physio.forces': 'Kræfter',
        'physio.insulin': 'Insulin',
        'physio.sensitivity': 'Insulinfølsomhed',
        'physio.food': 'Mad',
        'physio.ketones': 'Ketoner',
        // Physiology section labels
        'physio.basalRate': 'Basal',
        'physio.plasmaI': 'Plasma I',
        'physio.effectiveISF': 'Effektiv ISF',
        'physio.circadian': 'Døgnrytme',
        'physio.glucotox': 'Glukotoks.',
        'physio.stress': 'Stress',
        'physio.exercise': 'Motion',
        'physio.carbRate': 'Kulhydratrate',
        'physio.protGlucagon': 'Prot. glukagon',
        'physio.acidosis': 'Acidose',
        'physio.ffaLipo': 'FFA lipolyse',
        // Force names for the effects panel (physiological BG influences)
        'force.egp': 'Leverproduktion',
        'force.cause.dawn': 'dawn-effekt',
        'force.cause.stress': 'stresshormoner',
        'force.cause.sleep': 'søvntab',
        'force.cause.protein': 'protein',
        'force.carbAbsorption': 'Kulhydrater',
        'force.insulinAction': 'Insulinvirkning',
        'force.basalInsulin': 'Basalinsulin',
        'force.bolusInsulin': 'Hurtiginsulin',
        'force.exerciseUptake': 'Muskeloptag',
        'force.stressHormones': 'Stresshormoner',
        'force.dawnEffect': 'Dawn-effekt',
        'force.renalExcretion': 'Nyreudskillelse',
        'force.brainConsumption': 'Insulin-uafhængigt forbrug',
        'force.proteinGlucagon': 'Protein → glukagon',
        'force.ffaResistance': 'FFA-resistens',
        'force.glucotoxicity': 'Glukotoksicitet',
        // Dashboard graph titles
        'dashboard.title': 'Fysiologi-dashboard',
        'dashboard.bg': 'Blodsukker (mmol/L)',
        'dashboard.insulin': 'Insulin',
        'dashboard.food': 'Mad-absorption',
        'dashboard.stress': 'Stresshormoner',
        'dashboard.liver': 'Lever & glykogen',
        'dashboard.ketones': 'Ketoner',
        'settings.label': 'Settings',
        'settings.title': 'Indstillinger',
        'settings.debug': 'Debug',
        'drawer.stats': 'Spil data',
        'drawer.debug': 'Debug',
        'settings.sound': 'Lyd',
        'settings.vfx': 'VFX',
        'settings.vfx.title': 'Visuelle symptomeffekter til/fra — simulerer sløret syn, tunnelsyn og falmende farver ved hypo, hyper og DKA',
        'settings.sfx': 'Lydeffekter',
        'settings.cgm': 'CGM-lyde',
        'settings.music': 'Musik',
        'settings.lang': 'DA',
        // Section titles (divider labels)
        'settings.sect.gameplay': 'Gameplay',
        'settings.sect.display': 'Visning',
        'settings.sect.developer': 'Udvikler',
        // Help text below toggles
        'settings.sfx.help': 'Knap-lyde og spil-events.',
        'settings.cgm.help': 'Lyd ved hver ny CGM-måling.',
        'settings.effects.help': 'Pile der viser, hvad der driver {characterName}s blodsukker.',
        'settings.lifeBars': 'Life bars',
        'settings.lifeBars.help': 'Hjerne, acidose og vægt som progress bars.',
        'settings.stats': 'Statistik',
        'settings.stats.help': 'TIR, gns blodsukker og vægt nederst på skærmen.',
        'settings.fullscreen': 'Fuld skærm',
        'settings.fullscreen.help': 'Vis simulatoren i fuld skærm.',
        'settings.vfx.help2': 'Slør, afmætning og tunnelsyn ved lavt blodsukker, langvarigt højt blodsukker og syrebelastning.',
        'settings.dashboard.help': 'Detaljeret realtidsvisning i separat vindue.',
        'settings.tips': 'Tips',
        'settings.tips.help': 'Tips og hints om kontrol, baner og fysiologi.',
        'settings.bgUnit': 'Blodsukkerenhed',
        'settings.bgUnit.help': 'Skift mellem mmol/L og mg/dL.',
        'settings.debug.help': 'Interne værdier, sandt blodsukker og CSV-logning.',
        // Physiology button (top bar)
        'ui.btn.physiology': 'Fysiologi',
        'ui.title.physiology': 'Vis de skjulte mekanismer der driver blodsukker\n— kun til læring, score gemmes ikke',
        'ui.physiology.watermark': 'FYSIOLOGI-VISNING',
        'ui.physiology.confirm.title': 'Aktivér fysiologi-visning?',
        'ui.physiology.confirm.body': 'Fysiologi-visning er en god måde at lære om de mekanismer der driver blodsukker.<br><br>I hverdagen har man dog ikke adgang til denne information, derfor gemmes scoren ikke.',
        'ui.physiology.confirm.yes': 'Ja, vis fysiologien',
        'ui.physiology.confirm.no': 'Fortsæt uden fysiologi',
        'ui.physiology.startWarn.title': 'Fysiologi-tilstand er aktiv',
        'ui.physiology.scoreNotSaved': 'Score ikke gemt — fordi fysiologi-visning giver indsigt man ikke har i virkeligheden.',

        // --- Game modes ---
        'mode.title': 'Vælg tilstand',
        'mode.group.play': 'Spil',
        'mode.boxchallenge': 'Box Challenge',
        'mode.boxchallenge.desc': 'Undgå forhindringerne og saml points!',
        'mode.campaign': 'Kampagne',
        'mode.campaign.desc': 'Hjælp en karakter med at holde blodsukkeret stabilt — trin for trin',
        'mode.screenNote': 'T1D Simulator er designet til at fungere bedst på en større skærm, fx PC eller tablet.',


        // --- Lille-viewport popup ---
        'viewport.title': 'Lille skærm?',
        'viewport.message': 'T1D Simulator er bygget til PC og tablet. Din skærm er lille — prøv mobilversionen for en bedre oplevelse.',
        'viewport.switch': 'Skift til mobilversion',
        'viewport.stay': 'Bliv på desktop',

        // --- Box Challenge ---
        'boxchallenge.lives': 'Liv',
        'boxchallenge.levelComplete': 'Gennemført!',
        'boxchallenge.dayLabel': 'DAG {day}',
        'boxchallenge.dayPoints': 'I dag',
        'boxchallenge.total': 'Total',
        'boxchallenge.bonus': 'Bonus: +{bonus} points',
        'boxchallenge.perfect': 'Perfekt kontrol!',
        'boxchallenge.great': 'Godt klaret!',
        'boxchallenge.passed': 'Bestået!',
        'boxchallenge.nextDay': 'Næste dag →',
        'boxchallenge.lifeUsed': 'Du mistede et liv!',
        'boxchallenge.respawn.hypo': 'Respawn efter hypo — blodsukker nulstillet!',
        'boxchallenge.respawn.dka': 'Respawn efter DKA — blodsukker nulstillet!',
        'boxchallenge.gameOver': 'Alle liv brugt!',
        'boxchallenge.continue': 'Fortsæt',
        'boxchallenge.respawn.box': 'Du ramte en forhindring!',
        'boxchallenge.respawn.weight': 'Vægt ude af kontrol — nulstillet!',
        'boxchallenge.respawn.complications': 'Komplikationer — ny chance!',
        // --- Kampagne ---
        'campaign.levelLabel': 'Bane {n}',
        'campaign.playingCharacter': 'Du hjælper {characterName}',
        'campaign.selectLevel': 'Vælg bane',
        'campaign.objectives': 'Krav',
        'campaign.obj.complete3Days': 'Hjælp {characterName} gennem 3 dage',
        'campaign.obj.positiveCalorieFood': 'Giv {characterName} nok mad til at få positiv kaloriebalance',
        'campaign.availableTools': 'Tilgængelige værktøjer',
        'campaign.startLevel': '▶ Start banen',
        'campaign.returnToLevel': '▶ Tilbage til banen',
        'campaign.info.title': 'Vis bane-info (mål, beskrivelse og værktøjer)',
        'campaign.failed.title': 'Ikke bestået endnu',
        'campaign.failed.body': 'Et eller flere mål blev ikke opfyldt',
        'campaign.failed.missing': 'Mangler',
        'campaign.failed.noPoints': 'Der gemmes ingen points for dette forsøg.',
        'campaign.levelComplete': 'Gennemført!',
        'campaign.levelPoorPass': 'Bestået med nød og næppe',
        'campaign.levelIncomplete': 'Ikke gennemført',
        'campaign.nextLevel': 'Næste bane →',
        'campaign.replay': '↺ Prøv igen',
        'campaign.retry': '↺ Prøv igen',
        'campaign.backToMenu': '← Menu',
        'campaign.quit': 'Afslut',
        'campaign.basePoints': 'Points',
        'campaign.total': 'Total',
        'campaign.encouragement': 'Det er helt ok at fejle — man lærer af det! Prøv igen.',
        'campaign.action.basal': 'Basal insulin',
        'campaign.action.bolus': 'Hurtiginsulin',
        'campaign.action.food': 'Mad',
        'campaign.action.exercise': 'Motion',
        'campaign.action.kit': 'T1D kit',

        // Level titles and descriptions
        'campaign.level1.title': 'Basal-insulin',
        'campaign.level1.desc': '<p>{characterName}s sidste basalinsulin blev givet kl. 8 i går og aftager i løbet af formiddagen.</p><p>Afprøv <strong>{basalRangeMin}-{basalRangeMax} E</strong> basalinsulin til {characterName}. For lidt basal får typisk blodsukkeret til at stige langsomt. For meget får det til at falde og kan give lavt blodsukker. Basal virker over mange timer, så følg kurven gennem dagen.</p>',
        'campaign.level1.obj.complete': 'Gennemfør 3 dage',
        'campaign.level1.obj.basal': 'Giv basal insulin',
        'campaign.level1.obj.survive': 'Hold {characterName}s blodsukker stabilt gennem 3 døgn',

        'campaign.level2.title': 'Dawn-effekten',
        'campaign.level2.desc': '<p>Om morgenen kan {characterName}s blodsukker stige uden mad. Det kaldes <strong>dawn-effekten</strong>.</p><p>Udforsk forskellige doser og tidspunkter for hurtiginsulin. Se, hvad der holder {characterName}s blodsukker stabilt om morgenen. Basalinsulinen skal stadig gives hver dag.</p>',
        'campaign.level2.obj.complete': 'Gennemfør 3 dage',
        'campaign.level2.obj.basal': 'Giv basal insulin',
        'campaign.level2.obj.survive': 'Bevar god blodsukkerkontrol i 3 døgn',

        'campaign.level3.title': 'Hurtige kulhydrater',
        'campaign.level3.desc': '<p>Giv {characterName} forskellige snacks og søde drikke. Se, hvor hurtigt de hæver blodsukkeret.</p><p>Udforsk, hvordan hurtiginsulinens dosis og tidspunkt ændrer kurven, og prøv at holde den i det grønne område.</p>',
        'campaign.level3.obj.food3xPerDay': 'Giv {characterName} snacks eller søde drikke mindst 3 gange hver dag',
        'campaign.level3.tip.glucagon': 'Ved meget lavt blodsukker kan glucagon fra T1D-kittet hæve blodsukkeret på få minutter.',
        'campaign.level3.tip.liquidFaster': 'Drikkevarer med sukker optages typisk hurtigere end faste snaks.',
        'campaign.level3.tip.sweetFast': 'Druesukker er glukose og hæver blodsukkeret hurtigt.',

        'campaign.level4_meals.title': 'Bolus til måltider',
        'campaign.level4_meals.desc': '<p>Giv {characterName} forskellige måltider. Afprøv forskellige tidspunkter for hurtiginsulin, og se, hvad der holder {characterName}s blodsukker i det grønne område.</p><p>Du får flest point mellem {bonusLow} og {bonusHigh} {unit}.</p>',
        'campaign.level4_meals.obj.eat': 'Giv {characterName} måltider, så kaloriebalancen bliver positiv',
        'campaign.level4_meals.tip.bolusFirst': 'Sammenlign bolus før og efter maden.',
        'campaign.level4_meals.tip.noBolus': 'Måltidet blev givet uden bolus. Kulhydraterne er allerede under optagelse.',
        'campaign.level4_meals.tip.kcalIntro': '🔥 viser kaloriebalancen: plus betyder, at der er spist mere energi, end der er forbrændt.',
        'campaign.level4_meals.tip.kcalDeficit': 'Kaloriebalancen er negativ. Banens mål kræver, at den bliver positiv inden afslutningen.',

        'campaign.level4.title': 'Low carb',
        'campaign.level4.desc': '<p>Low carb-måltider indeholder færre kulhydrater og mere protein eller fedt.</p><p>Giv {characterName} forskellige måltider, og udforsk hurtiginsulinens dosis og tidspunkt. Følg kurven i mindst 4 timer for at se, om blodsukkeret stiger igen, når hurtiginsulinens virkning aftager.</p>',
        'campaign.level4.obj.eat': 'Giv {characterName} low carb-måltider, så kaloriebalancen bliver positiv',
        'campaign.level4.obj.survive': 'Bevar god blodsukkerkontrol i 3 døgn',

        'campaign.level6_buffet.title': 'Buffet',
        'campaign.level6_buffet.desc': '<p>Alle madtyper og begge insulintyper er nu tilgængelige.</p><p>Giv {characterName} måltider og snacks gennem dagen. Udforsk forskellige måltider og tidspunkter for hurtiginsulin, og prøv at holde blodsukkeret i det grønne område.</p>',

        'campaign.level7.title': 'Hverdagsaktivitet',
        'campaign.level7.desc': '<p>Gåture, ærinder, havearbejde og yoga påvirker {characterName}s blodsukker forskelligt.</p><p>Vælg forskellige hverdagsaktiviteter til {characterName}. Sørg for mindst 2 timers aktivitet hver dag, og følg blodsukkeret under aktiviteten og bagefter.</p>',
        'campaign.level7.obj.activity': 'Lad {characterName} være aktiv mindst 2 timer hver dag',
        'campaign.level7.tip.intro': 'Gåtur, havearbejde, yoga og ærinder giver forskellige blodsukkerkurver.',
        'campaign.level7.tip.strategic': 'En kort gåtur er tilgængelig. Se, hvordan den ændrer blodsukkerkurven.',
        'campaign.level7.tip.stopButton': 'Du kan til enhver tid stoppe en aktivitet manuelt med stop-knappen i aktivitets-overlay\'et.',
        'campaign.level7.tip.styrke': 'Styrketræning kan først hæve blodsukkeret og senere få det til at falde.',
        'campaign.level7.tip.afslapning': 'Afslapning (yoga, vejrtrækning) sænker stresshormoner og forbedrer blodsukkerkontrol indirekte — særligt brugbart efter stressende dage.',

        // Placeholder titles for levels 9-10 (under construction — shown on "Select level")
        'campaign.level8.title': 'Sport',
        'campaign.level8.desc': '<p>Cardio og styrketræning kan påvirke {characterName}s blodsukker forskelligt.</p><p>Lad {characterName} dyrke hård motion mindst 1 time hver dag. Hold øje med aktiv insulin (IOB), og følg kurven under motionen og 1–3 timer bagefter.</p>',
        'campaign.level8.obj.hardExercise': 'Lad {characterName} dyrke mindst 1 times hård motion hver dag',
        'campaign.level8.tip.cardioIob': 'Motion med aktiv insulin kan sænke blodsukkeret hurtigere. Sammenlign IOB og trend ved start.',
        'campaign.level8.tip.strengthLater': 'Ved høj intensitet kan blodsukker først stige lidt og senere falde. Kig igen 1-3 timer efter aktiviteten.',
        'campaign.level9.title': 'Sygdom og stress',
        'campaign.level9.desc': '<p>På dag 1 bliver {characterName} udsat for stress, og på dag 2 bliver {characterName} lettere syg.</p><p>Følg blodsukker, aktiv insulin (IOB) og ketoner, og prøv at holde blodsukkeret i det grønne område gennem alle 3 dage.</p>',
        'campaign.level9.marker.test': 'Vigtig prøve',
        'campaign.level9.marker.illness': 'Sygdom',
        'campaign.level9.tip.stressGeneral': 'En stressende situation kan få blodsukker til at stige i 1-2 timer, også uden mad.',
        'campaign.level9.tip.stressEvent': 'Stresshormonerne stiger nu — hold øje med blodsukker de næste par timer.',
        'campaign.level9.tip.illnessEvent': 'Sygdom øger insulinbehovet — samme dosis kan virke svagere end normalt.',
        'campaign.level9.tip.illnessGeneral': 'Ved sygdom kan insulin virke svagere gennem mange timer.',
        'campaign.level9.tip.ketones': 'Hvis blodsukker bliver højt under sygdom, kan ketonmåling give ekstra information.',
        'campaign.level10.title': 'Uforudsigelighed',
        'campaign.level10.desc': '<p>Hjælp {characterName} gennem 3 dage med uventet stress, sygdom, mad, aktivitet og fejl fra den kontinuerlige glukosemåler (CGM).</p><p>Følg trend, aktiv insulin (IOB) og kurven, og prøv at holde blodsukkeret i det grønne område.</p>',
        'campaign.level10.tip.active': 'Uforudsete hændelser er aktive i denne bane. Nogle ses først bagefter på kurven.',
        'campaign.level10.tip.cgmCompression': 'Et pludseligt natligt CGM-fald kan skyldes tryk på sensoren. Fingerprikken viser {characterName}s aktuelle blodsukker.',
        'campaign.level10.tip.sensorLoss': '{characterName}s CGM-sensor kan blive slået løs. Fingerprik fra T1D-kittet giver data imens.',
        'campaign.level10.tip.sensorCheck': 'CGM-signalet kan fejlteste sig selv i korte perioder. Der mangler CGM-data imens, men fingerprik virker stadig.',
        'campaign.level10.tip.falseAlarms': 'Et pludseligt CGM-fald kan være en falsk alarm. Fingerprikken viser {characterName}s blodsukker mere præcist.',
        'campaign.level10.event.presentation': 'Uforudset stress: {characterName} skal holde en vigtig præsentation. Blodsukkeret kan stige de næste par timer.',
        'campaign.level10.event.conflict': 'Uforudset stress: {characterName} havner i en presset situation, som får stresshormonerne til at stige.',
        'campaign.level10.event.poorSleep': 'CGM-alarm: {characterName} har ligget på sensorarmen, så CGM kan vise for lavt i en periode.',
        'campaign.level10.event.illness': '{characterName} føler sig lettere syg. Følg blodsukker og ketoner, hvis blodsukkeret bliver højt.',
        'campaign.level10.event.sensorLoss': '{characterName}s CGM-sensor er blevet slået løs. Der kommer ingen nye CGM-tal før ny sensor og warmup.',
        'campaign.level10.event.sensorCheck': 'CGM tjekker {characterName}s signal kortvarigt. Brug fingerprik, hvis du vil se blodsukkeret nu.',
        'campaign.level10.event.cake': 'Uventet mad: {characterName} spiser et stykke kage. Tag højde for både sukker og fedt.',
        'campaign.level10.event.pizza': 'Uventet mad: {characterName} spiser pizza, som kan give både en tidlig og en sen blodsukkerstigning.',
        'campaign.level10.popup.presentationTitle': 'Vigtig præsentation',
        'campaign.level10.popup.presentation': '{characterName} skal holde en vigtig præsentation. Stresshormoner kan få blodsukkeret til at stige i 1-2 timer, også uden mad. Spillet er pauset, så du kan se på blodsukker og IOB og vælge næste handling.',
        'campaign.level10.popup.conflictTitle': 'Presset situation',
        'campaign.level10.popup.conflict': '{characterName} havner i en presset situation. Stresshormoner kan få blodsukkeret til at stige, selvom {characterName} ikke har spist. Spillet er pauset, så du kan følge udviklingen.',
        'campaign.level10.popup.foodTitle': 'Uventet mad',
        'campaign.level10.popup.cake': 'En ven kommer uventet forbi med kage, og {characterName} tager et stykke. Kagen er nu registreret på grafen. Spillet er pauset, så du kan se på blodsukker og IOB og vælge næste handling.',
        'campaign.level10.popup.pizza': 'Planen ændrer sig, og {characterName} spiser pizza. Pizza giver både hurtige kulhydrater og en længere fedt-/protein-effekt. Spillet er pauset, så du kan planlægge næste skridt.',
        'campaign.level10.popup.sleepAlarmTitle': 'CGM-alarm om natten',
        'campaign.level10.popup.sleepAlarm': '{characterName} vågner af en CGM-alarm efter at have ligget på sensorarmen. Derfor kan CGM vise for lavt i en periode. Spillet er pauset: brug evt. fingerprik til at se blodsukkeret direkte. Søvnafbruddet kan øge insulinbehovet næste dag.',
        'campaign.level10.popup.illnessTitle': 'Mild sygdom',
        'campaign.level10.popup.illness': '{characterName} får ondt i halsen og føler sig syg. Ved sygdom kan insulin virke svagere i mange timer. Følg blodsukkeret, og mål ketoner, hvis det bliver højt.',
        'campaign.level10.popup.sensorLossTitle': 'CGM-sensoren faldt af',
        'campaign.level10.popup.sensorLoss': '{characterName}s CGM-sensor er blevet revet løs ved et uheld. En ven kommer med en ny sensor om 2 timer. Derefter tager warmup 1 time. Brug fingerprik imens, hvis du vil se {characterName}s blodsukker.',
        'campaign.level10.popup.sensorCheckTitle': 'CGM fejltester',
        'campaign.level10.popup.sensorCheck': '{characterName}s CGM-signal ser usædvanligt ud, så sensoren holder kort pause for at tjekke signalet. Spillet er pauset: brug fingerprik, hvis du vil se blodsukkeret direkte.',
        'campaign.level10.popup.busRunTitle': 'Løb efter bussen',
        'campaign.level10.popup.busRun': '{characterName} er sent på den og må løbe efter bussen. Cardio er startet på grafen og kan få blodsukkeret til at falde hurtigt. Spillet er pauset, så du kan vurdere blodsukker og kulhydrater.',
        'campaign.level10.popup.liftingTitle': 'Tungt løft',
        'campaign.level10.popup.lifting': '{characterName} hjælper med at flytte nogle møbler. Det er registreret som styrkeaktivitet på grafen. Styrke kan give en kort blodsukkerstigning, mens musklerne stadig kan bruge mere glukose bagefter.',
        'campaign.level10.event.busRun': 'Uventet aktivitet: {characterName} må løbe efter bussen. Cardio kan få blodsukkeret til at falde hurtigt.',
        'campaign.level10.event.lifting': 'Uventet aktivitet: {characterName} hjælper med at flytte møbler. Styrke kan give en kort blodsukkerstigning.',
        'campaign.level10.marker.presentation': 'Præsentation',
        'campaign.level10.marker.stress': 'Stress',
        'campaign.level10.marker.poorSleep': 'Dårlig søvn',
        'campaign.level10.marker.cgmAlarm': 'CGM-alarm',
        'campaign.level10.marker.illness': 'Sygdom',
        'campaign.level10.marker.sensorLoss': 'CGM væk',
        'campaign.level10.marker.sensorCheck': 'CGM tjekker',
        'campaign.level10.marker.cake': 'Kage',
        'campaign.level10.marker.pizza': 'Pizza',
        'campaign.level10.marker.busRun': 'Løb efter bus',
        'campaign.level10.marker.lifting': 'Tungt løft',

        // Marker labels
        'campaign.marker.giveBasal': 'Giv basal',
        'campaign.marker.eatBreakfast': 'Morgenmad',
        'campaign.marker.eatLunch': 'Frokost',
        'campaign.marker.eatDinner': 'Aftensmad',
        'campaign.marker.bolusBeforeMeal': 'Bolus før mad',
        'campaign.marker.tryLowCarb': 'Prøv low carb',

        // Tutorial tips (first time only)
        'tutorial.level1.openDock': 'Tryk på sprøjte-ikonet i bunden for at åbne insulin-panelet',
        'tutorial.level1.speedUp': 'Brug ◀ ▶ knapperne til at ændre spilhastigheden. Du kan også bruge piletasterne på tastatur.',
        'tutorial.level2.dawn': 'Dawn-effekten er aktiv: Morgenens stresshormoner kan hæve blodsukkeret uden mad.',
        'tutorial.level3.openFood': 'Tryk på mad-ikonet i bunden, og vælg {characterName}s første måltid.',

        // In-game tips (campaign)
        'campaign.level1.tip.noBasal': 'Uden basalinsulin kan blodsukkeret stige langsomt gennem dagen.',
        'campaign.level1.tip.moreInfoIcons': 'De små runde info-ikoner åbner mere uddybende forklaringer, når du vil vide mere.',
        'campaign.level1.tip.bgRising': 'Blodsukker er højt, og der er stadig ikke givet basal-insulin.',
        'campaign.level1.tip.useRapid': 'Blodsukkeret er over målzonen. Hurtiginsulin virker gradvist over de næste 1-2 timer.',
        'campaign.level1.tip.ketoneSymptoms': 'Insulinmangel kan få både blodsukker og ketoner til at stige.',
        'campaign.level1.tip.ketoneMeasure': 'Ketonmåling giver ekstra information, når blodsukkeret har været højt i flere timer.',
        'campaign.level1.tip.ketoneHigh': 'Forhøjet ketonmåling peger på insulinmangel.',
        'campaign.level1.tip.splitDose': 'En delt basaldosis giver en anden døgnkurve end én samlet dosis.',
        'campaign.level1.tip.basalOnset': 'Efter en basal-dosis går der ca. 2-4 timer, før virkningen er fuldt oppe.',
        'campaign.level1.tip.basalDuration': 'Basal-insulin varer typisk 22-32 timer, så timing betyder noget.',
        'campaign.level1.tip.physiologyMode': 'Fysiologi-visning giver adgang til viden, man normalt ikke har i den virkelige verden.',
        'campaign.level2.tip.rememberBasal': 'Der er endnu ikke givet basalinsulin i denne bane.',
        'campaign.level2.tip.dawn': 'Hvis blodsukker stiger om morgenen uden mad, kan det være dawn-effekten.',
        'campaign.level2.tip.isfIntro': 'ISF viser cirka, hvor meget 1 E hurtiginsulin sænker blodsukkeret i dette scenarie.',
        'campaign.level2.tip.isfVaries': 'ISF varierer over dagen og påvirkes blandt andet af stress, søvn og aktivitet.',
        'campaign.level2.tip.isfSleep': 'Efter dårlig søvn kan samme insulindosis virke svagere i modellen.',
        'campaign.level2.tip.onsetUncertainty': 'Dawn-effekten kan starte og toppe lidt forskelligt fra dag til dag.',
        'debug.unlockAllLevels': 'Lås alle baner op',
        'debug.unlockAllLevels.help': 'Giver adgang til alle kampagnebaner uanset fremskridt.',
        'campaign.level3.tip.icr': 'Udforsk, hvordan forskellige mængder kulhydrat og hurtiginsulin ændrer blodsukkerkurven.',
        'campaign.level3.tip.bolusTiming': 'Hurtiginsulin før og efter samme snack giver forskellige blodsukkerkurver.',
        'campaign.level3.tip.postmeal': 'Kulhydrat hæver blodsukkeret hurtigt; hurtiginsulin påvirker kurven gradvist over de næste timer.',

        'campaign.level4.tip.lowcarbIntro': 'Low carb-mad har færre kulhydrater og giver ofte en mindre og langsommere blodsukkerstigning.',
        'campaign.level4.tip.protein': 'Protein kan hæve blodsukker langsomt, ofte først tydeligt efter 2-4 timer.',
        'campaign.level4.tip.fatDelay': 'Fedt kan forsinke mavetømningen og forlænge blodsukkerstigningen efter måltidet.',
        'campaign.level4.tip.timescale': 'Kunstig insulin virker relativt langsomt — derfor er det nemmere at tilpasse til de langsomme ændringer ved low carb.',
        'campaign.level4.tip.lowBgDelay': 'Et low carb-måltid hæver blodsukkeret langsomt, når udgangspunktet er lavt.',
        'campaign.level4.tip.splitDose': 'Én samlet og to delte doser giver forskellige insulinprofiler.',
        'campaign.level4.tip.physiologyMode': 'Prøv eventuelt Fysiologi-visning for at følge aktiv insulin og kulhydratoptag på grafen.',

        'campaign.tip.basalLow': '{characterName}s blodsukker begynder at stige. Sidste basaldosis var for {hoursSinceBasal} timer siden.',

        // Global in-game tips (all modes)
        'tips.moreInfoIcons': 'Runde info-ikoner betyder mere forklaring. Tryk på dem for at åbne spilguiden ved det relevante afsnit.',
        'tips.foodNoBolus': 'Måltidet blev givet uden bolus. Kulhydraterne er allerede under optagelse.',
        'tips.symptomHypo': 'Sved, rysten og hjertebanken kan følge lavt blodsukker. Giv {characterName} hurtigt sukker i spillet.',
        'tips.symptomHyper': 'Tørst og hyppig vandladning kan følge højt blodsukker hos {characterName}.',
        'tips.symptomKetone': 'Kvalme og mavesmerter kan følge stigende ketoner og syrebelastning hos {characterName}.',
        'tips.symptomVfxSlowDown': 'Slør eller tunnelsyn er et visuelt symptom hos {characterName}. Pause spillet, og se på kurven.',
        'tips.symptomEnergyDeficit': 'Sult, svaghed og hovedpine kan følge energiunderskud hos {characterName}.',
        'tips.symptomIllness': 'Ondt i halsen, nys og træthed viser, at {characterName} er syg.',
        'tips.symptomMultiple': 'Det samme symptom kan have flere årsager. Sammenlign {characterName}s kurve med de seneste hændelser.',
        'tips.dawnEffect': 'Blodsukker stiger om morgenen — det er dawn-effekten pga. stresshormoner',
        'tips.nightAction': 'Handlinger om natten afbryder søvnen og kan øge stresshormonerne næste dag.',
        'tips.speedControl': 'Brug hastighedsknapperne til at skrue op og ned. På tastatur kan du bruge piletasterne.',
        'tips.pauseButton': 'Pause-knappen stopper simulationen. På tastatur kan du bruge mellemrum.',
        'tips.keyboardRapidInsulin': 'På PC kan du trykke ½ eller 1-9 for at give hurtiginsulin direkte.',
        'tips.keyboardDextrose': 'På PC kan du trykke V to gange for at tage druesukker fra T1D-kittet.',
        'tips.physiologySuggestion': 'Fysiologi-visning kan vise insulin, kulhydrater og eISF direkte på grafen.',
        'tips.physiologyEisf': 'eISF-linjen viser modellens effektive insulinfølsomhed gennem dagen.',
        'tips.musicSettings': 'Slå musik fra eller til under Settings i top-baren',
        'tips.tipsOff': 'Disse tips kan slås fra under Settings i top-baren',
        'tips.ringAfterInsulin': 'Ringen omkring et eventikon markerer den næste time på grafen.',
        'tips.ringAfterFood': 'Ringen omkring et eventikon markerer den næste time på grafen.',
        'tips.experiment': 'Prøv at ændre én ting ad gangen. Så er det lettere at se, hvad der ændrer blodsukkeret.',
        'tips.pointsBonus': 'Du optjener points, når blodsukker ligger mellem {low} og {high} {unit}. Mellem {bonusLow} og {bonusHigh} {unit} får du 2x points.',
        'tips.pointsZero': 'Blodsukker mellem {halfLow} og {halfHigh} {unit} er for højt og giver kun 1/2 points.',
        'tips.pointsHypoZero': 'Blodsukker under {floor} {unit} er farligt lavt og giver derfor ingen points.',
        'tips.starsTir': 'TIR på mindst 70% giver bonus-points ved dagens eller banens afslutning.',
        'tips.cgmDelay': 'CGM viser et forsinket estimat; der kan gå 5-15 min, før ændringer ses.',
        'tips.fingerprick': 'En fingerprik viser {characterName}s aktuelle blodsukker uden CGM-forsinkelse.',
        'tips.variabilityRapidInsulin': 'Samme dosis hurtiginsulin kan optages lidt hurtigere eller langsommere fra gang til gang.',
        'tips.variabilityBasal': 'Basalinsulin varer ikke præcist lige længe hver gang; i simulatoren kan virkningen strække sig over ca. 22-38 timer.',
        'tips.variabilityDawn': 'Dawn-effekten kan starte og toppe lidt forskelligt fra dag til dag, især efter dårlig søvn.',
        'tips.variabilityCgm': 'CGM er et forsinket estimat, så fingerprik og CGM kan vise lidt forskellige tal.',
        'tips.variabilityFood': 'Fedt, fiber, væske/fast føde og maveindhold ændrer hvor hurtigt blodsukker stiger efter mad.',
        'tips.variabilityMotion': 'Motion påvirker blodsukkeret forskelligt alt efter type, intensitet og aktiv insulin.',

        // --- Highscore tabs ---
        'highscore.tab.sandbox': 'Sandkasse',
        'highscore.tab.boxchallenge': 'Box Challenge',
        'highscore.tab.campaign': 'Kampagne',

        // --- Debug panel ---
        'debug.title': 'Debug',
        'debug.trueBG': 'Sandt blodsukker',
        'debug.csvLog': 'CSV log',
        'debug.ready': 'Klar',
        'debug.rows': 'rækker',
        'debug.clearAll': 'Ryd al lokal data',
        'debug.clearAll.title': 'Ryd alle gemte data (profil, highscores, indstillinger og infobekræftelse)',
        'debug.clearAll.confirm': 'Er du sikker? Dette sletter din profil, highscores, indstillinger og bekræftelsen af informationen om simulatoren. Siden genindlæses.',

        // --- Event log ---
        'log.noEvents': 'Ingen hændelser endnu',
        'log.now': 'nu',
        'log.food': 'Mad: {carbs}g K, {protein}g P, {fat}g F',
        'log.stomachFull': 'Maven er fuld — vent til der er plads',
        'log.fastInsulin': 'Hurtig insulin: {dose}E',
        'log.basalInsulin': 'Basal insulin: {dose}E',
        'log.fingerprick': 'Fingerprik: {value} {unit}',
        'log.ketoneTest': 'Keton-stik: {value} {unit} — {status}',
        'log.glucagon': 'Glukagon brugt! Blodsukker stiger hurtigt.',
        'log.activityStart': 'Aktivitet: {name} ({intensity}){duration}{kcal}',
        'log.activityEnd': 'Aktivitet slut: {name} ({intensity}), {duration} min, {kcal} kcal',
        'log.exerciseMaxDuration': '⏱️ Motion stoppet automatisk efter 4 timer — {characterName} har brug for hvile.',
        'log.exerciseCooldown': '⏳ {characterName} har brug for hvile — prøv igen om {min} min.',
        'log.acuteStress': 'Akut stresshormon-stigning: +{amount} (fx adrenalin/glukagon)',
        'log.chronicStress': 'Kronisk stressniveau øget: +{amount} (fx kortisol ved sygdom)',
        'log.cgmCompression': 'CGM-kompression: sensoren viser midlertidigt for lavt.',
        'log.cgmSensorLost': 'CGM-sensoren er faldet af. Ingen nye CGM-tal før ny sensor og warmup.',
        'log.cgmSelfTest': 'CGM fejltester signalet. Brug fingerprik ved behov.',
        'log.sleepStart': '🌙 {characterName} går i seng.',
        'log.goodSleep': '☀️ {characterName} er frisk efter en uforstyrret nat.',
        'log.sleepDisruption': '{characterName}s søvn blev afbrudt. Omkring {hours} times søvn gik tabt.',
        'log.sleepDebt': '☀️ {characterName} har mistet {hours} timers søvn og er mere insulinresistent i dag.',

        // --- Graph messages ---
        'graph.sleepLoss': 'zZzz... -{hours}t søvn',
        'graph.yAxisLabel': 'Blodsukker ({unit})',
        'graph.now': 'NU',
        'cgm.status.offline': 'sensor',
        'cgm.status.warmup': 'warmup',
        'cgm.status.checking': 'tjekker',
        'label.cgmSensorLost': 'CGM faldt af',
        'label.cgmSelfTest': 'CGM tjekker',
        'label.illnessStarts': 'syg',
        'symptom.illness.throat': 'ondt i halsen',
        'symptom.illness.headache': 'hovedpine',
        'symptom.illness.tired': 'træthed',
        'symptom.illness.sneeze': 'nyser',

        // --- Ketone status ---
        'ketone.ok': 'OK',
        'ketone.elevated': 'Forhøjet',
        'ketone.high': 'Høj!',
        'ketone.critical': 'KRITISK!',

        // --- Game over ---
        'game.over.title': 'Game Over',
        'game.over.pointsLabel': 'Points',
        'game.over.saveLabel': 'Gem din score:',
        'game.over.namePlaceholder': 'Dit navn',
        'game.over.saveBtn': 'Gem',
        'game.over.savedBtn': 'Gemt',
        'game.over.savedRank': 'Gemt! Du er nr. {rank} på highscore-listen.',
        'game.over.saved': 'Gemt!',
        'game.over.whatHappened': 'Hvad skete der?',
        'game.over.howToAvoid': 'Sådan undgår du det næste gang',
        'game.over.tryAgain': 'Prøv igen',
        'game.over.viewGraph': 'Se grafen',
        'game.over.physiologyTip': 'Tip: Slå Fysiologi-visningen til for at se insulin, kulhydrater, ISF og blodsukkerkræfter direkte på grafen, mens du øver banen.',
        'campaign.failed.physiologyTip': 'Tip: Slå Fysiologi-visningen til for at se insulin, kulhydrater, ISF og blodsukkerkræfter direkte på grafen, mens du øver banen.',

        // --- Game over causes ---
        'game.over.hypo.name': 'Svær Hypoglykæmi',
        'game.over.hypo.cause': 'Blodsukker kritisk lavt for længe (blodsukker {bg} {unit}).<br>Hjernens energireserver er opbrugt.',
        'game.over.hypo.explanation': 'Hjernen har kun et lille glukose-lager (~4g). Under ~{threshold} {unit} begynder den at mangle energi — først forvirring, så kramper og bevidstløshed.',
        'game.over.hypo.tip1': 'Giv {characterName} druesukker eller juice ved første tegn på lavt blodsukker',
        'game.over.hypo.tip2': 'Reagér på {characterName}s faldende CGM-kurve, før blodsukkeret når {threshold} {unit}',
        'game.over.hypo.tip3': 'Motion kan forstærke insulinvirkningen — sammenlign aktiv insulin og mad før træning',
        'game.over.hypo.tip4': 'Giv {characterName} glukagon ved svær hypo i spillet',
        'brain.deficit.warning.title': 'Hjerne-energimangel!',
        'brain.deficit.warning.message': '{characterName}s blodsukker har været meget lavt i længere tid, og hjernen mangler energi.<br><br>Giv {characterName} druesukker, juice eller glukagon med det samme.',

        'game.over.weight.name': 'Ekstrem Vægtændring',
        'game.over.weight.cause': '{characterName}s vægt ændrede sig {weight} kg. Grænsen er ca. 7% af startvægten — svarende til {limit} kg / {limitKcal} kcal.',
        'game.over.weight.explanation': 'Alvorlig ubalance mellem kalorier ind og ud. Kan skyldes insulinmangel (kroppen nedbryder fedt/muskler) eller overernæring.',
        'game.over.weight.tip1': 'Giv {characterName} regelmæssige og tilstrækkelige måltider',
        'game.over.weight.tip2': 'Hold øje med kaloriebalancen i statistikken',
        'game.over.weight.tip3': 'Uden basalinsulin begynder {characterName}s krop at nedbryde fedt og muskelvæv',

        'game.over.dka.name': 'Diabetisk Ketoacidose (DKA)',
        'game.over.dka.cause': 'Ketonmåling: {ketones} mmol/L<br>— meget forhøjet.',
        'game.over.dka.explanation': 'Når kroppen mangler insulin, kan ketonerne stige og gøre blodet surt.',
        'game.over.dka.tip1': 'Mål {characterName}s ketoner, hvis blodsukkeret har været højt i flere timer',
        'game.over.dka.tip2': 'Kvalme og mavesmerter sammen med højt blodsukker og hyppig vandladning kan være tegn på DKA',
        'game.over.dka.tip3': 'DKA kan opstå, når {characterName} mangler insulin. Husk at give {characterName} basalinsulin',
        'game.over.dka.tip4': 'Mål {characterName}s ketoner igen senere, og se, om de stiger eller falder',

        'game.over.complications.name': 'Sendiabetiske Komplikationer',
        'game.over.complications.cause': 'Gennemsnitligt blodsukker de sidste 7 dage: {avg} {unit}.',
        'game.over.complications.explanation': 'Vedvarende højt blodsukker skader blodkar og nerver → blindhed, nyresvigt, nerveskader, hjerte-kar-sygdom.',
        'game.over.complications.tip1': 'Se på kurven, og find de perioder, der trak {characterName}s gennemsnit op',
        'game.over.complications.tip2': 'Spil igen, og ændr én ting ad gangen',
        'game.over.complications.tip3': 'Basalinsulin påvirker udviklingen mellem måltiderne',
        'game.over.complications.tip4': 'Hurtiginsulin påvirker stigningen efter måltiderne',

        // --- Symptom texts (subtle overlays on the graph) ---
        // Hypoglycaemia (BG < 4.0) — progressive autonomic + neuroglycopenic symptoms
        'symptom.hypo.sweat': 'svedtendens',
        'symptom.hypo.heartbeat': 'hjertebanken',
        'symptom.hypo.tremor': 'rysten',
        'symptom.hypo.dizziness': 'svimmelhed',
        'symptom.hypo.confusion': 'forvirring',
        'symptom.hypo.blurredVision': 'sløret syn',
        'symptom.hypo.seizures': 'kramper',
        // DKA / ketoacidosis — progressive symptoms based on acidosis load
        'symptom.dka.thirst': 'tørst',
        'symptom.dka.urination': 'hyppig vandladning',
        'symptom.dka.fatigue': 'træthed',
        'symptom.dka.nausea': 'kvalme',
        'symptom.dka.stomachPain': 'mavesmerter',
        'symptom.dka.acetone': 'acetonlugt',
        'symptom.dka.vomiting': 'opkastning',
        'symptom.dka.kussmaul': 'dyb, hurtig vejrtrækning',
        'symptom.dka.confusion': 'forvirring',
        // Hyperglycaemia (BG > 14) — osmotic symptoms
        'symptom.hyper.thirst': 'tørst',
        'symptom.hyper.urination': 'hyppig vandladning',
        'symptom.hyper.fatigue': 'træthed',
        'symptom.hyper.blurred': 'sløret syn',
        'symptom.hyper.dryMouth': 'mundtørhed',
        'symptom.hyper.nausea': 'kvalme',
        // Hunger (caloric deficit / weight loss)
        'symptom.hunger.hungry':       'sult',
        'symptom.hunger.weakness':     'svaghed',
        'symptom.hunger.irritability': 'irritabilitet',
        'symptom.hunger.headache':     'hovedpine',

        // --- Formål og afgrænsning ved første spilstart ---
        'disclaimer.title': 'Om simulatoren',
        'disclaimer.text': 'T1D Simulator er et <strong>læringsspil om, hvad der påvirker blodsukkeret</strong>. Du hjælper faste, fiktive karakterer.<br><br>Spillet beregner ikke insulindoser til virkelige personer og er ikke beregnet som grundlag for behandling.',
        'disclaimer.accept': 'Forstået',

        // --- Welcome and guided tour ---
        'welcomeTour.aria.welcome': 'Velkomstpopup',
        'welcomeTour.eyebrow': 'Velkommen',
        'welcomeTour.title': 'Velkommen til T1D Simulator',
        'welcomeTour.lead': 'Udforsk blodsukker gennem faste, fiktive karakterer.',
        'welcomeTour.recommended': 'Anbefalet første gang',
        'welcomeTour.choice.tour.title': 'T1D Intro Tour',
        'welcomeTour.choice.tour.copy': 'En gennemgang af simulatoren: grafen, blodsukkertallet og knapperne til insulin, mad, aktivitet og T1D Kit.',
        'welcomeTour.choice.campaign.title': 'Start første læringsbane',
        'welcomeTour.choice.campaign.copy': 'I kampagnen lærer du gradvist om nye diabetes-emner: basal, mad, insulin, aktivitet og CGM.',
        'welcomeTour.showOnStartup': 'Vis denne velkomst ved opstart',
        'welcomeTour.notNow': 'Ikke nu',
        'welcomeTour.group.navigation': 'Navigation',
        'welcomeTour.group.speech': 'Tale',
        'welcomeTour.autoPlay': 'Auto-frem',
        'welcomeTour.autoPlayOn': 'Auto-frem er slået TIL',
        'welcomeTour.autoPlayOff': 'Auto-frem er slået FRA',
        'welcomeTour.sound': 'Tale',
        'welcomeTour.soundOn': 'Tale er slået TIL',
        'welcomeTour.soundOff': 'Tale er slået FRA',
        'welcomeTour.pauseSpeech': 'Pause',
        'welcomeTour.resumeSpeech': 'Fortsæt',
        'welcomeTour.replay': 'Gentag',
        'welcomeTour.replayUnavailable': 'Slå tale til for at gentage trinnet',
        'welcomeTour.replayNoAudio': 'Der er ikke tale til dette trin endnu',
        'welcomeTour.skip': 'Afslut tur',
        'welcomeTour.back': 'Tilbage',
        'welcomeTour.next': 'Frem',
        'welcomeTour.done': 'Færdig',
        'welcomeTour.progress': '{current} af {total}',
        'welcomeTour.graphMarker.range': 'Målzone',
        'welcomeTour.graphMarker.pointsBonus': '2x points/time',
        'welcomeTour.graphMarker.pointsOne': '1x points/time',
        'welcomeTour.graphMarker.pointsHalf': '½x points/time',
        'welcomeTour.graphMarker.night': 'Nat',
        'welcomeTour.graphMarker.day': 'Dag',
        'welcomeTour.tipDemo.text': '{characterName}s blodsukker er lavt. En hurtig snack kan hæve det.',
        'welcomeTour.tipDemo.link': 'Åbn spilguiden',
        'welcomeTour.step.overview.title': 'Velkommen til T1D Simulator',
        'welcomeTour.step.overview.text': 'T1D Simulator er et læringsspil om blodsukker. Du hjælper fiktive karakterer og ser, hvordan mad, insulin, aktivitet, søvn og stress påvirker deres blodsukker.\n\nPrøv forskellige valg, se hvad der sker, og prøv igen.',
        'welcomeTour.step.graph.title': 'Grafen',
        'welcomeTour.step.graph.text': 'De grønne prikker er {characterName}s CGM-målinger over tid. Farvebåndene viser, hvor hurtigt du optjener points:\n\n- 2x i bonuszonen\n- 1x i målzonen\n- ½x ved moderat forhøjet blodsukker',
        'welcomeTour.step.graphDayNight.title': 'Dag og nat',
        'welcomeTour.step.graphDayNight.text': 'Grafen viser et døgn fra 00 til 24. Mørke felter er nat, og det lysere felt er dag.',
        'welcomeTour.step.cgm.title': 'Blodsukkertallet',
        'welcomeTour.step.cgm.text': 'Når simulationen kører, vises {characterName}s aktuelle CGM-værdi her. Pilen viser, om værdien er på vej op, ned eller ligger stabilt. CGM-målingen er forsinket 5-10 minutter i forhold til det faktiske blodsukker.\n\nIOB betyder aktiv insulin: hurtiginsulin fra tidligere doser, som stadig virker.',
        'welcomeTour.step.insulin.title': 'Insulin',
        'welcomeTour.step.insulin.text': 'Insulin-ikonet nederst åbner insulinpanelet. Her giver du {characterName} basal- og hurtiginsulin.',
        'welcomeTour.step.basal.title': 'Basal-insulin',
        'welcomeTour.step.basal.text': 'Basalinsulin dækker {characterName}s grundbehov over mange timer. Vurdér dosis ud fra rolige perioder, for eksempel om natten eller flere timer efter mad og hurtiginsulin.\n\nBasal kan gives som én daglig dosis eller fordeles på to doser.',
        'welcomeTour.step.fast.title': 'Hurtig insulin',
        'welcomeTour.step.fast.text': 'Hurtiginsulin bruges til måltider og korrektioner. Det begynder at blive optaget efter cirka 10-20 minutter, men den synlige effekt på blodsukkeret kommer ofte senere - typisk efter 30-45 minutter, og endnu senere på CGM fordi CGM halter efter det faktiske blodsukker.\n\nEffekten er som regel stærkest efter 1-2 timer og kan fortsætte i 3-5 timer. IOB betyder insulin on board: hurtiginsulin fra tidligere doser, som stadig har virkning tilbage.',
        'welcomeTour.step.food.title': 'Mad',
        'welcomeTour.step.food.text': 'Mad-ikonet nederst åbner madpanelet. Vi gennemgår de tre faste rækker fra mest almindelig til mindst almindelig: hurtige kulhydrater, måltider og lav-kulhydrat.',
        'welcomeTour.step.foodMeals.title': 'Måltider',
        'welcomeTour.step.foodMeals.text': 'Midterste række er hele måltider som pasta, pizza og burger. De hæver blodsukkeret langsommere end ren sukker, og typen af kulhydrat styrer farten. Fedt kan forsinke toppen — det er pizza-effekten.',
        'welcomeTour.step.foodLowCarb.title': 'Lav-kulhydrat',
        'welcomeTour.step.foodLowCarb.text': 'Øverste række er lav-kulhydrat som æg, nødder, salat og bøf. De giver typisk en mindre og langsommere blodsukkerstigning end kulhydratrige måltider, fordi der er få kulhydrater. Protein og fedt kan stadig give en senere stigning, og fedt kan sænke insulinfølsomheden i nogle timer.\n\nI simulatoren kan den langsommere effekt være lettere at matche med hurtiginsulin, fordi injiceret insulin virker langsommere end kroppens egen insulinfrigivelse.',
        'welcomeTour.step.foodSugars.title': 'Hurtige kulhydrater',
        'welcomeTour.step.foodSugars.text': 'Nederste række er druesukker, juice, cola og slik, som virker hurtigt og kan bruges til at rette et lavt blodsukker op. Banan og chokolade indeholder også kulhydrat, men virker langsommere end ren druesukker eller juice.',
        'welcomeTour.step.activityOverview.title': 'Aktivitet',
        'welcomeTour.step.activityOverview.text': 'Aktivitets-ikonet nederst åbner aktivitetspanelet. Tryk på det for at planlægge motion.',
        'welcomeTour.step.activity.title': 'Aktivitet',
        'welcomeTour.step.activity.text': 'Vælg først aktivitetstype og intensitet. Cardio bruger musklerne jævnt og sænker ofte blodsukker, især hvis der er aktiv hurtiginsulin. Styrke eller høj intensitet kan først hæve blodsukker kortvarigt, fordi stresshormoner frigiver glukose, men bagefter kan insulinfølsomheden stadig være højere.\n\nNederst vælger du varighed. Når du trykker 15 min, 30 min, 60 min eller Åben, starter aktiviteten med de valg du har sat.',
        'welcomeTour.step.kitOverview.title': 'T1D Kit',
        'welcomeTour.step.kitOverview.text': 'T1D Kit-ikonet nederst åbner måleudstyr, druesukker og glukagon.',
        'welcomeTour.step.kit.title': 'T1D Kit',
        'welcomeTour.step.kit.text': 'Fingerprik viser {characterName}s aktuelle blodsukker uden CGM-forsinkelse.\n\nKeton-stik måler ketoner. Ketoner kan stige, når kroppen mangler insulin og i stedet nedbryder fedt.\n\nDruesukker hæver blodsukkeret hurtigt. Glukagon kan bruges ved svær hypo i spillet.',
        'welcomeTour.step.time.title': 'Tiden',
        'welcomeTour.step.time.text': 'Øverst ser du dag og klokkeslæt. Simulatoren kører videre af sig selv, så du kan følge hvordan blodsukker ændrer sig gennem døgnet.',
        'welcomeTour.step.timeControls.title': 'Tidskontrol',
        'welcomeTour.step.timeControls.text': 'Midterknappen sætter spillet på pause og starter det igen. Pilene ændrer tempoet: 1, 4, 12 eller 24 simulerede timer per minut. Brug lavt tempo eller pause, når du skal vælge handlinger. Brug højt tempo, når der ikke sker så meget, for eksempel når {characterName} sover.',
        'welcomeTour.step.physiology.title': 'Fysiologi-visning',
        'welcomeTour.step.physiology.text': 'Fysiologi-knappen slår ekstra grafer og information til. De hjælper dig med at se og lære, hvad der sker inde i kroppen, og hvilke fænomener der får blodsukkeret til at stige eller falde. Du kan blandt andet følge aktuel insulinvirkning, kulhydratoptag, og hvordan kroppens følsomhed for insulin ændrer sig. Highscores gemmes ikke, mens fysiologi-visningen er slået til.',
        'welcomeTour.step.settings.title': 'Settings',
        'welcomeTour.step.settings.text': 'Settings-knappen åbner indstillingerne. Her kan du skifte blodsukker-enhed, slå bane-tips og generelle tips til eller fra, og styre lyd, musik og visning.',
        'welcomeTour.step.learn.title': 'Lær mere undervejs',
        'welcomeTour.step.learn.text': 'Mens du spiller, dukker der tips op her med små råd. Under hvert tip sidder et lille ikon — tryk på det for at åbne spilguiden på lige det emne. Hjælp-knappen øverst er der også altid.',
        'welcomeTour.step.ready.title': 'Klar',
        'welcomeTour.step.ready.text': 'Det var rundturen. Et godt næste skridt er at starte en kampagne, hvor værktøjerne låses op gradvist, mens du lærer hvordan de påvirker blodsukker. Du kan åbne rundturen igen fra Hjælp.',

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
        'highscore.col.character': 'Karakter',
        'highscore.col.points': 'Points',
        'highscore.col.day': 'Dag',
        'highscore.col.gameOver': 'Game Over',
        'highscore.col.date': 'Dato',
        'highscore.close': 'Luk',
        'highscore.clearAll': 'Slet alle scores',
        'highscore.confirmClear': 'Slet alle highscores?',

        // --- Profile popup ---
        'profile.readonlyNotice': 'Karakteren kan ikke ændres mens du spiller. Afslut banen eller gå til hovedmenuen for at vælge en anden karakter.',
        'profile.name.placeholder': 'Dit navn',
        'profile.restingKcal': 'Hvileforbrug',
        'profile.save': 'Gem',
        'profile.reset': 'Default',
        'profile.character': 'Vælg karakter',
        'archetype.child.name': 'Barn',
        'archetype.child.desc': 'Let, insulinfølsom krop',
        'archetype.adult.name': 'Voksen',
        'archetype.adult.desc': 'Standard voksen',
        'archetype.large.name': 'Kraftig voksen',
        'archetype.large.desc': 'Større krop, mindre følsom',
        // Short column headers for the character picker (the three body-type columns).
        'character.col.child': 'Barn',
        'character.col.adult': 'Voksen',
        'character.col.large': 'Kraftig',

        // --- Mobile shell (mobile/) — strings unique to the phone UI ---
        'm.speed.60': '1t/min', 'm.speed.240': '4t/min', 'm.speed.720': '12t/min', 'm.speed.1440': '24t/min', 'm.speed.pause': 'Pause',
        'm.graph.timeAxis': 'Tid (kl.)',
        'm.tip.welcome': 'Følg kurven, og afprøv, hvordan mad, insulin og aktivitet påvirker blodsukkeret hos {characterName}.',
        'm.ob.1.title': 'Velkommen!',
        'm.ob.1.body': 'Her hjælper du {characterName} og ser, hvordan insulin, mad og aktivitet påvirker blodsukkeret. Du kan lære og udforske i dit eget tempo.',
        'm.ob.2.title': 'Sådan spiller du',
        'm.ob.2.body': 'Brug knapperne nederst til at give {characterName} insulin og mad, vælge aktivitet og bruge T1D-kittet. Målet er at holde blodsukkeret i den grønne zone (4–10 mmol/L).',
        'm.ob.3.title': 'Du bestemmer tempoet',
        'm.ob.3.body': 'Tiden går hurtigt — skru op og ned for farten nederst. Se, hvordan mad og insulin ændrer {characterName}s blodsukker.',
        'm.ob.next': 'Næste', 'm.ob.start': 'Kom i gang', 'm.ob.skip': 'Spring over',
        // Start screen (mobile landing) — warm, learning-framed welcome shown on load.
        'm.start.title': 'Velkommen',
        'm.start.intro': 'Udforsk, hvordan mad, insulin, aktivitet, søvn og stress påvirker blodsukkeret hos spillets karakterer.',
        'm.start.benefit1': 'Motiverende læring i dit eget tempo',
        'm.start.benefit2': 'Feedback med det samme',
        'm.start.benefit3': 'Interaktiv udforskning med hurtig feedback',
        'm.start.benefit4': 'Forstå fysiologien bag kurven',
        'm.start.skip': 'Luk velkomst menu',
        'm.start.showWelcome': 'Vis velkomst ved opstart',
        'm.tip.close': 'Luk tip', 'm.aria.slower': 'Langsommere', 'm.aria.faster': 'Hurtigere', 'm.aria.menu': 'Menu',
        'm.badge.day': 'Dag', 'm.mode.sandbox': 'Sandkasse',
        'm.pill.points': 'Point', 'm.pill.avg': 'BSgns',
        'm.dock.insulin': 'Insulin', 'm.dock.food': 'Mad', 'm.dock.activity': 'Aktivitet', 'm.dock.kit': 'T1D Kit',
        'm.sheet.insulin': 'Giv insulin', 'm.sheet.food': 'Giv mad', 'm.sheet.activity': 'Aktivitet', 'm.sheet.kit': 'T1D Kit', 'm.sheet.profile': 'Karakter', 'm.sheet.settings': 'Indstillinger', 'm.menu.title': 'Menu',
        'm.insulin.basalLabel': 'Basal', 'm.insulin.tryScenarioWith': 'Afprøv i scenariet med', 'm.insulin.fastLabel': 'Hurtig', 'm.insulin.fastHint': 'Bolus dækker måltidernes kulhydrater', 'm.unit.ePerDay': 'E/dag',
        'm.food.pickCategory': 'Vælg en kategori.',
        'm.food.cat.lowCarb': 'Lav-kulhydrat', 'm.food.cat.lowCarb.ex': 'æg, salat, nødder…',
        'm.food.cat.meals': 'Måltider', 'm.food.cat.meals.ex': 'pasta, pizza, burger…',
        'm.food.cat.fast': 'Hurtige kulhydrater', 'm.food.cat.fast.ex': 'druesukker, juice, slik…',
        'm.food.recent': 'Sidste valgte', 'm.food.recent.empty': 'Ingen endnu',
        'm.activity.type': 'Type', 'm.activity.intensity': 'Intensitet', 'm.activity.duration': 'Tid', 'm.activity.open': 'Åben', 'm.activity.running': '{type} · {intensity} kører.', 'm.activity.stop': 'Stop aktivitet',
        'm.kit.hint': 'Måling øverst · nødhjælp nederst.', 'm.kit.fingerprick': 'Fingerprik', 'm.kit.ketone': 'Keton-test', 'm.kit.glucagon': 'Glukagon', 'm.kit.dextro': 'Druesukker',
        'm.kit.ready': 'nu', 'm.kit.cooldown': '{name} klar om {time}', 'm.unit.min': 'min', 'm.unit.hour': 't', 'm.unit.minShort': 'm',
        'm.toast.linkCopied': 'Link kopieret',
        'm.menu.profile.help': 'Vælg hvilken karakter du hjælper.', 'm.menu.highscore.help': 'Dine bedste resultater fra kampagnen.', 'm.highscore.subCampaign': 'Din bedste score for hver bane.', 'm.menu.share': 'Del link', 'm.menu.share.help': 'Del linket til spillet — det åbner den rette version på enhver enhed.', 'm.menu.desktop': 'Skift til desktop-version', 'm.menu.desktop.help': 'Åbn den fulde version her på enheden.',
        'm.disclaimer.title': 'Om simulatoren', 'm.disclaimer.body': 'T1D Simulator er et læringsspil om, hvad der påvirker blodsukkeret. Du hjælper faste, fiktive karakterer. Spillet beregner ikke insulindoser til virkelige personer og er ikke beregnet som grundlag for behandling.', 'm.disclaimer.ok': 'Forstået',
        'm.profile.title': 'Karakter', 'm.profile.intro': 'Ændringer starter forfra med den valgte karakter.',
        'm.settings.display': 'Visning', 'm.settings.fullscreen': 'Fuld skærm', 'm.settings.fullscreen.help': 'Skjul browserens kanter.', 'm.settings.physiology': 'Fysiologi', 'm.settings.physiology.help': 'Vis insulin, kulhydrater, eISF og ketoner på grafen.', 'm.physiology.watermark': 'Fysiologi', 'm.settings.showWelcome': 'Velkomstskærm', 'm.settings.showWelcome.help': 'Vis velkomst-skærmen når appen åbnes.', 'm.settings.bgUnit': 'Blodsukkerenhed', 'm.settings.bgUnit.help': 'Skift mellem mmol/L og mg/dL.', 'm.settings.lang': 'Sprog', 'm.settings.lang.help': 'Skift mellem dansk og engelsk.', 'm.settings.sound': 'Lyd', 'm.settings.sfx': 'Lydeffekter', 'm.settings.sfx.help': 'Lyde ved handlinger og hændelser.', 'm.settings.cgm': 'CGM-lyde', 'm.settings.cgm.help': 'Lyd ved nye målinger og advarsler.', 'm.settings.music': 'Musik', 'm.settings.data': 'Data', 'm.settings.clearHs': 'Ryd highscores', 'm.settings.clearHs.help': 'Slet dine gemte rekorder.', 'm.settings.clearHs.confirm': 'Slet alle gemte highscores? Det kan ikke fortrydes.', 'm.settings.clearHs.done': 'Highscores ryddet',
        'm.gameover.title': 'Game Over', 'm.gameover.whatHappened': 'Hvad skete der?', 'm.gameover.howToAvoid': 'Sådan undgår du det næste gang', 'm.gameover.replay': 'Spil igen',

        // --- Mobile campaign (level select, intro, objectives HUD, result screens) ---
        // Shared campaign.* keys (levelLabel, objectives, startLevel, replay, retry,
        // nextLevel, basePoints, total, encouragement, selectLevel, failed.body) are
        // reused as-is — only mobile-specific strings live under m.campaign.*.
        'm.mode.campaign': 'Kampagne',
        'm.menu.campaign': 'Kampagne', 'm.menu.campaign.help': 'Spil banerne og lær trin for trin.',
        'm.campaign.construction': 'Bygges',
        'm.campaign.locked': 'Låst',
        'm.campaign.complete': 'Bane gennemført!',
        'm.campaign.levels': '↤ Baner',

        // --- Activity type names (for log/overlay) ---
        'activity.name.cardio': 'Cardio',
        'activity.name.styrke': 'Styrketræning',
        'activity.name.blandet': 'Blandet sport',
        'activity.name.afslapning': 'Afslapning',

        // --- Log: activity formatting ---
        'log.activity.duration.fixed': ', {min} min',
        'log.activity.duration.open': ', åben',
        'log.activity.kcal': ' (~{kcal} kcal)',
    },

    // =========================================================================
    // ENGLISH — Full translation
    // =========================================================================
    en: {
        // --- Slogan ---
        'ui.slogan': 'Try. Learn. Repeat.',

        // --- Buttons ---
        'ui.btn.start': 'Start',
        'ui.btn.stop': 'End',
        'ui.btn.help': 'Help',
        'ui.btn.highscore': 'Highscore',

        // --- Top-bar tooltips ---
        'ui.title.start': 'Start a new simulation',
        'ui.title.stop': 'End the simulation and view results',
        'ui.title.profile': 'View or change character',
        'ui.title.help': 'Help and information',
        'ui.title.highscore': 'View highscore list',
        'ui.title.datetime': 'Day, time and speed',
        'ui.btn.fullscreen': 'Fullscreen',
        'ui.title.fullscreen': 'Toggle fullscreen mode',
        'ui.title.slower': 'Slower (←)',
        'ui.title.faster': 'Faster (→)',
        'ui.title.pause': 'Pause / Resume (Space)',
        'ui.title.daynight': 'Time of day',

        // --- Status badges ---
        'ui.badge.day': 'Day',
        'ui.badge.points.title': 'Points: earned by keeping blood sugar in target range',
        'ui.points.total': 'Total',
        'ui.points.today': 'Today',
        'ui.points.caption': 'points',

        // --- CGM hero ---
        'ui.iob.title': 'Insulin On Board — active insulin in the body',
        'ui.cob.title': 'Carbs On Board — carbohydrates not yet absorbed',

        // --- Steep drop warning ---
        'ui.steepDrop': '⚠ WARNING: Rapidly falling blood sugar!',

        // --- Activity overlay ---
        'ui.activity.stop': '⏹ Stop',
        'ui.activity.kcalBurned': 'kcal burned',

        // --- Stats panel ---
        'stats.toggle.title': 'Expand/collapse statistics panel',
        'stats.player.title': 'Character Profile',
        'stats.player.anonymous': 'Anonymous',
        'stats.label.name': 'Name',
        'stats.tooltip.name': 'Your player name (used for highscore)',
        'stats.label.weight': 'Weight',
        'stats.label.restingKcal': 'Resting burn',
        'stats.tooltip.weight': '{characterName}\'s body weight.',
        'stats.tooltip.restingKcal': 'Resting burn: basal calorie expenditure per day',
        'stats.section.stats': 'Statistics',
        'stats.header.today': 'Today',
        'stats.header.week': 'Week',
        'stats.label.tir': 'TIR',
        'stats.label.stdBg': 'SD blood sugar',
        'stats.label.avgCgm': 'Avg. CGM',
        'stats.label.eHbA1c': 'eHbA1c',
        'stats.label.fastInsulin': 'Rapid insulin',
        'stats.label.basalInsulin': 'Basal insulin',
        'stats.label.kcalIntake': 'Cal. intake',
        'stats.label.kcalBalance': 'Cal. balance',
        'stats.tooltip.tir': 'Time in Range: percentage of time with blood sugar between {low}-{high} {unit}',
        'stats.tooltip.stdBg': 'Standard deviation of true blood sugar — measure of glucose variability. Lower = more stable.',
        'stats.tooltip.avgCgm': 'Average CGM value over the period',
        'stats.tooltip.eHbA1c': 'Model estimate (GMI) calculated from the character\'s average CGM during the game period. Only meaningful after longer simulated time.',
        'stats.tooltip.kcalBalance': 'Energy balance: intake minus expenditure. Negative = deficit → weight loss.',
        'stats.label.weightChange': 'Weight change',
        'stats.tooltip.weightChange': 'Accumulated weight change based on calorie balance. Game over at about 7% of {characterName}\'s starting weight.',
        // Stats fragment in capsule bar
        'stats.tir': 'TIR',
        'stats.avgBg': 'Avg blood sugar',
        'stats.avgBgSub': 'avg',
        'stats.bgShort': 'BS',

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
        'ui.dock.food.title': 'Give food (X)',
        'ui.dock.activity.title': 'Activity (C)',
        'ui.dock.kit.title': 'T1D Kit (V)',

        // --- Insulin panel ---
        'insulin.basal': 'Basal',
        'insulin.fast': 'Rapid',
        'insulin.unit': 'U',
        'insulin.fastHint': 'Keys 1–9 = rapid insulin 1–9 U',

        // --- Food panel (3 rows: low-carb / meals / adjustments+fruit+snacks + custom) ---
        // Row headings
        'food.row.lowCarb': 'Low carb',
        'food.row.meals': 'Meals',
        'food.row.adjustments': 'Fast carbs',
        'food.shortcut': 'Shortcut',
        'food.portions.adult': 'adult portions',
        'food.portions.child': 'child portions',
        // Row 1 — Low carb
        'food.egg': 'Egg',
        'food.nuts': 'Nuts',
        'food.salad': 'Salad',
        'food.salmonAvocado': 'Salmon & avocado',
        'food.eggsBacon': 'Eggs & bacon',
        'food.steakBearnaise': 'Steak & bearnaise',
        // Row 2 — Meals
        'food.curry': 'Curry & rice',
        'food.cereal': 'Oatmeal',
        'food.burger': 'Burger',
        'food.pasta': 'Pasta',
        'food.pizza': 'Pizza',
        'food.cake': 'Cake',
        // Row 3 — Fast carbs
        'food.dextro': 'Dextrose',
        'food.candy': 'Candy',
        'food.juice': 'Juice',
        'food.cola': 'Cola',
        'food.banana': 'Banana',
        'food.chocolate': 'Chocolate',
        // Custom
        'food.custom': 'Custom',
        'food.eat': '🍲 Give',
        'food.label.carbs': 'Carbs',
        'food.label.protein': 'Protein',
        'food.label.fat': 'Fat',
        'food.tooltip.carbs': 'Carbohydrates raise blood sugar fastest.',
        'food.tooltip.protein': 'Protein can raise blood sugar slowly, especially in large meals.',
        'food.tooltip.fat': 'Fat delays absorption of carbohydrates and protein.',
        // Carb-type selector in custom popup
        'food.custom.carbType.label': 'Carb type',
        'food.custom.carbType.mixed': 'Mixed',
        'food.custom.carbType.mixedTitle': 'Mixed meal (default) — typical τG ~40 min',
        'food.custom.carbType.sugarSolid': 'Sugar',
        'food.custom.carbType.sugarSolidTitle': 'Pure sugar (dextrose, candy) — fast rise, τG ~25 min',
        'food.custom.carbType.sugarLiquid': 'Drink',
        'food.custom.carbType.sugarLiquidTitle': 'Sugar in drinks (cola, juice) — passes pylorus quickly, τG ~18 min',
        'food.custom.carbType.fruit': 'Fruit',
        'food.custom.carbType.fruitTitle': 'Fruit: simple sugars + skin fiber, τG ~35 min',
        'food.custom.carbType.whiteFlour': 'White flour',
        'food.custom.carbType.whiteFlourTitle': 'White flour (pasta, white bread): starch, low fiber, τG ~47 min',
        'food.custom.carbType.wholeGrain': 'Whole grain',
        'food.custom.carbType.wholeGrainTitle': 'Whole grain (rye bread, oatmeal): starch + lots of fiber, τG ~59 min',
        'food.custom.carbType.veggie': 'Veggie',
        'food.custom.carbType.veggieTitle': 'Vegetables: low carbs, very high fiber',

        // --- Activity panel ---
        'activity.section.type': 'Activity type',
        'activity.section.intensity': 'Intensity',
        'activity.section.time': 'Duration and Start',
        'activity.cardio': 'Cardio',
        'activity.strength': 'Strength',
        'activity.mixed': 'Mixed',
        'activity.relaxation': 'Relax',
        'activity.intensity.low': 'Low',
        'activity.intensity.medium': 'Medium',
        'activity.intensity.high': 'High',
        // General examples (fallback)
        'activity.examples.cardio': 'Walk, cycling, running',
        'activity.examples.styrke': 'Carrying bags, bodyweight, weightlifting',
        'activity.examples.blandet': 'Bowling, badminton, football',
        'activity.examples.afslapning': 'Breathing, yoga, tai chi',
        // Intensity-specific examples — shows that "exercise" also means everyday activities
        'activity.examples.cardio.Lav': 'Slow walk, vacuuming, light chores',
        'activity.examples.cardio.Medium': 'Brisk walk, cycling, errands',
        'activity.examples.cardio.Høj': 'Running, hard cycling, swimming',
        'activity.examples.styrke.Lav': 'Gardening, carrying bags, light lifts',
        'activity.examples.styrke.Medium': 'Bodyweight exercises, light weights, moving furniture',
        'activity.examples.styrke.Høj': 'Heavy weights, crossfit, heavy lifting',
        'activity.examples.blandet.Lav': 'Bowling, golf, slow dancing',
        'activity.examples.blandet.Medium': 'Badminton, casual football, energetic dancing',
        'activity.examples.blandet.Høj': 'Competitive football, handball match, martial arts',
        'activity.examples.afslapning.Lav': 'Meditation, deep breathing',
        'activity.examples.afslapning.Medium': 'Gentle yoga, stretching',
        'activity.examples.afslapning.Høj': 'Dynamic yoga, tai chi',
        'activity.title.cardio': 'Cardio: running, cycling, swimming — lowers blood sugar (Q)',
        'activity.title.styrke': 'Strength training: weights, crossfit — raises blood sugar acutely (W)',
        'activity.title.blandet': 'Mixed sport: football, badminton — relatively stable blood sugar (E)',
        'activity.title.afslapning': 'Relaxation: yoga, meditation — reduces stress',
        'activity.title.low': 'Low intensity (A)',
        'activity.title.medium': 'Medium intensity (S)',
        'activity.title.high': 'High intensity (D)',
        'activity.duration.15': 'Start 15 min activity (Z)',
        'activity.duration.30': 'Start 30 min activity (X)',
        'activity.duration.60': 'Start 60 min activity (C)',
        'activity.duration.open': 'Start open activity — runs until you press Stop (V)',
        'activity.duration.label.15': '15 min',
        'activity.duration.label.30': '30 min',
        'activity.duration.label.60': '60 min',
        'activity.duration.label.open': 'Open',

        // --- T1D Kit ---
        'kit.dextro': 'Dextrose',
        'kit.fingerprick': 'Fingerprick',
        'kit.ketone': 'Ketone test',
        'kit.glucagon': 'Glucagon',
        'kit.dextro.title': '3g pure glucose — fast hypo correction (12 kcal) — key V',
        'kit.fingerprick.title': 'Manual blood sugar measurement. More accurate than CGM, but test strips are expensive and the prick hurts. 3h cooldown. — key Z',
        'kit.ketone.title': 'Measure blood ketones. Test strips are expensive — only use when suspecting insulin deficiency. Normal: < 0.6, Dangerous: > 1.5. 6h cooldown. — key X',
        'kit.glucagon.title': 'Glucagon emergency injection. Used for severe hypoglycemia. 24h cooldown. — key C',

        // --- Settings ---
        'settings.physiology': 'Physiology Mode',
        'physiology.insulinBand': 'Insulin line',
        'physiology.carbBand': 'Carb absorption',
        'physiology.isfLine': 'Effective ISF',
        'physiology.effectsPanel': 'Blood sugar forces',
        'physiology.dashboard': 'Physiology window',
        // Section titles in physiology effects panel
        'physio.forces': 'Forces',
        'physio.insulin': 'Insulin',
        'physio.sensitivity': 'Insulin sensitivity',
        'physio.food': 'Food',
        'physio.ketones': 'Ketones',
        // Physiology section labels
        'physio.basalRate': 'Basal',
        'physio.plasmaI': 'Plasma I',
        'physio.effectiveISF': 'Effective ISF',
        'physio.circadian': 'Circadian',
        'physio.glucotox': 'Glucotox.',
        'physio.stress': 'Stress',
        'physio.exercise': 'Exercise',
        'physio.carbRate': 'Carb rate',
        'physio.protGlucagon': 'Prot. glucagon',
        'physio.acidosis': 'Acidosis',
        'physio.ffaLipo': 'FFA lipolysis',
        'force.egp': 'Liver production',
        'force.cause.dawn': 'dawn effect',
        'force.cause.stress': 'stress hormones',
        'force.cause.sleep': 'sleep loss',
        'force.cause.protein': 'protein',
        'force.carbAbsorption': 'Carb absorption',
        'force.insulinAction': 'Insulin action',
        'force.basalInsulin': 'Basal insulin',
        'force.bolusInsulin': 'Rapid insulin',
        'force.exerciseUptake': 'Muscle uptake',
        'force.stressHormones': 'Stress hormones',
        'force.dawnEffect': 'Dawn effect',
        'force.renalExcretion': 'Renal excretion',
        'force.brainConsumption': 'Insulin-independent uptake',
        'force.proteinGlucagon': 'Protein → glucagon',
        'force.ffaResistance': 'FFA resistance',
        'force.glucotoxicity': 'Glucotoxicity',
        'dashboard.title': 'Physiology Dashboard',
        'dashboard.bg': 'Blood sugar (mmol/L)',
        'dashboard.insulin': 'Insulin',
        'dashboard.food': 'Food absorption',
        'dashboard.stress': 'Stress hormones',
        'dashboard.liver': 'Liver & glycogen',
        'dashboard.ketones': 'Ketones',
        'settings.label': 'Settings',
        'settings.title': 'Settings',
        'settings.debug': 'Debug',
        'drawer.stats': 'Game data',
        'drawer.debug': 'Debug',
        'settings.sound': 'Sound',
        'settings.vfx': 'VFX',
        'settings.vfx.title': 'Toggle visual symptom effects — simulates blurred vision, tunnel vision and fading colours during hypo, hyper and DKA',
        'settings.sfx': 'Sound effects',
        'settings.cgm': 'CGM sounds',
        'settings.music': 'Music',
        'settings.lang': 'EN',
        // Section titles (divider labels)
        'settings.sect.gameplay': 'Gameplay',
        'settings.sect.display': 'Display',
        'settings.sect.developer': 'Developer',
        // Help text under toggles
        'settings.sfx.help': 'Button sounds and game events.',
        'settings.cgm.help': 'Sound for each new CGM reading.',
        'settings.effects.help': 'Arrows showing what drives {characterName}\'s blood sugar.',
        'settings.lifeBars': 'Life bars',
        'settings.lifeBars.help': 'Brain, acidosis and weight as progress bars.',
        'settings.stats': 'Stats',
        'settings.stats.help': 'TIR, avg blood sugar and weight at the bottom of the screen.',
        'settings.fullscreen': 'Fullscreen',
        'settings.fullscreen.help': 'Show the simulator in fullscreen.',
        'settings.vfx.help2': 'Blur, desaturation and tunnel vision during low blood sugar, prolonged high blood sugar and acid load.',
        'settings.dashboard.help': 'Detailed real-time view in separate window.',
        'settings.tips': 'Tips',
        'settings.tips.help': 'Tips and hints about controls, levels and physiology.',
        'settings.bgUnit': 'Blood sugar unit',
        'settings.bgUnit.help': 'Switch between mmol/L and mg/dL.',
        'settings.debug.help': 'Internal values, true blood sugar and CSV logging.',
        // Physiology button (top bar)
        'ui.btn.physiology': 'Physiology',
        'ui.title.physiology': 'Reveal the hidden mechanisms driving blood sugar\n— learning only, score not saved',
        'ui.physiology.watermark': 'PHYSIOLOGY MODE',
        'ui.physiology.confirm.title': 'Activate Physiology Mode?',
        'ui.physiology.confirm.body': 'Physiology Mode is a great way to learn about the mechanisms driving blood sugar.<br><br>In everyday life, however, you do not have access to this information, so the score is not saved.',
        'ui.physiology.confirm.yes': 'Yes, show physiology',
        'ui.physiology.confirm.no': 'Continue without physiology',
        'ui.physiology.startWarn.title': 'Physiology Mode is active',
        'ui.physiology.scoreNotSaved': 'Score not saved — because Physiology Mode gives insight you don\'t have in real life.',

        // --- Game modes ---
        'mode.title': 'Choose mode',
        'mode.group.play': 'Play',
        'mode.boxchallenge': 'Box Challenge',
        'mode.boxchallenge.desc': 'Dodge the obstacles and collect points!',
        'mode.campaign': 'Campaign',
        'mode.campaign.desc': 'Help a character keep blood sugar steady — step by step',
        'mode.screenNote': 'T1D Simulator is designed to work best on a larger screen, such as a PC or tablet.',


        // --- Small-viewport popup ---
        'viewport.title': 'Small screen?',
        'viewport.message': 'T1D Simulator is built for PC and tablet. Your screen is small — try the mobile version for a better experience.',
        'viewport.switch': 'Switch to mobile',
        'viewport.stay': 'Stay on desktop',

        // --- Box Challenge ---
        'boxchallenge.lives': 'Lives',
        'boxchallenge.levelComplete': 'Complete!',
        'boxchallenge.dayLabel': 'DAY {day}',
        'boxchallenge.dayPoints': 'Today',
        'boxchallenge.total': 'Total',
        'boxchallenge.bonus': 'Bonus: +{bonus} points',
        'boxchallenge.perfect': 'Perfect control!',
        'boxchallenge.great': 'Well done!',
        'boxchallenge.passed': 'Passed!',
        'boxchallenge.nextDay': 'Next day →',
        'boxchallenge.lifeUsed': 'You lost a life!',
        'boxchallenge.respawn.hypo': 'Respawned after hypo — blood sugar reset!',
        'boxchallenge.respawn.dka': 'Respawned after DKA — blood sugar reset!',
        'boxchallenge.gameOver': 'All lives used!',
        'boxchallenge.continue': 'Continue',
        'boxchallenge.respawn.box': 'You hit an obstacle!',
        'boxchallenge.respawn.weight': 'Weight out of control — reset!',
        'boxchallenge.respawn.complications': 'Complications — new chance!',
        // --- Campaign ---
        'campaign.levelLabel': 'Level {n}',
        'campaign.playingCharacter': 'You help {characterName}',
        'campaign.selectLevel': 'Select level',
        'campaign.objectives': 'Requirements',
        'campaign.obj.complete3Days': 'Help {characterName} through 3 days',
        'campaign.obj.positiveCalorieFood': 'Give {characterName} enough food for a positive calorie balance',
        'campaign.availableTools': 'Available tools',
        'campaign.startLevel': '▶ Start level',
        'campaign.returnToLevel': '▶ Return to level',
        'campaign.info.title': 'Show level info (objectives, description and tools)',
        'campaign.failed.title': 'Not completed yet',
        'campaign.failed.body': 'One or more objectives were not met',
        'campaign.failed.missing': 'Missing',
        'campaign.failed.noPoints': 'No points are saved for this attempt.',
        'campaign.levelComplete': 'Complete!',
        'campaign.levelPoorPass': 'Barely passed',
        'campaign.levelIncomplete': 'Not completed',
        'campaign.nextLevel': 'Next level →',
        'campaign.replay': '↺ Try again',
        'campaign.retry': '↺ Try again',
        'campaign.backToMenu': '← Menu',
        'campaign.quit': 'Quit',
        'campaign.basePoints': 'Points',
        'campaign.total': 'Total',
        'campaign.encouragement': "It's totally ok to fail — you learn from it! Try again.",
        'campaign.action.basal': 'Basal insulin',
        'campaign.action.bolus': 'Rapid insulin',
        'campaign.action.food': 'Food',
        'campaign.action.exercise': 'Exercise',
        'campaign.action.kit': 'T1D kit',

        'campaign.level1.title': 'Basal insulin',
        'campaign.level1.desc': '<p>{characterName}\'s last basal insulin was given at 08:00 yesterday and fades during the morning.</p><p>Try <strong>{basalRangeMin}-{basalRangeMax} U</strong> of basal insulin for {characterName}. Too little basal usually makes blood sugar rise slowly. Too much makes it fall and can cause low blood sugar. Basal acts over many hours, so follow the curve through the day.</p>',
        'campaign.level1.obj.complete': 'Complete 3 days',
        'campaign.level1.obj.basal': 'Give basal insulin',
        'campaign.level1.obj.survive': 'Keep {characterName}\'s blood sugar steady for 3 days',

        'campaign.level2.title': 'Dawn effect',
        'campaign.level2.desc': '<p>In the morning, {characterName}\'s blood sugar can rise without food. This is called the <strong>dawn effect</strong>.</p><p>Explore different rapid-insulin doses and times. See what keeps {characterName}\'s blood sugar stable in the morning. Basal insulin still needs to be given every day.</p>',
        'campaign.level2.obj.complete': 'Complete 3 days',
        'campaign.level2.obj.basal': 'Give basal insulin',
        'campaign.level2.obj.survive': 'Maintain good blood sugar control for 3 days',

        'campaign.level3.title': 'Quick Carbohydrates',
        'campaign.level3.desc': '<p>Give {characterName} different snacks and sweet drinks. See how quickly they raise blood sugar.</p><p>Explore how the dose and timing of rapid insulin change the curve, and try to keep it in the green zone.</p>',
        'campaign.level3.obj.food3xPerDay': 'Give {characterName} snacks or sweet drinks at least 3 times each day',
        'campaign.level3.tip.glucagon': 'At very low blood sugar, glucagon from the T1D kit can raise blood sugar within minutes.',
        'campaign.level3.tip.liquidFaster': 'Drinks with sugar are typically absorbed faster than solid snacks.',
        'campaign.level3.tip.sweetFast': 'Glucose tablets contain glucose and raise blood sugar quickly.',

        'campaign.level4_meals.title': 'Bolus for meals',
        'campaign.level4_meals.desc': '<p>Give {characterName} different meals. Try rapid insulin at different times and see what keeps {characterName}\'s blood sugar in the green zone.</p><p>You earn the most points between {bonusLow} and {bonusHigh} {unit}.</p>',
        'campaign.level4_meals.obj.eat': 'Give {characterName} meals to reach a positive calorie balance',
        'campaign.level4_meals.tip.bolusFirst': 'Compare bolus before and after eating.',
        'campaign.level4_meals.tip.noBolus': 'The meal was given without bolus. The carbohydrates are already being absorbed.',
        'campaign.level4_meals.tip.kcalIntro': '🔥 shows calorie balance: a positive number means more energy was eaten than burned.',
        'campaign.level4_meals.tip.kcalDeficit': 'The calorie balance is negative. This level requires it to be positive before the end.',

        'campaign.level4.title': 'Low carb',
        'campaign.level4.desc': '<p>Low-carb meals contain fewer carbohydrates and more protein or fat.</p><p>Give {characterName} different meals, and explore the dose and timing of rapid insulin. Follow the curve for at least 4 hours to see whether blood sugar rises again as the rapid insulin wears off.</p>',
        'campaign.level4.obj.eat': 'Give {characterName} low-carb meals to reach a positive calorie balance',
        'campaign.level4.obj.survive': 'Maintain good blood sugar control for 3 days',

        'campaign.level6_buffet.title': 'Buffet',
        'campaign.level6_buffet.desc': '<p>All food types and both types of insulin are now available.</p><p>Give {characterName} meals and snacks through the day. Explore different meals and rapid-insulin timing, and try to keep blood sugar in the green zone.</p>',

        'campaign.level7.title': 'Everyday activity',
        'campaign.level7.desc': '<p>Walking, errands, gardening, and yoga affect {characterName}\'s blood sugar in different ways.</p><p>Choose different everyday activities for {characterName}. Include at least 2 hours of activity each day, and follow blood sugar during activity and afterwards.</p>',
        'campaign.level7.obj.activity': 'Keep {characterName} active for at least 2 hours each day',
        'campaign.level7.tip.intro': 'Walking, gardening, yoga, and errands produce different blood sugar curves.',
        'campaign.level7.tip.strategic': 'A short walk is available. See how it changes the blood sugar curve.',
        'campaign.level7.tip.stopButton': 'You can stop any activity manually at any time using the stop button in the activity overlay.',
        'campaign.level7.tip.styrke': 'Strength training can raise blood sugar at first and make it fall later.',
        'campaign.level7.tip.afslapning': 'Relaxation (yoga, breathing) lowers stress hormones and improves blood sugar control indirectly — particularly useful after stressful days.',

        // Placeholder titles for levels 9-10 (under construction — shown in level-select)
        'campaign.level8.title': 'Sport',
        'campaign.level8.desc': '<p>Cardio and strength training can affect {characterName}\'s blood sugar in different ways.</p><p>Let {characterName} do at least 1 hour of hard exercise each day. Watch active insulin (IOB), and follow the curve during exercise and for 1–3 hours afterwards.</p>',
        'campaign.level8.obj.hardExercise': 'Let {characterName} do at least 1 hour of hard exercise each day',
        'campaign.level8.tip.cardioIob': 'Exercise with active insulin can lower blood sugar faster. Compare IOB and trend at the start.',
        'campaign.level8.tip.strengthLater': 'With high intensity, blood sugar can rise a little first and fall later. Check again 1-3 hours after activity.',
        'campaign.level9.title': 'Illness and stress',
        'campaign.level9.desc': '<p>On day 1, {characterName} experiences stress, and on day 2, {characterName} develops a mild illness.</p><p>Follow blood sugar, active insulin (IOB), and ketones, and try to keep blood sugar in the green zone through all 3 days.</p>',
        'campaign.level9.marker.test': 'Important test',
        'campaign.level9.marker.illness': 'Illness',
        'campaign.level9.tip.stressGeneral': 'A stressful situation can make blood sugar rise for 1-2 hours, even without food.',
        'campaign.level9.tip.stressEvent': 'Stress hormones are rising now — watch blood sugar over the next couple of hours.',
        'campaign.level9.tip.illnessEvent': 'Illness increases insulin needs — the same dose can act more weakly than usual.',
        'campaign.level9.tip.illnessGeneral': 'During illness, insulin can act more weakly for many hours.',
        'campaign.level9.tip.ketones': 'If blood sugar runs high during illness, a ketone test can give extra information.',
        'campaign.level10.title': 'Unpredictability',
        'campaign.level10.desc': '<p>Help {characterName} through 3 days of unexpected stress, illness, food, activity, and continuous glucose monitor (CGM) errors.</p><p>Follow the trend, active insulin (IOB), and the curve, and try to keep blood sugar in the green zone.</p>',
        'campaign.level10.tip.active': 'Unexpected events are active in this level. Some only appear afterwards on the curve.',
        'campaign.level10.tip.cgmCompression': 'A sudden night-time CGM drop may be caused by pressure on the sensor. A fingerprick shows {characterName}\'s current blood sugar.',
        'campaign.level10.tip.sensorLoss': '{characterName}\'s CGM sensor can get knocked loose. A fingerprick from the T1D kit provides data in the meantime.',
        'campaign.level10.tip.sensorCheck': 'The CGM signal can run a self-check for short periods. CGM data is missing during the check, but fingerprick still works.',
        'campaign.level10.tip.falseAlarms': 'A sudden CGM drop may be a false alarm. A fingerprick shows {characterName}\'s blood sugar more accurately.',
        'campaign.level10.event.presentation': 'Unexpected stress: {characterName} is giving an important presentation. Blood sugar can rise over the next couple of hours.',
        'campaign.level10.event.conflict': 'Unexpected stress: {characterName} is in a pressured situation that raises stress hormones.',
        'campaign.level10.event.poorSleep': 'CGM alarm: {characterName} has been lying on the sensor arm, so CGM may read falsely low for a while.',
        'campaign.level10.event.illness': '{characterName} feels mildly ill. Follow blood sugar and ketones if blood sugar runs high.',
        'campaign.level10.event.sensorLoss': '{characterName}\'s CGM sensor has been knocked loose. No new CGM readings arrive until a new sensor and warmup.',
        'campaign.level10.event.sensorCheck': 'CGM is briefly checking {characterName}\'s signal. Use a fingerprick if you want to see blood sugar now.',
        'campaign.level10.event.cake': 'Unexpected food: {characterName} eats a piece of cake. Account for both sugar and fat.',
        'campaign.level10.event.pizza': 'Unexpected food: {characterName} eats pizza, which can cause both an early and a late blood sugar rise.',
        'campaign.level10.popup.presentationTitle': 'Important presentation',
        'campaign.level10.popup.presentation': '{characterName} is giving an important presentation. Stress hormones can make blood sugar rise for 1-2 hours, even without food. The game is paused so you can check blood sugar and IOB and choose the next action.',
        'campaign.level10.popup.conflictTitle': 'Pressured situation',
        'campaign.level10.popup.conflict': '{characterName} is in a pressured situation. Stress hormones can make blood sugar rise even though {characterName} has not eaten. The game is paused so you can follow the trend.',
        'campaign.level10.popup.foodTitle': 'Unexpected food',
        'campaign.level10.popup.cake': 'A friend unexpectedly stops by with cake, and {characterName} has a piece. The cake is now registered on the graph. The game is paused so you can check blood sugar and IOB and choose the next action.',
        'campaign.level10.popup.pizza': 'Plans change, and {characterName} eats pizza. Pizza provides both fast carbohydrates and a longer fat/protein effect. The game is paused so you can plan the next step.',
        'campaign.level10.popup.sleepAlarmTitle': 'Night CGM alarm',
        'campaign.level10.popup.sleepAlarm': '{characterName} wakes up from a CGM alarm after lying on the sensor arm. CGM may therefore read falsely low for a while. The game is paused: use a fingerprick if you want to see blood sugar directly. The sleep interruption may raise insulin needs the next day.',
        'campaign.level10.popup.illnessTitle': 'Mild illness',
        'campaign.level10.popup.illness': '{characterName} develops a sore throat and feels ill. During illness, insulin can act more weakly for many hours. Follow blood sugar, and check ketones if it runs high.',
        'campaign.level10.popup.sensorLossTitle': 'CGM sensor came off',
        'campaign.level10.popup.sensorLoss': '{characterName}\'s CGM sensor was knocked loose by accident. A friend is bringing a new sensor in 2 hours. Warmup then takes 1 hour. Use a fingerprick in the meantime if you want to see {characterName}\'s blood sugar.',
        'campaign.level10.popup.sensorCheckTitle': 'CGM signal check',
        'campaign.level10.popup.sensorCheck': '{characterName}\'s CGM signal looks unusual, so the sensor pauses briefly to check the signal. The game is paused: use a fingerprick if you want to see blood sugar directly.',
        'campaign.level10.popup.busRunTitle': 'Running for the bus',
        'campaign.level10.popup.busRun': '{characterName} is running late and has to run for the bus. Cardio has started on the graph and can make blood sugar fall quickly. The game is paused so you can assess blood sugar and carbohydrates.',
        'campaign.level10.popup.liftingTitle': 'Heavy lifting',
        'campaign.level10.popup.lifting': '{characterName} helps move some furniture. This is registered as strength activity on the graph. Strength work can cause a brief blood sugar rise, while muscles may still use more glucose afterwards.',
        'campaign.level10.event.busRun': 'Unexpected activity: {characterName} has to run for the bus. Cardio can make blood sugar fall quickly.',
        'campaign.level10.event.lifting': 'Unexpected activity: {characterName} helps move furniture. Strength work can cause a brief blood sugar rise.',
        'campaign.level10.marker.presentation': 'Presentation',
        'campaign.level10.marker.stress': 'Stress',
        'campaign.level10.marker.poorSleep': 'Poor sleep',
        'campaign.level10.marker.cgmAlarm': 'CGM alarm',
        'campaign.level10.marker.illness': 'Illness',
        'campaign.level10.marker.sensorLoss': 'CGM off',
        'campaign.level10.marker.sensorCheck': 'CGM check',
        'campaign.level10.marker.cake': 'Cake',
        'campaign.level10.marker.pizza': 'Pizza',
        'campaign.level10.marker.busRun': 'Run for bus',
        'campaign.level10.marker.lifting': 'Heavy lift',

        'campaign.marker.giveBasal': 'Give basal',
        'campaign.marker.eatBreakfast': 'Breakfast',
        'campaign.marker.eatLunch': 'Lunch',
        'campaign.marker.eatDinner': 'Dinner',
        'campaign.marker.bolusBeforeMeal': 'Bolus before meal',
        'campaign.marker.tryLowCarb': 'Try low carb',

        'tutorial.level1.openDock': 'Tap the syringe icon at the bottom to open the insulin panel',
        'tutorial.level1.speedUp': 'Use the ◀ ▶ buttons to change game speed. On keyboard, you can also use the arrow keys.',
        'tutorial.level2.dawn': 'The dawn effect is active: Morning stress hormones can raise blood sugar without food.',
        'tutorial.level3.openFood': 'Tap the food icon at the bottom and choose {characterName}\'s first meal.',

        'campaign.level1.tip.noBasal': 'Without basal insulin, blood sugar can rise slowly through the day.',
        'campaign.level1.tip.moreInfoIcons': 'The small round info icons open deeper explanations when you want to know more.',
        'campaign.level1.tip.bgRising': 'Blood sugar is high, and no basal insulin has been given yet.',
        'campaign.level1.tip.useRapid': 'Blood sugar is above target. Rapid insulin acts gradually over the next 1-2 hours.',
        'campaign.level1.tip.ketoneSymptoms': 'Insulin deficiency can make both blood sugar and ketones rise.',
        'campaign.level1.tip.ketoneMeasure': 'Ketone testing provides extra information when blood sugar has been high for several hours.',
        'campaign.level1.tip.ketoneHigh': 'An elevated ketone reading points to insulin deficiency.',
        'campaign.level1.tip.splitDose': 'A split basal dose produces a different daily curve than one combined dose.',
        'campaign.level1.tip.basalOnset': 'After a basal dose, it takes about 2-4 hours before the effect is fully active.',
        'campaign.level1.tip.basalDuration': 'Basal insulin typically lasts 22-32 hours, so timing matters.',
        'campaign.level1.tip.physiologyMode': 'Physiology Mode gives access to information you normally do not have in the real world.',
        'campaign.level2.tip.rememberBasal': 'No basal insulin has been given in this level yet.',
        'campaign.level2.tip.dawn': 'If blood sugar rises in the morning without food, it may be the dawn effect.',
        'campaign.level2.tip.isfIntro': 'ISF shows approximately how much 1 U of rapid insulin lowers blood sugar in this scenario.',
        'campaign.level2.tip.isfVaries': 'ISF varies through the day and is affected by stress, sleep, and activity.',
        'campaign.level2.tip.isfSleep': 'After poor sleep, the same insulin dose may act more weakly in the model.',
        'campaign.level2.tip.onsetUncertainty': 'The dawn effect can start and peak a little differently from day to day.',
        'debug.unlockAllLevels': 'Unlock all levels',
        'debug.unlockAllLevels.help': 'Unlocks all campaign levels regardless of progress.',
        'campaign.level3.tip.icr': 'Explore how different amounts of carbohydrate and rapid insulin change the blood sugar curve.',
        'campaign.level3.tip.bolusTiming': 'Rapid insulin before and after the same snack produces different blood sugar curves.',
        'campaign.level3.tip.postmeal': 'Carbohydrate raises blood sugar quickly; rapid insulin changes the curve gradually over the next few hours.',

        'campaign.level4.tip.lowcarbIntro': 'Low carb food has fewer carbohydrates and often gives a smaller, slower blood sugar rise.',
        'campaign.level4.tip.protein': 'Protein can raise blood sugar slowly, often becoming clear after 2-4 hours.',
        'campaign.level4.tip.fatDelay': 'Fat can delay stomach emptying and prolong the blood sugar rise after the meal.',
        'campaign.level4.tip.timescale': 'Synthetic insulin acts relatively slowly — that\'s why it is easier to match the slow changes with a low-carb diet.',
        'campaign.level4.tip.lowBgDelay': 'A low-carb meal raises blood sugar slowly when the starting value is low.',
        'campaign.level4.tip.splitDose': 'One combined dose and two split doses produce different insulin profiles.',
        'campaign.level4.tip.physiologyMode': 'You can try Physiology Mode to follow active insulin and carbohydrate absorption on the graph.',

        'campaign.tip.basalLow': '{characterName}\'s blood sugar is starting to rise. The last basal dose was {hoursSinceBasal} hours ago.',

        'tips.moreInfoIcons': 'Round info icons mean there is a deeper explanation. Tap them to open the game guide at the relevant section.',
        'tips.foodNoBolus': 'The meal was given without bolus. The carbohydrates are already being absorbed.',
        'tips.symptomHypo': 'Sweating, trembling and palpitations can accompany low blood sugar. Give {characterName} fast sugar in the game.',
        'tips.symptomHyper': 'Thirst and frequent urination can accompany high blood sugar in {characterName}.',
        'tips.symptomKetone': 'Nausea and stomach pain can accompany rising ketones and acid load in {characterName}.',
        'tips.symptomVfxSlowDown': 'Blur or tunnel vision is a visual symptom in {characterName}. Pause the game and look at the curve.',
        'tips.symptomEnergyDeficit': 'Hunger, weakness and headache can accompany an energy deficit in {characterName}.',
        'tips.symptomIllness': 'A sore throat, sneezing and fatigue show that {characterName} is ill.',
        'tips.symptomMultiple': 'The same symptom can have several causes. Compare {characterName}\'s curve with recent events.',
        'tips.dawnEffect': 'Blood sugar rises in the morning — this is the dawn effect from stress hormones',
        'tips.nightAction': 'Actions during the night interrupt sleep and may raise stress hormones the next day.',
        'tips.speedControl': 'Use the speed buttons to slow down or speed up. On keyboard, you can use the arrow keys.',
        'tips.pauseButton': 'The pause button stops the simulation. On keyboard, you can use spacebar.',
        'tips.keyboardRapidInsulin': 'On PC, press ½ or 1-9 to give rapid insulin directly.',
        'tips.keyboardDextrose': 'On PC, press V twice to take dextrose from the T1D kit.',
        'tips.physiologySuggestion': 'Physiology Mode can show insulin, carbohydrates and eISF directly on the graph.',
        'tips.physiologyEisf': 'The eISF line shows the model\'s effective insulin sensitivity through the day.',
        'tips.musicSettings': 'Toggle music on or off in Settings in the top bar',
        'tips.tipsOff': 'These tips can be turned off in Settings in the top bar',
        'tips.ringAfterInsulin': 'The ring around an event icon marks the next hour on the graph.',
        'tips.ringAfterFood': 'The ring around an event icon marks the next hour on the graph.',
        'tips.experiment': 'Try changing one thing at a time. That makes it easier to see what changes blood sugar.',
        'tips.pointsBonus': 'You earn points when blood sugar is between {low} and {high} {unit}. Between {bonusLow} and {bonusHigh} {unit}, you get 2x points.',
        'tips.pointsZero': 'Blood sugar between {halfLow} and {halfHigh} {unit} is too high and only gives 1/2 points.',
        'tips.pointsHypoZero': 'Blood sugar below {floor} {unit} is dangerously low and therefore gives no points.',
        'tips.starsTir': 'TIR of at least 70% gives bonus points at the end of the day or level.',
        'tips.cgmDelay': 'CGM shows a delayed estimate; changes can take 5-15 min to appear.',
        'tips.fingerprick': 'A fingerprick shows {characterName}\'s current blood sugar without CGM delay.',
        'tips.variabilityRapidInsulin': 'The same rapid insulin dose can be absorbed a little faster or slower from time to time.',
        'tips.variabilityBasal': 'Basal insulin does not last exactly the same length every time; in the simulator it can act for about 22-38 hours.',
        'tips.variabilityDawn': 'The dawn effect can start and peak a little differently from day to day, especially after poor sleep.',
        'tips.variabilityCgm': 'CGM is a delayed estimate, so fingerprick and CGM can show slightly different numbers.',
        'tips.variabilityFood': 'Fat, fiber, liquid/solid food, and stomach content change how quickly blood sugar rises after food.',
        'tips.variabilityMotion': 'Exercise affects blood sugar differently depending on type, intensity, and active insulin.',

        // --- Highscore tabs ---
        'highscore.tab.sandbox': 'Sandbox',
        'highscore.tab.boxchallenge': 'Box Challenge',
        'highscore.tab.campaign': 'Campaign',

        // --- Debug panel ---
        'debug.title': 'Debug',
        'debug.trueBG': 'True blood sugar',
        'debug.csvLog': 'CSV log',
        'debug.ready': 'Ready',
        'debug.rows': 'rows',
        'debug.clearAll': 'Clear all local data',
        'debug.clearAll.title': 'Clear all saved data (profile, highscores, settings, and information acknowledgement)',
        'debug.clearAll.confirm': 'Are you sure? This deletes your profile, highscores, settings, and acknowledgement of the simulator information. The page will reload.',

        // --- Event log ---
        'log.noEvents': 'No events yet',
        'log.now': 'now',
        'log.food': 'Food: {carbs}g C, {protein}g P, {fat}g F',
        'log.stomachFull': 'Stomach is full — wait for digestion',
        'log.fastInsulin': 'Rapid insulin: {dose}U',
        'log.basalInsulin': 'Basal insulin: {dose}U',
        'log.fingerprick': 'Fingerprick: {value} {unit}',
        'log.ketoneTest': 'Ketone test: {value} {unit} — {status}',
        'log.glucagon': 'Glucagon used! Blood sugar rising rapidly.',
        'log.activityStart': 'Activity: {name} ({intensity}){duration}{kcal}',
        'log.activityEnd': 'Activity ended: {name} ({intensity}), {duration} min, {kcal} kcal',
        'log.exerciseMaxDuration': '⏱️ Exercise stopped automatically after 4 hours — {characterName} needs rest.',
        'log.exerciseCooldown': '⏳ {characterName} needs rest — try again in {min} min.',
        'log.acuteStress': 'Acute stress hormone surge: +{amount} (e.g. adrenaline/glucagon)',
        'log.chronicStress': 'Chronic stress level increased: +{amount} (e.g. cortisol from illness)',
        'log.cgmCompression': 'CGM compression: the sensor is temporarily reading falsely low.',
        'log.cgmSensorLost': 'CGM sensor came off. No new CGM readings until a new sensor and warmup.',
        'log.cgmSelfTest': 'CGM is checking the signal. Use a fingerprick if needed.',
        'log.sleepStart': '🌙 {characterName} goes to bed.',
        'log.goodSleep': '☀️ {characterName} feels rested after an uninterrupted night.',
        'log.sleepDisruption': '{characterName}\'s sleep was interrupted. About {hours} hours of sleep were lost.',
        'log.sleepDebt': '☀️ {characterName} lost {hours} hours of sleep and is more insulin resistant today.',

        // --- Graph messages ---
        'graph.sleepLoss': 'zZzz... -{hours}h sleep',
        'graph.yAxisLabel': 'Blood Sugar ({unit})',
        'graph.now': 'NOW',
        'cgm.status.offline': 'sensor',
        'cgm.status.warmup': 'warmup',
        'cgm.status.checking': 'checking',
        'label.cgmSensorLost': 'CGM off',
        'label.cgmSelfTest': 'CGM check',
        'label.illnessStarts': 'ill',
        'symptom.illness.throat': 'sore throat',
        'symptom.illness.headache': 'headache',
        'symptom.illness.tired': 'tired',
        'symptom.illness.sneeze': 'sneezing',

        // --- Ketone status ---
        'ketone.ok': 'OK',
        'ketone.elevated': 'Elevated',
        'ketone.high': 'High!',
        'ketone.critical': 'CRITICAL!',

        // --- Game over ---
        'game.over.title': 'Game Over',
        'game.over.pointsLabel': 'Points',
        'game.over.saveLabel': 'Save your score:',
        'game.over.namePlaceholder': 'Your name',
        'game.over.saveBtn': 'Save',
        'game.over.savedBtn': 'Saved',
        'game.over.savedRank': 'Saved! You are #{rank} on the highscore list.',
        'game.over.saved': 'Saved!',
        'game.over.whatHappened': 'What happened?',
        'game.over.howToAvoid': 'How to avoid it next time',
        'game.over.tryAgain': 'Try again',
        'game.over.viewGraph': 'View graph',
        'game.over.physiologyTip': 'Tip: Turn on Physiology view to show insulin, carbohydrates, ISF and blood sugar forces directly on the graph while you practice the level.',
        'campaign.failed.physiologyTip': 'Tip: Turn on Physiology view to show insulin, carbohydrates, ISF and blood sugar forces directly on the graph while you practice the level.',

        // --- Game over causes ---
        'game.over.hypo.name': 'Severe Hypoglycemia',
        'game.over.hypo.cause': 'Blood sugar critically low for too long (blood sugar {bg} {unit}).<br>Brain energy reserves depleted.',
        'game.over.hypo.explanation': 'The brain has only a tiny glucose reserve (~4g). Below ~{threshold} {unit} it runs out of energy — confusion, seizures, then loss of consciousness.',
        'game.over.hypo.tip1': 'Give {characterName} dextrose or juice at the first signs of low blood sugar',
        'game.over.hypo.tip2': 'Act on {characterName}\'s falling CGM curve before blood sugar reaches {threshold} {unit}',
        'game.over.hypo.tip3': 'Exercise can amplify insulin action — compare active insulin and food before exercise',
        'game.over.hypo.tip4': 'Give {characterName} glucagon for severe hypoglycemia in the game',
        'brain.deficit.warning.title': 'Brain energy deficit!',
        'brain.deficit.warning.message': '{characterName}\'s blood sugar has been very low for a prolonged period, and the brain lacks energy.<br><br>Give {characterName} dextrose, juice, or glucagon immediately.',

        'game.over.weight.name': 'Extreme Weight Change',
        'game.over.weight.cause': '{characterName}\'s weight changed by {weight} kg. The limit is about 7% of starting weight — that is {limit} kg / {limitKcal} kcal.',
        'game.over.weight.explanation': 'Serious calorie imbalance. May be caused by insulin deficiency (body breaks down fat/muscle) or overeating.',
        'game.over.weight.tip1': 'Give {characterName} regular and sufficient meals',
        'game.over.weight.tip2': 'Monitor calorie balance in the statistics',
        'game.over.weight.tip3': 'Without basal insulin, {characterName}\'s body begins to break down fat and muscle tissue',

        'game.over.dka.name': 'Diabetic Ketoacidosis (DKA)',
        'game.over.dka.cause': 'Ketone reading: {ketones} mmol/L<br>— very high.',
        'game.over.dka.explanation': 'When the body lacks insulin, ketones can rise and make the blood acidic.',
        'game.over.dka.tip1': 'Check {characterName}\'s ketones if blood sugar has been high for several hours',
        'game.over.dka.tip2': 'Nausea and abdominal pain together with high blood sugar and frequent urination can be signs of DKA',
        'game.over.dka.tip3': 'DKA can develop when {characterName} lacks insulin. Remember to give {characterName} basal insulin',
        'game.over.dka.tip4': 'Check {characterName}\'s ketones again later and see whether they rise or fall',

        'game.over.complications.name': 'Late Diabetic Complications',
        'game.over.complications.cause': 'Average blood sugar over the last 7 days: {avg} {unit}.',
        'game.over.complications.explanation': 'Persistently high blood sugar damages blood vessels and nerves → blindness, kidney failure, nerve damage, cardiovascular disease.',
        'game.over.complications.tip1': 'Look at the curve and find the periods that raised {characterName}\'s average',
        'game.over.complications.tip2': 'Play again and change one thing at a time',
        'game.over.complications.tip3': 'Basal insulin affects the trend between meals',
        'game.over.complications.tip4': 'Rapid insulin affects the rise after meals',

        // --- Symptom texts (subtle overlays on the graph) ---
        // Hypoglycemia (blood sugar < 4.0) — progressive autonomic + neuroglycopenic symptoms
        'symptom.hypo.sweat': 'sweating',
        'symptom.hypo.heartbeat': 'palpitations',
        'symptom.hypo.tremor': 'trembling',
        'symptom.hypo.dizziness': 'dizziness',
        'symptom.hypo.confusion': 'confusion',
        'symptom.hypo.blurredVision': 'blurred vision',
        'symptom.hypo.seizures': 'seizures',
        // DKA / ketoacidosis — progressive symptoms based on acidosis load
        'symptom.dka.thirst': 'thirst',
        'symptom.dka.urination': 'frequent urination',
        'symptom.dka.fatigue': 'fatigue',
        'symptom.dka.nausea': 'nausea',
        'symptom.dka.stomachPain': 'stomach pain',
        'symptom.dka.acetone': 'acetone smell',
        'symptom.dka.vomiting': 'vomiting',
        'symptom.dka.kussmaul': 'deep, rapid breathing',
        'symptom.dka.confusion': 'confusion',
        // Hyperglycemia (blood sugar > 14) — osmotic symptoms
        'symptom.hyper.thirst': 'thirst',
        'symptom.hyper.urination': 'frequent urination',
        'symptom.hyper.fatigue': 'fatigue',
        'symptom.hyper.blurred': 'blurred vision',
        'symptom.hyper.dryMouth': 'dry mouth',
        'symptom.hyper.nausea': 'nausea',
        // Hunger (calorie deficit / weight loss)
        'symptom.hunger.hungry':       'hunger',
        'symptom.hunger.weakness':     'weakness',
        'symptom.hunger.irritability': 'irritability',
        'symptom.hunger.headache':     'headache',

        // --- Purpose and limits shown before the first game starts ---
        'disclaimer.title': 'About the simulator',
        'disclaimer.text': 'T1D Simulator is a <strong>learning game about factors that affect blood glucose</strong>. You help fixed, fictional characters.<br><br>The game does not calculate insulin doses for real people and is not intended as a basis for treatment decisions.',
        'disclaimer.accept': 'Got it',

        // --- Welcome and guided tour ---
        'welcomeTour.aria.welcome': 'Welcome popup',
        'welcomeTour.eyebrow': 'Welcome',
        'welcomeTour.title': 'Welcome to T1D Simulator',
        'welcomeTour.lead': 'Explore blood glucose through fixed, fictional characters.',
        'welcomeTour.recommended': 'Recommended first time',
        'welcomeTour.choice.tour.title': 'T1D Intro Tour',
        'welcomeTour.choice.tour.copy': 'A walkthrough of the simulator: the graph, the blood sugar number and the buttons for insulin, food, activity and the T1D Kit.',
        'welcomeTour.choice.campaign.title': 'Start first learning level',
        'welcomeTour.choice.campaign.copy': 'In Campaign, you gradually learn new diabetes topics: basal insulin, food, insulin, activity and CGM.',
        'welcomeTour.showOnStartup': 'Show this welcome on startup',
        'welcomeTour.notNow': 'Not now',
        'welcomeTour.group.navigation': 'Navigation',
        'welcomeTour.group.speech': 'Voice',
        'welcomeTour.autoPlay': 'Auto-forward',
        'welcomeTour.autoPlayOn': 'Auto-forward is ON',
        'welcomeTour.autoPlayOff': 'Auto-forward is OFF',
        'welcomeTour.sound': 'Voice',
        'welcomeTour.soundOn': 'Voice is ON',
        'welcomeTour.soundOff': 'Voice is OFF',
        'welcomeTour.pauseSpeech': 'Pause',
        'welcomeTour.resumeSpeech': 'Resume',
        'welcomeTour.replay': 'Replay',
        'welcomeTour.replayUnavailable': 'Turn voice on to replay this step',
        'welcomeTour.replayNoAudio': 'This step does not have voice yet',
        'welcomeTour.skip': 'End tour',
        'welcomeTour.back': 'Back',
        'welcomeTour.next': 'Forward',
        'welcomeTour.done': 'Done',
        'welcomeTour.progress': '{current} of {total}',
        'welcomeTour.graphMarker.range': 'Target range',
        'welcomeTour.graphMarker.pointsBonus': '2x points/hour',
        'welcomeTour.graphMarker.pointsOne': '1x points/hour',
        'welcomeTour.graphMarker.pointsHalf': '½x points/hour',
        'welcomeTour.graphMarker.night': 'Night',
        'welcomeTour.graphMarker.day': 'Day',
        'welcomeTour.tipDemo.text': '{characterName}\'s blood sugar is low. A quick snack can raise it.',
        'welcomeTour.tipDemo.link': 'Open the game guide',
        'welcomeTour.step.overview.title': 'Welcome to T1D Simulator',
        'welcomeTour.step.overview.text': 'T1D Simulator is a learning game about blood glucose. You help fictional characters and see how food, insulin, activity, sleep, and stress affect their blood glucose.\n\nTry different choices, see what happens, and try again.',
        'welcomeTour.step.graph.title': 'The graph',
        'welcomeTour.step.graph.text': 'The green dots are {characterName}\'s CGM readings over time. The colored bands show how fast you earn points:\n\n- 2x in the bonus zone\n- 1x in the target range\n- ½x for moderately elevated blood sugar',
        'welcomeTour.step.graphDayNight.title': 'Day and night',
        'welcomeTour.step.graphDayNight.text': 'The graph shows one day from 00 to 24. Dark areas are night, and the lighter area is daytime.',
        'welcomeTour.step.cgm.title': 'The blood sugar number',
        'welcomeTour.step.cgm.text': 'When the simulation is running, {characterName}\'s current CGM value is shown here. The arrow shows whether the value is rising, falling, or steady. The CGM reading is delayed 5-10 minutes compared with actual blood sugar.\n\nIOB means active insulin: rapid insulin from earlier doses that is still working.',
        'welcomeTour.step.insulin.title': 'Insulin',
        'welcomeTour.step.insulin.text': 'The insulin icon at the bottom opens the insulin panel. This is where you give {characterName} basal and rapid insulin.',
        'welcomeTour.step.basal.title': 'Basal insulin',
        'welcomeTour.step.basal.text': 'Basal insulin covers {characterName}\'s basic insulin need over many hours. Judge the dose from quiet periods, such as overnight or several hours after food and rapid insulin.\n\nBasal can be given as one daily dose or split into two doses.',
        'welcomeTour.step.fast.title': 'Rapid insulin',
        'welcomeTour.step.fast.text': 'Rapid insulin is meal/correction insulin. It begins absorbing after about 10-20 minutes, but the visible effect on blood sugar often comes later - commonly after 30-45 minutes, and later still on CGM because CGM lags behind actual blood sugar.\n\nIt usually has its strongest effect after 1-2 hours and can keep working for 3-5 hours. IOB means insulin on board: rapid insulin from earlier doses that still has effect left.',
        'welcomeTour.step.food.title': 'Food',
        'welcomeTour.step.food.text': 'The food icon at the bottom opens the food panel. We go through the three fixed rows from most common to least common: fast carbs, meals and low-carb.',
        'welcomeTour.step.foodMeals.title': 'Meals',
        'welcomeTour.step.foodMeals.text': 'The middle row is full meals like pasta, pizza and burger. They raise blood sugar more slowly than pure sugar, and the type of carb sets the pace. Fat can delay the peak — that is the pizza effect.',
        'welcomeTour.step.foodLowCarb.title': 'Low-carb',
        'welcomeTour.step.foodLowCarb.text': 'The top row is low-carb food like eggs, nuts, salad and steak. These usually give a smaller, slower blood sugar rise than carb-heavy meals because they contain few carbs. Protein and fat can still create a later rise, and fat can temporarily reduce insulin sensitivity.\n\nIn the simulator, that slower effect can be easier to match with rapid insulin, because injected insulin works more slowly than the body’s own insulin release.',
        'welcomeTour.step.foodSugars.title': 'Fast carbs',
        'welcomeTour.step.foodSugars.text': 'The bottom row is dextrose, juice, cola and candy, which work quickly and can bring low blood sugar back up. Banana and chocolate are carbs too, but slower than pure dextrose or juice.',
        'welcomeTour.step.activityOverview.title': 'Activity',
        'welcomeTour.step.activityOverview.text': 'The activity icon at the bottom opens the activity panel. Tap it to plan a workout.',
        'welcomeTour.step.activity.title': 'Activity',
        'welcomeTour.step.activity.text': 'First choose activity type and intensity. Cardio uses the muscles steadily and often lowers blood sugar, especially when rapid insulin is active. Strength or high intensity can raise blood sugar briefly at first because stress hormones release glucose, but insulin sensitivity can still be higher afterward.\n\nAt the bottom, choose duration. Pressing 15 min, 30 min, 60 min or Open starts the activity with the choices you selected.',
        'welcomeTour.step.kitOverview.title': 'T1D Kit',
        'welcomeTour.step.kitOverview.text': 'The T1D Kit icon at the bottom opens measuring tools, dextrose, and glucagon.',
        'welcomeTour.step.kit.title': 'T1D Kit',
        'welcomeTour.step.kit.text': 'A fingerprick shows {characterName}\'s current blood sugar without CGM delay.\n\nA ketone test measures ketones. Ketones can rise when the body lacks insulin and breaks down fat instead.\n\nDextrose raises blood sugar quickly. Glucagon can be used for severe hypoglycemia in the game.',
        'welcomeTour.step.time.title': 'Time',
        'welcomeTour.step.time.text': 'At the top you see the day and clock. The simulator keeps running on its own, so you can follow how blood sugar changes through the day.',
        'welcomeTour.step.timeControls.title': 'Time controls',
        'welcomeTour.step.timeControls.text': 'The middle button pauses the game and starts it again. The arrows change the pace: 1, 4, 12 or 24 simulated hours per minute. Use a slow pace or pause when choosing actions. Use a high pace when not much is happening, for example when {characterName} is sleeping.',
        'welcomeTour.step.physiology.title': 'Physiology Mode',
        'welcomeTour.step.physiology.text': 'The Physiology button turns on extra graphs and information. They help you see and learn what is happening inside the body, and which phenomena make blood sugar rise or fall. You can follow current insulin action, carbohydrate absorption, and how the body’s sensitivity to insulin changes. Highscores are not saved while Physiology view is on.',
        'welcomeTour.step.settings.title': 'Settings',
        'welcomeTour.step.settings.text': 'The Settings button opens the app controls. Here you can change the blood sugar unit, turn level tips and general tips on or off, and control sound, music and display options.',
        'welcomeTour.step.learn.title': 'Learn as you go',
        'welcomeTour.step.learn.text': 'While you play, tips pop up here with small pieces of advice. Under each tip there is a small icon — tap it to open the game guide on that exact topic. The Help button at the top is always there too.',
        'welcomeTour.step.ready.title': 'Ready',
        'welcomeTour.step.ready.text': 'That was the tour. A good next step is to start a Campaign, where the tools unlock gradually as you learn how they affect blood sugar. You can reopen the tour from Help.',

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
        'highscore.col.character': 'Character',
        'highscore.col.points': 'Points',
        'highscore.col.day': 'Day',
        'highscore.col.gameOver': 'Game Over',
        'highscore.col.date': 'Date',
        'highscore.close': 'Close',
        'highscore.clearAll': 'Delete all scores',
        'highscore.confirmClear': 'Delete all highscores?',

        // --- Profile popup ---
        'profile.readonlyNotice': 'Character cannot be changed while playing. End the level or return to the main menu to choose a different character.',
        'profile.name.placeholder': 'Your name',
        'profile.restingKcal': 'Resting burn',
        'profile.save': 'Save',
        'profile.reset': 'Default',
        'profile.character': 'Choose character',
        'archetype.child.name': 'Child',
        'archetype.child.desc': 'Light, insulin-sensitive body',
        'archetype.adult.name': 'Adult',
        'archetype.adult.desc': 'Standard adult',
        'archetype.large.name': 'Large adult',
        'archetype.large.desc': 'Larger body, less sensitive',
        // Short column headers for the character picker (the three body-type columns).
        'character.col.child': 'Child',
        'character.col.adult': 'Adult',
        'character.col.large': 'Large',

        // --- Mobile shell (mobile/) — strings unique to the phone UI ---
        'm.speed.60': '1h/min', 'm.speed.240': '4h/min', 'm.speed.720': '12h/min', 'm.speed.1440': '24h/min', 'm.speed.pause': 'Pause',
        'm.graph.timeAxis': 'Time (h)',
        'm.tip.welcome': 'Follow the curve and test how food, insulin and activity affect {characterName}\'s blood sugar.',
        'm.ob.1.title': 'Welcome!',
        'm.ob.1.body': 'Here you help {characterName} and see how insulin, food, and activity affect blood sugar. Learn and explore at your own pace.',
        'm.ob.2.title': 'How to play',
        'm.ob.2.body': 'Use the buttons at the bottom to give {characterName} insulin and food, choose activity, and use the T1D kit. The goal is to keep blood sugar in the green zone (4–10 mmol/L).',
        'm.ob.3.title': 'You set the pace',
        'm.ob.3.body': 'Time moves fast — speed it up or down at the bottom. See how food and insulin change {characterName}\'s blood sugar.',
        'm.ob.next': 'Next', 'm.ob.start': 'Get started', 'm.ob.skip': 'Skip',
        // Start screen (mobile landing) — warm, learning-framed welcome shown on load.
        'm.start.title': 'Welcome',
        'm.start.intro': 'Explore how food, insulin, activity, sleep and stress affect blood sugar in the game\'s characters.',
        'm.start.benefit1': 'Motivating learning at your own pace',
        'm.start.benefit2': 'Instant feedback',
        'm.start.benefit3': 'Interactive exploration with rapid feedback',
        'm.start.benefit4': 'Understand the physiology behind the curve',
        'm.start.skip': 'Close welcome menu',
        'm.start.showWelcome': 'Show welcome on startup',
        'm.tip.close': 'Close tip', 'm.aria.slower': 'Slower', 'm.aria.faster': 'Faster', 'm.aria.menu': 'Menu',
        'm.badge.day': 'Day', 'm.mode.sandbox': 'Sandbox',
        'm.pill.points': 'Points', 'm.pill.avg': 'Avg',
        'm.dock.insulin': 'Insulin', 'm.dock.food': 'Food', 'm.dock.activity': 'Activity', 'm.dock.kit': 'T1D Kit',
        'm.sheet.insulin': 'Give insulin', 'm.sheet.food': 'Give food', 'm.sheet.activity': 'Activity', 'm.sheet.kit': 'T1D Kit', 'm.sheet.profile': 'Character', 'm.sheet.settings': 'Settings', 'm.menu.title': 'Menu',
        'm.insulin.basalLabel': 'Basal', 'm.insulin.tryScenarioWith': 'Try in the scenario with', 'm.insulin.fastLabel': 'Rapid', 'm.insulin.fastHint': 'Bolus covers meal carbohydrates', 'm.unit.ePerDay': 'U/day',
        'm.food.pickCategory': 'Pick a category.',
        'm.food.cat.lowCarb': 'Low-carb', 'm.food.cat.lowCarb.ex': 'eggs, salad, nuts…',
        'm.food.cat.meals': 'Meals', 'm.food.cat.meals.ex': 'pasta, pizza, burger…',
        'm.food.cat.fast': 'Fast carbs', 'm.food.cat.fast.ex': 'dextrose, juice, sweets…',
        'm.food.recent': 'Recently chosen', 'm.food.recent.empty': 'None yet',
        'm.activity.type': 'Type', 'm.activity.intensity': 'Intensity', 'm.activity.duration': 'Duration', 'm.activity.open': 'Open', 'm.activity.running': '{type} · {intensity} running.', 'm.activity.stop': 'Stop activity',
        'm.kit.hint': 'Tests on top · emergency below.', 'm.kit.fingerprick': 'Finger prick', 'm.kit.ketone': 'Ketone test', 'm.kit.glucagon': 'Glucagon', 'm.kit.dextro': 'Dextrose',
        'm.kit.ready': 'now', 'm.kit.cooldown': '{name} ready in {time}', 'm.unit.min': 'min', 'm.unit.hour': 'h', 'm.unit.minShort': 'm',
        'm.toast.linkCopied': 'Link copied',
        'm.menu.profile.help': 'Choose which character you help.', 'm.menu.highscore.help': 'Your best campaign results.', 'm.highscore.subCampaign': 'Your best score for each level.', 'm.menu.share': 'Share link', 'm.menu.share.help': 'Share the link to the game — it opens the right version on any device.', 'm.menu.desktop': 'Switch to desktop version', 'm.menu.desktop.help': 'Open the full version here on this device.',
        'm.disclaimer.title': 'About the simulator', 'm.disclaimer.body': 'T1D Simulator is a learning game about factors that affect blood glucose. You help fixed, fictional characters. The game does not calculate insulin doses for real people and is not intended as a basis for treatment decisions.', 'm.disclaimer.ok': 'Got it',
        'm.profile.title': 'Character', 'm.profile.intro': 'Changes start over with the chosen character.',
        'm.settings.display': 'Display', 'm.settings.fullscreen': 'Fullscreen', 'm.settings.fullscreen.help': 'Hide the browser edges.', 'm.settings.physiology': 'Physiology', 'm.settings.physiology.help': 'Show insulin, carbs, eISF and ketones on the graph.', 'm.physiology.watermark': 'Physiology', 'm.settings.showWelcome': 'Welcome screen', 'm.settings.showWelcome.help': 'Show the welcome screen when the app opens.', 'm.settings.bgUnit': 'Blood glucose unit', 'm.settings.bgUnit.help': 'Switch between mmol/L and mg/dL.', 'm.settings.lang': 'Language', 'm.settings.lang.help': 'Switch between Danish and English.', 'm.settings.sound': 'Sound', 'm.settings.sfx': 'Sound effects', 'm.settings.sfx.help': 'Sounds for actions and events.', 'm.settings.cgm': 'CGM sounds', 'm.settings.cgm.help': 'Sound for new readings and alarms.', 'm.settings.music': 'Music', 'm.settings.data': 'Data', 'm.settings.clearHs': 'Clear highscores', 'm.settings.clearHs.help': 'Delete your saved records.', 'm.settings.clearHs.confirm': 'Delete all saved highscores? This cannot be undone.', 'm.settings.clearHs.done': 'Highscores cleared',
        'm.gameover.title': 'Game Over', 'm.gameover.whatHappened': 'What happened?', 'm.gameover.howToAvoid': 'How to avoid it next time', 'm.gameover.replay': 'Play again',

        // --- Mobile campaign (level select, intro, objectives HUD, result screens) ---
        // Shared campaign.* keys (levelLabel, objectives, startLevel, replay, retry,
        // nextLevel, basePoints, total, encouragement, selectLevel, failed.body) are
        // reused as-is — only mobile-specific strings live under m.campaign.*.
        'm.mode.campaign': 'Campaign',
        'm.menu.campaign': 'Campaign', 'm.menu.campaign.help': 'Play the levels and learn step by step.',
        'm.campaign.construction': 'Coming soon',
        'm.campaign.locked': 'Locked',
        'm.campaign.complete': 'Level complete!',
        'm.campaign.levels': '↤ Levels',

        // --- Activity type names (for log/overlay) ---
        'activity.name.cardio': 'Cardio',
        'activity.name.styrke': 'Strength training',
        'activity.name.blandet': 'Mixed sport',
        'activity.name.afslapning': 'Relaxation',

        // --- Log: activity formatting ---
        'log.activity.duration.fixed': ', {min} min',
        'log.activity.duration.open': ', open',
        'log.activity.kcal': ' (~{kcal} kcal)',
    }
};


// =============================================================================
// t() — Global translation function
// =============================================================================
//
// Looks up a key in the active dictionary. Supports {variable} interpolation.
// Fallback chain: selected language → Danish → "[key]" (error display).
//
// Usage:
//   t('ui.btn.start')                        → "Start"
//   t('log.food', {carbs: 50, protein: 10})  → "Mad: 50g K, 10g P, 5g F"
//
// @param {string} key   - Translation key (e.g. 'ui.btn.start')
// @param {object} vars  - Optional variables for interpolation
// @returns {string} The translated string
// =============================================================================
function t(key, vars) {
    const lang = appSettings.language || 'da';
    let text = (I18N[lang] || I18N['da'])[key] ?? I18N['da'][key] ?? `[${key}]`;
    // Karakterens navn er en global tekstvariabel. Slå kun karakteren op, når
    // den konkrete tekst faktisk bruger navnet; t() kaldes ofte under spillet,
    // og et unødvendigt opslag i localStorage for hver almindelig label er dyrt.
    const runtimeVars = Object.assign({}, vars || {});
    if (text.includes('{characterName}') && runtimeVars.characterName === undefined) {
        const activeCharacter = typeof getActiveCharacter === 'function'
            ? getActiveCharacter()
            : { name: 'Erik' };
        runtimeVars.characterName = activeCharacter && activeCharacter.name
            ? activeCharacter.name
            : 'Erik';
    }
    Object.entries(runtimeVars).forEach(([k, v]) => {
        text = text.replaceAll(`{${k}}`, v);
    });
    return text;
}


// =============================================================================
// BG unit helper functions — conversion between mmol/L and mg/dL
// =============================================================================
//
// All internal calculations use mmol/L. These functions convert ONLY for display.
// Conversion factor: 1 mmol/L = 18.0182 mg/dL
//
// bgUnitLabel() — returns "mmol/L" or "mg/dL" based on the user's preference.
// displayBG(mmolValue) — converts a BG value to the user's selected unit and
//   formats with the correct number of decimal places (1 for mmol/L, 0 for mg/dL).
// displayBGValue(mmolValue) — like displayBG but returns a numeric value (float).
// =============================================================================
const MMOL_TO_MGDL = 18.0182;

function bgUnitLabel() {
    return appSettings.bgUnit === 'mg' ? 'mg/dL' : 'mmol/L';
}

function displayBG(mmolValue) {
    if (appSettings.bgUnit === 'mg') {
        return Math.round(mmolValue * MMOL_TO_MGDL).toString();
    }
    return mmolValue.toFixed(1);
}

function displayBGValue(mmolValue) {
    if (appSettings.bgUnit === 'mg') {
        return Math.round(mmolValue * MMOL_TO_MGDL);
    }
    return parseFloat(mmolValue.toFixed(1));
}


// bgVars() — Standard BG threshold values + profile parameters for use in tips/texts.
// Used as t('some.key', bgVars()) for tips and texts containing BG levels and profile values.
// Returns: {unit, insulinUnit, low, high, threshold, floor, ceil, icr, isf} — all as strings.
function bgVars() {
    return {
        unit: bgUnitLabel(),
        insulinUnit: tInsulinUnit(),
        low: displayBG(4.0),       // Lower target zone
        high: displayBG(10.0),     // Upper target zone
        bonusLow: displayBG(5.0),  // Lower bonus zone
        bonusHigh: displayBG(6.0), // Upper bonus zone
        halfLow: displayBG(10.0),  // Lower half-points zone
        halfHigh: displayBG(14.0), // Upper half-points zone
        threshold: displayBG(2.5), // Hypo threshold
        floor: displayBG(4.0),     // 0-points lower bound
        ceil: displayBG(14.0),     // 0-points upper bound
        icr: game ? game.ICR : '?',
        isf: game ? game.ISF : '?',
    };
}


// =============================================================================
// translateDOM() — Translate all static HTML elements with data-i18n attributes
// =============================================================================
//
// Scans the entire DOM for elements with:
//   data-i18n="key"       → replaces textContent
//   data-i18n-title="key" → replaces title attribute
//   data-i18n-placeholder="key" → replaces placeholder attribute
//
// Called at:
//   1. App initialisation (initializeApp in main.js)
//   2. Language switch (click handler on the language toggle button)
//
// Danish text remains hardcoded in HTML as fallback — if translateDOM()
// does not run (e.g. due to an error), Danish users still see correct UI.
// =============================================================================
function translateDOM() {
    // Translate textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translated = t(key);
        // Preserve child elements by updating only the first text node,
        // NOT textContent (which would delete children).
        // Exception: elements with no children can use textContent directly.
        if (el.children.length === 0) {
            el.textContent = translated;
        } else {
            // Find the first text node and replace it
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
            const firstText = walker.nextNode();
            if (firstText) firstText.textContent = translated;
        }
    });

    // Translate title attributes (tooltips)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });

    // Translate placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });

    // Update HTML lang attribute
    document.documentElement.lang = appSettings.language || 'da';

    // Update language selection checkmarks in the settings dropdown
    const langCheckDA = document.getElementById('langCheckDA');
    const langCheckEN = document.getElementById('langCheckEN');
    const isDa = (appSettings.language || 'da') === 'da';
    if (langCheckDA) langCheckDA.textContent = isDa ? '✓' : '';
    if (langCheckEN) langCheckEN.textContent = isDa ? '' : '✓';
}


// =============================================================================
// tInsulinUnit() — Returns the correct insulin unit string for the active language
// =============================================================================
//
// Danish: "E" (Enheder)
// English: "U" (Units)
//
// Used in places where the unit text is embedded in dynamic HTML
// (e.g. insulin preset chips, slider buttons).
// =============================================================================
function tInsulinUnit() {
    return (appSettings.language || 'da') === 'en' ? 'U' : 'E';
}
