# Oversigt over analyser og beslutninger

Opdateret: 2026-10-25. Se [standarden](README.md). Oversigten starter med dagens arbejde og er endnu ikke et fuldstændigt indeks over ældre rapporter.

| Emne og reference | Konklusion, der kan genbruges | Beslutning og udførelse |
|---|---|---|
| 1. [Glukose: gennemførlighed, vand og synlig effekt](2026-10-25_codex_glucose-feasibility.md) | Fælles kulhydrat-tidskonstant kobler mave og tarm. Foreslået prototype adskiller processerne. Produktets sammensætning betyder noget; analysen begrunder ikke en universel glukosefordel eller en fast vandbonus. Følsomhedsforsøg er ikke klinisk kalibrering. | Analyse afsluttet. Prototype og parametre er anbefalinger, ikke godkendte eller implementerede modelændringer. Genåbn kalibreringen ved originaldata eller et konkret prototypevalg. |
| 2. [Glukose: indledende modelplan](2026-10-25_glucose-model-plan.md) | Beskriver det oprindelige ønske og evidensbehovet. Læs gennemførlighedsanalysen ovenfor for den efterfølgende vurdering. | Historisk oplæg; den videre analyse er leveret. Kulhydratændringen er stadig åben. |
| 3. [Lav CGM-alarm og opvågning](2026-10-25_cgm-low-alarm-fix.md) | Dokumenterer alarmens diagnose, valgte adfærd og verifikation. | Implementeret og testet lokalt. Ikke publiceret som del af dagens arbejde. |
| 4. [Onboardingpilot](2026-10-25_onboarding-pilot.md) | Forslag om at afprøve en kort frokostcase og derefter en situation mellem måltider. Lokal klikbar mockup viser retningen. | Beslutningsoplæg og mockup. Baneforslagene er ikke implementeret i den spilbare udgave. Afprøv forståelighed før videre udrulning. |
| 5. [Rettelser og én offentlig udgave](2026-10-25_release-verification.md) | Samler testnoter, lokale rettelser, kontrol og kendte begrænsninger. | Klargjort og kontrolleret lokalt. Ingen commit, push eller publicering af dagens pakke. Glukosevalg og udgivelsesrækkefølge er uafklaret. |
| 6. [Konkret forslag: mave, tarm og druesukker](2026-10-25_codex_gastric-intestinal-proposal.md) | Én fælles mave med sporing pr. kulhydratprofil, særskilt efterfølgende optagelsesprofil, én indtagskø og samme profiler i madmenu/kit/Lav selv. Indeholder ligninger, berørte filer, kalibreringsgrænser og acceptkriterier. | Brugeren har besluttet at beholde bamserne. Arkitektur og nye custom-valg er forslag; ingen modelimplementering. Uafhængig agentkritik er indarbejdet. |

Ved genbrug: læs rapportens scope, kildedækning og begrænsninger. Tabellen er en genvej til begrundelserne, ikke en erstatning for dem.

Tilføjelse 2026-10-25 til emne 1: Rapportens follow-up vurderer sukrosebaseret candyfloss som mulig erstatning for bamserne og særskilte valg for druesukker/hvidt sukker i brugerdefineret mad. Begge er forslag. En større forskel i blodsukkerrespons er ikke dokumenteret ved produktskiftet alene. Den eksisterende PDF indeholder endnu ikke tilføjelsen.

Efterfølgende beslutning 2026-10-25: Brugeren ønsker at beholde bamserne indtil videre. Candyfloss-forslaget forfølges derfor ikke. Det konkrete modeloplæg findes under emne 6.
