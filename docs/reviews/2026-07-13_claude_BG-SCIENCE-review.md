# Videnskabeligt review: `docs/BG-SCIENCE.md`

- **Dato:** 2026-07-13
- **Reviewer:** Claude (6 parallelle Opus-review-agenter, én pr. dokumentdel)
- **Scope:** Hele `docs/BG-SCIENCE.md` (doc-version 2026-06-05-v1, 3063 linjer, §1–§29)
- **Fokus:** Videnskabelige fejl, forkerte kvantitative værdier, interne inkonsistenser, kilde-/citations-integritet, forbudt AI-clché-sprog, klarhed
- **Status:** KUN review — dokumentet er ikke ændret. Linjenumre refererer til filen ved review-tidspunktet.

---

## Sammenfatning

Dokumentet er gennemgående af **høj videnskabelig kvalitet**: mekanistisk stringent, kvantitativt, velciteret og med forbilledlig usikkerheds-flagning. De fleste kernemodel-parametre (Hovorka 2004, Dalla Man 2007, insulin-analog-PK, DKA-kriterier, EC50-hierarki) er korrekte og internt konsistente. Der er ingen fejl der invaliderer dokumentets brug som vidensbase.

Men reviewet fandt **fem alvorlige (KRITISKE) problemer**, et gennemgående **kilde-integritets-problem** (forkerte/kolliderende PMID'er flere steder), og **fire brud på projektets forbud mod AI-clché-sprog**. Hovedmønsteret: substansen er solid, men **kildesporbarheden og enkelte kvantitative tal svigter** — netop det der undergraver et referenceværks troværdighed mest.

### Fund-statistik

| Kategori | KRITISK | MODERAT | MINDRE |
|----------|:-------:|:-------:|:------:|
| Fysiologisk umulige / forkerte tal | 3 | ~10 | ~8 |
| AI-clché / metaforsprog (forbudt) | 1 | 3 | ~6 (borderline) |
| Interne inkonsistenser | 1 | ~8 | ~6 |
| Kilde-/citations-integritet | 1 | ~18 | ~8 |
| Formatering / stil-konsistens | – | 4 | flere |

---

## TOP-PRIORITET — ret disse først

Disse er enten fysiologisk umulige tal der kan vildlede en modellør direkte, eller kildefejl der bryder sporbarheden i dokumentets mest citerede datasæt.

1. **§10b — umulig enhed på insulin-dagsdosis** (linje ~1259): `52.4 → 49.0 U·kg⁻¹·d⁻¹`. En TDD på 52 U/kg/døgn er ~50–100× for høj. Skal være `U·d⁻¹` (absolut dagsdosis). %-beregningen (−6,5%) er korrekt.
2. **§10b — fysiologisk umulig HbA1c-reduktion** (linje ~1257): range `0.31–21%`. 21 procentpoint absolut HbA1c-reduktion er umuligt (HbA1c ligger ~5–14%). Sandsynligvis tastefejl for 2,1%. Verificér mod Innes & Selfe 2016.
3. **§24 — inkohærent EGP/glykogenolyse-kvantitering** (linje 2326, 2330): tre modstridende tal for samme fænomen. "3–5-fold → 20–40 mg/min" er ~10× for lavt; "2 mg/kg/min = 2 g/min" er en enhedsfejl (~14× for højt; korrekt ~0,14 g/min); "fully depleted in 50–100 min" modsiger den efterfølgende (korrekte) "4–8 h". Gør ét konsistent talsæt.
4. **§11.4 — adrenalin-tærsklens retning er selvmodsigende** (linje 1314, 1345): "shifted to **lower** glucose thresholds" efterfulgt af tal der **stiger** (3.4 → 3.8 mmol/L). Modsiger også klassisk HAAF-mekanisme (attenuering = *dybere* hypo kræves). Afklar amplitude- vs. tærskel-skift og verificér mod Verhulst 2022.
5. **Rizza 1981 citeres med TRE forskellige forkerte PMID'er** (§23 linje 2211/2296: `7014664`; §25 linje 2477: `7018254`; §29 linje 3051: `7015809`). Dette er dokumentets mest citerede clamp-datasæt. Korrekt PMID = **7018254**; brug den alle tre steder.

---

## A. Fysiologisk umulige / forkerte kvantitative værdier

### KRITISKE (se også Top-prioritet #1–#4)
- **§10b** insulin-TDD-enhed (l.1259); **§10b** HbA1c-range 21% (l.1257); **§24** EGP/glykogen-tal (l.2326/2330); **§11.4** adrenalin-tærskel (l.1345).

### MODERATE
- **§2 GH-timing selvmodsigende** (l.207): GH-sekretion angivet kl. 03–07 MED 4–8 t lag ville placere insulinresistens-peak *efter* morgenmaden, ikke "pre-breakfast". Flyt GH-vinduet til tidlig nat (~23–02).
- **§2 GNG:GLY-split summer ikke** (l.189): T1D-tal "74:20" (=94) og "41:35" (=76) summer ikke til 100, og mangler enhed. Normalisér til procent eller mærk som absolutte fluxes med enhed.
- **§4 hjernens glukoseandel ikke afstemt** (l.298/313 vs. §2 l.157): "20–25% of disposal" + "110–120 g/day" vs. §2's basale EGP ~190–220 g/døgn giver tilsyneladende faktor-2½ konflikt. Præcisér at 20–25% er 24-t-gennemsnit (fed+fasted), mens den post-absorptive andel er højere.
- **§5 EFSA β-glukan-tærskel forkert** (l.430/466): EFSA (2011) kræver **4 g/30 g tilgængeligt kulhydrat**, ikke "4,5–5,5 g". Tærsklen er desuden anakronistisk tilskrevet Würsch & Pi-Sunyer 1997 (14 år før afgørelsen). Tilføj EFSA Journal 2011;9(6):2207 som selvstændig kilde.
- **§5 fruktose-disposition byttet om** (l.416): "~20% til glukose, ~25% til glykogen" bytter om på andelene. Tappy & Lê 2010 angiver ~50% til glukose, ~25% laktat, ~15–18% glykogen. Ukilderet — tilføj reference.
- **§7 Akt-fosforylering fejlformuleret** (l.835): "PDK1 phosphorylates Akt at Thr308, mTORC2 at Ser473" læses som at PDK1 fosforylerer mTORC2. Korrekt: mTORC2 fosforylerer Akt ved Ser473.
- **§7 NPH fejlklassificeret som "long-acting"** (l.888/900): NPH er intermediært virkende.
- **§27 rate-of-change ~10× for høj** (l.2632/2676): ">2 mmol/L/min" og loft "~5 mmol/L/min" er ~12× over dokumentets egen ↑↑-tærskel (l.2680: >0,17 mmol/L/min). Reelt maks ~0,1–0,4 mmol/L/min.
- **§11.5/§11.1 cortisol/GH-tærskler placeret under symptomtærsklen** (l.1316/1351): cortisol/GH ~2,8–3,2 vs. autonome symptomer ~3,4 modsiger Schwartz 1987 (alle hormontærskler ligger over symptomer) og dokumentets egen "prophylactic"-konklusion. Verificér; klassisk ligger cortisol/GH ~3,6–3,8.

### MINDRE
- **§3 GFR-fald fejlberegnet** (l.266): (149−129)/149 = 13,4%, ikke "16%".
- **§2 EGP µmol-afrunding** (l.185): 1,8 mg/kg/min = 10,0 µmol/kg/min, ikke "11". Interval bør være ~10–12.
- **§24** "2 mg/kg/min = 10–12 g/h" (l.2326): = 8,4 g/h.
- **§23** 72-t-faste β-OHB angives varierende "1–3", "2–5", "5–7" mmol/L (l.2161/2200/2222) — stram op.
- **§8 glukose-disposal ved moderat aerob** (l.951 vs. 975): ">10" (prosa) vs. "6–10" (tabel).
- **§8 muskelblodgennemstrømning fold-rise** (l.952): "15–30-fold" matcher ikke tallene (op til ~50×).

---

## B. AI-clché / metaforisk fysiologi-sprog (FORBUDT i projektet)

CLAUDE.md forbyder eksplicit dette sprogmønster. Følgende bør omskrives:

### Klare brud
- **§26 "master switch"** (l.2507 overskrift + l.2521): "mitochondrial superoxide as the **master switch**". Står direkte på forbudslisten. → "the shared upstream trigger" / "the common proximal driver".
- **§18 "endocrine choreography"** (l.1803 overskrift): samme familie som det forbudte "hormonernes dans". → "endocrine timing" / "coupled endocrine rhythms".
- **§11 "the body's defense" + "Evolution has endowed"** (l.1304 overskrift + l.1306): possessiv + teleologisk personificering. NB: "lines of defense" er legitim Cryer-terminologi og beholdes — kun personificeringen dæmpes. → "Counterregulatory hormones — physiological defense against hypoglycemia".
- **§26 "handed to complex IV in an orderly fashion"** (l.2509): antropomorf. → "transferred to complex IV".

### Borderline (overvej ved oprydning)
- **§3** "one of the body's natural restraints" (l.268) → "one of the physiological ceilings (renal spillover)".
- **§9** "the recipe for late hypoglycemia" (l.1085) → "which predisposes to late hypoglycemia".
- **§17** "a tight-rope walk between..." (l.1723); **§21** "a pharmacodynamic shadow" (l.1865); **§19** "a liver that cannot mount a counterregulatory response" (l.1893).

**Positivt:** den værste forbudte antropomorfisering ("insulin tells cells to...") er **konsekvent undgået** i hele dokumentet — mekanismer beskrives korrekt som "insulin binds INSR → recruits IRS → ...".

---

## C. Interne inkonsistenser

- **§11.4 adrenalin-tærskel** (KRITISK, se A/Top-prioritet).
- **§5 gastroparese τ_G vs. t½** (l.502 vs. 654): "180–400 min" (prosa) vs. "1,5–4,0× på base 40 min = 60–160 min" (tabel). Gennemgående sammenblanding af Hovorka-tidskonstanten τ_G (base 40 min) og ventrikeltømnings-halveringstid t½ (~120 min). Hold dem adskilt gennem hele modelafsnittet.
- **§10 IL-6 marathon-stigning** (l.1134 vs. 1144): "30- til 100-fold" vs. "≈4-fold" — prosaen modsiger sig selv. Tilføj kohorte-forbeholdet inline.
- **§8 insulin+kontraktion additivitet** (l.950/982 vs. 997): "more than additive" (definitivt) vs. "near-additive (sometimes supra-additive)". Brug "additive to partially supra-additive" begge steder.
- **§25 vs. §29.9 mætnings-koncentrationer** (l.2410 vs. 3007): near-max Rd ved "~200–700 µU/mL" vs. "~80–100 mU/L". "80–100 mU/L ≈ 3–4× basal" er også internt forkert (basal ~5–15 → 3–4× = 15–60).
- **§28 vs. §29 Sorensen-størrelse** (l.2770: "19 compartments" vs. l.2790/2927/2998: "22"). Tabellen l.3002 lader en "udvidelse" have færre compartments (19) end originalen (22).
- **§29.8/§28.8 UVA/Padova "~300 parametre"** (l.2868/3001): forveksler 300 *virtuelle subjekter* (l.2802/2965) med parametre. Modellen har ~30–40 params/subjekt.
- **§18 Donga-tal blander to mål** (l.1821): "~14–21% reduction" sammenblander disposal-fald (14%) og GIR-fald (21%).
- **§6 FFA-resistens-onset** (l.736 vs. 783): "first 3 h" vs. "until ~3,5 h".
- **§4/§5 varighed hurtigtvirkende analoger** (l.470 vs. 791): "3–5 h" vs. "~3–4 h".
- **§17 "feed-forward loop"** (l.1723): kontrolteoretisk forkert term for en ond cirkel — brug "positive-feedback loop" / "vicious cycle".
- **Roadmap "29 sections"** (l.14): der er reelt 30 pga. §10b. Ret til "29 numbered sections (with an additional §10b)".

---

## D. Kilde- og citations-integritet (gennemgående tema)

Dette er dokumentets svageste punkt. Flere in-tekst-PMID'er peger på forkerte artikler, og References-lister mangler mange in-tekst-citationer.

### PMID-fejl / kolliderende ID'er
- **Rizza 1981 — tre forkerte PMID'er** (KRITISK, se Top-prioritet #5).
- **§5 systematisk PMID-mismatch** — in-tekst vs. Sources afviger for Thompson 1983 (`6411484` vs. korrekt `6832623`), Goo 1987 (`3692672` vs. `3609660`), Deloose 2012 (`22407798` vs. `22450306`), Mönnikes 2001, Leiper (in-tekst "2001"/`11310927` vs. Sources "2015"/`26290294`), Otte 2001 (`11310927` — deler forkert ID med Leiper). Gennemgå hele §5-modulatorafsnittets PMID'er.
- **§12 Perriello-PMID-kollision + fantom-citat** — "Møller et al., 1990" (l.1410) findes ikke i kildelisten; Perriello 1990 citeres med `2406181` i §12 (l.1440) men `2178966` i §13 (l.1517). Korrekt = 2178966.
- **§17 Manthous 1995 forkert PMID** (l.1739: `3621073` vs. Sources l.1783: korrekt `7812538`).
- **"Diabetes: Models, Signals, and Control"** — §28 (l.2876): "2014" (forkert år; vol 2 = 2009); §29 (l.3055): PMID `20948577` (forkert). Korrekt: 2009, PMID 20936044.

### Kilde matcher ikke påstand
- **§11.2 Brissova 2005 β-cellefraktion** (l.1322): "60–80%" er gnaver-tal og modsiger Brissovas centrale humane fund (~54%). Ret til ~50–60%.
- **§11.5 Bolli 1984** (l.1353): in-tekst-påstand om panhypopituitarisme matcher ikke den citerede artikels titel (adrenerge mekanismer i T1D); desuden vol 32 = 1983, ikke 1984.
- **§10 Emanuelli 2001** (l.1152): IL-6→SOCS3-fund tilskrevet et TNF-α-paper. Klassisk IL-6→SOCS3 er Senn 2003.
- **§26 Rossetti phlorizin** (l.2529): tilskrevet Rossetti 1990 (review), men eksperimentet er Rossetti 1987.
- **§24 Petersen** (l.2330 vs. Sources l.2351): tekst siger "2001, J Clin Invest", kilde siger "Am J Physiol vol 270" (=1996) med PMID for et postprandialt studie. Tekst og kilde peger på forskellige artikler.
- **§27 Beck 2017 JAMA** (l.2719/2753): kilde-titel siger "Type 2 Diabetes", men PMID 28118453 er T1D DIAMOND-studiet. Desuden "DIAMOND, GOLD, DIaMonD" (l.2719) lister DIAMOND to gange.
- **§27 Basu 2013** (l.2630/2723): empirisk lag-måling citeret til en review-titel med PMID 24150777.
- **§25 Sjöstrand** (l.2378/2491): "2002" i tekst, men Sources' vol/PMID (276 / 9886964) = 1999-artiklen — to forskellige artikler blandet.

### Mistænkelige / muligt hallucinerede termer og kilder
- **§29.3 "Skeggs filtration kinetics"** (l.2930): ingen anerkendt sådan term for renal glukose. Skal være tubulær maksimum (Tm)/threshold-kinetik.
- **§26 "STATISTIC" trial** (l.2521): ikke et kendt ruboxistaurin-forsøg (ægte: PKC-DRS, PKC-DRS2, PKC-DMES). Verificér eller fjern.
- **§17 "Apperley/Ng 2019"** (l.1792): "reference" er blot en PubMed-søge-URL, ikke en konkret artikel.

### Manglende / uciterede referencer
- **§29 References** mangler ~20+ in-tekst-citationer (Cobelli 1987, Caumo & Cobelli 1993, Hovorka 2010/2011/2013, Kovatchev 2012, Breton 2009, Clarke & Kovatchev 2009 m.fl.). Samme mønster i §24/§25/§26 Sources.
- Orphan-referencer (i liste, ikke citeret i tekst): So-ngern 2019 (omvendt — citeret men mangler i §18-liste), Borel 2009, Plougmann 2003, Mader 2024, Pereira 2015, Gerich 2001, Christiansen 2023, DCCT 2016.
- **§19 vage tidsskrifter** (l.1930–1935): "Diabetic Medicine / Diabetes Care-affiliated" osv. — slå det entydige tidsskrift op pr. PMID.
- **§11.2 Rizza 1979 forfatterliste** (l.1320): verificér om Haymond faktisk står på PMID 36413.

---

## E. Formatering / stil-konsistens

- **"### References" vs. "### Sources"**: §10 (l.1203) og §29 (l.3029) bruger "References"; resten bruger "Sources". Ensret.
- **Part 4 listeformat**: §8 bruger punktliste, §9/§10/§10b bruger blockquote. Vælg ét.
- **Amerikansk vs. britisk stavning**: §8–§9 amerikansk (glycemic, signaling), §10–§10b britisk (glycaemic, signalling, oedema). Vælg én konvention for hele dokumentet.
- **§16 citationsstil** (l.1710): ikke-hyperlinket "[Forfatter År]" i modsætning til §11–§15's hyperlinks.

---

## F. Mindre typos og skønhedsfejl

- **§27** "ascetaminophen" → "acetaminophen" (l.2620).
- **§5** "dichotomous listening" → "dichotic listening" (l.533).
- **§7** "hexadecandioic" → "hexadecanedioic" (l.852).
- **§29.5** ubalanceret parentes i V-ligningen (l.2960): ekstra `)`.
- **§27** "15-15-15 zone" → "15/15" (l.2653).
- **§25** "step input giver et peak" (l.630, §5): et step-input stiger monotont mod plateau; det er impuls/bolus-input der giver U_G-peak ved t=τ_G.
- **§29.4 k12 fejlmærket** (l.2949): k12=0,066 min⁻¹ er glukose-transferkonstant (Q2→Q1) i Hovorka 2004, ikke gut-absorption (styret af tmax,G). Vildledende for reimplementering.
- **§26 "Active in simulator"** (l.2503): simulator-reference i prosaen bryder BG-SCIENCE's rene-fysiologi-rolle (CLAUDE.md). Behold kun 🔧-callout (l.2603).
- **§26 DCCT/EDIC 1993** (l.2505): 1993-studiet er DCCT alene (EDIC eksisterede ikke i 1993).

---

## Til orientering — hvad der er stærkt (ikke til rettelse)

- **Kernemodel-parametre korrekte og internt konsistente**: Hovorka 2004 (F01, ke, ka1/ka2/ka3, renal threshold), Dalla Man 2007 gut-parametre, insulin-analog-PK (degludec t½ ~25 h, glulisin ~42 min, Fiasp tidligere tmax), DKA-kriterier, anion gap, pKa-værdier.
- **§13 (Somogyi)** afspejler korrekt den moderne CGM-baserede afkræftelse af den klassiske teori — velbalanceret.
- **§19 ethanol-redox-mekanismen** er lærebogs-korrekt.
- **§6 (fedt/protein)** er kvantitativt stærkt og internt konsistent.
- **Usikkerheds-flagning** (paywall-noter, "values from heterologous expression systems", ascertainment-forbehold) er forbilledlig for review-niveau.
- **EC50-hierarki** konsistent mellem §23 og §25.

---

## Anbefalet handlingsrækkefølge

1. **Ret de 5 top-prioritets-fund** (fysiologisk umulige tal + Rizza-PMID) — høj effekt, lav indsats.
2. **Ret de 4 AI-clché-brud** ("master switch", "endocrine choreography", "the body's defense/Evolution has endowed", "handed to complex IV") — projektregel.
3. **Systematisk PMID-audit** af §5-modulatorafsnittet og §12/§13/§17/§29 — kilde-integritet.
4. **Harmonisér de interne inkonsistenser** (τ_G/t½, Sorensen 19/22, UVA/Padova subjekter/parametre, cortisol/GH-tærskler).
5. **Ensret formatering** (Sources/References, stavekonvention, listeformat) — kan gøres i én omgang.
6. **Bump doc-version-markøren** (`<!-- doc-version: ... -->`) når rettelser er lavet.

Alle ovenstående er reviewer-fund; ingen ændringer er foretaget i `docs/BG-SCIENCE.md`.
