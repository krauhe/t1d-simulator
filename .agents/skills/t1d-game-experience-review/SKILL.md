---
name: t1d-game-experience-review
description: Analyser T1D Simulatorens onboarding, klikfriktion, engagement, motivation, læringsdesign og etiske game design. Brug når brugeren vil gøre spillet nemmere at gå til, reducere klik før start, forbedre velkomst- eller startflowet, skabe mere engagement og spænding, gennemgå Campaign- eller Box Challenge-progression, vurdere tutorials og belønninger eller have evidensbaserede forslag til spilleroplevelsen.
---

# T1D Game Experience Review

## Formål

Analysér den faktiske spilleroplevelse fra første sidevisning til meningsfuldt gameplay. Foreslå snævre, testbare forbedringer, som bevarer fysiologisk troværdighed, en tryg tone og spillerens frivillighed.

Skillen er primært en review- og beslutningsskill. Ændr ikke kode, medmindre brugeren udtrykkeligt beder om implementering.

## Før arbejdet

1. Læs projektets `AGENTS.md`.
2. Læs altid [evidence-principles.md](references/evidence-principles.md).
3. Læs [review-template.md](references/review-template.md), når resultatet skal være en samlet rapport eller et beslutningsoplæg.
4. Kør `git status --short`, og bevar alle eksisterende ændringer.
5. Undersøg den relevante kode, før du vurderer oplevelsen. Brug `rg` til at finde startknapper, popups, lagret progression, modevalg, karaktervalg, tutorials, objectives og analytics.
6. Brug kun sub-agenter, når brugeren udtrykkeligt har bedt om parallelle agenter eller delegation.

## Vælg arbejdsspor

1. Review eller diagnose: arbejd read-only og lever findings, evidens og forslag.
2. Koncept eller redesign: vis mindst to rimelige løsninger med tradeoffs, og anbefal én.
3. Implementering: følg først reviewet, diskutér større ændringer, og implementér kun det godkendte scope.
4. Browservalidering: brug projektets `playwright-test`-skill.
5. Fysiologisk påvirkning: brug `phys-reviewer`, før en ændring, der ændrer modeladfærd eller medicinsk framing.
6. Spillertekst: brug `game-text-writer`, når nye tips, introer, hjælpeafsnit eller game-over-tekster er en væsentlig del af opgaven.

## Workflow

### 1. Kortlæg det faktiske flow

Kortlæg separat for:

1. Ny spiller med tom `localStorage`.
2. Tilbagevendende spiller med gemt karakter, accepteret disclaimer og Campaign-progress.
3. Hver offentligt tilgængelig spiltilstand.
4. Desktop og mobil, hvis begge er i scope.

Registrér:

1. Minimumsantal klik eller tastetryk til en kørende simulation.
2. Antal beslutninger, skærme og blokerende popups.
3. Tidstyve som animationer, automatisk tale og forsinkelser efter en startkommando.
4. Om standardvalg allerede er gyldige, men stadig kræver bekræftelse.
5. Om progression bruges til en reel `Fortsæt`-vej.
6. Om hjælp gentages, ikke kan genfindes eller blokerer handling.
7. Afbrudte flows, Escape-adfærd, tilbageveje og anden fejlgenopretning.

Definér altid, hvad "startet" betyder. Foretræk "simulationen kører og spilleren kan handle" frem for blot "spilobjektet er oprettet".

### 2. Vurdér oplevelsen på otte dimensioner

1. Tid til meningsfuldt gameplay.
2. Valg- og informationsbelastning.
3. Kontekstuel læringsstøtte og genfindelig hjælp.
4. Kompetence: tidlig succes, forståelig feedback og mulighed for at rette fejl.
5. Autonomi: reelle, reversible valg uden tvang.
6. Relation og relevans: karakter, situation og hverdag uden lang adgangstekst.
7. Etisk engagement: ingen skyld, kunstig knaphed, tabstruede streaks eller skjulte fravalg.
8. Tryghed og faglig integritet: fiktiv karakter, ingen individuel behandlingsvejledning og ingen forenkling, der gør fysiologien misvisende.

