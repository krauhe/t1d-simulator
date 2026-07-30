# Ikke-lineær insulin dosis-respons — Hill-tærskler for fedt, muskel og lever

**Dato:** 2026-06-13
**Type:** Beslutnings-doc (forslag — afventer godkendelse før implementering)
**Status:** ✅ IMPLEMENTERET (2026-06-13) — se "Implementering — faktisk resultat" i bunden
**Relaterer til:** TODO #6 ("Non-lineær insulin dosis-respons med Hill-kurver for lever, muskel og fedtvæv")
**Berørte filer (forventet):** `js/hovorka.js`, `tests/simulation.test.js`, `tests/model-validation.html`, `docs/MODEL-IMPLEMENTATION.md`
**Videnskabelig basis:** `docs/BG-SCIENCE.md` §25 (vurderet tilstrækkelig 2026-06-13 — ingen omskrivning nødvendig)

---

## Baggrund

Under en diskussion om dead zone-fænomenet beskrev brugeren en konkret lived experience med to dele:

1. **Ved inaktivitet:** der findes en "dead zone" — en lille korrektionsdosis ser ud til ikke at virke, og en efterfølgende dosis kan så ramme uforholdsmæssigt hårdt (insulin stacking).
2. **Efter motion:** en times motion gør de næste ~24 timer markant nemmere at styre — insulin opfører sig mere forudsigeligt/lineært.

Dette er to veldokumenterede fysiologiske fænomener:

- **Dead zone / small-dose paradox** opstår fordi de tre insulin-følsomme væv har forskellige aktiveringstærskler (EC50). Mellem leverens og musklens arbejdsområde kan insulin undertrykke lever-EGP og lipolyse uden endnu at rekruttere perifert glukoseoptag — så BG falder ikke synligt (BG-SCIENCE §25).
- **Post-exercise insulin sensitivity (PEIS)** øger muskel-insulinfølsomheden i 24-48 t efter motion (Mikines 1988; Cartee 2015), hvilket indsnævrer lever-muskel-EC50-gabet og dermed dead zone.

Simulatoren kan i dag **ikke vise nogen af delene**, fordi insulinvirkningen er modelleret lineært (se Diagnose). Featuren har høj læringsværdi: den lader spilleren selv opdage at "inaktiv = svær at styre" mens "trænet = nem at styre".

## Diagnose

### Nuværende implementering (lineær)

I `js/hovorka.js` er de tre insulin-effekter første-ordens kompartmenter, lineære i plasma-insulin `I` [mU/L]:

```
dx1 = k_b1·I − k_a1·x1      (transport,  k_a1 = 0.006,  k_b1 = S_IT·k_a1,  S_IT = 51.2e-4 L/min/mU)
dx2 = k_b2·I − k_a2·x2      (disposal,   k_a2 = 0.06,   k_b2 = S_ID·k_a2,  S_ID = 8.2e-4  L/min/mU)
dx3 = k_b3·I − k_a3·x3      (EGP-suppr., k_a3 = 0.03,   k_b3 = S_IE·k_a3,  S_IE = 520e-4  1/mU)
```

I steady-state gælder `x_i = S_i · I` — dvs. **effekten er proportional med insulin fra dosis nul**. Der er ingen tærskel og ingen mætning. Konsekvens: en lille bolus giver altid et proportionalt BG-fald, og der findes hverken dead zone, small-dose paradox eller en synlig forskel mellem inaktiv og trænet tilstand. Featuren er strukturelt umulig i den nuværende model.

### Mapning af "de tre celletyper" til modellen

De tre væv passer ikke 1:1 på Hovorkas tre kompartmenter — dette er afklaret:

| Væv | Kanal i modellen | Status |
|---|---|---|
| **Lever** | `x3` (EGP-suppression) | lineær i dag → skal have Hill |
| **Muskel** | `x1` (transport) + `x2` (disposal); Rd ~80% muskel | lineær i dag → skal have Hill |
| **Fedt** | lipolyse-suppression i ketonmodellen (`LIPOLYSIS_EC50`) | **allerede Hill-baseret** — ingen ny kanal nødvendig |

