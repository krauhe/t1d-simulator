# Codex-review: E5 og den præcise 120-minutters ISF-forsinkelse

**Dato:** 2026-08-05  
**Scope:** E5 i `tests/model-validation.html`, styrketræningens PEIS-timing i `js/physiology-engine.js` og den tilhørende evidens  
**Brugerobservation:** ISF ser ud til først at stige efter præcis 2 timer  
**Samlet vurdering:** Den for skarpe modelantagelse og den mindre numeriske diskontinuitet er rettet og verificeret lokalt

> **Status update (2026-08-05):** Fundene i dette review er implementeret med
> en glat Hill-latenstidsgate, fjernede komponent-cutoffs og minutopløsning i
> E5. Se `2026-08-05_strength-smooth-peis-onset-fix.md`.

## Kort konklusion

E5 viser den nuværende implementering korrekt. Styrketræning har bevidst
`insulinSensitivityDelayMin = 120`, og alle tre insulinmedierede
motionskomponenter holdes derfor præcist på nul frem til 120 minutter efter
aktivitetens start.

Det præcise tidspunkt er ikke identificeret i den citerede fysiologiske
litteratur. Young et al. (2023) støtter, at insulinmedieret glukoseudnyttelse
ikke steg under et 45-minutters styrkepas og den tidlige observationsperiode,
men studiet identificerer ikke en universel biologisk tænding efter præcis 120
minutter. Projektets egen dokumentation beskriver også de 120 minutter som et
konservativt implementeringsvalg og ikke som en målt molekylær tidskonstant.

Derudover undertrykker modellen meget små komponentbidrag med en hård cutoff.
Det skaber et lille reelt spring, når late-komponenten passerer 0,005. E5
plotter kun ISF hvert 5. minut, så den første viste værdi efter grænsen er ved
minut 125, hvor ISF allerede er steget omkring 5 %. Det får overgangen til at
se skarpere ud end den interne minutkurve.

## 1. [ADVARSEL] Den rene 120-minutters forsinkelse er fysiologisk for præcis

**STATUS: ✅ FIKSET (lokalt, 2026-08-05)** — Den rene delay er erstattet af en
glat fjerdeordens Hill-gate med 150 minutters onset-halvtid.

Styrkeprofilen sætter forsinkelsen direkte til 120 minutter i både engine- og
spilkataloget:

- `js/physiology-engine.js:267-281`
- `js/simulator.js:105-121`

`exerciseRectangularResponse()` beregner først `delayedAge = ageMin - delayMin`
og returnerer nul for alle værdier, hvor `delayedAge <= 0`:

- `js/physiology-engine.js:207-235`

`currentISF` anvender den samme forsinkelse på fast-, early- og late-komponenten:

- `js/physiology-engine.js:2636-2705`

Fast-komponenten er samtidig helt slået fra for styrke, så der findes ingen
anden insulinmedieret bevægelse før 120-minuttersgrænsen. Det er derfor en
deterministisk modelkontrakt, ikke et tilfældigt resultat af E5.

### Evidensvurdering

Young et al. (2023) undersøgte 25 voksne med T1D under 45 minutters
styrketræning med en glukose-tracer-clamp. Insulinmedieret glukoseudnyttelse var
uændret, mens ikke-insulinmedieret udnyttelse steg under aktiviteten og vendte
tilbage mod baseline cirka 30 minutter efter. Det støtter, at den hurtige
insulinmedierede styrkekomponent skal være lille eller fraværende i det tidlige
vindue. Det identificerer ikke en diskret effektstart 120 minutter efter
aktivitetens begyndelse.

Dreyer/Vissing et al. (2008) fandt i raske unge mænd øget ben-glukoseoptagelse
under den første og anden recovery-time samt øget AS160/TBC1D4-fosforylering
ved 1 time. Studiet isolerer ikke insulinmedieret optagelse og er ikke udført i
T1D, så det kan ikke alene kalibrere simulatoren. Det taler dog imod at fortolke
120 minutter som en generel fysiologisk nul-til-en-grænse.

Projektets egne evidensnoter er enige i denne begrænsning:

- `docs/BG-SCIENCE.md:1134` kalder den præcise forsinkelse et konservativt
  implementeringsvalg og ikke en identificeret molekylær konstant.
- `docs/reviews/2026-07-23_strength-postexercise-peis-fix.md` beskriver samme
  valg som en transportmodel-antagelse.

### Vurdering

Koden gør det, den er skrevet til. Derfor er det ikke en klassisk kodebug.
Som fysiologisk tidsprofil er den rene forsinkelse imidlertid for kunstig og
bør betragtes som et åbent modelproblem, især fordi E5 er beregnet til klinisk
inspektion.

## 2. [NOTE] Cutoff skaber et lille faktisk spring kort efter 120 minutter

**STATUS: ✅ FIKSET (lokalt, 2026-08-05)** — Små komponenter summeres nu uden
en hård cutoff; kun sessionens levetid bruges til oprydning.

