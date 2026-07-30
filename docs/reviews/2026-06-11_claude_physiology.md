# Fysiologisk review — T1D Simulator (kerne-engine)

**Dato:** 2026-06-11
**Reviewer:** Claude (Fable 5), review-skill
**Scope:** Fuld gennemgang af `js/hovorka.js` (16 ODE'er) + alle fysiologi-subsystemer
i `js/simulator.js` (stress, HAAF, brain-deficit, acidose, glukotoksicitet, lever-/muskel-
glykogen, fedt/protein/FFA, ketoner, glucagon, CGM). Fokus: bugs, intern sammenhæng og
konsistens mellem evidens og implementering.
**Metode:** Kode-læsning + dimensionsanalyse + numerisk probe mod den faktiske kode +
test-suite (155/155 passerede).

---

## Samlet vurdering

Kodebasen er **moden og velkalibreret**. Enhederne balancerer i hele Hovorka-kernen,
integration er substep-bundet (dt ≤ 1 min) for alle BG-koblede led, edge cases er
gennemgående guardet (non-negativ clamp, division-by-zero-guards, NaN-sikre Hill-
funktioner), og samtlige automatiske tests passerer. **Ingen KRITISKE fund.** De fund
der er, er enten dokumenterede forenklinger eller lav-impact latente problemer.

Reviewet dækker IKKE udtømmende: Box Challenge boks-generering, CGM sensor-loss
state-machine, og dashboard-kraft-dekomponering (`_computeBGForces`) — de er ikke
fysiologisk kerne.

---

## ADVARSEL — F_01c tillader superbasal hjerneforbrug ved hyperglykæmi

**Fil:** `js/hovorka.js`, linje 385-386
**Subsystem:** Insulin-uafhængigt glukoseforbrug (F_01c)
**Problem:** Den glatte Michaelis-Menten-form `F_01c = (F_01/0.85) × G/(G+1)` har en
asymptote over baseline. Forbruget stiger MED blodsukkeret i stedet for at plateaue.
**Evidens (numerisk probe mod koden, 70 kg):**

| BG (mmol/L) | F_01c / F_01 |
|------------|--------------|
| 2.0  | 0.784 |
| 5.0  | 0.980 (baseline) |
| 10.0 | 1.070 |
| 15.0 | 1.103 |
| 20.0 | 1.120 |
| 30.0 | 1.139 |

Insulin-uafhængigt forbrug (GLUT1-medieret) er mættet allerede ved ~5 mmol/L — det bør
være tilnærmelsesvis konstant ved hyperglykæmi, ikke +12-14%. BG-SCIENCE §4 holder CMRglc
konstant. Koden selv flagger dette (kommentar linje 382-384: "en clamp ved F_01 kan
overvejes").
**Impact:** Mild. Ved BG=20 fjerner det ekstra ~0.08 mmol/min (~0.5 mmol/L/t). Det
modvirker tilfældigt den under-modellerede renale clearance (se nedenfor), så netto-
effekten på spil-trajektorier er lille.
**Forslag:** Overvej `F_01c = min(F_01, F_01s × G/(G+1))` så forbruget aldrig overstiger
baseline. Lille ændring, fjerner en kendt afvigelse fra evidens.
**STATUS:** ❌ ÅBEN (dokumenteret forenkling)

---

## NOTE — `this.dawnAmplitude` er aldrig defineret (latent dead reference)

**Fil:** `js/simulator.js`, linje 1637 (i `circadianISF`-getteren)
**Subsystem:** Circadian ISF
**Problem:** `const amp = this.dawnAmplitude != null ? this.dawnAmplitude : 1.0;` refererer
`this.dawnAmplitude` — men kun `this._dawnAmplitude` (med underscore) er defineret nogensinde
(constructor linje 1050, regenerateDawn linje 1492). `this.dawnAmplitude` er derfor ALTID
`undefined`, så `amp` falder altid tilbage til 1.0.
**Evidens:** `grep dawnAmplitude js/` viser kun `_dawnAmplitude`-tildelinger + de to læse-
referencer i getteren. Ingen `this.dawnAmplitude =` nogen steder.
**Impact:** Lav i dag — 1.0 er den tilsigtede default. Men: (1) kommentaren lover at amp
"kan justeres via campaign-levels eller profil" — det er umuligt med den nuværende navn-
mismatch; (2) en fremtidig udvikler der sætter `_dawnAmplitude` for at dæmpe ISF-swinget
vil opdage at det ingen effekt har (det styrer kun HGP-kurven). Navne-kollisionen er en
fælde.
**Forslag:** Enten fjern den døde reference og hardcode `amp = 1.0`, eller indfør en reel
`this.dawnAmplitude`-property som campaign kan overstyre. Afklar samtidig at `_dawnAmplitude`
(HGP) og ISF-swing-styrken er to forskellige ting.
**STATUS:** ❌ ÅBEN

---

## NOTE — Renal clearance er svag ved svær hyperglykæmi

**Fil:** `js/hovorka.js`, linje 119-120, 391
**Subsystem:** Renal glukose-udskillelse (F_R)
**Problem:** `R_cl = 0.003` giver kun ~4 g/t udskillelse ved BG=20 (numerisk verificeret).
**Evidens:** F_R = R_cl × (G − R_thr) × V_G = 0.003 × 11 × 11.2 = 0.37 mmol/min ≈ 4 g/t.
Klinisk glukosuri over tærskel er ~10-30 g/t ved svær hyperglykæmi. "Sikkerhedsventilen"
mod ekstrem hyperglykæmi er altså svagere end fysiologisk.
**Impact:** Lav-moderat. Ved meget høj BG bidrager nyrerne mindre til at trække BG ned end
i virkeligheden, hvilket gør DKA-/hyperglykæmi-scenarier marginalt mere "klæbrige". By
design (blød ventil), men værd at notere.
**Forslag:** Ingen handling nødvendig medmindre hyperglykæmi-recovery føles for langsom;
da kan R_cl hæves mod ~0.006-0.01.
**STATUS:** ⚠️ ACCEPTABEL (bevidst forenkling)

---

## NOTE — Død kode i hovorka.js + molær-masse-inkonsistens

**Fil:** `js/hovorka.js`, linje 269-278
**Subsystem:** IOB/COB getters
**Problem:** `get insulinOnBoard()` og `get carbsOnBoard()` er defineret men **kaldes aldrig**
(`grep` viser nul brugssteder uden for definitionen). Simulator tracker IOB/COB selv.
Derudover bruger `carbsOnBoard` den molære masse `180` mens hele resten af projektet bruger
`GLUCOSE_MM_G_PER_MOL = 180.16`.
**Impact:** Kosmetisk (0.09% afvigelse i død kode). Men død kode i kernen kan vildlede.
**Forslag:** Slet de to ubrugte getters, eller ret 180 → den fælles konstant hvis de skal
beholdes til dashboard-brug.
**STATUS:** ❌ ÅBEN

---

## NOTE — brainEnergyDeficit bruger hele F_01 som "hjerneforbrug"

**Fil:** `js/simulator.js`, linje 3069
**Subsystem:** Neuroglykopeni / brain-deficit
**Problem:** `const F01 = this.hovorka.F_01;` bruges som "hjernens basale forbrugrate". Men
F_01 dækker ifølge hovorka.js-kommentaren (linje 361) ALT insulin-uafhængigt forbrug
(hjerne + RBC + nyremedulla + andre) ≈ 0.679 mmol/min ≈ 176 g/døgn. Hjernen alene er ~120
g/døgn.
**Impact:** Lav. Game-over-tiderne i constructor-kommentaren (linje 585-588) er kalibreret
mod netop F_01=0.679 og er internt konsistente — så det er en kalibreringsbeslutning, ikke
en regnefejl. Men konceptuelt er deficit-akkumuleringen ~45% hurtigere end hvis kun "ægte"
hjerneforbrug drev den.
**Forslag:** Ingen kode-ændring nødvendig (kalibreringen hænger sammen). Evt. omdøb
kommentaren så den ikke kalder F_01 for rent hjerneforbrug.
**STATUS:** ⚠️ BY DESIGN

---

## NOTE — Lever-glykogen-storage er ikke blod-koblet trods "massebalance"-claims

**Fil:** `js/simulator.js`, `updateGlycogenReserve`, linje 3395-3403
**Subsystem:** Lever-glykogenpool
**Problem:** `postprandialStorage` og `gngReplenishment` FYLDER lever-poolen, men trækker
ikke tilsvarende glukose ud af blodet (Q1). Kun muskel-glykogen-resynthesis er blod-koblet
(linje 4538). Lever-poolen er reelt en heuristisk "gate" der modulerer stress-EGP via
`glycogenReserve` — ikke en mass-konserveret blod-koblet størrelse.
**Evidens:** `updateGlycogenReserve` opdaterer kun `this.liverGlycogenGrams`; ingen
`hovorka.state[4]`-mutation for storage/replenishment. Hovorka 2004 har ingen hepatisk
glukose-OPTAGS-term, så postprandial leverlagring kan ikke trækkes fra blodet uden at
bryde kernemodellen.
**Impact:** Ingen på BG-trajektorier (poolen er kun en gate). Men de gentagne kommentarer
("massebalance", "glukose opstår ALDRIG fra ingenting", linje 1097, 3252) **overstater**
hvor strengt konserveret poolen er — storage tilføjer glukose "gratis".
**Forslag:** Juster kommentar-sproget så det matcher virkeligheden: glykogenolyse-DRAIN er
matchet mod EGP-glycogenolyse-komponenten, men STORAGE er en uafhængig gate-genopfyldning.
Ingen funktionel ændring anbefales.
**STATUS:** ⚠️ BY DESIGN (dokumentation bør nuanceres)

---

## OK — bekræftede korrekte implementeringer (kort)

- **Dimensionel konsistens:** Alle 16 Hovorka-ODE'er balancerer (dQ1, dI, dx1-3, dC, dE1/E2
  verificeret eksplicit). g→mmol (180.16) og E→mU (×1000) konverteringer korrekte.
- **Numerisk stabilitet:** Substep-løkken capper dt ved 1.0 min uanset spilhastighed/framerate
  (fund #1 fra 2026-06-08-reviewet er korrekt implementeret). Eksponentielle washout-led er
  dt-eksakte. Per-bolus tauI ∈ [27, 88] min → stepDt/tauI << 1.
- **Stress/EGP-omskrivning:** `EGP = EGP_0 × max(0, stressMultiplier − x3)` lader
  kontraregulering (glukagon/adrenalin) override insulin-suppression korrekt; baseline
  stressMultiplier=1.0 (0.5 glycogenolyse + 0.5 GNG) giver normal EGP.
- **ISF-kobling:** `setISFModifier(currentISF/ISF)` annullerer base-ISF korrekt så kun de
  dynamiske modifikatorer (circadian, FFA, glucotox, motion) skalerer k_b — ingen
  dobbelt-anvendelse af base-ISF.
- **Per-bolus insulin-depots:** To overlappende boluser med forskellig tauFactor interfererer
  ikke (separate s1/s2-par). Basal/rapid-separation via skygge-kaskaden er eksakt pga.
  Hovorkas linearitet.
- **Acidose-gate:** Glat smoothstep erstatter den gamle hårde tærskel; faste-ketose (insulin
  til stede, BHB høj) akkumulerer korrekt IKKE acidose, mens DKA (I→0) gør.
- **Glucagon mass-conservation:** Trækker fra liverGlycogenGrams, tilføjer Q1; tom pool →
  klinisk svigt (matcher alkohol-/faste-hypo). Verificeret af test GLUCAGON 1-9.

---

## STATUS-OPSUMMERING

| # | Fund | Prioritet | Status |
|---|------|-----------|--------|
| 1 | F_01c superbasal ved hyperglykæmi | ADVARSEL | ❌ ÅBEN (dokumenteret) |
| 2 | `this.dawnAmplitude` udefineret (dead ref) | NOTE | ❌ ÅBEN |
| 3 | Renal clearance svag ved høj BG | NOTE | ⚠️ ACCEPTABEL |
| 4 | Død kode + 180 vs 180.16 i hovorka.js | NOTE | ❌ ÅBEN |
| 5 | brainEnergyDeficit bruger hele F_01 | NOTE | ⚠️ BY DESIGN |
| 6 | Lever-glykogen-storage ikke blod-koblet | NOTE | ⚠️ BY DESIGN |

**Ingen KRITISKE fund.** 2 åbne NOTE-fund (#2, #4) er trivielle at rette hvis ønsket.
Test-suite: 155/155 passerede.