Fedtvæv er ikke et selvstændigt glukose-kompartment i Hovorka (adipose optager kun en lille brøkdel af Rd). Dens dominerende insulinvirkning er anti-lipolytisk, og den ligger allerede som en Hill-funktion i `js/simulator.js` (`LIPOLYSIS_EC50 = 5 mU/L`, `LIPOLYSIS_HILL_N = 3`, plus `CPT1_EC50 = 7 mU/L`). At opfinde et nyt glukose-flux-adipose-kompartment ville være fysiologisk forkert.

### Motions-mekanismer findes allerede

Begge dele af brugerens oplevelse har allerede en model-kanal:

- **Insulin-uafhængigt "gulv" (akut, under motion):** `− beta·E1·HR_effect` i `dQ2` (`beta = 0.78`, `E1` pulsdrevet, t½ ~15 min). Fylder dead zone *under* motion, forsvinder ~1 t efter.
- **Vedvarende PEIS (~24-48 t):** KORREKTION (2026-06-13): denne kommer IKKE fra `exerciseFactor`. Den beregnes i `js/simulator.js` som `sensitivityIncreaseFactor` (tre-komponent fast/early/late-model) og påføres via `setISFModifier(currentISF/ISF)`, som skalerer `k_b1/k_b2/k_b3` (lineær gain) for alle tre kanaler. Hovorkas interne `exerciseFactor`/`E2` (t½ ~3,3 t) + `beta·E1·HR_effect` dækker kun den AKUTTE under-motion-fase.

Når Hill-tærsklerne er på plads, lukker disse to eksisterende kanaler dead zone — det akutte gulv under motion, og PEIS i ~24 t efter. **Ingen ny motions-kanal skal bygges.**

## Videnskabelig basis — tre EC50'er (BG-SCIENCE §25, Tabel 25-1)

Rizza, Mandarino & Gerich (1981), sekventielle insulin-clamps, n = 15 raske:

| Væv / effekt | EC50 (pmol/L) | EC50 (µU/mL ≈ mU/L) | Hill n |
|---|---|---|---|
| Fedt: lipolyse-suppression | ~44–68 | ~8–11 | ~1.5 |
| Lever: EGP-suppression | ~174 | ~29 | ~1.7 |
| Muskel/whole-body: Rd | ~330 | ~55 | ~1.5 |

Enheds-bro: Hovorka's `I` er i mU/L, hvilket numerisk = µU/mL. Rizza-værdierne kan derfor bruges direkte som EC50 i modellens insulin-enheder. Typisk operating range (faste ~5-10, postprandial peak ~40-80 mU/L) ligger netop hen over de tre tærskler — dvs. dead zone vil falde i et spilbart område.

## Løsning

### Matematisk struktur (mættende driving-funktion)

Erstat den lineære driving-term med en Hill-funktion af plasma-insulin, så kompartment-dynamikken (forsinkelsen via `k_a`) bevares men steady-state mættes:

```
dx_i = k_a_i · ( x_i,max · H_i(I) − x_i )
H_i(I) = I^n_i / (EC50_i^n_i + I^n_i)
```

Valget af denne form (frem for at lægge Hill på selve effekt-leddet `x_i·Q`) gør at EC50 udtrykkes i **plasma-insulin-enheder** og dermed kan tages direkte fra Rizza. `x_i,max` kalibreres (se nedenfor).

### Parametre

| Kanal | EC50 (mU/L) | Hill n | Handling |
|---|---|---|---|
| Lever (`x3`) | 29 | 1.7 | NY Hill |
| Muskel (`x1`, `x2`) | 55 | 1.5 | NY Hill (samme tærskel på begge muskel-kompartmenter) |
| Fedt (lipolyse) | 5 (nuværende, gameplay-tunet) | 3 | INGEN ændring — se note |

**Note om fedt:** `LIPOLYSIS_EC50 = 5` er bevidst tunet ned fra 8→6→5 (2026-06-06) på brugerfeedback, og afviger dermed fra litteraturens ~8-11 mU/L. Dette er en eksisterende BY DESIGN-afvigelse. Forslaget rører **ikke** ved den — fedt-tærsklen dokumenteres blot som den tredje tærskel i familien. (Mindre uoverensstemmelse til afklaring: §25 angiver adipose ~8-11 µU/mL, mens kode-kommentaren i simulator.js linje 687 skriver ~13-18 mU/L. Bør reconciles i en separat lille opgave — ikke en del af denne.)

