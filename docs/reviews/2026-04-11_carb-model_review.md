# Review af ny carb-model

Dato: 2026-04-11

Omfang:
- kritisk review af litteraturgrundlaget bag den nye carb-model
- review af modelbeskrivelsen
- gennemgang af implementeringen
- gennemgang af `tests/model-validation.html` og de seneste gemte Playwright-resultater

Metode:
- læst `docs/MODEL-IMPLEMENTATION.md`, `docs/BG-SCIENCE.md`, `docs/references/SOURCES.md`
- gennemgået `js/foods.js`, `js/simulator.js`, `js/hovorka.js`
- gennemgået `tests/model-validation.html` og `tests/simulation.test.js`
- kørt `node tests/simulation.test.js` (122/122 tests bestod)
- sammenholdt de lokale kilder med den citerede litteratur og nyere review-/guideline-litteratur

## Samlet vurdering

Den nye carb-model er et klart skridt fremad i forhold til den gamle faste `tau_G`-tilgang. Den fanger flere rigtige fysiologiske retninger:
- flydende sukker hurtigere end fast sukker
- mere fiber langsommere end mindre fiber
- fedt forsinker absorptionen
- protein/fedt interagerer med måltidsforløbet i stedet for at være ignoreret

Som undervisningsmodel er retningen god. Som videnskabeligt underbygget model er den endnu ikke helt stram nok. Det vigtigste problem er ikke selve idéen, men dokumentationskæden og valideringen:
- litteraturgrundlaget er kun delvist ordentligt arkiveret og registreret
- modelbeskrivelsen har interne selvmodsigelser
- flere kommentarer og validation-forventninger lover mere, end implementeringen og testdesignet faktisk kan bære
- `model-validation.html` er i sin nuværende form for støjende og for delvist fejl-designet til at fungere som stærk evidens for modellen

## Hovedfund

### 1. Største problem: litteraturkæden er ikke fyldestgørende dokumenteret

Den nye carb-model henviser mange steder til litteratur om GI, fiber, mavetømning og flydende vs. fast føde, men `docs/references/SOURCES.md` registrerer kun en lille del af de kilder, som faktisk bruges i kode og dokumentation.

De vigtigste carb-relaterede kilder nævnes i kommentarer og dokumentation, men mangler helt eller delvist i `SOURCES.md`, bl.a.:
- Jenkins 1981
- Atkinson/Wolever/Brand-Miller 2008 GI-tabeller
- Marathe 2013
- Mendoza 2008
- Kong & Singh 2008
- Horowitz-relaterede mavetømningskilder
- Würsch & Pi-Sunyer 1997
- Frost 2003
- Stahel 2016

Konsekvens:
- det er svært at auditere, hvad der er primær evidens, og hvad der er intern fortolkning
- projektets egen referencepraksis brydes: dokumentationen siger, at referencer skal hentes lokalt og samles systematisk, men den officielle kildeoversigt er ikke ajour

Der ligger godt nok flere carb-relaterede HTML-filer i `docs/references/`, men flere af dem er ikke egentlige artikler eller fuldtekstkopier. De er korte, håndlavede abstracts/notes med udtrukne tal. Det gælder især flere af de nye 2026-04-11-filer. Det er brugbart som arbejdsnoter, men ikke som stærk dokumentationsstandard.

Vurdering:
- ikke fyldestgørende som dokumenteret referencegrundlag
- delvist fyldestgørende som intern research

### 2. Modelbeskrivelsen er ikke internt konsistent om carb-bioavailability

Der er en direkte spænding mellem tre lag:

1. Hovorka-implementeringen bruger stadig `A_G = 0.8`, dvs. 80% carb-bioavailability.
2. `MODEL-IMPLEMENTATION.md` siger både, at kun 80% absorberes, og senere at EU-carb kan feedes direkte ind som fordøjelig carb uden bioavailability-korrektion for fiber.
3. `BG-SCIENCE.md` beskriver fordøjelig carb som tæt på 95-100% absorberbar og siger eksplicit, at fiber ændrer timing, ikke total.

Det er ikke den samme påstand i tre forskellige ord. Det er tre forskellige modelbudskaber.

