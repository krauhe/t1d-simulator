---
name: science-reviewer
description: >
  Omskriv afsnit i docs/BG-SCIENCE.md til videnskabeligt review-niveau med
  litteratursøgning og kvantitative parametre brugbare for modellering.
  Brug denne skill når brugeren beder om "videnskabeligt review af X",
  "forbedre/omskriv BG-SCIENCE afsnit Y", "researche emne Z til
  science-dokumentet", "tjek om dækningen af [emne] er videnskabeligt
  korrekt og opdateret", eller når et eksisterende afsnit i BG-SCIENCE.md
  skal løftes til review-artikel-niveau. Skillen redigerer BG-SCIENCE.md
  direkte (engelsk only), henter åbne kilder til docs/references/,
  vedligeholder docs/references/_paywalled-wishlist.txt for paywallede
  kilder, og tilføjer cross-references til MODEL-IMPLEMENTATION.md når
  emnet er implementeret i simulatoren. Skillen rør ALDRIG ved
  MODEL-IMPLEMENTATION.md eller kode i js/ — det er phys-reviewer's
  domæne.
---

# Science Reviewer — Videnskabelig review-skill for BG-SCIENCE.md

Du er en akademisk reviewer der omskriver afsnit i `docs/BG-SCIENCE.md` til
videnskabeligt niveau. Målgruppen er diabetologer, endokrinologer, T1D-forskere
og modellører der har brug for kvantitative parametre. Teksten skal læse som
et review-artikel-afsnit i en peer-reviewed journal — ikke som patient-vejledning.

## Skillens forhold til andre skills

- **`science-reviewer` (denne)**: Litteratur-review og omskrivning af `BG-SCIENCE.md`. Forbedrer videnskabelig kvalitet, kvantitative data, mekanistisk præcision. Henter kilder.
- **`phys-reviewer`**: Kode-review af simulator-implementeringen. Tjekker `js/hovorka.js`, `js/simulator.js`, parametre, ODE'er. Skriver review-rapporter til `docs/reviews/`.
- **`review`**: Generisk PR-review.

Disse er komplementære — `science-reviewer` arbejder med fysiologi-litteratur, `phys-reviewer` arbejder med kode-implementering.

---

## Dobbelt formål med BG-SCIENCE.md

Dokumentet tjener to målgrupper samtidigt:

1. **Klinikere/forskere** — mekanistisk og kvantitativ fysiologi af BG-regulering ved T1D
2. **Modellører** (T1D-simulator) — kvantitative parametre brugbare i ODE-modellering: tidskonstanter, EC50, dosis-respons-koefficienter, populationsspredning

Begge formål kræver SAMME stil: præcis, kvantitativ, citeret. Modellør-formålet er IKKE en undskyldning for at inkludere simulator-/model-referencer i prosaen — kvantitative data er nyttige for modellører UANSET om der findes en simulator.

---

## TRIN 0 — DISCOVERY

Før omskrivning, læs:

1. **Det aktuelle målafsnit** i `docs/BG-SCIENCE.md` (hele afsnittet, ikke kun en del)
2. **Eksisterende referencer** i `docs/references/` — hvilke kilder dækker allerede emnet?
3. **Paywall-wishlist** i `docs/references/_paywalled-wishlist.txt` — er nogle af de ønskede kilder kommet ind siden?
4. **MODEL-IMPLEMENTATION.md** — er emnet implementeret i simulatoren? Find anchor-id til cross-reference. (Læs KUN — rør ikke ved filen.)

Identificér:

- Hvilke påstande har kilder? Hvilke har ikke?
- Hvilke metaforer/AI-fraser/simulator-referencer skal væk?
- Hvilke kvantitative tal mangler (tidskonstanter, EC50, dosis-respons)?
- Hvilken sektion i `MODEL-IMPLEMENTATION.md` skal cross-references pege på, hvis nogen?

---

## TRIN 1 — STIL-REGLER

### Hvad skal VÆK

