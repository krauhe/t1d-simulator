# CGM-regressionstest - kritisk gennemgang

**Dato:** 2026-07-30
**Scope:** `tests/clinical-equivalence.js`, CGM-testkontrakten, testinitialisering og eksisterende CGM-dækning.

## Konklusion

De tre fejl er reproducerbare, men de viser **ikke en ændring i den underliggende
blodglukosefysiologi**. Den frosne baseline fra 2026-07-23 blev lavet, da
`Simulator(..., 'sandbox')` stadig havde `cgmSensorFaults=true`. Den nuværende
sandbox har bevidst `cgmSensorFaults=false`; kun kampagnebane 10 aktiverer
selvtest/sensortab. Når den gamle modulindstilling genaktiveres, reproducerer den
nuværende kode den gamle baseline præcist i alle tre fejlede scenarier.

Testen er derfor rød, fordi baseline og den aktuelle produktkontrakt er forskellige.
Den må ikke bare ignoreres, men baselinen bør heller ikke blot regenereres: den
nuværende test blander fysiologisk regression, CGM-forsinkelse, tilfældig sensorstøj
og sensor-fejltilstande i samme punkt-for-punkt-sammenligning.

## [ADVARSEL] - Baseline tester en udgået sensor-kontrakt

**Fil:** `tests/clinical-equivalence.js:91-224`, `js/simulator.js:218-224`
**Subsystem:** Regressionstest / CGM-modulvalg
**Problem:** Baseline blev frosset med sensor-fejltilstande aktiveret i sandbox.
Den nuværende simulator deaktiverer dem i sandbox og i kampagnebane 1-9.

**Evidens:** Firevejsdiagnostikken gav:

| Scenarie | Nuværende faults-off mod gammel baseline | Gammel faults-on mod gammel baseline |
|---|---:|---:|
| bolus-2u | 44 CGM-fejl, maks. 1,0191 mmol/L | 0 fejl, maks. 0,0000 |
| exercise-cardio | 29 CGM-fejl, maks. 1,1056 mmol/L | 0 fejl, maks. 0,0000 |
| ketones-dka | 40 CGM-fejl, maks. 4,7063 mmol/L | 0 fejl, maks. 0,0000 |

`trueBG` var identisk i alle tre scenarier med den gamle initialisering. Forskellen
opstår, fordi self-test-kandidatvejen med `cgmSensorFaults=true` trækker ekstra
tilfældige tal. Det forskyder alle senere CGM-støjtræk, selv når fysiologien er ens.

**Forslag:** Erstat den gamle baseline med en eksplicit nuværende testkontrakt:
sensor-fejltilstande slået fra i almindelige fysiologiscenarier; bane 10 testes separat.

**STATUS:** ✅ FIKSET (denne commit/2026-07-30) - fysiologibaselinen kræver nu
`cgmSensorFaults=false`, mens bane-10-fejltilstande forbliver særskilt testet.

## [ADVARSEL] - Testens BG-hjælper opretter en inkonsistent modeltilstand

**Fil:** `tests/harness.js:176-180`
**Subsystem:** Scenarieinitialisering
**Problem:** `setSimulatorBG()` sætter `trueBG`, `cgmBG` og plasma-kompartmentet
`Q1`, men ikke det perifere glukosekompartment `Q2` eller CGM-kompartmentet `C`.
Det giver et kunstigt glukose- og sensorspring ved scenariestart.

**Evidens:** Produktionsmotorens `PhysiologyEngine.setBG()` skalerer `Q1` og `Q2`
proportionalt og sætter `C`, `trueBG` og `cgmBG` samlet
(`js/physiology-engine.js:3544-3565`). API-testen verificerer allerede denne
kontrakt (`tests/physiology-engine-api.test.js:280-297`). Når diagnostikken bruger
den korrekte initialisering, ændres både `trueBG` og `cgmBG` i forhold til den gamle
baseline; den gamle baseline har altså frosset en kunstig initial transient.

**Forslag:** Lad `tests/harness.js::setSimulatorBG()` delegere til
`sim.engine.setBG(targetBG)`. Gennemgå derefter de ændrede fysiologiske kurver, før
en ny baseline godkendes.

**STATUS:** ✅ FIKSET (denne commit/2026-07-30) - hjælperen delegerer nu til
`sim.engine.setBG(targetBG)`, og berørte fixturer er regenereret og gennemgået.

## [ADVARSEL] - Én baseline blander deterministisk fysiologi og stokastisk sensor

