# Review af Videnskabelig Litteratur, Fysiologisk Model og Brugeroplevelse (UX)

**Dato:** 2026-10-03  
**Forfatter:** Gemini (AI Pair Programmer)  
**Scope:** Gennemgang af videnskabelig litteratur (`docs/BG-SCIENCE.md`), fysiologisk modelimplementering (`hovorka.js`, `physiology-engine.js`), samt forslag til at højne det faglige niveau og forbedre brugervenligheden.

**Efterkontrol 2026-10-04:** De fysiologiske og tekniske forslag er vurderet mod den aktuelle kode i [det samlede modelreview](2026-10-04_codex_model-science-test-review.md#follow-up-two-reports-archived-on-3-october). Rapportens oprindelige tekst og statusangivelser er bevaret nedenfor; de er ikke en validering. Flere forslag findes allerede eller kræver anden dokumentation. Se især F13 og det nye F15; UX-forslagene er ikke implementeret.

---

## Executive Summary

T1D Simulatorens fysiologiske fundament og litteraturdækning (`docs/BG-SCIENCE.md`) holder et udtalt højt fagligt niveau, der overgår langt de fleste pædagogiske eller kommercielle diabetes-simulatorer. Modellen kombinerer Hovorka 2004 kerne-ODE'erne med nyere klinisk evidens for fedt/protein (Wolpert 2013, Paterson 2016), motion (Resalat 2020, Riddell 2017) og keton-dynamik (Pinnaro 2021).

Denne rapport gennemgår tre hovedområder:
1. **Litteratur og fysiologisk præcision:** Identifikation af områder hvor litteraturen kan udvides eller præciseres.
2. **Højning af det faglige niveau:** Strategier til at gøre simuleringen endnu mere videnskabeligt værdifuld for undervisere, klinikere og kyndige brugere.
3. **Brugervenlighed og onboarding (UX):** Konkrete greb til at reducere klikfriktion, forbedre pædagogisk feedback og gøre spillet mere engagerende uden at gå på kompromis med den fysiologiske præcision.

---

## 1. Dybdegående Gennemgang af Litteraturen (`docs/BG-SCIENCE.md`)

`BG-SCIENCE.md` dækker 30 videnskabelige afsnit i peer-review kvalitet. Gennemgangen har identificeret følgende områder, hvor dokumentationsgrundlaget og modellen med fordel kan forbedres eller opdateres:

### 1.1 Incretin-effekten (GLP-1 / GIP) og moderne Tillægsbehandlinger
* **Nuværende status:** Mavetømning forsinkes af fedt via CCK/GLP-1 analogier, men den direkte inkretin-akse og nyere adjuverende behandlinger (GLP-1 receptor agonister som semaglutid/tirzepatid eller SGLT2-hæmmere) er kun delvist omtalt.
* **Vurdering:** Da mange T1D-patienter i dag eksperimenterer med GLP-1RA som tillægsbehandling for at dæmpe postprandial glukose-fluktuation, bør dette emne dækkes i et selvstændigt afsnit i `BG-SCIENCE.md`.
* **STATUS:** `❌ ÅBEN`

### 1.2 Ultra-hurtigvirkende Insulinanaloger (FiASP / Lyumjev)
* **Nuværende status:** Hovorka 2004 parametriserer standard hurtigvirkende insulin (NovoRapid/Humalog) med $\tau_I \approx 55\text{ min}$.
* **Vurdering:** Moderne ultra-hurtige insuliner (Faster Aspart / Insulin Lispro-aabc) har en lavere absorptions-latenstid ($t_{\max} \approx 15\text{--}30\text{ min}$) pga. tilsætning af nikotinamid eller treprostinil. Et litteraturafsnit og en model-option for ultra-rapid PK vil løfte modellens tidsmæssige relevans.
* **STATUS:** `❌ ÅBEN`

### 1.3 Euglykæmisk DKA (eDKA) ved SGLT2-hæmning
* **Nuværende status:** Keton-modellen aktiveres ved lavt plasma-insulin.
* **Vurdering:** Ved SGLT2-hæmning udskilles glukose i nyrerne i en grad, så DKA kan udvikle sig ved *normalt eller kun let forhøjet blodsukker* (euglykæmisk DKA). Dette er et kritisk klinisk emne i moderniseringen af T1D-litteraturen.
* **STATUS:** `⚠️ BY DESIGN` (Modellen understøtter faste-ketose og insulinmangel-DKA, men eDKA under SGLT2i kræver eksplicit udvidelse).

### 1.4 Sygdomsvarighed og differentieret Glukagon-respons
* **Nuværende status:** Modellen antager 100% tab af det hypoglykæmiske glukagonsvar.
* **Vurdering:** Hos nydiagnosticerede patienter (< 1–2 års varighed) er det parakrine alfa-cellesvar ved hypoglykæmi ofte delvist bevaret. En differentiering baseret på sygdomsvarighed vil give bedre pædagogisk forståelse af "honeymoon-fasen".
* **STATUS:** `⚠️ ACCEPTABEL`

---

## 2. Højning af det Faglige Niveau

For at positionere T1D Simulator som et førende forsknings- og undervisningsværktøj foreslås følgende tre faglige opgraderinger:

### 2.1 Visuel repræsentation af Fysiologisk Variabilitet (Konfidensbånd)
* **Koncept:** I virkeligheden svinger insulinabsorptionen med 20–30% CV fra dag til dag. I stedet for kun at vise én tynd kurve på graffen, kan brugeren slå "Fysiologisk usikkerhed" til.
* **Pædagogisk værdi:** Grafen viser et let skygget konfidensbånd omkring CGM-kurven. Dette lærer afgørende pædagogisk logik: *Selv ved identisk dosis og mad vil blodsukkeret aldrig opføre sig 100% ens hver dag.*

### 2.2 Avanceret Fysiologi-Laboratorium (Levende kraft-vektorer)
* **Koncept:** Udvide UI'ets debug-/fysiologi-panel med et "Kraft-diagram" (Force Decomposition), der viser de aktive glukose-fluxes i realtid:
  - $\text{U}_G$ (Tarm-absorption, mmol/min)
  - $\text{EGP}$ (Lever-produktion, mmol/min)
  - $\text{F}_{01c}$ (Hjerne/grundforbrug, mmol/min)
  - $\text{Disposal}$ (Insulin- + motions-drevet muskeloptag, mmol/min)
* **Pædagogisk værdi:** Gør det muligt for studerende og klinikere at se *hvilken fysiologisk kraft* der dominerer i et givet minut.

### 2.3 RK4 (Runge-Kutta 4) Integration i Kernen
* **Koncept:** Opgradere `HovorkaModel.step()` fra Euler-integration til RK4.
* **Gevinst:** Eliminering af numeriske trunkeringsfejl ved høje spolingshastigheder, hvilket sikrer 100% matematisk rigorositet i forsknings-sammenhæng.
* **STATUS:** `❌ ÅBEN`

---

## 3. Forbedring af Brugervenligheden (UX og Læringsdesign)

Selvom det faglige niveau er højt, må simulatoren ikke føles uoverskuelig eller akademisk tør for almindelige spillere, børn eller nydiagnosticerede voksne.

### 3.1 Reduktion af Start-friktion ("Klik-fri onboarding")
* **Udfordring:** Mange valg (karakter, profil, basaldosis, regler) før man kommer i gang kan skabe kognitiv overbelastning.
* **Løsning:** Indfør en fremtrædende "Hurtig Start"-knap på forsiden, der med ét klik starter en forhåndskonfigureret standardkarakter (fx Erik, 70 kg) med euglykæmisk balance.

### 3.2 Kontekstuel "Læring i øjeblikket" (Just-in-Time Micro-tips)
* **Udfordring:** Lange hjælpetekster før spilstart læses sjældent.
* **Løsning:** Vis korte, opmuntrende popups *når hændelsen sker for første gang*:
  - *Første hypo:* "Blodsukkeret falder — drik 15g hurtigt sukker (fx juice)."
  - *Første fedtrige måltid:* "Pizza spist! Læg mærke til hvordan blodsukkeret først stiger efter et par timer."
* **Formattering:** Varm, opmuntrende og uden alarmerende krise-sprog (jf. `AGENTS.md` retningslinjer).

### 3.3 Reelt visuelt overblik på Grafen ("Hvorfor stiger/falder blodsukkeret?")
* **Koncept:** Tilføje en lille dynamisk indikator ved siden af den aktuelle CGM-måling:
  - 🟢 **Mad-optag dominerer** (opadgående pil med ikon af mad)
  - 🔵 **Insulin dominerer** (nedadgående pil med sprøjte-ikon)
  - 🏃 **Motion dominerer** (stejl nedadgående pil med løbesko-ikon)
  - 🟡 **Lever/Stress dominerer** (opadgående pil ved fastende tilstand)

---

## 4. Samlet Statustabel over Fund og Anbefalinger

| Fund / Anbefaling | Domæne | Type | STATUS |
|---|---|---|---|
| **RK4 Integrator** | Fysiologi / Numerik | Matematisk stabilitet | `❌ ÅBEN` |
| **Incretin & GLP-1RA afsnit** | BG-SCIENCE | Videnskabelig udvidelse | `❌ ÅBEN` |
| **Ultra-rapid Insulin (FiASP)** | Fysiologi / PK | Model-udvidelse | `❌ ÅBEN` |
| **eDKA ved SGLT2-hæmning** | BG-SCIENCE | Klinisk dokumentation | `⚠️ BY DESIGN` |
| **Sygdomsvarighed & Glukagon** | Fysiologi | Modelforfinelse | `⚠️ ACCEPTABEL` |
| **Hurtig-start (Klikfri UX)** | Brugeroplevelse | Onboarding | `❌ ÅBEN` |
| **Kraft-vektorer på Grafen** | Visualisering | Pædagogisk værdi | `❌ ÅBEN` |
| **Konfidensbånd (Variabilitet)** | Visualisering | Undervisning | `❌ ÅBEN` |

---

## Konklusion

T1D Simulatorens fysiologiske kerne er af overordentlig høj kvalitet og hviler på et solidt videnskabeligt fundament. Ved at gennemføre de foreslåede UX-forbedringer (kontekstuelle micro-tips, klikfri start og visuel kraft-decomposition) kan simulatoren gøres markant mere tilgængelig og engagerende for spillere på alle niveauer — uden at lefle for det faglige og videnskabelige indhold.
