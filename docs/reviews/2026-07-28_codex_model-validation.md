# Kritisk review af model-validation

**Dato:** 2026-07-28

**Reviewer:** Codex med projektets `phys-reviewer`- og `playwright-test`-workflows

**Gren:** `codex/physiology-followups`

**Primært scope:** `tests/model-validation.html`, `tests/activity-validation.js`, `tests/e2e/smoke.spec.js`

**Krydskontrol:** `js/hovorka.js`, `js/physiology-engine.js`, `js/simulator.js`, `tests/simulation.test.js`, `tests/physiology-engine-api.test.js` og `docs/MODEL-IMPLEMENTATION.md`

## Samlet vurdering

`model-validation.html` var omfattende, men strukturen gjorde det svært at skelne mellem letfortolkelige scenarier, mekanismechecks og avancerede interne diagnostikforsøg. Siden havde 9 kapitler og 44 testsektioner. Det oprindelige review udvidede den til 11 kapitler og 52 sektioner. En opfølgning samme dag fjernede den forældede relaxation-test, så den aktuelle side har 51 sektioner med en klarere progression fra basal fysiologi til avanceret modeldiagnostik.

De vigtigste mangler var eksplicit dawn-ablation, langtidsinsulinets leveringsprofil, den fulde motionsmatrix, interaktionen mellem aktiv insulin og bevægelse, langvarig aktivitet, afslapning, stress, søvn og glukotoksicitet. De manglende checks er nu tilføjet. To eksisterende tests brugte desuden konklusioner, som ikke fulgte af det målte signal; de er rettet uden at ændre modelkode eller modelparametre.

Den oprindelige browserkørsel gennemførte alle 52 sektioner uden JavaScript-fejl eller røde konklusioner. Opfølgningen gennemførte de aktuelle 51 sektioner med samme resultat. Tre åbne kalibreringsfund står fortsat som gule advarsler. Det er korrekt: siden er et sæt modeladfærdschecks, ikke dokumentation for klinisk validering.

## Ny organisering

| Kapitel | Emne | Sektioner |
|---|---|---:|
| A | Baseline og døgnvariation | 6 |
| B | Insulinrespons | 3 |
| C | Mad og makronæringsstoffer | 8 |
| D | Faste karakterer og modelparametre | 4 |
| E | Motion | 5 |
| F | Kontraregulation og nyrefunktion | 2 |
| G | Protein, glukagon og leverdepot | 6 |
| H | Stress, søvn og metabolisk tilpasning | 3 |
| I | Ketonmodel | 6 |
| J | Stokastisk variation | 3 |
| K | Avanceret: ikke-lineær insulindiagnostik | 5 |
| **I alt** |  | **51** |

Siden indleder nu med en kort dæknings- og scopeforklaring. Den angiver eksplicit, at beståede tests viser overensstemmelse med de aktuelle ligninger og kalibreringsintervaller, men ikke klinisk nøjagtighed for en individuel person.

## Findings og rettelser

### 1. Utydelig blanding af scenarier og intern diagnostik

**STATUS: ✅ FIKSET (2026-07-28)**

Kontraregulation, leverfunktion, stress og avanceret insulinrespons var blandet i brede kapitler. Kapitlerne F-H er opdelt efter fysiologisk funktion, mens gain-map, clamp og non-linearitet nu ligger samlet i kapitel K med en tydelig “Advanced”-betegnelse.

### 2. Dawn-effekten blev vist, men ikke isoleret

**STATUS: ✅ FIKSET (2026-07-28)**

Der er tilføjet et matchet dawn on/off-forsøg fra samme steady state. Det gør det muligt at se, om morgenstigningen faktisk skyldes dawn-modulet frem for almindelig modeldrift. I den aktuelle deterministiske kørsel var forskellen ved kl. 08:00 2,81 mmol/L, og EGP var 1,067 mod 0,748 mmol/min.

### 3. Langtidsinsulinets leveringsprofil manglede

**STATUS: ✅ FIKSET (2026-07-28)**

En ny test viser ramp-up, plateau og hale over hele 28-timers levetiden og integrerer den leverede mængde. En deterministisk 20 E dosis leverer 16,40 E efter den implementerede biotilgængelighed på 0,82. Testen kontrollerer både profilens form og massebevarelse.

### 4. Motionskapitlet dækkede ikke det vigtigste læringssamspil

**STATUS: ✅ FIKSET (2026-07-28)**

**OPFØLGNING: ✅ FIKSET (2026-07-28)** - Den forældede E.6 relaxation-test er fjernet, fordi den offentlige simulator nu kun viser cardio, styrke og blandet aktivitet. Det interne relaxation-API er ikke ændret i denne opfølgning.

Motionskapitlet indeholder nu:

1. medium cardio, styrke og blandet aktivitet;
2. styrketræning ved lav, medium og høj intensitet;
3. en komplet 3 x 3-matrix for aktivitetstype og intensitet;
4. aktiv hurtiginsulin ved bolus -120, -60 og 0 minutter samt ingen ekstra bolus, alle ved tre intensiteter;
5. 180 minutters kontinuerlig styrketræning med kontrol omkring stoptidspunktet.

Insulin/motionsforsøget bruger et fast 1 E modelinput og samme BG på 10,0 mmol/L ved aktivitetsstart. Hvert aktivitetsforløb har en hvilekontrol med identisk insulinforløb. Resultatet måler derfor bevægelsens ekstra modelvirkning og ikke bolusens selvstændige BG-effekt.