Responsfunktionen er i sig selv kontinuert ved 120 minutter, men komponenterne
tilføjes først, når deres boost er større end en hård cutoff:

- late-cutoff er `0.005` i `js/physiology-engine.js:197-200`.
- summeringen bruger `lateBoost > ENGINE_EXERCISE_LATE_CUTOFF` i
  `js/physiology-engine.js:2692-2705`.

For E5's 180-minutters medium styrkepas gav en direkte grænsetest:

| Minut fra start | Effektiv ISF | PEIS-faktor | Bemærkning |
|---:|---:|---:|---|
| 119,00 | 3,000000 | 1,000000 | Alle komponenter nul |
| 120,00 | 3,000000 | 1,000000 | Ren delay-grænse |
| 120,25 | 3,000000 | 1,000000 | Respons findes matematisk, men er under cutoff |
| 120,50 | 3,015811 | 1,005270 | Late-komponenten passerer cutoff og indsættes |
| 121,00 | 3,031425 | 1,010475 | Videre kontinuert opbygning |
| 125,00 | 3,149570 | 1,049857 | Første post-delay-punkt på E5's ISF-kurve |

Springet er lille, cirka 0,016 mmol/L/U i effektiv ISF, men det modsiger
kommentaren om, at den samlede viste respons er matematisk kontinuert.

## 3. [NOTE] E5's 5-minutters plotning fremhæver knækket

**STATUS: ✅ FIKSET (lokalt, 2026-08-05)** — E5 plotter nu ISF hvert minut og
har ikke længere en onset-markør ved præcis minut 120.

E5 gemmer minut-snapshots, men føjer kun et ISF-punkt til grafserien hvert 5.
minut (`tests/model-validation.html:4027-4035`). Grafen annoterer samtidig
minut 120 som “Delayed sensitivity begins” (`tests/model-validation.html:4057-4061`).

Det betyder, at grafen går fra 3,000 ved minut 120 direkte til cirka 3,150 ved
minut 125. Plotningen opfinder ikke forsinkelsen, men den får en allerede skarp
modelantagelse til at fremstå endnu mere abrupt.

## 4. [OK] Ingen stop-tidsfejl ved minut 180 og ingen relevant dt-afhængighed

**STATUS: ✅ OK**

Det oprindelige formål med E5 var at sikre, at følsomheden ikke først blev
tændt, når aktiviteten stoppede. Den kontrakt holder:

- følsomheden er allerede aktiv ved minut 150;
- stop ved minut 180 fryser sessionens varighed uden at oprette en ny effekt;
- ISF fortsætter uden et stop-induceret spring;
- resultaterne ved dt = 1, 0,5 og 0,25 minut var praktisk identiske.

Eksempel ved minut 180:

| Tidsstep | Effektiv ISF |
|---:|---:|
| 1,00 min | 3,948402 |
| 0,50 min | 3,948379 |
| 0,25 min | 3,948367 |

Den præcise 2-timersstart skyldes derfor ikke numerisk ustabilitet eller
event-rækkefølgen omkring det automatiske stop.

## Implementeret rettelsesretning

Modelændringen er gennemført som en koordineret fysiologisk kalibrering:

1. Bevar fraværet af en stor hurtig styrke-PEIS under det 45-minutters Young-
   vindue.
2. Erstat den rene 120-minutters delay med en glat, gradvis onset-funktion, som
   kan være meget lille tidligt uden at være matematisk præcis nul frem til ét
   bestemt minut.
3. Bevar det validerede 24-timers mål for styrketræningens late-komponent.
4. Fjern komponent-cutoffens bidrag til den viste ISF-kurve eller anvend cutoff
   kun til oprydning af udløbne sessioner.
5. Opdatér E5 til minutopløsning omkring onset og test både kontinuitet,
   tidlig-recovery-vinduet og 24-timersendepunktet.

Det dedikerede fix-decision-doc med ligning, kalibreringsmål og før/efter-data
ligger i `docs/reviews/2026-08-05_strength-smooth-peis-onset-fix.md`.

## Filer og kilder gennemgået

- `tests/model-validation.html:3984-4099`
- `tests/simulation.test.js:1364-1402` og `1666-1690`
- `js/physiology-engine.js:156-235`, `267-281`, `2604-2755` og `3417-3463`
- `js/simulator.js:46-121` og `1007-1035`
- `js/hovorka.js:151-157` og `403-450`
- `docs/MODEL-IMPLEMENTATION.md:1481-1533`, `1655-1680` og `1814-1835`
- `docs/BG-SCIENCE.md:1030-1134`
- `docs/references/Young_2023_ResistanceExerciseGlucoseDynamicsT1D.html`
- `docs/references/Vissing_2008_ResistanceExerciseAS160Recovery.html`
- `docs/references/Breen_2011_ResistanceExerciseGlycemicControl.html`
- `docs/reviews/2026-07-23_strength-postexercise-peis-fix.md`

## Statusoversigt

- Fiksede advarsler: 1
- Fiksede noter: 2
- Åbne fund: 0
- Bekræftede integrations-/stopfejl: 0
