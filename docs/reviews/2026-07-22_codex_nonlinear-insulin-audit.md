# Audit af ikke-lineær insulindosis-respons

**Dato:** 2026-07-22
**Scope:** TODO #6; insulinens vævsspecifikke dosis-respons i `js/hovorka.js` og `js/physiology-engine.js`, tilhørende dokumentation og tests.
**Grundlag:** `docs/BG-SCIENCE.md` §25, `docs/MODEL-IMPLEMENTATION.md`, beslutningsdokumentet `2026-06-13_nonlinear-insulin-dose-response-decision.md` samt den aktuelle kode.

## Konklusion

TODO #6 var allerede implementeret. Muskelkanalerne har en mættende Hill-respons, fedtvævets anti-lipolytiske kanal har sin egen Hill-respons, og leverkanalen er bevidst bevaret som en lineær tidlig-respons-approksimation efter tidligere kalibrering. Der er ikke grundlag for at ændre modelmatematikken igen som del af dette punkt.

Auditten fandt én forældet implementeringsnote i `BG-SCIENCE.md` og én forkert enhedsangivelse i en kodekommentar. Begge er rettet. Fem automatiske kontrakttests beskytter nu den eksisterende Hill-implementering.

## OK — Muskelkanalerne bruger en dimensionskonsistent Hill-respons

**Fil:** `js/hovorka.js`, omkring linje 121-149 og 421-445
**Subsystem:** Insulinvirkning på perifer transport (`x1`) og disposal (`x2`)
**Vurdering:**

```text
x_target = amplitudeMod * x_max * I^n / (EC50_eff^n + I^n)
```

Hill-leddet er dimensionsløst, fordi både tæller og nævner har enheden `(mU/L)^n`. `x1max` og `x2max` har enheden `1/min`, så målet har samme enhed som `x1` og `x2`. Ved `I = EC50_eff` er målet præcis halvdelen af maksimum; ved meget høj insulin nærmer det sig maksimum asymptotisk.

`EC50_muscle = 55 mU/L` og `n = 1.5` følger den dokumenterede Rizza-baserede startparameter. Maksimum er kalibreret til at matche den tidligere lineære model ved `I = 35 mU/L`, så normal bolusadfærd bevares, mens lavdosisområdet bliver underproportionalt.

**STATUS:** ✅ FIKSET (2026-07-22) — den eksisterende implementering er bevaret og har fået direkte kontrakttests.

## OK — PEIS forskyder kun musklens EC50

**Fil:** `js/physiology-engine.js`, omkring linje 1227-1233; `js/hovorka.js`, omkring linje 398-445
**Subsystem:** Post-exercise insulin sensitivity (PEIS)
**Vurdering:** `EC50_eff = EC50_muscle / peisMuscleFactor` øger muskelresponsen ved samme plasmakoncentration uden at hæve Hill-kurvens maksimum. Leverens `x3` ændres ikke af PEIS-faktoren. Det er konsistent med den valgte muskel-/AS160-framing og beslutningsdokumentet fra 2026-06-13.

**STATUS:** ✅ FIKSET (2026-07-22) — den eksisterende kobling er bevaret og dækket af en automatisk regressionstest.

## OK — Fedtvævets relevante insulinkanal er allerede ikke-lineær

**Fil:** `js/physiology-engine.js`, omkring linje 487-490 og 1773-1788
**Subsystem:** Insulinhæmning af lipolyse og CPT-1-aktivitet
**Vurdering:** Fedtvæv er ikke modelleret som et selvstændigt glukosekompartment. Dets centrale kanal i denne model er anti-lipolyse, som allerede bruger en Hill-funktion med `LIPOLYSIS_EC50 = 5 mU/L` og `n = 3`. CPT-1-suppressionen er ligeledes mættende. Et nyt adipøst glukoseoptagskompartment er derfor ikke nødvendigt for at afslutte TODO #6.

**STATUS:** ⚠️ BY DESIGN — den gameplay-kalibrerede EC50 på 5 mU/L bevares; den kendte afvigelse fra populationsestimater er dokumenteret separat.

## BY DESIGN — Leverens x3-kanal forbliver lineær

**Fil:** `js/hovorka.js`, omkring linje 131-140 og 443-445
**Subsystem:** Insulinsuppression af endogen glukoseproduktion
**Vurdering:**

```text
x3_target = amplitudeMod * S_IE * I
```

Enhedskæden er `L/mU * mU/L = 1`, så `x3` er dimensionsløs som krævet. En literal Hill-kurve med den plasma-refererede Rizza-EC50 på 29 mU/L blev tidligere afprøvet, men var ikke kompatibel med modellens basalinsulinniveau: den undertrykte EGP for lidt ved basal eller for meget i mellemområdet afhængigt af kalibreringen. Det påvirkede basalbalance, DKA-gate, hypoglykæmi og glukagonrespons. Den lineære kanal er derfor en dokumenteret tidlig-respons-approksimation, ikke en glemt del af TODO #6.

**STATUS:** ⚠️ BY DESIGN — beslutningen fra 2026-06-13 fastholdes.

## NOTE — Forældet implementeringsstatus i BG-SCIENCE

**Fil:** `docs/BG-SCIENCE.md`, implementeringsnoten efter §25
**Problem:** Noten sagde fortsat, at `x1/x2/x3` var lineære, og at TODO #6 afventede implementering.
**Løsning:** Noten beskriver nu muskel-Hill, adipose Hill, den lineære leverapproksimation og PEIS-forskydningen korrekt. Dokumentmarkøren er opdateret til `2026-07-22-v2`.

**STATUS:** ✅ FIKSET (2026-07-22)

## NOTE — Forkert enhed i S_IE-kommentar

**Fil:** `js/hovorka.js`, linje 91
**Problem:** Kommentaren angav `S_IE` som `1/mU`. Det ville give `1/L` efter multiplikation med plasma-insulin i `mU/L`, selv om `x3` skal være dimensionsløs.
**Løsning:** Kommentaren er rettet til `L/mU`. Talværdi og beregning var allerede korrekte.

**STATUS:** ✅ FIKSET (2026-07-22)

## Verifikation

- JavaScript-syntaks: bestået.
- Fuld Node-suite: 171/171 bestået, inklusive fem nye Hill-kontrakttests.
- PhysiologyEngine API: 21/21 bestået.
- Golden master: 7/7 bit-identiske scenarier.
- Klinisk ækvivalens: 9/9 scenarier.
- Standalone-paritet: 10/10 scenarier.
- Tekstsynkronisering: 891/891 nøgler.

## Status-opsummering

- KRITISK: 0.
- ADVARSEL: 0.
- NOTE: 2, begge fikset.
- OK/BY DESIGN: 4.
- Åbne punkter fra TODO #6: 0.

TODO #6 kan betragtes som færdigt. Eventuelle senere ændringer af leverens dosis-respons eller glukoseafhængig GLUT4-mætning er selvstændige, højrisiko modeludvidelser og kræver ny kalibrering samt et separat beslutningsdokument.
