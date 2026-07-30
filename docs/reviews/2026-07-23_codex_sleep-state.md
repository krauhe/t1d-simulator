# Review: fælles søvn- og vågentilstand

Dato: 2026-07-23  
Scope: Natlig fysisk aktivitet, søvnunderskud, stress og spillerens visuelle feedback

## ADVARSEL — Søvnstatus er fordelt på flere uafhængige repræsentationer

**Fil:** `js/physiology-engine.js`, `js/simulator.js`, `js/archetypes.js`, `js/ui.js`, `mobile/mobile.js`  
**Subsystem:** Søvnforstyrrelse og natlig aktivitet

**Problem:** Motoren har fysiologiske variable for søvnunderskud, men ingen fælles tilstand for, om karakteren aktuelt er vågen eller sover. De eksisterende repræsentationer har forskellige ansvar:

- `lostSleepHoursTonight` bruges til næste morgens kroniske stress og dawn-forstærkning.
- `lastNightAwakeningTime` bruges til at gruppere natlige handlinger.
- `nightAwakenings` ligger i `Simulator`-facaden og bruges som visuel historik.
- BG Hero, Zzz-animationen og nattebaggrunden afgør søvn på forskellige måder.

Når fysisk aktivitet startes om natten, kalder motoren den generelle `registerNightIntervention()`. Den funktion tildeler et tilfældigt søvntab på 0,3-1,8 timer, men kender ikke aktivitetens faktiske varighed. Derfor kan Zzz og den mørke nattebaggrund vende tilbage, mens en længere aktivitet stadig udføres. Portrættet kontrollerer den aktive aktivitet, men kan skifte direkte fra aktiv til sovende ved stop uden en restitutionsperiode.

**Fysiologisk og spilmekanisk konsekvens:** En lang træning om natten kan blive registreret som mindre søvntab end den faktiske vågentid. Det giver for lidt efterfølgende kronisk stress og dawn-forstærkning. Samtidig kan spillerens tre søvnsignaler modsige hinanden.

**Forslag:**

1. Lad motoren eje én eksplicit vågentilstand og historik, eksempelvis et aktivt `nightAwakeUntil` kombineret med sammenlagte vågenintervaller.
2. Hurtige natlige handlinger kan fortsat åbne et stokastisk interval for tiden, før karakteren falder i søvn igen.
3. Cardio, styrke og mixed skal holde karakteren vågen under hele aktiviteten. Ved manuel eller automatisk afslutning forlænges vågentiden med 30 minutter. Afslapning omfattes ikke som fysisk træning.
4. Akkumulér søvntab efter faktisk vågen tid inden for 22:00-07:00 og sammenlæg overlappende intervaller, så samme minut ikke tælles flere gange.
5. Lad følgende læse samme motor-ejede tilstand/historik:
   - Zzz på desktop og mobil
   - karakterens søvn-, trætheds-, aktivitets- og forpustethedsudtryk
   - lyse vågenfelter i desktop- og mobilgrafens nattebaggrund
6. Bevar prioriteterne hypo, hyper og sygdom over de almindelige søvnhumører.
7. Opdatér `MODEL-IMPLEMENTATION.md`, fordi den nuværende beskrivelse siger, at søvntab tildeles pr. natlig handling.

**Nødvendige tests:**

- Fysisk aktivitet viser ingen søvnmarkører under aktiviteten.
- Efter stop vises forpustet ved høj puls, ellers træt, i op til 30 minutter.
- Zzz og mørk nat vender først tilbage efter restitutionsperioden.
- Styrke, cardio og mixed følger samme søvnkontrakt.
- Manuel og automatisk afslutning giver samme resultat.
- Aktivitet hen over midnat og 07:00 tæller kun vågne minutter inden for nattevinduet.
- Overlappende aktivitet og andre natlige handlinger dobbelttæller ikke søvntab.
- Resultatet er stabilt ved mindst to integrationstrin.

**STATUS:** ✅ FIKSET (lokalt 2026-07-27) — motoren ejer nu én sammenlagt vågenhistorik og optjener søvntab fra faktisk vågen tid. Fysisk aktivitet holder tilstanden åben under passet og 30 minutter efter både automatisk og manuelt stop. Desktop, mobil, Zzz, humør og natbaggrund læser samme tilstand. Direkte engine-tests og hele simulationssuiten består.

## OK — Koblingen fra søvntab til næste dags fysiologi findes allerede

Motoren konverterer om morgenen `lostSleepHoursTonight` til en begrænset kronisk-stresspåvirkning. Den kroniske stress påvirker insulinresistens, og søvntabet forstærker dawn-responsen. Denne downstream-kobling bør bevares; det er registreringen af vågentid og den delte søvnstatus, der skal rettes.

**STATUS:** ⚠️ ACCEPTABEL — downstream-koblingen bevares ved den planlagte rettelse.

## Samlet status

- KRITISK: 0
- ADVARSEL: 0 åbne, 1 fikset lokalt
- NOTE: 0
- OK: 1 acceptabel
