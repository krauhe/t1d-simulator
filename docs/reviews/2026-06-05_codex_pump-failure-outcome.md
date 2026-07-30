# Pump Failure Outcome Review

**Dato:** 2026-06-05  
**Scope:** Screenshot af simuleret pumpefejl ved 24 h, vurderet mod lokal modeldokumentation og klinisk litteratur om CSII-afbrydelse.

## ADVARSEL - BHB stiger for hurtigt i de første timer

**Fil:** `js/simulator.js`, linje 669-715; `tests/simulation.test.js`, linje 1835-1850  
**Subsystem:** FFA-drevet ketonmodel ved total insulinmangel  
**Problem:** Screenshotkurven ser ud til at nå DKA-tærsklen BHB >3 mmol/L omkring 5-8 timer efter pumpefejl. Det er hurtigere end nyere pumpeokklusionsdata og hurtigere end en klinisk CSII-afbrydelsesstudie på 4 timer.

**Evidens:**
- Projektets kodekommentarer og tests forventer cirka BHB 1.5-2.0 mmol/L efter 4 h og 3.5-4.5 mmol/L efter 8 h uden insulin.
- Lokal simulatorkørsel med `createCleanSimulator()` gav: 4 h BHB 1.61, 8 h BHB 3.40, 14 h BHB 5.15.
- Guerci et al. 2006 rapporterede ved CSII-afbrydelse i 4 h: BG fra 149.8 til 224.8 mg/dL og capillær beta-OHB fra 0.1 til 0.9 mmol/L.
- En nyere pumpeokklusionsmodel estimerede gennemsnitlig tid til BHB 1.6 mmol/L som 8.0 h og BHB 3.0 mmol/L som 14.2 h; tilsvarende tid til BG 300/400 mg/dL var 5.8/8.5 h.

**Vurdering:** Det tidlige BHB-forløb er sandsynligvis 1.5-2x for hurtigt for en gennemsnitlig voksen/ung med pumpebehandling uden ekstra sygdom, SGLT2-hæmmer eller lang faste. Hurtigere forløb kan dog være realistisk i højrisiko-scenarier: barn, infektion, dehydrering, lavt insulin-depot, høj stress eller SGLT2-behandling.

**Forslag:** Hvis scenariet skal repræsentere "typisk pumpe defekt", bør BHB-targets flyttes mod cirka 0.5-1.0 mmol/L ved 4 h, cirka 1.5-2.0 mmol/L ved 8 h og BHB 3.0 omkring 12-16 h. Hvis scenariet er ment som "hurtigt eskalerende højrisiko-pumpefejl", bør UI/level-tekst sige det eksplicit.

**STATUS:** ✅ FIKSET (2026-06-06)

Hele keton-pathway'en blev rekalibreret 2026-06-06 (commit pending). Den langsommere ramp blev opnået ved at forlænge den effektive ketogenese-lag (FFA_LIPO_CLEAR_HALF 60 → 180 min, repræsenterer malonyl-CoA-depletion + CPT-1-derepression) og sænke BHB_PROD_RATE (0.0028 → 0.0008) tilsvarende. Nøgle-indsigt: ved I=0 er cpt1Activity altid 1.0 uanset CPT-1-parametre, så CPT-1's form (fladet til EC50=11, n=2) løftede moderat-insulin-ketose UAFHÆNGIGT af pumpesvigt-rampen.

**Anden kalibreringsrunde (2026-06-06, playtest-feedback):** Overnight-faste lå lidt for højt (~0.9) og pumpesvigt lidt for lavt. LIPOLYSIS_EC50 8→6 og CPT1_EC50 11→7 trak moderat-insulin yderligere ned (begge uafhængige af nul-insulin-rampen), mens BHB_PROD_RATE 0.0008→0.0012 og FFA_LIPO_CLEAR_HALF 180→120 hævede rampen. Endelige tal:
- Overnight faste (G.4): 0.90 → 0.47 (Pinnaro-alignet 0.2-0.5)
- Pumpesvigt fuld G.6: +4h 1.75, +8h 2.82, +12h 3.60 (clean-state ramp: +4h 1.16, +8h 2.35, +12h 3.24)
- DKA-tærskel krydses ~12-14h. Rampen ligger nu mellem Guerci (langsom) og Laffel (hurtig).

