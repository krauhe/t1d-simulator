# Fysiologisk Model — Diabetes-Dysten

*Denne side beskriver de fysiologiske modeller og videnskabelige kilder bag simulationen i Diabetes-Dysten.*

---

## Overblik

Diabetes-Dysten simulerer glukose-insulin-dynamikken hos en person med type 1 diabetes (T1D). Simulationen modellerer de vigtigste fysiologiske processer der påvirker blodsukkeret:

1. **Glukose-kinetik** — hvordan glukose fordeles og forbruges i kroppen
2. **Insulin-farmakokinetik** — hvordan injiceret insulin optages og virker
3. **Kulhydrat-absorption** — hvordan mad fordøjes og glukose optages i blodet
4. **Motionseffekter** — hvordan fysisk aktivitet påvirker blodsukkeret
5. **Stresshormoner** — hvordan kortisol, adrenalin og glukagon påvirker leveren
6. **Ketonstofskifte** — hvordan insulinmangel fører til ketoacidose
7. **CGM-simulation** — realistisk sensor-forsinkelse og støj

---

## Kerne-model: Hovorka 2004 (Cambridge-modellen)

Simulationens kerne er baseret på **Hovorka et al. (2004)** — en valideret fysiologisk model udviklet ved University of Cambridge til forskning i kunstig bugspytkirtel (closed-loop insulin delivery).

### Hvorfor denne model?

Hovorka-modellen er:
- **Klinisk valideret** mod rigtige T1D-patienter
- **Veletableret** i den akademiske verden (1000+ citationer)
- **Velbalanceret** — tilstrækkelig kompleks til realistisk adfærd, enkel nok til real-time simulation
- **Veldokumenteret** med publicerede parametre og ligninger

### Modellens struktur