Den samme interaktion er nu en automatisk regressionstest i `activity-validation.js`: 12 aktivitetsscenarier og 12 matchede hvilekontroller. Uden ekstra bolus var bevægelsesreduktionen 2,20, 4,00 og 5,00 mmol/L ved lav, medium og høj intensitet. Den stærkeste boluskontekst gav 2,60, 4,57 og 5,61 mmol/L. Aktiv insulin øgede dermed bevægelsesreduktionen med 0,58 mmol/L ved medium og 0,61 mmol/L ved høj intensitet i dette faste modeleksempel.

Dette er et relationelt modelcheck og en læringsillustration, ikke en doseringsregel.

### 5. Stress, søvn og glukotoksicitet var ikke synligt dækket

**STATUS: ✅ FIKSET (2026-07-28)**

Kapitel H indeholder nu separate forsøg for akut/kronisk stress, søvnunderskudskæden og opbygning samt restitution af glukotoksisk insulinresistens. Alle tre checks består i den aktuelle model.

### 6. Redundant og død testkode gjorde siden sværere at vedligeholde

**STATUS: ✅ FIKSET (2026-07-28)**

En ubrugt og defekt `runScenario()`-hjælper er fjernet. En 72-timers plasma-insulin-staircase er også fjernet, fordi gain-map-diagnostikken viser det samme non-lineære respons mere direkte og med færre konfunderende tidsforløb.

### 7. PEIS-testen sammenlignede absolut slut-BG

**STATUS: ✅ FIKSET (2026-07-28)**

Den gamle konklusion blev påvirket af forskellig baggrundsdrift efter aktivitet. Testen sammenligner nu hver insulindosis med en matchet nul-dosis-kontrol i samme PEIS-tilstand. Den kontrollerer dermed insulinets ekstra effekt. Den aktuelle effekt steg fra 2,37 til 2,76 mmol/L ved 1 E og fra 5,00 til 5,96 mmol/L ved 2 E.

### 8. Lever/glukagon-testen krævede en ikke-underbygget monoton BG-rækkefølge

**STATUS: ✅ FIKSET (2026-07-28)**

Den tidligere test krævede, at glukagonens netto-BG-respons faldt monotont efter gentagen motion. Modellens relevante begrænsning er leverdepotet, men samtidig modeldrift kan skjule en lille forskel i netto-BG. Testen kontrollerer nu direkte, at leverdepotet falder, at responsen er positiv og endelig, og rapporterer nettoresponsen deskriptivt.

### 9. Alle features bør ikke duplikeres på den visuelle side

**STATUS: ⚠️ BY DESIGN**

HAAF-state transitions, CGM-fejltilstande, inputvalidering, campaign-routing og spilregler er fortsat dækket i de automatiske Node- og Playwright-suiter. De duplikeres ikke på `model-validation.html`, fordi de ikke primært er fysiologiske kurvesammenligninger. Scopepanelet forklarer denne arbejdsdeling.

### 10. Kalibreringsfund der fortsat er åbne

**STATUS: ❌ ÅBEN**

Tre advarsler er reproducerbare og bør undersøges som selvstændige modelopgaver:

1. Måltider accelererer ikke leverdepotets genopfyldning nok til sidens mål på højst 8 timer; den målte restitution er over 12 timer.
2. Baseline-BHB efter 24 timer er 0,50 mmol/L på første modeldøgn.
3. Det absolutte clamp M-value ved insulin 60 mU/L er 14,5 mg/kg/min mod Shetty-målet 4,4 ± 0,4. Kontrolsubtraherede motionsinkrementer kan stadig sammenlignes, men den absolutte insulin-dose-respons er ikke valideret.

Disse fund er ikke ændret i dette arbejde, fordi en korrektion ville kræve særskilt fysiologisk analyse, litteraturforankret kalibrering og et fix-decision-doc.

## Verifikation

1. `tests/activity-validation.js`: 11 PASS, 3 PARTIAL, 3 NOT TESTABLE, 0 FAIL.
2. Ny bolus/intensitetsmatrix: 12/12 scenarier finite, 4/4 intensitetsrækkefølger består, 2/2 medium/høj-sammenligninger viser forstærkning ved aktiv insulin.
3. Headless Chrome, desktop: 52/52 sektioner gennemført, 0 runtime-fejl, 0 console-fejl og 0 røde konklusioner.
4. Headless Chrome, mobil viewport: siden er responsiv, og testkort, grafer og betingelser kan læses uden horisontal layoutfejl.
5. Playwright smoke: 6/6 tests består, inklusive en ny regression der kræver, at alle 52 sektioner gennemføres uden JavaScript-fejl. Den ville have fanget den tidligere `createEngine is not defined`-fejl.

**Opfølgende verifikation (2026-07-28):** Smoke-forventningen er opdateret til 51 sektioner, og den aktuelle browserside gennemfører 51/51 uden JavaScript- eller konsolfejl. E.5 har nu synlige start-/stopmarkører, og den sekundære y-akse kan ikke længere forveksles med en ISF-diskontinuitet.

Lokale visuelle artefakter ligger i `tests/playwright/2026-07-28_model-validation/` og er med vilje gitignored.

## Samlet status

- **Fikset:** 8 findings
- **By design:** 1 afgrænsning
- **Åbne kalibreringsfund:** 3
- **Modelkode eller parametre ændret:** Nej
- **Visuelle modelchecks efter opfølgning:** 51/51 gennemført uden røde konklusioner
