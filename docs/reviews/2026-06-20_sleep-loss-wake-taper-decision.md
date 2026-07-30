# Søvntab tapet mod vågetid (fix-decision-doc)

**Dato:** 2026-06-20
**Type:** Model-/motor-adfærdsændring (motor-lag, `PhysiologyEngine.registerNightIntervention`)
**Gren:** `editor-graph-unification`
**Forfatter:** Claude

> Fælles dokument for Claude Code og Codex. Skrevet selvstændigt — ingen
> samtale-kontekst. Et værktøj kan overtage koldt.

---

## Baggrund

En intervention om natten (22:00-07:00) — mad, bolus, basal, motion, glukagon —
behandles som en "opvågning" der koster søvn ([physiology-engine.js](../../js/physiology-engine.js)
`registerNightIntervention`). En ny opvågning (>30 min siden sidste nat-handling)
kostede et **fast** tab (deterministisk 1.0 t; i spillet `gaussRand(1.0, 0.3)`
klippet til 0.3-1.8 t). Tabet akkumuleres i `lostSleepHoursTonight` og omsættes
ved 07:00-krydset (`applySleepDebt`) til kronisk stress (0.06 pr. tabt time,
loft 0.30), som hæver insulinresistensen (`1 + chronicStress*0.5`) og forstærker
dawn-amplituden (`× (1 + lostSleep*0.12)`) resten af dagen.

**Problemet:** porten var binær ved 07:00. En event kl. 06:59 kostede en HEL time
søvn (indløst ved samme dags 07:00 → stress hele dagen); samme event kl. 07:01
kostede intet. En 1-minuts forskydning hen over 07:00 vippede altså hele døgnets
insulinresistens → en diskontinuitet i BG-kurven. Målt i editoren (bolus 3 E,
samme dag): BG kl. 12 = **8.55** for event kl. 06:55 mod **7.35** kl. 07:05 —
et **~1.2 mmol/L spring** fra 10 minutters forskel. Det er ufysisk: at vågne
1 minut før vækkeuret mister ikke en hel times søvn.

## Beslutning

Tap søvntabet mod vågetid: **en opvågning kan ikke koste mere søvn end der er
tilbage til kl. 07:00.**

```
sleepLoss = min(baseLoss, minutter_til_07:00 / 60)
```

`baseLoss` er uændret (1.0 t deterministisk / gaussRand i spillet). Tabet glider
nu mod 0 hen mod vågetid, så porten ved 07:00 bliver kontinuert. Fordi
`lostSleepHoursTonight` driver BÅDE resistens-bumpet OG dawn-forstærkningen,
bliver begge nedstrøms-effekter kontinuerte i ét greb.

### Hvorfor kun morgen-grænsen (07:00)?

22:00-grænsen (sengetid) lades **bevidst** urørt. Den er fysiologisk et reelt
trin: at gøre noget *før* sengetid koster ingen søvn (man er vågen), mens at blive
vækket *lige efter* indsovning forstyrrer hele natten. Et taper dér ville give den
modsatte ulogik (en opvågning kl. 22:01 ville koste ~0, selvom man mister nattens
ro). Desuden er 22:00-effekten ikke synlig i et 24-timers editor-vindue: den
indløses først ved NÆSTE dags 07:00, som ligger uden for vinduet (i 48/72t-vindue
ses den korrekt på dag 2).

## Implementering

I `registerNightIntervention`: `gaussRand` trækkes stadig i SAMME position (RNG-
strømmen er uændret); kun den resulterende `baseLoss` cappes bagefter.

```js
const minsUntilWake = this.timeInMinutes < 7 * 60
    ? (7 * 60 - this.timeInMinutes)              // 00:00-07:00 → vågn samme dag
    : ((24 * 60 - this.timeInMinutes) + 7 * 60); // 22:00-24:00 → vågn næste dag
const sleepLoss = Math.min(baseLoss, minsUntilWake / 60);
```

`timeInMinutes` er tid-på-døgnet [0,1440) (wrapper ved midnat), så udtrykket
dækker begge nat-segmenter.

## Verifikation

- **Golden-master: 7/7 bit-identisk** (`tests/golden-master.js check`). Intet
  golden-scenarie har en nat-intervention tæt nok på 07:00 til at `min()` bider
  (fx en opvågning kl. 03:00 har 4 t tilbage → `min(1.0, 4) = 1.0`, uændret), så
  ingen re-baseline var nødvendig — default-fysiologien er uændret undtagen i det
  smalle nær-vågetids-vindue.
- **Fuld suite: 161/161.**
- **Editor (måling af kontinuitet), bolus 3 E, BG kl. 12 + tabt søvn:**
  06:00 → 1.00 t / 9.03 · 06:30 → 0.50 t / 8.23 · 06:50 → 0.17 t / 7.68 ·
  06:59 → 0.02 t / 7.43 · 07:05 → 0 t / 7.35. Springet 06:59→07:05 er nu ~0.08
  mmol/L (ren insulin-timing) mod tidligere ~1.2 — diskontinuiteten er væk.

## Åbne punkter / ude af scope

- **22:00-grænsen** beholdes som et trin (by design, se ovenfor).
- **Editor-markering af søvntab** (vågne-stribe + "💤 -X t"-label) blev tilføjet
  separat (v0.9.55) så søvn-omkostningen er synlig i editoren; den hører ikke til
  denne motor-ændring men gør effekten aflæselig.