### Det åbne designvalg — hvordan motion kobles til muskel-Hill

`exerciseFactor` (den vedvarende PEIS) skal interagere med den nye muskel-Hill. To muligheder:

- **(A) Amplitude-skalering (nuværende struktur):** `exerciseFactor` multiplicerer Hill-OUTPUTtet (`x_i·Q`). Mindst invasiv. Persisterer 24 t via E2. Ulempe: hæver loftet (max-disposal kan overshoote 1.0×), mindre tro mod §25.
- **(B) EC50-skift:** motion sænker muskel-EC50 (fx `EC50_muskel_eff = 55 / sqrt(exerciseFactor)`). Mere tro mod §25/Tabel 25-2 (motion = venstre-skift). Bundet loft. Reproducerer brugerens 24-timers-oplevelse renere. Ulempe: større strukturel ændring.

**Anbefaling: (B) EC50-skift for muskel-kanalen.** Begrundelse: (1) det matcher den mekanisme §25 faktisk beskriver; (2) det bevarer et fysiologisk bundet disposal-loft; (3) det reproducerer "nemmere at styre i 24 t" som en tærskel-sænkning frem for en amplitude-eksplosion, hvilket er den ægte lived experience. Det akutte insulin-uafhængige gulv (`beta·E1·HR_effect`) bevares uændret som den under-motion-komponent.

**Besluttet 2026-06-13: (B) EC50-skift for muskel-kanalen.** Det akutte insulin-uafhængige gulv (`beta·E1·HR_effect`) bevares uændret som under-motion-komponenten.

**Implementerings-split (besluttet 2026-06-13):** Da den vedvarende PEIS påføres via `setISFModifier` (gain-skalering af `k_b`), ikke via `exerciseFactor`, splittes ISF-modifieren ved kaldestedet (simulator.js:2074):
- spiller-ISF + circadian + vasodilatation + resistensfaktorer (stress/FFA/glucotox) → **amplitude-skalering** af `x_max` (alle tre kanaler — bevarer eksisterende tuning).
- kun `sensitivityIncreaseFactor` (motion-PEIS) → **EC50-skift** på muskel: `EC50_muskel_eff = EC50_muskel / PEIS`.
- Hovorkas akutte `exerciseFactor` (flux-multiplikator) + `beta·E1·HR_effect` bevares uændret. Liver-kanalen (`x3`) får ikke længere PEIS (fysiologisk korrekt — PEIS er muskel-specifik via AS160/GLUT4).

### Kalibrering — krav om ingen regression

Den nuværende lineære model er omhyggeligt tunet (ISF-mapning, bolus-respons, eksisterende test-batteri). Hill-erstatningen **skal kalibreres så den matcher den lineære model i det normale operating range** (I ~ 20-80 mU/L) og kun afviger i (i) sub-threshold-zonen (små doser → dead zone) og (ii) saturations-zonen (supra-fysiologiske doser). `x_i,max` vælges regressions-drevet: standard-scenarier i `tests/simulation.test.js` skal forblive inden for tolerance. Dette er den primære risiko og det primære test-mål.

## Verifikationsplan

1. **Stepped-clamp-test** i `tests/model-validation.html`: hold I konstant på trin (≈10, 20, 30, 45, 60, 90, 150 mU/L), mål steady-state EGP-suppression og Rd. Skal reproducere den sigmoidale adskillelse (lever mætter før muskel) — dvs. dead zone bliver synlig.
2. **Small-dose / stacking-test:** lille bolus fra lav baseline → forventet minimal synlig BG-effekt; en andel dosis oveni → uforholdsmæssigt fald. Reproducerer small-dose paradox.
3. **Motions-test (24 t):** stepped-clamp før vs. 1 t / 6 t / 24 t efter en standard cardio-session → dead zone-bredden skal være reduceret og forblive reduceret i ~24 t.
4. **Regressions-suite:** hele `tests/simulation.test.js` skal fortsat passere inden for tolerance (ingen utilsigtet ændring af eksisterende scenarier).

## Åbne spørgsmål