**Fil:** `tests/clinical-equivalence.js:39-69`
**Subsystem:** Testdesign
**Problem:** `cgmBG` sammenlignes punkt for punkt med tolerance 0,15 mmol/L i de
samme scenarier, som skal beskytte insulin-, mad-, motions- og ketonfysiologien.
En tilsigtet ændring i antallet af RNG-træk kan derfor gøre hele regressionssuiten
rød uden at ændre `trueBG`.

**Forslag:** Del kontrakten i to:

1. **Fysiologisk regression:** `noiseEnabled=false`,
   `cgmSensorFaults=false`, korrekt `setBG()`. Sammenlign `trueBG`, IOB, COB,
   ketoner, acidose og hjernedeficit. Et deterministisk interstitielt CGM-signal
   kan beholdes, hvis det navngives som en separat lag-kontrakt.
2. **CGM-sensortests:** test forsinkelse, støj, drift, diskontinuiteter,
   kompression og bane-10-fejltilstande hver for sig.

**STATUS:** ✅ FIKSET (denne commit/2026-07-30) - fysiologibaselinen bruger nu et
deterministisk interstitielt signal; stokastisk CGM har separate komponenttests.

## [ADVARSEL] - Den visuelle MARD-test har en selvmodsigende assertion

**Fil:** `tests/model-validation.html:5668-5752`
**Subsystem:** CGM-kalibrering
**Problem:** Testen accepterer MARD mellem 2 og 20 %, men succes-teksten siger,
at resultatet ligger i litteraturens 8-10 %-område. En værdi på 3 % eller 18 %
vil derfor få grønt flueben med en forkert forklaring. Ét 6-timers måltidsforløb
er desuden ikke en tilstrækkelig MARD-validering, fordi forsinkelse under en hurtig
glukoseændring blandes med sensorens målefejl.

**Evidens:** `BG-SCIENCE.md:2662-2679` beskriver MARD som en aggregeret
referencepar-metrik og angiver cirka 8-10 % for moderne sensorer samt dårligere
nøjagtighed i hypoglykæmiområdet. `MODEL-IMPLEMENTATION.md:2880-2903` beskriver
modellens separate støj-, drift- og springmekanismer.

**Forslag:** Behold måltidsfiguren som kvalitativ lag-visualisering. Flyt MARD til
en særskilt, automatiseret test over flere BG-niveauer, seeds og referencepar med
foruddefinerede litteraturmål.

**STATUS:** ✅ FIKSET (denne commit/2026-07-30) - den selvmodsigende assertion er
fjernet. Figuren er nu eksplicit kvalitativ, og den viste forskel er beskrivende
uden klinisk MARD-pass/fail.

## [OK] - Fejltilstandenes basale state transitions er dækket

**Fil:** `tests/simulation.test.js:904-960`, `2906-2960`
**Subsystem:** CGM-selvtest, sensortab og warmup
**Vurdering:** Testene bekræfter, at fejltilstande kun er aktive i bane 10, at
offline/warmup skaber datagab, og at fysiologien fortsætter under selvtest.
De bør bevares og suppleres, ikke erstattes af den frosne støjkurve.

**STATUS:** ⚠️ ACCEPTABEL

## Anbefalet implementeringsrækkefølge

1. Ret `setSimulatorBG()` til at bruge `engine.setBG()`.
2. Gør fysiologiregressionen deterministisk og uafhængig af sensor-fejl/RNG.
3. Regenerér først derefter fysiologibaselinen og gennemgå de ændrede endpoints.
4. Tilføj separate automatiske CGM-tests for:
   - førsteordens interstitiel respons ved `ka_int=0.073 min⁻¹`, hvor
     `dC/dt = ka_int * (G-C)` har enheder mmol/L/min, halvresponstid
     `ln(2)/ka_int = 9,50 min` og tidskonstant `1/ka_int = 13,70 min`;
   - samme seed giver identisk sensortrace;
   - støjens middelværdi og standardafvigelse ved mindst tre BG-niveauer;
   - driftens amplitude og periode;
   - sensor-clamp 2,2-30 mmol/L;
   - kompressionens fortegn, fade-in og fade-out;
   - automatisk selvtest med kontrolleret kandidat og RNG;
   - eksisterende offline/warmup/state transitions i bane 10.
5. Erstat den nuværende 2-20 %-MARD-grænse med en testprotokol, der faktisk
   matcher den valgte litteraturreference.

## Statusopsummering

- KRITISK: 0
- ADVARSEL: 0 åbne
- FIKSET: 4
- OK/ACCEPTABEL: 1
- Samlet status: Testkontrakten er repareret. Klinisk baseline består 8/8,
  golden master består 7/7 bit-identisk, standalone-paritet består 10/10 med
  nulafvigelse, og engine-API-suiten består 34/34.