Praktisk betyder det:
- relative forskelle mellem carb-typer kan stadig være fornuftige
- den absolutte fortolkning af "25 g fordøjelig carb" er uklar
- validation-sidens udsagn om at alle 25 g bør give omtrent samme AUC bliver svagere, når modellen stadig taber 20% i Hovorka-leddet

Dette skal afgøres eksplicit:
- enten beholdes Hovorkas `A_G = 0.8`, og dokumentationen skal sige klart at simulatoren stadig bruger et historisk Hovorka-effektivt absorptionsled
- eller også bør modellen rekalibreres mod `A_G` tættere på 1.0, hvis man vil stå på EU-konventionen "fordøjelig carb = det der absorberes"

### 3. Parametriseringen er semi-empirisk, men beskrives flere steder mere sikkert end evidensen bærer

Formlen

`tau_G = carbBase * fiberMod * liquidMod + fatDelay`

er fornuftig som heuristik, men den er ikke afledt direkte fra én valideret fysiologisk model. Den er en sammensat kalibrering, hvor:
- `simpleFraction` bruges som proxy for kemisk "hurtighed"
- `fiberPerGram` bruges som proxy for både viskositet og matrix-effekt
- `liquidFactor` bruges som proxy for pyloric sieve
- `fatDelay` bruges som proxy for CCK/GLP-1-medieret forsinkelse

Det er fint til en undervisningssimulator, men dokumentationen bør være mere tydelig om, at dette er en pragmatisk semi-mekanistisk model og ikke litteraturens direkte ligningssystem.

Særligt fiberleddet er aggressivt kalibreret. Den nye log-form giver pædagogisk separation mellem fx hvidt brød og rugbrød, men den blander flere forskellige mekanismer sammen:
- viskøs opløselig fiber
- uopløselig fiber/bulk
- fødevarematrix og partikelstørrelse

Litteraturen støtter klart retningen, men ikke nødvendigvis den specifikke én-parameter-repræsentation pr. gram fiber.

### 4. `CARB_TYPES` er nyttig, men nogle tal er svagere underbygget end kommentarerne giver indtryk af

Der er flere steder, hvor kommentarsporene og de konkrete parameter-valg ikke helt matcher hinanden.

Eksempel:
- for `hvidt_mel` angiver kommentarerne eksempeldata, der ligger tættere på fiber/carb omkring 0.06-0.08
- selve parameteren er sat til 0.04

Det kan godt være et bevidst konservativt valg, men så bør rationalet stå tydeligt. Lige nu ligner det mere, at dokumentationseksemplerne og de endelige kodeværdier ikke er ført helt færdigt sammen.

Tilsvarende gælder noget af bibliografien:
- "Wolever 2008 — International GI Tables" er ikke en ren og præcis citation
- lokale referencefiler blander nogle steder Atkinson/Wolever/Brand-Miller sammen
- Horowitz-referencerne er ikke helt bibliografisk rene

Det svækker troværdigheden mere end selve tallene gør.

### 5. Validation-siden er den svageste del af hele kæden

`tests/model-validation.html` er i sin nuværende form ikke en stærk validering af carb-modellen.

Det skyldes især fire ting:

#### 5a. Sektionerne sammenligner ofte forskellige tilfældige simulatorer

`createSim()` opretter bare `new Simulator(profile)`. Simulator-konstruktøren randomiserer bl.a. dawn-amplitude, dawn-tidspunkt og basal insulin-varighed. Det betyder, at mange validation-sektioner sammenligner scenarier på tværs af forskellige stokastiske baggrunde.

Det er direkte i modstrid med fx section 8, som siger at "kun CARB_TYPES varierer".

Konsekvens:
- AUC-spredning, peak-tider og peak-højder er delvist confoundet af baggrundsvariation
- en del af validation-sidens røde/gule fund kan være testdesignstøj, ikke modeladfærd

Dette er den vigtigste tekniske svaghed i valideringen.

#### 5b. Flere sektioner bruger peak-tid som kriterium, selv hvor kurverne er brede, forsinkede eller næsten plateau-formede

Det rammer især:
- heavy meals / pizza-effekt
- protein-scenarier
- fat-vs-carb-scenarier
- langsomme carb-typer