- ~~Designvalg (A) vs (B) for motions-koblingen~~ — AFGJORT 2026-06-13: (B) EC50-skift.
- **Habituelt aktivitetsniveau som baseline-ISF (ny idé, 2026-06-13):** I dag er "ingen motion" = baseline ISF, og motion lægger kun PEIS oveni. Forslag: definér et habituelt aktivitetsniveau der sætter *udgangs*-ISF — mindre aktivitet end vanligt → lavere ISF (dekonditionering/insulinresistens), mere → højere. Dette er en kronisk/træningstilstands-effekt, distinkt fra akut PEIS, og komponerer naturligt med (B)'s EC50-skift (kronisk niveau sætter baseline muskel-EC50; akutte bouts skubber yderligere venstre). Separat feature — blokerer ikke denne opgave. Kandidat til ny TODO.
- Reconciliation af adipose-EC50-uoverensstemmelsen (§25: 8-11 µU/mL vs. simulator-kommentar: 13-18 mU/L) — foreslås som separat lille opgave.
- Skal Hill-koefficienterne (n) være patient-individuelle senere? §25 noterer CV ~30-40% inter-individuelt; ikke en del af denne første implementering.

---

---

## Implementering — faktisk resultat (2026-06-13)

Implementeret i `js/hovorka.js` + `js/simulator.js`. Et par ting afveg fra planen ovenfor — opdaget under kodning og verificeret mod test-suiten:

**1. Leveren (x3) endte LINEÆR — ikke Hill.** Den oprindelige plan var Hill på både muskel og lever. Under kalibrering viste det sig at modellens basal-insulin (`I_ss`) ligger langt under den systemiske Rizza-lever-EC50 (29 mU/L), så en literal lever-Hill enten under-supprimerede EGP ved basal (hævede `I_ss` → brød DKA-gaten) eller over-supprimerede mellem-området (dybere hypoer, forskudt glucagon-respons). Løsning: `x3 = amplitudeMod · S_IE · I` (lineær). Det er fysiologisk forsvarligt — leveren er en tidlig responder med lav effektiv tærskel — og dead-zone-gabet bevares, fordi MUSKLEN bærer den høje tærskel (§25: dead zone er muskel-drevet). De tre tærskler er dermed: fedt (lipolyse-Hill, eksisterende), muskel (ny Hill), lever (lav effektiv tærskel ≈ lineær).

**2. Muskel-Hill matchet ved bolus-peak (~35 mU/L), ikke EC50.** `x_max` kalibreret så Hill = gammel lineær ved I≈35 (typisk bolus), hvilket fjerner en lille overshoot omkring I≈30 (ellers blev 2U-korrektioner marginalt for potente). Måltids-doser ~uændrede, dead zone under ~25 mU/L.

**3. PEIS som EC50-skift via split af `setISFModifier`.** `setISFModifier` erstattet af `setInsulinModifiers(amplitudeMod, peisMuscleFactor)`. `currentISF`-getteren udskiller PEIS-faktoren (`_lastPeisFactor`); resten (circadian, vasodilatation, resistens) skalerer `x_max` som amplitude.

**4. Basal-insulin steg til ~8.08 mU/L** (var ~5.8) — mere fysiologisk (8-17 mU/L). Konsekvens: to acidose-tests (`tests/simulation.test.js`) der satte høje ketoner men lod default basal-insulin stå, klassificerede nu korrekt ~8 mU/L som faste-ketose (ufarlig), jf. søster-testen "Fasting ketosis does NOT cause acidosis". De to tests rettet til eksplicit at sætte `state[6]=0` (DKA), så de tester acidose-matematikken som tiltænkt.

**Verifikation:**
- `tests/simulation.test.js`: 155/155 (stabilt over 5 kørsler).
- `tests/model-validation.html` kapitel N: N.1 (dead zone, 5 doser) ✓ — 1U lander BG på 13.0 (klatrer fra 9.0; kontrol 15.3), 3U bringer til 7.4; per-unit stiger 2.29→2.67 så falder (Hill-signatur). N.2 (motion åbner dead zone) ✓ — post-cardio lander hver dosis lavere (2U: 10.4→8.6).

**Berørte filer (faktiske):** `js/hovorka.js`, `js/simulator.js`, `tests/simulation.test.js`, `tests/model-validation.html`, `docs/MODEL-IMPLEMENTATION.md` (ny sektion + `#nonlinear-insulin`-anchor, doc-version v2).
