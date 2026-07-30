# UI Feedback: Bund-layout, BG-panel og graffarver
Genereret: 2026-04-06

---

## 1. SPEED STEPPER I BUNDEN — Problem og forslag

### Problem
Speed-stepperen (◀ ▶4t/min ▶) er visuelt "forældreløs" under dock'en:
- **Størrelsesforskel**: Dock-ikoner er ~48×48px med labels, stepperen er ~100×38px. Den ser ud som et glemt element.
- **Stilforskel**: Dock'en har runde ikoner med hover-magnification og farve-kategorier. Stepperen er en flad, rektangulær kontrol. To forskellige designsprog.
- **Hierarki**: Stepperen er en af de mest brugte kontroller (hastighed, pause), men den ser ud som det mindst vigtige element.

### Forslag
**A. Integrer stepperen i dock'ens visuelle ramme:**
- Sæt stepperen INDEN I dock-panelet (samme baggrund/border/blur), adskilt med en tynd vertikal separator.
- Gør stepper-knapperne runde som dock-ikonerne.
- → Én sammenhængende "kontrol-ø" i bunden.

**B. Alternativt: gør stepperen til et dock-lignende element:**
- Giv den dock-stil: rund baggrund, ikon-størrelse, label under.
- Play/pause som primært ikon, hastighed som label.
- Pileknapper vises ved hover/tap.

---

## 2. BG-PANEL (CGM HERO) — Flyt til højre?

### Nuværende
- Absolut positioneret øverst til venstre i grafen (`top: 32px; left: 70px`)
- Dækker potentielt CGM-datalinjen
- Halvgennemsigtig med blur — man KAN se bagved, men det er ikke ideelt

### Analyse af tom plads til højre
Bottom-bar bruger `grid-template-columns: 1fr auto 1fr`. Event-log fylder venstre kolonne, dock centreres, højre kolonne er tom (settings-gruppen er flyttet til top-bar). Der er altså ledig plads i højre side af bottom-bar OG til højre for grafen (når side-draweren er lukket).

### Forslag
**Flyt CGM hero til et fast panel til højre for grafen**, ikke som overlay:
- Placering: Højre side af `#graph-section`, som en kolonne ved siden af canvas
- Fordele: Dækker aldrig grafdata, giver grafen fuld bredde, BG-tallet er altid synligt
- Ulempe: Kræver layout-ændring fra 1-kolonne til 2-kolonne i graph-section
- **Alternativt**: Behold overlay men flyt til ØVERSTE HØJRE hjørne af grafen, hvor BG-linjen sjældent er (typisk er de nyeste data til højre, men man scroller ikke fremad)

---

## 3. GRAFFARVER — Kritik

### Nuværende farver
```
Hyper (>14):  rgba(255, 90, 90, 0.28)    — rød
Forhøjet:    rgba(255, 160, 20, 0.50)    — orange (HØJ alpha!)
Target:      rgba(80, 220, 140, 0.32)    — grøn
Hypo (<4):   rgba(255, 90, 90, 0.28)     — rød
```

### Problemer
1. **Orange-zonen har for høj alpha (0.50)** — dominerer visuelt og gør grafen "tung"
2. **Trafiklys-effekt**: Rød-orange-grøn er intuitivt men skaber en "advarselstavle"-æstetik der føles stressende — modsat spillets pædagogiske mål
3. **Mørk baggrund + mættede farver** = dystert udtryk. Grafen skal føles som et trygt læringsmiljø, ikke et faresignal
4. **Grønzonen dominerer** (~60% af synligt areal ved normal y-akse), hvilket gør resten af grafen visuelt tung
5. **Hårde farveskift** (trods soft transitions) — øjet fanges af farveændringerne i stedet for BG-linjen

### 4 alternative farve-paradigmer → se mockup-filer

---

## 4. MOCKUP-OVERSIGT

| # | Fil | Paradigme | Beskrivelse |
|---|-----|-----------|-------------|
| 1 | mockup-graph-subtle.html | **Subtil gradient** | Næsten usynlige zoner, kun tydelige ved kanterne. Fokus på BG-linjen. |
| 2 | mockup-graph-lines.html | **Linje-markører** | Ingen fyldte zoner. Tynde horisontale linjer ved 4, 10, 14 mmol/L med labels. |
| 3 | mockup-graph-soft.html | **Bløde pasteller** | Lysere, varmere farver med meget lav alpha. Venligere udtryk. |
| 4 | mockup-graph-mono.html | **Monokrom gradient** | Én farve (teal) i varierende intensitet. Ingen trafiklys-effekt. |