### 3. Adskil evidens fra designinferens

Markér hvert centralt argument som:

1. Direkte evidens: forskning i spil, læring eller målgruppen, som svarer tæt til spørgsmålet.
2. Nærliggende evidens: solid forskning, men fra en anden kontekst.
3. Industri-praksis: platform- eller designvejledning.
4. Designinferens: en konkret hypotese for simulatoren, som skal testes.

Skriv aldrig "best practice" som om den gælder universelt. Choice overload, tutorials, fortælling og belønninger har heterogene effekter og afhænger af opgave, målgruppe og spillets kompleksitet.

### 4. Formulér forslag som testbare beslutninger

Angiv for hvert forslag:

1. Finding og berørt spillergruppe.
2. Evidens og evidensniveau.
3. Foreslået ændring.
4. Forventet virkningsmekanisme.
5. Risiko eller tradeoff.
6. Mindste relevante test.
7. Berørte filer og eksisterende UI-mønstre, der bør genbruges.

Prioritér med Høj, Mellem eller Lav. Gør den anbefalede rækkefølge tydelig.

### 5. Mål det rigtige

Brug ikke klik eller sessionstid alene. Medtag som minimum:

1. Tid til første meningsfulde handling.
2. Andel der når kørende gameplay.
3. Andel der gennemfører første loop: handling, konsekvens og nyt valg.
4. Setup-frafald pr. trin.
5. Første-session-læring eller forståelse.
6. Oplevet kompetence, autonomi og lyst til at prøve ét valg mere.
7. Hjælp, fejl, tilbageklik og sikkerhedsforståelse som guardrails.
8. Tilbagevendende spilleres tid til næste handling.

Hold analytics anonyme og minimale. Log ikke helbredsdata eller fritekst.

## T1D-specifikke guardrails

1. Frame spillet som læring og udforskning, ikke overlevelse.
2. Brug neutral, ikke-dømmende, faktabaseret og håbefuld diabetes-tekst.
3. Beløn hypoteser, observationer og forståelige beslutninger; beløn ikke tvangspræget tilbagevenden.
4. Gør fejl i spillet reversible og informative. Undgå skam og personlige labels.
5. Bevar tydeligt skel mellem fiktiv simulation og behandling af virkelige personer.
6. Brug ikke frygt for hypo, DKA eller komplikationer som retentionmekanik.
7. Bevar nødvendige sikkerhedsbudskaber, men komprimér eller flyt sekundær information efter behov.
8. Undgå konkurrerende leaderboards, hvis de kan få børn eller nydiagnosticerede til at sammenligne medicinsk "dygtighed".

## Output

1. Svar på dansk.
2. Nummerér findings, forslag og valgmuligheder.
3. Brug konkrete fil- og linjereferencer for påstande om den nuværende kode.
4. Indled med konklusionen og den vigtigste anbefaling.
5. Medtag scope, metode, current-state-flow, findings, evidens, prioriterede forslag, måleplan, risici og begrænsninger.
6. Gem samlede reviews i `docs/reviews/YYYY-MM-DD_<author>_<scope>.md`, når brugeren beder om en filbaseret rapport.
7. Implementér ikke større eller tvetydige forslag uden eksplicit godkendelse.

## Kvalitetstjek

1. Er første- og tilbagevendende flow analyseret separat?
2. Er klik, beslutninger, popups og forsinkelser adskilt?
3. Er direkte evidens og designinferens tydeligt mærket?
4. Har alle Høj-prioritetsforslag en måling og en guardrail?
5. Bevarer forslagene fysiologi, sikkerhed, varm tone og spillerens autonomi?
6. Genbruger forslagene eksisterende komponenter og projektmønstre?
7. Er der undgået dark patterns, AI-clichéer og dramatisk diabetes-framing?
