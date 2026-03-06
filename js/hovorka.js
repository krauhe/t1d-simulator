// =============================================================================
// HOVORKA.JS — Hovorka 2004 glukose-insulin model (Cambridge-modellen)
// =============================================================================
//
// Denne fil implementerer den videnskabeligt validerede Hovorka-model til
// simulation af glukose-insulin dynamik hos type 1 diabetes patienter.
//
// Modellen er baseret på:
//   Hovorka R, Canonico V, Chassin LJ, et al. (2004)
//   "Nonlinear model predictive control of glucose concentration in
//   subjects with type 1 diabetes." Physiological Measurement, 25(4):905-920.
//
// Udvidet med motionseffekter fra:
//   Resalat N, El Youssef J, Reddy R, Jacobs PG. (2020)
//   "Simulation Software for Assessment of Nonlinear and Adaptive
//   Multivariable Control Algorithms." PMC7449052.
//
// JavaScript-port er delvist baseret på Python-implementationen:
//   https://github.com/jonasnm/svelte-flask-hovorka-simulator
//   af Jonas Nordhassel Myhre (MIT licens antaget)
//
// Modellen består af 11 differentialligninger (ODE'er):
//   D1, D2  — Tarm-kompartmenter (kulhydrat-absorption)
//   S1, S2  — Subkutant insulin (depot under huden)
//   Q1, Q2  — Glukose i plasma og perifere væv
//   I       — Plasma insulin-koncentration
//   x1,x2,x3 — Insulins effekt på transport, disposal og leverproduktion
//   C       — CGM-sensorværdi (med forsinkelse)
//
// Eksporter (global): HovorkaModel klasse
// =============================================================================


class HovorkaModel {