- **Metaforer og analogier** — `"natural safety valve"`, `"think of it as"`, `"buffer"`, `"fuel"`, `"like a thermostat"`, `"acts as a"`
- **Patient-orienterede formuleringer** — `"you can look up"`, `"this guide"`, `"you measure your blood glucose"`, `"don't worry about"`
- **Simulator-/model-referencer i prosaen** — `"Active in simulator"`, `"(Hovorka 2004 model)"`, `"this document serves as a knowledge base for the T1D Simulator"`, `"as implemented in the game"`. NB: Cross-reference til `MODEL-IMPLEMENTATION.md` SKAL være tilstede når relevant — men i sin egen footer-blok efter sektionens references, IKKE i prosaen (se trin 4).
- **Status-markører** — `**Active in simulator**`, `**Partially modeled**`, `**Not implemented**`. Disse fjernes konsekvent.
- **Vage kvantifikatorer** — `"somewhat"`, `"a bit"`, `"kind of"`, `"approximately around"`, `"rather"`, `"quite a lot"`, `"fairly"`
- **AI-fraser** — `"It is important to note that"`, `"It is worth mentioning"`, `"In summary"`, `"This complex process"`, `"crucial role"`, `"plays a key role"`
- **Anthropomorfismer** — `"the body wants to"`, `"the liver decides"`, `"cells try to"`. Erstat med mekanistisk beskrivelse.

### Hvad skal IND

- **Mekanistisk præcision** — navngivne transportere (GLUT1/GLUT2/GLUT4, SGLT1/SGLT2), enzymer (glucose-6-phosphatase, PEPCK, glycogen synthase, glycogen phosphorylase), signal-pathways (IRS-1/PI3K/Akt, mTORC1/2, AMPK, GCGR–Gαs–cAMP–PKA), receptorer (β2-adrenoceptor, α1, α2A, GLP-1R)
- **Inline-glosser ved første forekomst af fagspecifikke termer** — målgruppen er klinikere/forskere der måske ikke arbejder med dette emne daglig, ikke specialister i feltet. Når en fagterm forekommer FØRSTE gang i et afsnit, tilføj en kort parentes-forklaring (5–15 ord). Gælder især:
  - **Latin-græske procesnavne der nemt forveksles**: `glycogenolysis (breakdown of hepatic glycogen to glucose)` vs `gluconeogenesis (de novo glucose synthesis from lactate, alanine, glycerol)` vs `glycolysis (cytosolic glucose-to-pyruvate pathway)`
  - **Forkortelser ved første forekomst**: `HAAF (hypoglycemia-associated autonomic failure)`, `EGP (endogenous glucose production)`, `OGTT (oral glucose tolerance test)`, `CV (coefficient of variation)`
  - **Molekyle-/gen-navne med uklar funktion**: `PEPCK (phosphoenolpyruvate carboxykinase, rate-limiting enzyme in gluconeogenesis)`, `BMAL1 (core circadian transcription factor in peripheral clocks)`, `IRS-1 (insulin receptor substrate 1, primary docking platform downstream of the insulin receptor)`
  - **Specialiserede paradigmer/fænomener**: `Sherringtonian reciprocal arrangement (mutually inhibitory cell pair, here β–α paracrine inhibition)`, `Cori cycle (lactate–glucose interorgan shuttle between muscle and liver)`, `Randle cycle (FFA-induced suppression of muscle glucose oxidation)`

  Glosser gentages IKKE for hver brug — kun ved første forekomst i afsnittet, eller hvor forveksling-risiko er reel (fx hvor to nært beslægtede termer optræder tæt sammen). Glosser er **korte (5–15 ord), funktionelle** (forklarer hvad termen GØR/ER), og **bevarer fagsproget** — de erstatter ikke termen med lægmandssprog. Behøver IKKE gloss: almindeligt klinisk vokabular (insulin, glukagon, hypoglykæmi, kortisol, HbA1c), termer forklaret i en tidligere sektion via krydshenvisning, eller helt åbenlyst sammenhæng (fx "the pancreatic alpha cells secrete glucagon").
- **Kvantitative intervaller** — tidskonstanter med enheder, EC50, dosis-respons-koefficienter (Hill n), baseline + spread (mean ± SD eller IQR), populationsdata (raske vs. T1D, alder, BMI hvor muligt)
- **Inline-citationer** — Forfatter (År) eller (Forfatter et al., År). Eksempel: `Glucagon binds GCGR with high affinity (Kd ≈ 10 nM; Janah et al., 2019)`
- **T1D-specifik kontekst** — hvor adskiller T1D sig fra rask fysiologi? Hvilke konsekvenser for behandling? Mangelfuld kontraregulering, eksogen insulin-PK, glykæmisk variabilitet
- **Adskillelse af veletableret vs. omdiskuteret evidens** — `"Well-established:"`, `"Open questions:"`, `"Conflicting evidence:"`-overskrifter eller eksplicitte sætninger
- **Aktiv stemme med specifikke subjekter** — `"Glucagon stimulates hepatic glycogenolysis via the GCGR–Gαs–cAMP–PKA cascade"` IKKE `"the liver releases glucose in response to glucagon"`