Peak-tid er et dårligt mål for:
- biphasiske måltider
- brede plateauer
- langsomme kurver med meget flad top

Den nye carb-type sektion har faktisk selv erkendt dette og skiftet til max-slope. Den samme erkendelse er bare ikke gennemført konsekvent i resten af validation-siden.

#### 5c. Flere forventningstekster er for stærke eller forældede

Eksempler:
- sektionen om meal variability siger, at basal bioavailability/tauFactor varierer, men basal bioavailability er fast sessionsværdi, og basal-kinetik beskrives ikke sådan i koden længere
- protein-sektionen forventer et tydeligt senere peak end carbs, men måler kun over 5 timer med peak-baseret vurdering
- fat-sektionen konkluderer næsten fra ét peak-tidspunkt, selv om fat-effekten primært er kurveform og forsinket fordeling i tid

Validation-teksterne er derfor flere steder ikke længere aligned med den faktiske model.

#### 5d. De seneste gemte Playwright-resultater viser netop denne svaghed

De seneste gemte artefakter viser bl.a.:
- section 8: `tau_G`-ordning fejler
- heavy-meal section: pizza kommer ikke senere end pasta i det valgte peak-kriterium
- fat-vs-carb section: fedtkurven vurderes som næsten identisk
- protein section: peak-tid tolkes usikkert

Samtidig består `tests/simulation.test.js` alle 122 tests, inklusive de mere direkte `tau_G`-tests for carb-typer.

Det peger stærkt på:
- enhedstestene måler modelmekanikken bedre
- validation-siden måler en blanding af model + stokastik + skrøbelige metrics

## Implementeringsreview

## Det der ser godt ud

- Arkitekturen er rimelig: `foods.js` definerer typerne, `addFood()` fylder maveblandingen, og `_substepFatProteinFFA()` beregner dynamisk `tau_G`.
- Maveblandingen skaleres proportionalt under tømning, så ratioer bevares. Det er en god og ren CSTR-approksimation.
- Unit tests for carb-types er markant bedre end validation-siden, fordi de isolerer mekanikken mere direkte.
- Tom mave fallback til 40 min bevarer bagudkompatibilitet og gør resten af modellen stabil.

## Svagheder og konkrete forbedringspunkter

### A. Fallback i `addFood()` matcher ikke den dokumenterede default

Hvis `CARB_TYPES` ikke er tilgængelig, bruges fallback:

- `simpleFraction: 0.30`
- `fiberPerGram: 0.05`

men den dokumenterede/default type `mixed` er:

- `simpleFraction: 0.20`
- `fiberPerGram: 0.08`

Det er en lille ting, men det er en reel inkonsistens. Hvis `foods.js` ikke er loadet, får man ikke den adfærd kommentaren lover.

### B. Variabelnavnet `stomachLiquidVolume` er semantisk misvisende

I modellen betyder højere `liquidFactor` faktisk "mere solid-lignende retention", fordi:
- fast føde har `liquidFactor = 1.0`
- flydende har `liquidFactor < 1.0`

Matematisk virker det, men navngivningen er bagvendt og gør koden sværere at læse. Det er ikke en fysiologisk bug, men det øger risikoen for fremtidige fejl og misforståelser.

### C. Modellen repræsenterer ikke diabetes-specifik variation i mavetømning

Der er ingen eksplicit repræsentation af:
- accelereret mavetømning
- forsinket mavetømning/gastroparese
- akut hyperglykæmi som modulator af mavetømning

Det gør ikke modellen "forkert" som generel simulator, men det er en vigtig litteraturbegrænsethed, som bør stå tydeligere som limitation.

### D. Måltidsstørrelse og energibelastning er kun indirekte med

Litteraturen om mavetømning understreger også betydningen af kalorisk belastning og meal size. I den nuværende model bestemmes `tau_G` af sammensætning, ikke af samlet energi/massetryk, bortset fra at maveindholdet tømmes proportionalt med den aktuelle mængde.

Det betyder:
- god kompositionsmodel
- svagere meal-size model

For en undervisningssimulator er det acceptabelt, men det bør siges mere åbent.

## Litteraturvurdering

## Hvad der er dækket godt