    // =========================================================================
    // CONSTRUCTOR — Opret en ny Hovorka-model med patientspecifikke parametre
    // =========================================================================
    //
    // @param {number} bodyWeight - Patientens vægt i kg
    // @param {object} options    - Valgfrie parametre til at override defaults
    // =========================================================================
    constructor(bodyWeight = 70, options = {}) {
        this.BW = bodyWeight;

        // -----------------------------------------------------------------
        // PATIENTAFHÆNGIGE PARAMETRE (skalerer med kropsvægt)
        // -----------------------------------------------------------------
        // Disse parametre bestemmer modellens grundlæggende skala og er
        // proportionale med kroppens størrelse.
        // -----------------------------------------------------------------
        this.V_I = 0.12 * this.BW;     // Insulin-distributionsvolumen [L]
        this.V_G = 0.16 * this.BW;     // Glukose-distributionsvolumen [L]
        this.F_01 = 0.0097 * this.BW;  // Hjernens glukoseforbrug (insulin-uafhængigt) [mmol/min]
        this.EGP_0 = 0.0161 * this.BW; // Leverens basale glukoseproduktion [mmol/min]

        // -----------------------------------------------------------------
        // INSULIN-FØLSOMHEDS PARAMETRE
        // -----------------------------------------------------------------
        // SIT, SID, SIE bestemmer hvor kraftigt insulin påvirker de tre
        // glukose-processer. Disse kan varieres for at modellere individuel
        // insulinfølsomhed (ISF).
        //
        // options.insulinSensitivityScale: multiplikator for alle tre parametre.
        // Bruges til at mappe spillerens ISF til modellens parametre:
        //   ISF > default (3.0) → scale > 1.0 → mere insulinfølsom
        //   ISF < default (3.0) → scale < 1.0 → mindre insulinfølsom
        // -----------------------------------------------------------------
        const isScale = options.insulinSensitivityScale || 1.0;
        this.S_IT = 51.2e-4 * isScale;  // Følsomhed: transport (blod → muskler) [L/min/mU]
        this.S_ID = 8.2e-4 * isScale;   // Følsomhed: disposal (forbrænding i muskler) [L/min/mU]
        this.S_IE = 520e-4 * isScale;   // Følsomhed: EGP-suppression (lever) [1/mU]

        // -----------------------------------------------------------------
        // TIDSKONSTANTER
        // -----------------------------------------------------------------
        this.tau_G = options.tau_G || 40;   // Tid til maks kulhydrat-absorption [min]
        this.tau_I = options.tau_I || 55;   // Tid til maks insulin-absorption [min]

        // -----------------------------------------------------------------
        // ØVRIGE KONSTANTER
        // -----------------------------------------------------------------
        this.A_G = 0.8;               // Kulhydrat-bioavailability (80% optages) [dimensionsløs]
        this.k_12 = 0.066;            // Glukose-transfer periferi → plasma [1/min]

        // Insulin-aktionskonstanter:
        // ka = deaktiveringshastighed (hvor hurtigt insulineffekten forsvinder)
        // kb = aktiveringshastighed (hvor hurtigt insulin begynder at virke)
        // kb = S_Ix * ka (koblingen mellem insulin-koncentration og effekt)
        this.k_a1 = 0.006;            // Deaktivering: transport [1/min]
        this.k_b1 = this.S_IT * this.k_a1;  // Aktivering: transport
        this.k_a2 = 0.06;             // Deaktivering: disposal [1/min]
        this.k_b2 = this.S_ID * this.k_a2;  // Aktivering: disposal
        this.k_a3 = 0.03;             // Deaktivering: EGP [1/min]
        this.k_b3 = this.S_IE * this.k_a3;  // Aktivering: EGP

        this.k_e = 0.138;             // Insulin-eliminationsrate fra plasma [1/min]

        // CGM-sensor forsinkelseskonstant
        this.ka_int = 0.073;           // CGM interstitiel forsinkelse [1/min]

        // Renal clearance (nyrer udskiller glukose over tærskelværdi)
        this.R_cl = 0.003;             // Clearance-rate [1/min]
        this.R_thr = 9;                // Tærskel for renal udskillelse [mmol/L]
                                        // (Sat til 9 mmol/L — fysiologisk korrekt.
                                        //  Python-koden brugte 14, men det er for højt.)

        // -----------------------------------------------------------------
        // MOTIONSPARAMETRE (fra udvidet Hovorka-model, Resalat et al. 2020)
        // -----------------------------------------------------------------
        // alpha: Hvor meget motion forstærker insulins effekt (x1 og x2)
        // beta: Insulin-uafhængig glukoseoptag i muskler under motion
        // -----------------------------------------------------------------
        this.alpha = options.alpha || 1.79;   // Motions-forstærkning af insulinvirkning [dimensionsløs]
        this.beta = options.beta || 0.78;     // Direkte muskel-glukoseoptag [mmol/min]
        this.HR_base = options.HR_base || 60; // Hvilepuls [bpm]

        // -----------------------------------------------------------------
        // TILSTANDSVARIABLE (state vector, 13 elementer)
        // -----------------------------------------------------------------
        // Disse er modellens "hukommelse" — alt den skal vide for at køre videre.
        // Indeks: 0=D1, 1=D2, 2=S1, 3=S2, 4=Q1, 5=Q2, 6=I, 7=x1, 8=x2, 9=x3,
        //         10=C (CGM), 11=E1 (motion kort), 12=E2 (motion lang)
        // -----------------------------------------------------------------
        this.state = new Float64Array(13);

        // -----------------------------------------------------------------
        // INPUTS (ændres udefra af Simulator-klassen)
        // -----------------------------------------------------------------
        this.insulinRate = 0;           // Aktuel insulin-infusionsrate [mU/min]
        this.carbRate = 0;              // Aktuel kulhydrat-indtagelsesrate [mmol/min]
        this.heartRate = this.HR_base;  // Aktuel puls [bpm] — sættes af motionsmodel

        // -----------------------------------------------------------------
        // Stress-multiplikator for EGP (sættes af Simulator)
        // -----------------------------------------------------------------
        this.stressMultiplier = 1.0;
    }


    // =========================================================================
    // initializeSteadyState — Find basal rate der giver target-BG
    // =========================================================================
    //
    // Finder den stationære tilstand (steady state) for en given basal insulin-rate,
    // ELLER (hvis targetBG er angivet) søger automatisk efter den rate der giver
    // det ønskede blodsukker-niveau.
    //
    // Hovorka-modellens insulin-parametre matcher ikke nødvendigvis patientens
    // kliniske ISF/100-regel direkte. Derfor bruger vi en simpel binær søgning
    // til at finde den rate der giver det ønskede steady-state BG.
    //
    // @param {number} basalRate - Startgæt for basal insulin-rate [mU/min]
    // @param {number} targetBG  - Ønsket steady-state BG [mmol/L] (default: 5.5)
    // @returns {number} Steady-state BG i mmol/L
    // =========================================================================
    initializeSteadyState(basalRate, targetBG = 5.5) {
        // Binær søgning: find den insulin-rate der giver targetBG
        let lo = 0.5;    // Minimum rate [mU/min]
        let hi = 20.0;   // Maximum rate [mU/min]
        let bestRate = basalRate;
        let bestBG = 0;

        // 20 iterationer af binær søgning giver præcision < 0.00002 mU/min
        for (let iter = 0; iter < 20; iter++) {
            const mid = (lo + hi) / 2;

            // Nulstil og kør til steady-state med denne rate
            this.state.fill(0);
            this.insulinRate = mid;
            this.carbRate = 0;
            this.heartRate = this.HR_base;
            this.stressMultiplier = 1.0;

            const dt = 1.0;
            for (let i = 0; i < 2000; i++) {
                this.step(dt);
            }

            const bg = this.glucoseConcentration;

            // Mere insulin → lavere BG, så:
            // Hvis BG > target → brug mere insulin (hæv lo)
            // Hvis BG < target → brug mindre insulin (sænk hi)
            if (bg > targetBG) {
                lo = mid;
            } else {
                hi = mid;
            }

            bestRate = mid;
            bestBG = bg;
        }

        // Gem den fundne rate til reference (kan bruges af simulator til at
        // forstå den effektive basal-rate Hovorka-modellen kører med)
        this.steadyStateBasalRate = bestRate;

        return this.glucoseConcentration;
    }