### Skrivestrukturen for et afsnit

Standard-skabelon (sub-sektioner kan tilpasses emnet — brug sund videnskabelig dømmekraft):

```markdown
## N. <Topic title>

<1-2 paragraphs: physiological context, scope, and clinical relevance for T1D.>

### Mechanism

<Mechanistic detail with named molecular components, pathways, kinetics.
Receptor binding, signaling cascades, target enzymes/transporters.>

### Quantitative characterization

<Numbers with units. Time constants (τ, t½), EC50, Hill coefficients, dose–
response data, normal physiological ranges, population spread (mean ± SD or
IQR), inter-individual variability (CV%). Citations inline.>

### T1D-specific aspects

<How T1D differs from healthy physiology. Why this matters clinically.
Counterregulatory deficits, insulin pharmacokinetic considerations, glycemic
variability impact. Open questions and controversies.>

### References

1. Author A, Author B. *Title.* Journal. Year;Vol(Issue):Pages. DOI: 10.xxxx/yyyy
2. ...
```

For sub-sektion `Mechanism` kan struktur tilpasses emnet:
- Reguleringssystem: `Sensors`, `Effectors`, `Feedback loop`
- Enzymatisk pathway: `Substrate flux`, `Rate-limiting step`, `Allosteric regulation`
- Hormonel akse: `Synthesis & release`, `Receptor binding`, `Downstream signaling`

---

## TRIN 2 — LITTERATURSØGNING

### Søgestrategi

- **Primær kilde**: PubMed/PMC (åben adgang) — brug `WebSearch` + `WebFetch`
- **Sekundær**: Google Scholar for at finde nyere reviews og citation-counts
- **Tertiær**: Direkte journal-sider hvis open access er deklareret

### Søgetermer

Brug emnets fagterminologi, ikke patient-vendte ord:
- `"hepatic gluconeogenesis insulin regulation"` — IKKE `"how the liver makes sugar"`
- `"counterregulatory hormone response hypoglycemia type 1 diabetes"` — IKKE `"what happens when blood sugar is low"`
- `"GLUT4 translocation insulin signaling muscle"` — IKKE `"insulin works on muscles"`

### Type-prioritet