Styrker i kildesættet:
- Hovorka som kernemodel er et stærkt valg
- fat/protein i T1D er dækket med relevante T1D-studier og reviews
- GI/fiber/gastric emptying er dækket i brede træk via klassiske kilder
- dansk fødevaredatabase som basis for sukker/stivelse/fiber-forhold er fornuftig

## Hvad der mangler eller bør styrkes

### 1. En strammere og mere officiel kildeliste for carb-modellen

SOURCES.md bør eksplicit udvides med hele carb-sporet.

### 2. T1D-specifik ernærings-/meal-composition litteratur bør samles mere systematisk

Der er allerede Bell/Smart/Paterson i arkivet, men den samlede kæde mellem:
- glykemisk indeks
- carb-type
- mixed meals
- T1D-dosering

er stadig spredt mellem docs, kommentarer og små note-filer.

### 3. Variabilitet og gastroparese-litteratur bør nævnes

Selv hvis den ikke modelleres nu, bør den være med i litteraturdiskussionen, fordi den er klinisk vigtig netop for måltidsoptagelse i T1D.

## Validation-vurdering

## Dom

`tests/model-validation.html` er nyttig som explorativ visuel sanity-check, men den er ikke stærk nok som egentlig validering af den nye carb-model.

## Hvor den fungerer

- giver et hurtigt visuelt overblik
- kan opdage grove regressioner
- er nyttig til pædagogisk demo og manuel QA

## Hvor den ikke fungerer godt nok endnu

- scenarierne er ikke deterministiske nok
- kontrol og interventionsscenarier kører ofte på forskellige randomiserede simulatorer
- flere metrics er for skrøbelige
- flere forventningstekster er ikke opdateret til den nuværende model

## Prioriterede anbefalinger

### Høj prioritet

1. Gør validation deterministisk for alle litteraturkritiske sektioner.
   - Brug en "clean" simulator uden random dawn/basal-variation.
   - Alternativt: seed randomisering og brug samme seed for kontrol og intervention.

2. Ryd op i bioavailability-budskabet.
   - Beslut om modellen skal stå ved `A_G = 0.8` eller nærme sig 1.0 for EU-digestible carbs.
   - Gør README, BG-SCIENCE, MODEL-IMPLEMENTATION og kommentarer konsistente.

3. Udvid `SOURCES.md` så den faktisk dækker carb-modellen.
   - Saml alle carb-kilder ét sted med korrekte bibliografiske oplysninger.

4. Gør referencearkivet mere auditérbart.
   - Marker tydeligt hvad der er fuldtekst, abstract-snapshot og intern note.

### Mellem prioritet

5. Revider validation-metrics.
   - Brug max-slope, time-to-max-slope, early AUC, half-AUC time eller curve centroid.
   - Brug mindre peak-fiksering for fat/protein/langsomme carbs.

6. Opdater eller nedton forventningsteksterne i `model-validation.html`.
   - Flere af de nuværende tekster er stærkere end evidensen og stærkere end testen selv kan afgøre.

7. Harmoniser kodekommentarer og parameterbegrundelser.
   - Især `hvidt_mel`, bibliografiske labels og fallback-adfærd.

### Lavere prioritet

8. Overvej senere modeludvidelser for:
   - gastroparese / hurtig mavetømning
   - akut hyperglykæmi som modulator af gastric emptying
   - mere eksplicit meal-size / caloric-load effekt
   - særskilt fiber-effekt på intestinal absorption vs. gastric emptying

## Konklusion

Den nye carb-model er fagligt set lovende og klart bedre end en fast, én-størrelse-passer-alle `tau_G`.

Men hvis den skal stå som "videnskabeligt veldokumenteret", mangler der stadig oprydning på tre fronter:
- referencehygiejne
- intern konsistens i dokumentationen
- en validation-harness der virkelig isolerer det, den påstår at validere

Min samlede bedømmelse:
- modelidé: god
- implementering: overvejende solid, men med nogle inkonsistenser og tydelige forbedringspunkter
- litteraturdækning: relevant, men ikke tilstrækkeligt stramt dokumenteret
- validation-side: nyttig til QA, men endnu ikke stærk nok som evidens for modellen
