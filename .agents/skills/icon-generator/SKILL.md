---
name: icon-generator
description: Lav eller revider ikoner til T1D Simulator som transparente PNG-assets i samme visuelle familie som F001-F018 og lowcarb-referenceikonerne. Brug denne skill ved alle ikonopgaver: mad, custom food carb-typer, insulin, T1D kit, activity, settings, campaign-events, mode-ikoner og abstrakte procesikoner. Ikonerne skal være kompakte, semi-realistiske, uden tekst/logo, optimeret til 36-42 px, og baggrunden skal være transparent.
---

# Ikon-generator til T1D Simulator

Denne skill bruges til at lave og revidere alle ikoner i T1D Simulator. Målet er en samlet ikonfamilie, ikke en blanding af emoji, hurtige SVG-piktogrammer og fotorealistiske billeder.

## Stilanker

Brug altid disse som primær reference for stil, farver, detaljeniveau og læsbarhed:

- Mockup-serien `F001-F018` i `mockups/2026-05-24_icon-revision-plan/generated/transparent/`
- `assets/icons/food/lowcarb-salmon-avocado.png`
- `assets/icons/food/lowcarb-eggs-bacon.png`
- `assets/icons/food/lowcarb-steak-bearnaise.png`

F001-F018 viser den ønskede retning: transparente PNG'er, kompakte motiver, mere realistiske end emoji, men stadig tydelige ved 36-42 px.

## Grundregel

Lav ikoner som kompakte objekter eller motivgrupper, ikke som flade UI-symboler.

Krav:

- Transparent PNG som slutformat.
- Kvadratisk kildeasset, helst ca. `1254x1254`.
- Motivet skal fylde ca. 82-90% af canvas med jævn luft til alle kanter.
- 3/4 top-down eller let 3/4 produktvinkel. Undgå helt flade frontale symboler medmindre objektet kræver det.
- Let stiliseret semi-realistisk illustration: tydelige former, realistiske materialer, mættede men naturlige farver og kontrollerede highlights.
- Bløde, klare kanter uden tyk sort outline.
- Ingen tekst, bogstaver, tal, labels, logo, brands, vandmærke, bord, serviet, bestik eller baggrundsdekoration.
- Ingen kastet skygge på baggrund. Hvis dybde er nødvendig, skal skyggen være indbygget i selve motivet.

## Små størrelser

Design altid til at ikonet primært vises småt:

- Food chips: ca. `42x42 px`.
- Graf-events: ca. `36x36 px`.
- Settings og mode-ikoner: ofte 20-36 px.

Derfor:

- Brug få store former frem for mange små detaljer.
- Maks. 2-4 hovedkomponenter pr. ikon.
- Små detaljer må kun være tekstur, ikke information brugeren skal kunne læse.
- Silhuetten skal kunne genkendes ved 36 px.
- Undgå tynde streger, små frø, mikrotekst, små målemarkeringer og detaljer der bliver mudrede.

## Farvestil

Farverne skal ligge i samme familie som F001-F018:

- Høj, men ikke neonagtig, mætning.
- Varme highlights på mad, plast, metal og medicinske objekter.
- Dybere skygger i objektets egen farvefamilie, ikke hård sort/grå.
- Friske grønne toner må bruges, men ikke som chroma-key.
- Medicinske ikoner skal bevare semantiske farver: rapid = teal, basal = blå, glukagon/nød = rød, ketoner = lilla.

Undgå:

- Flade emoji-farver uden tekstur.
- Lucide-/outline-SVG som endelig stil.
- Fotorealistisk kamerastøj, hårde reflekser eller uskarpe billedkanter.
- Meget blege beige/tan-motiver der forsvinder på lys UI.
- Meget mørke motiver der forsvinder på grafen.

## Tallerken, skål og beholdere

Tallerken/skål/beholder er tilladt når den forbedrer genkendelighed ved lille størrelse. Det er ikke et mål i sig selv at fjerne tallerkener.

Brug beholder når den er en del af det stereotype visuelle udtryk eller gør motivet mere læsbart, fx:

- Havregrød i skål.
- Pasta i lav tallerken.
- Karry/ris i lav skål.
- Juice/cola som karton, glas eller flaske.
- Generelt madikon som lille samlet servering.

Beholderen skal være enkel og sekundær. Maden eller objektet skal være hovedmotivet.