**Tredje justering (samme dag):** Playtest af den SENE pumpesvigt-fase viste at BHB plateauede for lavt (~5.7) i stedet for at klatre mod severe DKA. BHB_VMAX sænket 0.020→0.016 (perifert keton-oxidations-loft, hæmmet ved severe acidose). Fordi MM-clearance er nær-lineær ved lav BHB men mættet ved høj BHB, hæver dette PRÆFERENTIELT det høje plateau (+48h: 5.7 → 9.5) uden at påvirke overnight nævneværdigt. LIPOLYSIS_EC50 sænket yderligere 6→5 for at holde overnight ~0.42. Endelige pumpesvigt-tal: +4h 1.82, +8h 3.22, +12h 4.37, +24h 6.75, +48h 9.45 (severe DKA, klatrer fortsat). De tre node-tests passerer stadig (155/155).

## OK - BG-stigningen ligger rimeligt

**Fil:** `js/simulator.js`, Hovorka-kobling + renal/glukotoksicitetsmodeller  
**Subsystem:** Hyperglykæmi ved insulinmangel  
**Problem:** Ingen egentlig fejl. Screenshot viser BG fra cirka 7 til cirka 18-20 mmol/L inden for de første 5-15 timer efter pumpefejl.

**Evidens:**
- Nyere pumpeokklusionsdata estimerer BG 300 mg/dL (16.7 mmol/L) omkring 5.8 h og BG 400 mg/dL (22.2 mmol/L) omkring 8.5 h.
- Screenshotkurven ser ud til at ramme cirka 18-20 mmol/L i samme størrelsesorden efter pumpefejlen.

**Vurdering:** BG-stigningen er klinisk plausibel. Det er ikke nødvendigvis et problem at BG senere falder noget, hvis modellen samtidig har kraftig glukosuri, ingen madtilførsel og faldende lever-glykogen. Men BG omkring 12-14 mmol/L efter langvarig total insulinmangel med BHB omkring 9-10 mmol/L bør forklares som et euglykæmisk/nær-euglykæmisk DKA-lignende forløb, ikke som et normalt pumpefejlforløb.

**STATUS:** ⚠️ ACCEPTABEL

## ADVARSEL - Høj BHB efter 24-48 h er plausibel, men klinisk alvorlighed skal være tydelig

**Fil:** `docs/BG-SCIENCE.md`, DKA-afsnit; `js/simulator.js`, linje 616-633 og 3034-3098  
**Subsystem:** DKA/alvorlig acidose ved vedvarende insulinmangel  
**Problem:** Screenshot viser BHB omkring 8-10 mmol/L sent i forløbet. Det er fysiologisk plausibelt ved ubehandlet DKA, men patienten ville typisk være klinisk meget syg længe før dette punkt.

**Evidens:**
- BG-SCIENCE angiver DKA-regime som beta-OHB 3-25+ mmol/L, pH <7.30 og bicarbonat <18 mmol/L.
- ISPAD/ADA-kriterier bruger BHB >=3.0 mmol/L som DKA-relevant tærskel sammen med acidosekriterier.
- Lokal modeldokumentation beskriver 16-24 h ved total insulinmangel som BHB 7-15+ og svær acidose.

**Vurdering:** Slutniveauet er ikke urimeligt, men det skal kobles hårdt til symptomer/game-over/handlingskrav. En kurve med BHB 9-10 mmol/L uden tydelig klinisk konsekvens ville være pædagogisk misvisende.

**STATUS:** ❌ ÅBEN

## Kilder

- Guerci B et al. 2006. "Early detection of insulin deprivation in continuous subcutaneous insulin infusion-treated patients with type 1 diabetes." PubMed: https://pubmed.ncbi.nlm.nih.gov/16472052/
- "Time to Moderate and Severe Hyperglycemia and Ketonemia Following an Insulin Pump Occlusion." PMC/search result: https://pmc.ncbi.nlm.nih.gov/articles/PMC11531023/
- BG-SCIENCE.md DKA-afsnit: `docs/BG-SCIENCE.md`
- MODEL-IMPLEMENTATION.md keton/DKA-afsnit: `docs/MODEL-IMPLEMENTATION.md`

## Status-opsummering

- KRITISK: 0
- ADVARSEL: 1 fikset (tidlig BHB-ramp rekalibreret 2026-06-06), 1 delvist (sen høj BHB — se nedenfor)
- NOTE: 0
- OK/ACCEPTABEL: 1

**Opdatering 2026-06-06:** Hoved-advarslen (for hurtig tidlig BHB-ramp) er fikset via fuld keton-pathway-rekalibrering. Den anden advarsel (høj BHB 9-10 ved 24-48h skal kobles hårdt til symptomer/game-over) er stadig relevant som UI/game-design-opgave — selve BHB-niveauet er fysiologisk plausibelt ved ubehandlet DKA, men den kliniske konsekvens-kobling er ikke en del af keton-modellen og forbliver en separat opgave.