    // =========================================================================
    // COMPUTED PROPERTIES — Aflæs vigtige værdier fra tilstandsvektoren
    // =========================================================================

    /** Glukose-koncentration i plasma [mmol/L] — det "sande" blodsukker */
    get glucoseConcentration() {
        return this.state[4] / this.V_G;  // Q1 / VG
    }

    /** CGM-sensor værdi [mmol/L] — med forsinkelse og drift */
    get cgmValue() {
        return Math.max(0, this.state[10]);  // C (clamp til >= 0)
    }

    /** Plasma insulin-koncentration [mU/L] */
    get plasmaInsulin() {
        return this.state[6];  // I
    }

    /** Insulin On Board — total aktiv insulin i subkutane depoter [mU] */
    get insulinOnBoard() {
        return this.state[2] + this.state[3];  // S1 + S2
    }

    /** Carbs On Board — uabsorberet kulhydrat i tarmen [mmol] → konverter til gram */
    get carbsOnBoard() {
        return (this.state[0] + this.state[1]) * 180 / 1000;  // D1+D2 i mmol → gram
    }


    // =========================================================================
    // step — Et enkelt simulationstrin (Euler-integration)
    // =========================================================================
    //
    // Beregner de 13 tidsafledede (dX/dt) og opdaterer tilstandsvektoren.
    //
    // Vi bruger simpel Euler-integration: X(t+dt) = X(t) + dX/dt * dt
    // Dette er tilstrækkeligt præcist for vores tidsstep (~0.1-1.0 min).
    // For mere præcis integration kan man opgradere til RK4 (Runge-Kutta 4),
    // men Euler er hurtigere og tilstrækkeligt for et spil.
    //
    // @param {number} dt - Tidsstep i minutter (simuleret tid)
    // =========================================================================
    step(dt) {
        // Udtræk tilstandsvariable for læsbarhed
        const D1 = this.state[0];   // Tarm kompartment 1 [mmol]
        const D2 = this.state[1];   // Tarm kompartment 2 [mmol]
        const S1 = this.state[2];   // Subkutant insulin depot 1 [mU]
        const S2 = this.state[3];   // Subkutant insulin depot 2 [mU]
        const Q1 = this.state[4];   // Plasma-glukose [mmol]
        const Q2 = this.state[5];   // Perifær glukose [mmol]
        const I  = this.state[6];   // Plasma insulin [mU/L]
        const x1 = this.state[7];   // Insulineffekt: transport
        const x2 = this.state[8];   // Insulineffekt: disposal
        const x3 = this.state[9];   // Insulineffekt: EGP-suppression
        const C  = this.state[10];  // CGM-sensorværdi [mmol/L]
        const E1 = this.state[11];  // Motion: kortvarig effekt
        const E2 = this.state[12];  // Motion: langvarig effekt

        // -----------------------------------------------------------------
        // AFLEDTE STØRRELSER
        // -----------------------------------------------------------------

        // Glukose-koncentration i plasma [mmol/L]
        const G = Q1 / this.V_G;

        // Glukose-absorption fra tarmen [mmol/min]
        const U_G = D2 / this.tau_G;

        // Insulin-absorption fra subkutant depot [mU/min]
        const U_I = S2 / this.tau_I;

        // Hjernens glukoseforbrug — afhænger af tilgængeligt blodsukker.
        // Ved normalt BG: konstant forbrug (F_01).
        // Ved lavt BG: reduceret forbrug (hjernen får ikke nok glukose).
        // Formlen F_01s * G / (G + 1) giver en blød overgang:
        //   G = 5 mmol/L → F_01c ≈ 0.95 * F_01 (næsten fuld)
        //   G = 2 mmol/L → F_01c ≈ 0.67 * F_01 (reduceret)
        //   G = 0.5 mmol/L → F_01c ≈ 0.33 * F_01 (kraftigt reduceret)
        const F_01s = this.F_01 / 0.85;
        const F_01c = F_01s * G / (G + 1);

        // Renal clearance — nyrerne udskiller glukose når BG overstiger tærsklen.
        // Over ~9 mmol/L begynder nyrerne at "lække" glukose ud i urinen.
        // Dette er en vigtig beskyttelsesmekanisme mod ekstrem hyperglykæmi.
        const F_R = (G >= this.R_thr) ? this.R_cl * (G - this.R_thr) * this.V_G : 0;

        // Endogen glukoseproduktion (EGP) — leverens glukose-output.
        // EGP er en balance mellem insulin-suppression (x3) og stimulering
        // fra kontraregulatoriske hormoner (stressMultiplier: glukagon, adrenalin).
        //
        // Formel: EGP = EGP_0 * max(0, stressMultiplier - x3)
        //
        // Normal tilstand (stress=1.0, x3=0.3):
        //   EGP = EGP_0 * 0.7 — lever producerer moderat (normalt)
        //
        // Bolus aktiv (stress=1.0, x3=1.3):
        //   EGP = EGP_0 * 0 — insulin undertrykker leverproduktion (korrekt)
        //
        // Hypoglykæmi + kontraregulering (stress=1.5, x3=1.3):
        //   EGP = EGP_0 * 0.2 — glukagon "vinder" delvist over insulin!
        //   Leveren frigiver glykogen trods aktiv insulin. Fysiologisk korrekt:
        //   under hypo dominerer glukagon-signalet ved leverens glukagon-receptorer.
        //
        // Svær hypo + massiv kontraregulering (stress=2.0, x3=1.3):
        //   EGP = EGP_0 * 0.7 — kraftig leverproduktion (emergency respons)
        //
        // Tidligere formel var: EGP_0 * stressMultiplier * (1 - x3)
        // Problem: når x3 > 1.0 blev EGP clamped til 0, og stressMultiplier
        // kunne ALDRIG override — glukagon var virkningsløs under hypo!
        const EGP = Math.max(0, this.EGP_0 * (this.stressMultiplier - x3));

        // Motionsfaktor — forstærker insulins effekt under og efter træning.
        // (1 + alpha * E2^2) er en multiplikator der øger insulin-transport (x1)
        // når E2 > 0 (under og efter motion).
        const exerciseFactor = 1 + this.alpha * E2 * E2;

        // Puls-dreven motionseffekt — direkte muskel-glukoseoptag
        // Kun aktiv når hjertefrekvensen er over hvile.
        const HR_effect = Math.max(0, (this.heartRate - this.HR_base) / this.HR_base);

        // -----------------------------------------------------------------
        // DIFFERENTIALLIGNINGER (dX/dt for alle 13 tilstandsvariable)
        // -----------------------------------------------------------------

        // Tarm-kompartment 1: mad ind, passage til kompartment 2
        const dD1 = this.A_G * this.carbRate - D1 / this.tau_G;

        // Tarm-kompartment 2: fra kompartment 1, absorption til blod
        const dD2 = D1 / this.tau_G - U_G;

        // Subkutant insulin depot 1: injektion ind, passage til depot 2
        const dS1 = this.insulinRate - S1 / this.tau_I;

        // Subkutant insulin depot 2: fra depot 1, absorption til plasma
        const dS2 = S1 / this.tau_I - U_I;

        // Plasma-glukose (Q1): DEN centrale ligning
        //   + U_G: glukose fra tarmen (mad)
        //   + EGP: glukose fra leveren
        //   + k_12 * Q2: glukose der vender tilbage fra perifere væv
        //   - F_01c: hjernens forbrug
        //   - F_R: nyrernes udskillelse
        //   - exerciseFactor * x1 * Q1: insulin-drevet transport til muskler
        const dQ1 = -(F_01c + F_R) - exerciseFactor * x1 * Q1
                    + this.k_12 * Q2 + U_G + EGP;

        // Perifær glukose (Q2): muskler og fedtvæv
        //   + exerciseFactor * x1 * Q1: ind fra plasma (insulin-drevet)
        //   - k_12 * Q2: tilbage til plasma
        //   - x2 * Q2: forbrænding i musklerne (insulin-drevet disposal)
        //   - beta * E1 / HRbase: direkte muskeloptag under motion (insulin-uafhængigt)
        const dQ2 = exerciseFactor * x1 * Q1 - (this.k_12 + x2) * Q2
                    - this.beta * E1 * HR_effect;

        // Plasma insulin: tilførsel fra depot, elimination fra kroppen
        const dI = U_I / this.V_I - this.k_e * I;

        // Insulin-aktionsvariable: forsinkelse mellem insulin i blod og effekt
        // kb * I: insulin aktiverer effekten
        // ka * x: effekten deaktiveres naturligt over tid
        const dx1 = this.k_b1 * I - this.k_a1 * x1;
        const dx2 = this.k_b2 * I - this.k_a2 * x2;
        const dx3 = this.k_b3 * I - this.k_a3 * x3;

        // CGM-sensor: følger plasma-glukose med forsinkelse
        const dC = this.ka_int * (G - C);

        // Motions-tilstandsvariable (tidskonstanter styres af heartRate)
        // E1: Kortvarig effekt — stiger under motion, falder hurtigt efter
        // E2: Langvarig effekt — stiger langsomt, falder langsomt (insulinfølsomhed)
        const tau_E1 = 20;   // Tidskonstant for kortvarig effekt [min]
        const tau_E2 = 200;  // Tidskonstant for langvarig effekt [min]
        const dE1 = (HR_effect - E1) / tau_E1;
        const dE2 = (E1 - E2) / tau_E2;

        // -----------------------------------------------------------------
        // EULER-INTEGRATION: X(t+dt) = X(t) + dX/dt * dt
        // -----------------------------------------------------------------
        this.state[0]  += dD1 * dt;
        this.state[1]  += dD2 * dt;
        this.state[2]  += dS1 * dt;
        this.state[3]  += dS2 * dt;
        this.state[4]  += dQ1 * dt;
        this.state[5]  += dQ2 * dt;
        this.state[6]  += dI  * dt;
        this.state[7]  += dx1 * dt;
        this.state[8]  += dx2 * dt;
        this.state[9]  += dx3 * dt;
        this.state[10] += dC  * dt;
        this.state[11] += dE1 * dt;
        this.state[12] += dE2 * dt;

        // -----------------------------------------------------------------
        // CLAMP — Fysiologiske grænser for at undgå numeriske artefakter
        // -----------------------------------------------------------------
        // Negative værdier giver ikke mening for masser og koncentrationer.
        // Q1 har en nedre grænse svarende til BG = 0.5 mmol/L (bevidstløshed).
        for (let i = 0; i < 13; i++) {
            if (this.state[i] < 0) this.state[i] = 0;
        }
        // Mindstemængde plasma-glukose: 0.5 mmol/L * VG
        const minQ1 = 0.5 * this.V_G;
        if (this.state[4] < minQ1) this.state[4] = minQ1;
    }