## Ikke-mad ikoner

Ikoner for insulin, kit, settings, campaign-events og tilstande skal stadig følge bitmap-stilen:

- Byg dem som små, håndgribelige objekter: sprøjte, pen, teststrimmel, sensor, måler, kort, boks, noteseddel, signalbrik.
- Brug samme semi-realistiske lys, materiale og kompakte form som madikonerne.
- Undgå rene linjeikoner som slutresultat.
- Ved abstrakte begreber: lav 2-3 konkrete metafor-varianter i samme stil og lad brugeren vælge.
- Ved settings: hellere små “tool objects” end generiske emoji.

Eksempler:

- Basal insulin: blå sprøjte/pen med lille fysisk ur-badge, ikke flad clock-lineart.
- Glukagon: rød nød-pen/autoinjektor med stort enkelt førstehjælpskryds.
- Keton-test: teststrimmel med lilla farvefelt, ikke reagensglas hvis strimmel er mere konkret.
- Campaign: lille læringskort/rute eller forhindringsbane som kompakt objekt.
- Sim Lab: lille eksperimentbord eller lab-flaske, venlig og ikke klinisk.

## Imagegen-workflow

Brug `imagegen`-skillen til rastergenerering.

For transparent baggrund:

1. Generér på flad chroma-key baggrund.
2. Brug `#ff00ff` som standard, fordi mange ikoner har grønne/blå elementer.
3. Kopiér output fra `$CODEX_HOME/generated_images/...` til projektets mockup- eller asset-mappe.
4. Fjern chroma-key med:

```powershell
python C:\Users\krist\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py --input <source.png> --out <final.png> --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

Hvis der er farvefringe, prøv én gang mere med `--edge-contract 1`.

## Prompt-template

Brug denne promptstruktur:

```text
Create a square transparent-background game UI icon of [object / concept].
The icon must match the T1D Simulator F001-F018 icon family: polished semi-realistic illustrated game asset, compact, slightly stylized, realistic material texture, saturated but natural colors, controlled highlights, clean readable shapes, optimized for 36-42 px.

Subject and composition:
- Show [main object] as the largest readable form.
- Add [secondary element] only if it improves recognition.
- Use a compact 3/4 composition.
- Keep the silhouette clear at 36x36 px.
- No text, no labels, no logo, no brand marks.

Detail level:
- Use large readable forms with a few meaningful texture details.
- Avoid tiny details that must be read to understand the icon.

Color and lighting:
- Match the warm, saturated but natural F001-F018 style.
- Keep contrast high enough for both light cards and dark graph areas.
- No cast shadow, no contact shadow, no background shadow.

Background:
- Place the icon on a perfectly flat solid #ff00ff chroma-key background.
- The background must be one uniform color with no gradient, texture, floor plane, reflection, or lighting variation.
- Do not use #ff00ff anywhere in the object.

Output constraints:
- Square image.
- Centered subject filling about 82-90% of canvas.
- No text, no watermark.
```

## Revidering af eksisterende ikoner

Når ikoner i projektet revideres:

1. Find brugen i `index.html`, `js/foods.js`, `js/levels.js`, `js/ui.js`, `js/campaign.js` og `assets/icons/`.
2. Lav først mockup-udkast i `mockups/2026-05-24_icon-revision-plan/generated/`.
3. Vis udkast i `mockups/2026-05-24_icon-revision-plan/index.html`, ikke kun på en separat galleri-side.
4. Bevar eksisterende filnavne ved endelig udskiftning, medmindre brugeren vil sammenligne versioner.
5. Ændr ikke makroer, carbType, gameplay eller fysiologi som del af ikonarbejde.
6. Efter produktionsudskiftning: test visuelt i browser ved små størrelser.

## Kvalitetscheck

Godkend kun et ikon hvis:

- Det fungerer ved 42x42 px og 36x36 px.
- Det matcher F001-F018 bedre end emoji/SVG-stilen.
- Transparent baggrund er ren i hjørnerne.
- Ingen tekst, logo eller brandmarkering er synlig.
- Ikonet har nok materiale/tekstur til at føles realistisk, men ikke så meget at det bliver mudret.
- Farver, lys og detaljeniveau passer sammen med F001-F018.

Rapportér:

- Gemte filstier.
- Hvilke ID’er der er lavet.
- Om chroma-key-fjernelse og browservisning er valideret.
