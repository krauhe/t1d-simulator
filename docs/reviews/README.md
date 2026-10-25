# Standard for analyser, reviews og begrundede beslutninger

Oprettet: 2026-10-25. Denne fil beskriver, hvordan projektets konklusioner bevares og genbruges. Start i [oversigten](INDEX.md); brug [skabelonen](REVIEW-TEMPLATE.md) ved nye rapporter.

## 1. Placering og genfinding

1. Gem den autoritative rapport som `docs/reviews/YYYY-MM-DD_<scope>.md`. Et selvstændigt dokument om en større implementeringsbeslutning hedder `YYYY-MM-DD_<scope>-fix.md`, jf. AGENTS.md. Bevar eksisterende filnavne.
2. Registrér rapporten i `INDEX.md` med spørgsmål, konklusion, beslutningsstatus og implementeringsstatus. Link til en eksisterende rapport frem for at kopiere dens analyse. Indekset er indgangen; rapporten indeholder begrundelsen.
3. Gem figurer og kompakte, reproducerbare forsøgsresultater under `figures/` eller `artifacts/<dato-scope>/`. Angiv kommando, input, modelversion og resultatfiler. Store rådata, fuldtekstartikler og rå eksterne modelsvar forbliver i de private mapper; angiv deres placering og relevante filhash i rapporten. Den offentlige rapport skal stadig indeholde tilstrækkelige resultater og forbehold til at forstå konklusionen.
4. PDF og mockup er supplerende visninger. Markdown-rapporten er referenceversionen; angiv hvis en PDF ikke længere følger seneste rapportrevision. Filer er først sikret i Git-historikken efter et autoriseret commit. At de ligger her, er ikke dokumentation for commit eller publicering.

## 2. Minimumsindhold

1. Dato, spørgsmål, afgrænsning og undersøgt kodegrundlag: commit samt relevante lokale ændringer eller filhash. Skriv ukendt, hvis grundlaget ikke kan fastslås.
2. Kilder og deres faktiske læsedækning: original fuldtekst, abstract, uddrag eller sekundær gengivelse. Ekstern modelsparring er kritik, ikke forskningsbevis.
3. Konkrete fund, rimelige alternativer, anbefaling og begrundede fravalg. Adskil målinger, modelantagelser og ubekræftede hypoteser.
4. Beslutningslog med dato og grundlag for brugerens godkendelse, når den findes. Skriv udtrykkeligt, når der kun foreligger et forslag. En bestilt analyse er ikke en godkendt modelændring.
5. Implementering og verifikation: berørte filer, relevante resultater, kendte begrænsninger samt separat commit- og udgivelsesstatus. Brug de eksisterende STATUS-annotationer fra AGENTS.md ved rettede reviewpunkter.
6. Hvad der kan genbruges, hvilke spørgsmål der stadig er åbne, og hvad der konkret ville begrunde en ny analyse.

## 3. Opdatering uden tab af historik

1. Læs indekset og den relevante rapport før ny research. Genbrug eksisterende dokumenterede konklusioner med deres forbehold. Kontroller, om kodesteder, kilder og forudsætninger stadig gælder.
2. Tilføj en dateret beslutning eller statusændring i den eksisterende rapport. Overskriv ikke et tidligere valg, så dets begrundelse forsvinder. Ved væsentligt ændret scope oprettes en ny rapport med gensidige links og tydelig angivelse af, hvilke konklusioner den afløser.
3. Genåbn kun den berørte del ved ændret model, nye relevante data, et mislykket forsøg eller et ændret produktmål. Notér udløseren. Gentag ikke hele litteratursøgningen alene, fordi en ny chat starter.
4. Hold indeks og rapport enige. Anbefalet, godkendt, implementeret lokalt, verificeret og publiceret er forskellige tilstande; ingen af dem må udledes automatisk af en anden.

## 4. Indførelse

Standarden gælder nye rapporter og rapporter, som fremover berøres. Indekset starter med arbejdet fra 2026-10-25. Ældre rapporter bliver stående og registreres ved relevant genbrug; de er ikke blevet genvurderet som del af denne oprydning. De eksisterende krav til større modelbeslutninger i AGENTS.md gælder fortsat.