Modellen består af 11 differentialligninger (ODE'er) fordelt på fire subsystemer:

#### 1. Glukose-subsystem (Q1, Q2)
```
dQ1/dt = -(F01c + FR) - x1*Q1 + k12*Q2 + UG + EGP0*(1 - x3)
dQ2/dt = x1*Q1 - (k12 + x2)*Q2
```
- **Q1**: Glukose i plasma (det blod du kan måle)
- **Q2**: Glukose i perifere væv (muskler, fedtvæv)
- **F01c**: Glukoseforbrug i centralnervesystemet (hjernen bruger ~120g glukose/dag)
- **FR**: Renal clearance — nyrerne udskiller glukose når BG > ~9 mmol/L
- **EGP0*(1-x3)**: Endogen glukoseproduktion fra leveren, undertrykket af insulin
- **UG**: Glukose-absorption fra tarmen (fra mad)

#### 2. Insulin-subsystem (S1, S2, I)
```
dS1/dt = u(t) - S1/tmax_I
dS2/dt = S1/tmax_I - S2/tmax_I
dI/dt  = S2/(VI*tmax_I) - ke*I
```
- **S1, S2**: To subkutane kompartmenter (insulin under huden bevæger sig gradvist til blodet)
- **I**: Plasma insulin-koncentration
- **u(t)**: Insulin-injektionsrate (bolus eller basal)
- **tmax_I**: Tid til maksimal insulin-absorption (~55 min for hurtigvirkende)

#### 3. Insulin-aktions-subsystem (x1, x2, x3)
```
dx1/dt = -ka1*x1 + kb1*I    (insulin -> glukose-transport)
dx2/dt = -ka2*x2 + kb2*I    (insulin -> glukose-disposal i muskler)
dx3/dt = -ka3*x3 + kb3*I    (insulin -> suppression af leverproduktion)
```
Insulin virker ikke instantant — der er en forsinkelse fra insulin i blodet (I) til den faktiske effekt på glukose (x1, x2, x3). Disse tre "effekt-variable" modellerer:
- **x1**: Insulins effekt på transport af glukose fra blod til muskler
- **x2**: Insulins effekt på glukose-forbrænding i musklerne
- **x3**: Insulins effekt på at undertrykke leverens glukoseproduktion

#### 4. Tarm-absorption (D1, D2)
```
dD1/dt = AG*D(t) - D1/tmax_G
dD2/dt = D1/tmax_G - D2/tmax_G
UG = D2/tmax_G
```
- **D1, D2**: To kompartmenter der modellerer mave-tarm passage
- **tmax_G**: Tid til maksimal glukose-absorption (~40 min)
- **AG**: Bioavailability af kulhydrater (80% — ikke alt optages)

### Nøgleparametre (skaleret med kropsvægt)

| Parameter | Forklaring | Typisk værdi (70 kg) |
|-----------|-----------|---------------------|
| VG | Glukose-distributionsvolumen | 0.16 * BW = 11.2 L |
| VI | Insulin-distributionsvolumen | 0.12 * BW = 8.4 L |
| F01 | Hjernens glukoseforbrug | 0.0097 * BW = 0.68 mmol/min |
| EGP0 | Leverens basale glukoseproduktion | 0.0161 * BW = 1.13 mmol/min |
| SIT | Insulinfølsomhed (transport) | 51.2 * 10^-4 L/min/mU |
| SID | Insulinfølsomhed (disposal) | 8.2 * 10^-4 L/min/mU |
| SIE | Insulinfølsomhed (EGP) | 520 * 10^-4 1/mU |

---

## Udvidelser til basismodellen

### Motion (udvidet Hovorka-model)

Motionseffekterne er baseret på udvidelsen beskrevet i **Resalat et al. (2020)**, som tilføjer to tilstandsvariable drevet af hjertefrekvens:

- **E1 (kortvarig effekt)**: Insulin-uafhængig glukoseoptag i musklerne under træning (GLUT4-translokation)
- **E2 (langvarig effekt)**: Forstærket insulinfølsomhed der varer timer efter træning

```
dQ1/dt: ... -(1 + alpha*E2^2)*x1*Q1 ...   (forstærket insulintransport)
dQ2/dt: ... - beta*E1/HRbase ...            (direkte muskeloptag)
```

Modellen skelner mellem:
- **Aerob træning** (løb, cykling): Domineret af GLUT4-medieret glukoseoptag -> BG falder
- **Anaerob træning** (styrke, sprint): Katekolamin-drevet leverglukose-frigivelse -> BG kan stige akut

### Stresshormoner

Stresshormon-systemet er vores egen udvidelse, inspireret af den fysiologiske litteratur:

- **Akut stress** (adrenalin/glukagon): Halveringstid ~60 min. Triggers: hypoglykæmi, intensiv motion
- **Kronisk stress** (kortisol): Halveringstid ~12 timer. Triggers: sygdom, søvnmangel
- **Cirkadisk kortisol** (dawn-effekt): Sinusformet peak kl. 04:00-08:00

Alle stressparametre skalerer leverens glukoseproduktion (EGP):
```
EGP_effektiv = EGP0 * stressMultiplikator * (1 - x3)
stressMultiplikator = 1.0 + akutStress + kroniskStress + cirkadiskKortisol
```

### Kulhydrat-differentiering (fedt og protein)

Basismodellen har kun kulhydrater. Vi udvider tarm-absorptionen med:
- **Fedt**: Forsinker mavepassagen (oger tmax_G), hvilket giver et langsommere og lavere BG-peak
- **Protein**: Bidrager til BG via glukoneogenese (~25% af kulhydrateffekten, forsinket ~180 min)

Dette er inspireret af **UVA/Padova-simulatorens** nyeste udvidelser (Dalla Man et al., 2025) til mixed meals.

### Keton-model

En simpel keton-model baseret på kliniske grænseværdier:
- Ketoner stiger ved insulinmangel + BG > 12 mmol/L (kroppen brænder fedt i stedet for glukose)
- Ketoner falder når insulin gives (halveringstid ~2 timer)
- Kliniske grænseværdier: Normal < 0.6 | Forhøjet 0.6-1.5 | Farligt 1.5-3.0 | DKA > 3.0 mmol/L

### CGM-simulation

CGM (Continuous Glucose Monitor) simuleres med:
- **Sensorforsinkelse**: 5-10 minutters forsinkelse (interstitiel væske vs. blod)
- **Tilfældig støj**: +/- 0.5 mmol/L per måling
- **Systemisk drift**: Langsom sinusbølge (periode 4-8 timer, amplitude 0.3-0.7 mmol/L)

---

## Videnskabelige referencer

### Primære kilder

1. **Hovorka R, Canonico V, Chassin LJ, et al.** (2004). "Nonlinear model predictive control of glucose concentration in subjects with type 1 diabetes." *Physiological Measurement*, 25(4):905-920.
   - Kernemodellen for glukose-insulin dynamik
   - [PDF (Yale)](http://www.stat.yale.edu/~jtc5/diabetes/NonlinearModelPredictiveControl_Hovorka_04.pdf)

2. **Resalat N, El Youssef J, Reddy R, Jacobs PG.** (2020). "Simulation Software for Assessment of Nonlinear and Adaptive Multivariable Control Algorithms: Glucose-Insulin Dynamics in Type 1 Diabetes." *IFAC-PapersOnLine*, 53(2):16025-16030.
   - Udvidet Hovorka-model med motionseffekter (E1, E2 state variables)
   - [PMC7449052](https://pmc.ncbi.nlm.nih.gov/articles/PMC7449052/)

3. **Dalla Man C, Rizza RA, Cobelli C.** (2007). "Meal Simulation Model of the Glucose-Insulin System." *IEEE Transactions on Biomedical Engineering*, 54(10):1740-1749.
   - UVA/Padova-modellen — FDA-godkendt som erstatning for dyreforsog i insulin-pumpe trials

4. **Dalla Man C et al.** (2025). "Simulation of High-Fat High-Protein Meals Using the UVA/Padova T1D Simulator." *IFAC-PapersOnLine*.
   - Mixed meals med fedt- og protein-effekter pa glukose-absorption

### Sekundære kilder

5. **Kudva YC, et al.** (2021). "Exercise effect on insulin-dependent and insulin-independent glucose utilization in healthy individuals and individuals with type 1 diabetes: a modeling study." *American Journal of Physiology — Endocrinology and Metabolism*, 321(2):E230-E237.
   - Insulin-afhængig vs. insulin-uafhængig glukoseoptag under motion
   - [PMC8321821](https://pmc.ncbi.nlm.nih.gov/articles/PMC8321821/)

6. **Agianniotis A, et al.** (2021). "Modelling glucose dynamics during moderate exercise in individuals with type 1 diabetes." *PLOS ONE*, 16(3):e0248280.
   - Detaljeret model af glukosedynamik under moderat motion

7. **Ajmera I, et al.** (2021). "A comparison among three maximal mathematical models of the glucose-insulin system." *PLOS ONE*, 16(9):e0257789.
   - Sammenligning af Hovorka, UVA/Padova og Sorensen-modellerne

### Supplerende litteratur

8. **Bergman RN, Ider YZ, Bowden CR, Cobelli C.** (1979). "Quantitative estimation of insulin sensitivity." *American Journal of Physiology*, 236(6):E667-E677.
   - Den originale "Bergman Minimal Model"

9. **Sorensen JT.** (1985). "A Physiologic Model of Glucose Metabolism in Man and Its Use to Design and Assess Improved Insulin Therapies for Diabetes." PhD Thesis, MIT.
   - Den mest detaljerede multi-organ model

---

## Open source-software der er brugt

### Direkte implementationer

- **[svelte-flask-hovorka-simulator](https://github.com/jonasnm/svelte-flask-hovorka-simulator)** af Jonas Nordhassel Myhre
  - Python-implementation af Hovorka-modellens differentialligninger
  - Vores JavaScript-port er baseret pa denne implementation
  - Licens: MIT (antagelse — ingen eksplicit licens i repo)

### Afhængigheder

- **[Tone.js](https://tonejs.github.io/)** v14.8.49 — Web Audio framework til lydeffekter
  - Licens: MIT

---

## Begrænsninger og forbehold

Diabetes-Dysten er et **uddannelsesværktoj og spil** — IKKE et medicinsk device. Vigtige begrænsninger:

1. **Forenklinger**: Modellen er en forenkling af virkeligheden. Rigtige patienter har individuel variation der ikke fanges fuldt af modellen.

2. **Parametre**: Standardparametre repraesenterer en "gennemsnitlig" T1D-patient. Individuelle parametre (ISF, ICR) kan variere markant.

3. **Ikke-modellerede faktorer**: Alkohol, sygdom (udover generel stress), menstruation, søvnkvalitet, temperatur, og mange andre faktorer påvirker BG i virkeligheden.

4. **Keton-model**: Forenklet i forhold til den fulde fysiologi. Rigtig ketoacidose involverer pH-ændringer, dehydrering og elektrolytforstyrrelser.

5. **Motion**: Modellerer aerob/anaerob som separate mekanismer, men virkeligheden er et spektrum. Individuel variation i motionsrespons er stor.

**Brug ALDRIG denne simulator som grundlag for medicinske beslutninger. Følg altid din læges anbefalinger.**

---

*Sidst opdateret: Marts 2026*