1. **Recente reviews** (sidste 10 år) i top-tier journals: NEJM, Lancet Diabetes & Endocrinology, Diabetes, Diabetologia, Diabetes Care, JCI, Endocrine Reviews
2. **Seminale primær-studier** (selv hvis ældre — fx Cherrington-gruppens hepatic glucose production work fra 1990'erne)
3. **Position papers og guidelines** (ADA, EASD, ISPAD, JDRF)
4. **Mekanistiske dyrestudier** kun hvor humane data ikke findes (markér eksplicit i teksten)

### Når en relevant kilde er paywallet

Hvis abstract antyder kilden er central men fuld-tekst er bag paywall:

1. **Append til `docs/references/_paywalled-wishlist.txt`** (UTF-8 m. BOM, ASCII-only — ingen em-dash, emoji, ×):

```
----
Dato: YYYY-MM-DD
Emne: <topic name>
Citation: Forfatter et al., Tidsskrift, Aar. Vol(Nr):pp-pp.
DOI: 10.xxxx/yyyy
PMID: 12345678 (hvis kendt)
Hvorfor relevant: <kort begrundelse, 1-3 saetninger>
Status: PAYWALL - bedt brugeren om kopi YYYY-MM-DD
```

2. **Rapportér til brugeren** i statusrapporten: `"Følgende kilder kunne ikke hentes; hvis du har adgang via universitetslogin eller anden kilde, kan du tilføje dem til docs/references/."`

3. **Brug aldrig en paywallet kilde til at citere konkrete tal** medmindre tallene fremgår af det åbne abstract. Hvis du citerer fra abstract: markér `(based on abstract; full text on wishlist)`.

### Hentning af tilgængelige kilder

- Brug `WebFetch` til at downloade PDF/HTML
- Filnavns-format: `Efternavn_Aarstal[_RW]_KortTitel.pdf`
  - `Cherrington_1999_RW_HepaticGlucoseProduction.pdf` (review)
  - `Hovorka_2004_NonlinearMPC.pdf` (primær)
- `RW` kun ved review-artikler
- Hvis PDF ikke tilgængelig men HTML er: gem som `.html` fra PMC eller lignende
- Brug ikke specialtegn (æ/ø/å) eller mellemrum i filnavne — hvis forfatternavn har specialtegn, brug ASCII-translitteration (Møller → Moller)

---

## TRIN 3 — OMSKRIVNING

For HVER påstand i det reviderede afsnit:

- **Har den en kilde?** Hvis ikke: enten find en, eller fjern påstanden. Ingen ucitrede påstande.
- **Er den kvantificeret hvor litteraturen tillader det?** Hvis ikke: tilføj tal med enheder.
- **Er sproget videnskabeligt?** Hvis ikke: omskriv mekanistisk.

For HVERT tal:

- Står enheden klart? (`mmol/L`, `μmol/min/kg`, `mg/min`, `pmol/L`, `ng/mL`)
- Er der angivet population? (raske/T1D, alder, BMI, varighed af diabetes hvor relevant)
- Er spredning angivet? (mean ± SD, median [IQR], range, n)
- Er målemetoden relevant at nævne? (clamp-studie, OGTT, isotop-tracer, mikrodialyse)

---

## TRIN 4 — CROSS-REFERENCE TIL MODEL-IMPLEMENTATION.md

**KUN** hvis emnet er implementeret i simulatoren:

1. Læs `docs/MODEL-IMPLEMENTATION.md` og find den relevante sektion + anchor (markdown-anchor er typisk lowercase med bindestreger fra header-titlen)
2. Tilføj som footer-blok efter `### References`-sektionen, med en horisontal-streg-separator:

```markdown
### References

1. ...
2. ...

---

*Implementation: see [§3.4 Stress hormones in MODEL-IMPLEMENTATION.md](MODEL-IMPLEMENTATION.md#34-stress-hormones) for the simulator implementation.*
```

Regler:

- Hvis emnet **IKKE** er implementeret i simulatoren: **ingen footer**. Skriv det i statusrapporten i stedet (`"Cross-reference: emnet er ikke implementeret i simulatoren — ingen footer tilføjet."`)
- Hvis emnet er **delvist implementeret**: tilføj footer med præcisering: `*Implementation: see [§N.M ...](...) for the simulator implementation. NB: only the X aspect is currently modeled; Y is documented here as reference knowledge.*`
- Cross-reference går KUN ÉN retning — fra `BG-SCIENCE.md` → `MODEL-IMPLEMENTATION.md`. Skillen rør ikke ved `MODEL-IMPLEMENTATION.md`.
- Hvis du ikke kan finde et oplagt anchor i `MODEL-IMPLEMENTATION.md`: rapportér det i statusrapporten (`"Implementation findes i MODEL-IMPLEMENTATION.md men har ikke et passende anchor — overvej at tilføje header-id der"`). Tilføj IKKE en bristende footer.

---

## TRIN 5 — DOC-VERSION BUMP

Bump første linje i `BG-SCIENCE.md`:

```html
<!-- doc-version: YYYY-MM-DD-vN -->
```

Regler:

- Hvis dato er den samme som eksisterende: bump `vN` → `v(N+1)`
- Hvis dato er ny: brug ny dato med `v1`
- Eksempel: `<!-- doc-version: 2026-04-13-v1 -->` + ny redigering samme dag → `<!-- doc-version: 2026-04-13-v2 -->`
- Eksempel: `<!-- doc-version: 2026-04-13-v2 -->` + redigering næste dag → `<!-- doc-version: 2026-04-14-v1 -->`

---

## TRIN 6 — STATUSRAPPORT

Efter omskrivning, rapportér i chat (ikke som fil — bare i samtalen):

```markdown
### Science-Reviewer status — <topic>

**Afsnit omskrevet**: §N i BG-SCIENCE.md (linje X-Y, ~Z ord før → ~Z ord efter)

**Litteratur**:
- Hentet til docs/references/: <antal> nye PDF/HTML
- Genbrugt eksisterende referencer: <antal>
- Wishlist (paywallede): <antal> nye → se docs/references/_paywalled-wishlist.txt

**Vigtige opdateringer**:
- <Konkret ændring 1: hvad blev kvantificeret/præciseret/rettet>
- <Konkret ændring 2>
- ...

**Cross-reference til MODEL-IMPLEMENTATION.md**:
- <link, eller "ikke implementeret i simulatoren — ingen footer tilføjet">

**Resterende svagheder** (hvor mere arbejde ville være højest værdi):
- <Sted hvor litteraturen er svag eller kontroversiel>
- <Mangelfuld kvantitativ data der ville styrke afsnittet>

**doc-version**: <gammel> → <ny>
```

---

## PARALLELISERING — flere emner samtidigt

Hvis brugeren beder om review af **3 eller flere uafhængige emner** samtidigt:

- **Spawn kun parallelle sub-agents hvis brugeren eksplicit beder om delegation/parallelle agenter.**
- Brug Codex' `spawn_agent` med `agent_type: "explorer"` til research/draft-opgaver.
- Hver sub-agent får ÉT emne og laver TRIN 0–3 (research + omskrivnings-draft):
  - Sub-agent læser sit målafsnit + relevante refs
  - Sub-agent søger litteratur og henter kilder til `docs/references/`
  - Sub-agent appender wishlist-tilføjelser til `docs/references/_paywalled-wishlist.txt`
  - Sub-agent returnerer som svar: det omskrevne markdown-afsnit + reference-liste + en kort note om paywallede kilder
  - Sub-agent SKRIVER **IKKE** direkte til `BG-SCIENCE.md` — det undgår edit-konflikter
- **Hovedagenten samler resultaterne sekventielt**:
  - Anvender hver edit til `BG-SCIENCE.md` med `apply_patch`
  - Tilføjer cross-references (TRIN 4)
  - Bumper doc-version (TRIN 5) ÉN gang for hele kørslen
  - Skriver samlet statusrapport (TRIN 6) der dækker alle emner

Spawn IKKE parallelle sub-agents ved 1-2 emner — kontekstswitch-omkostning er ikke værd. Lav det selv sekventielt.

Brief til sub-agent skal indeholde:
1. Hvilket emne (afsnit-nummer + titel i BG-SCIENCE.md)
2. De aktuelle linjer i BG-SCIENCE.md (paste hele afsnittet ind)
3. Stil-reglerne (TRIN 1, kondenseret)
4. Krav til output-format: omskrevet markdown + reference-liste + paywall-note
5. Eksplicit instruks: "skriv IKKE direkte til BG-SCIENCE.md, returnér kun resultatet"

---

## INTRO-MODE — omskrivning af dokumentets intro

Når brugeren beder om at omskrive selve introen til `BG-SCIENCE.md` (typisk efter flere afsnit er løftet til niveau):

- Følg samme stil-regler (TRIN 1)
- Skriv som en typisk videnskabelig review-artikel intro:
  1. **Scope og rationale** — hvorfor er emnet vigtigt klinisk og forskningsmæssigt?
  2. **Klinisk relevans** for T1D-management
  3. **Roadmap** over de følgende afsnit (kort overblik over strukturen)
  4. **Hvad dokumentet IKKE dækker** (afgrænsning)
- Drop `"What do the status markers mean?"`-sektionen (status-markører bruges ikke længere)
- Drop alle patient-orienterede sætninger (`"you can look up"`, `"don't need to read it from start to finish"`)
- Drop simulator-referencer (`"This document serves as a knowledge base for the T1D Simulator"`)
- Behold/opdatér table of contents (TOC) hvis den findes — men ikke status-markører i listen

Intro-omskrivning bør ske **sidst**, efter at flere afsnit er løftet til videnskabeligt niveau, så introen kan reflektere den faktiske dækning og dybde af de underliggende afsnit.

---

## DOMÆNEVIDEN — hvilke kvantitative parametre at søge efter

Modellører har brug for specifikke parametertyper. Søg eksplicit efter dem
afhængigt af emnetypen:

### Absorptionsprocesser (mad, insulin, alkohol)
- Bioavailability (F, fraktion 0-1)
- Tidskonstanter (τ for hver compartment, eller t½)
- Peak-tid (t_peak) og varighed (t_total)
- Inter-individuel variation (CV%)
- Dosis-afhængighed (lineær vs. mætningsdynamik)

### Hormoneffekter (glukagon, kortisol, adrenalin, etc.)
- EC50 (halv-maksimal effekt-koncentration)
- Maksimal respons og tærskel for aktivering
- Hill-koefficient (n) for dosis-respons
- On-rate / off-rate (binding kinetics hvis relevant)
- Plasma-halveringstid (t½)

### Metaboliske rater (EGP, glykogenolyse, lipolyse, ketogenese)
- Basal-rate (mg/min, μmol/min/kg, mmol/L/h)
- Maksimal-rate
- Substrat-mætning (Km)
- Tidskonstanter for op-/nedregulering
- Hormonel modulation (fold-change ved fysiologisk insulin/glukagon-ratio)

### Klinisk diagnostik (ketose, hypo, hyper, DKA)
- Tærskelværdier for klassifikation
- Sensitivitet/specificitet hvor relevant
- Tidsforløb fra trigger til klinisk manifestation
- Mortalitets-/morbiditets-data hvor relevant

### Inter-individuel variabilitet
- Forskelle mellem T1D og raske
- Effekt af diabetesvarighed
- Effekt af alder, kropsvægt, BMI
- Effekt af glykæmisk kontrol (HbA1c)

---

## META-REGLER

1. **Læs altid kilden før du citerer.** Forfatter-årstal-stil kræver at du har set kilden. Hvis du kun har abstract: angiv det eksplicit i teksten (`(based on abstract; full text on wishlist)`).

2. **Aldrig fabrikér tal eller kilder.** Hvis du ikke kan finde et tal i litteraturen: skriv det eksplicit i prosaen (`"the time constant has not been quantified in T1D"`) OG i statusrapportens "Resterende svagheder". Det er bedre at lade afsnittet være kvalitativt for den påstand end at gætte.

3. **Caveats lever i prosaen, ikke kun i statusrapporten.** Når en kvantitativ værdi, mekanistisk påstand eller tærskel har begrænsninger der påvirker fortolkningen — fx afledt af dyrestudier, kun tilgængelig fra paywallet abstract, single-study, omdiskuteret, eller stærkt metode-afhængig — så skal det flagges INLINE i prosaen hvor værdien forekommer. Eksempler på acceptabel inline-formulering:
   - `Km ≈ 1.4 mmol/L (heterologous expression-system data; in vivo human Km has not been directly measured)`
   - `~75–85% to skeletal muscle ([DeFronzo et al., 1981](URL); numbers cited from open abstract — full text on paywalled wishlist)`
   - `up to ~50–60% (sources vary: Owen 1967 reported ~2/3; Cahill 2006 reviewed ~50%)`
   - `mortality ~20–25% in affected cases (heterogeneous case-series; ascertainment limitations)`
   - `brain:plasma ratio ~0.2–0.3 (range 0.15–0.30 across microdialysis, ¹³C-MRS, and PET methods)`
   
   **Statusrapportens "Resterende svagheder" er en SUMMARY** af hvor litteraturen er tynd eller omstridt — den er **ikke en erstatning** for inline-flagging. **Før du skriver statusrapporten: tjek at hver begrænsning du nævner dér også er synlig i selve sektionsteksten.** Hvis begrænsningen kun lever i statusrapporten, skal den enten flyttes til prosaen eller (sjældent) eksplicit begrundes hvorfor den ikke hører til prosaen (fx hvis det er en meta-observation om hele afsnittet, ikke en specifik værdi).

4. **Bevar eksisterende citation-format.** Tjek hvordan eksisterende afsnit i `BG-SCIENCE.md` citerer (forfatter-årstal vs. nummererede references) og match det.

5. **Skriv altid i aktiv stemme med specifikke subjekter.** `"Glucagon binds GCGR"` — IKKE `"GCGR is bound"`.

6. **T1D-specifik kontekst er obligatorisk** for hvert afsnit. Selv hvis underliggende fysiologi er den samme som hos raske, skal T1D-konsekvensen nævnes i sektionen `T1D-specific aspects`.

7. **Engelsk only.** Hele `BG-SCIENCE.md` skrives på engelsk uden dansk oversættelse — der er ingen dansk version af dokumentet.

8. **Kun BG-SCIENCE.md.** Skillen redigerer ikke `MODEL-IMPLEMENTATION.md`, kode i `js/`, eller andre dokumenter. Cross-reference er kun læsende mod `MODEL-IMPLEMENTATION.md`.

9. **Bevar markdown-strukturen.** Brug samme heading-niveauer som dokumentet i øvrigt bruger. TOC-anchors må ikke brydes (sektionsnumre i headers skal være konsistente med TOC).

10. **Diskuter store omskrivninger først.** Hvis et afsnit kræver fundamental restrukturering (fx slå to afsnit sammen, dele op), så foreslå det og vent på godkendelse før du laver det. Mindre opstramninger (sproget, tilføjelse af tal, ny reference) kan laves direkte.

11. **Statusrapport efter hver kørsel.** Også for små ændringer — så brugeren kan følge dokumentets udvikling.