    // =========================================================================
    // addBolus — Tilføj en bolus insulin-injektion
    // =========================================================================
    //
    // Konverterer fra enheder (E) til mU og fordeler over en kort tidsperiode.
    // 1 enhed insulin = 1000 mU (milli-units).
    //
    // @param {number} units - Insulin i enheder (E)
    // @param {number} duration - Injektionstid i minutter (default: 2 min)
    // @returns {number} Rate i mU/min der skal sættes som insulinRate
    // =========================================================================
    bolusToRate(units, duration = 2) {
        return (units * 1000) / duration;  // mU/min
    }


    // =========================================================================
    // addCarbs — Konverter gram kulhydrat til mmol/min input-rate
    // =========================================================================
    //
    // Kulhydrat (glukose) har en molekylvægt på 180 g/mol.
    // 1 gram kulhydrat = 1000/180 ≈ 5.56 mmol glukose.
    //
    // @param {number} grams - Kulhydrat i gram
    // @param {number} eatingDuration - Tid det tager at spise [min] (default: 15)
    // @returns {number} Rate i mmol/min
    // =========================================================================
    carbsToRate(grams, eatingDuration = 15) {
        return (grams * 1000 / 180) / eatingDuration;  // mmol/min
    }


    // =========================================================================
    // basalToRate — Konverter daglig basal-dosis til mU/min
    // =========================================================================
    //
    // Basal insulin (Lantus, Tresiba) leveres som enheder per dag.
    // Vi konverterer til en konstant mU/min rate.
    //
    // @param {number} dailyDose - Daglig basal-dosis i enheder (E)
    // @returns {number} Rate i mU/min
    // =========================================================================
    basalToRate(dailyDose) {
        return (dailyDose * 1000) / (24 * 60);  // mU/min
    }
}
