// --- Simulator Class: The core engine of the game ---
class Simulator {
    constructor() {
        this.day = 1; this.timeInMinutes = 0; this.totalSimMinutes = 0;
        this.simulationSpeed = parseInt(speedSelector.value); this.isGameOver = false;
        this.ISF = 3.0; this.ICR = 10;
        this.gramsPerMmolRise = this.ICR / this.ISF;
        this.trueBG = 5.5;
        this.cgmBG = 5.5;
        this.cgmBGHistory = [{ time: -5 * 60, value: 5.5 }];
        this.lastCgmCalculationTime = -5;
        this.cgmSystemicPeriod = (4 + Math.random() * 4) * 60;
        this.cgmSystemicAmplitude = (0.3 + Math.random() * 0.4);
        this.lastTrueBGForDropCheck = this.trueBG; this.timeOfLastBGDropCheck = 0;
        this.activeFood = []; this.activeFastInsulin = []; this.activeLongInsulin = []; this.activeMotion = [];
        this.iob = 0; this.cob = 0; this.lastInsulinTime = -Infinity;
        this.timeOfHighBGwithInsulinDeficit = 0; this.dkaWarning1Given = false; this.dkaGameOverTime = -1;
        this.glucagonUsedTime = -Infinity; this.normoPoints = 0;
        this.nightInterventionPenaltyFactor = 1.0; this.nightInterventionPenaltyEndTime = -1;
        this.basalReminderGivenForDay = [false, false, false];
        this.bgHistoryForStats = []; this.logHistory = [];
        this.totalKcalConsumed = 0; this.totalKcalBurnedBase = 0; this.totalKcalBurnedMotion = 0;
        this.weightChangeKg = 0;
        this.graphMessages = [];
        this.insulinResistanceFactor = 1.0;
        this.isInBonusRange = false;

        // --- Stresshormoner (kortisol, glukagon, adrenalin) ---
        // Disse hormoner øger leverens glukoseproduktion og insulinresistens.
        // Vi bruger to separate niveauer med forskellig washout-hastighed:
        //
        // acuteStressLevel: kortlivet stress (adrenalin/glukagon ved hypo eller intens træning).
        //   Halveringstid: ~60 simulerede minutter. Eksempel: hård styrketræning,
        //   kroppen reagerer på lavt blodsukker (Somogyi-effekten).
        //
        // chronicStressLevel: langvarig stress (forhøjet kortisol ved sygdom, søvnmangel).
        //   Halveringstid: ~12 simulerede timer. Aftager meget langsommere.
        //
        // Begge niveauer multipliceres på den hepatiske glukoseproduktion:
        //   stressMultiplikator = 1.0 + acuteStressLevel + chronicStressLevel
        // Ved 0 stress = normal produktion. Ved acuteStress=1.0 = dobbelt produktion.
        this.acuteStressLevel = 0.0;
        this.chronicStressLevel = 0.0;
        this.addLongInsulin(12, this.totalSimMinutes - 16 * 60, true);
        this.lastInsulinTime = this.totalSimMinutes - 16 * 60;
    }

    get currentISF() {
        let sensitivityIncreaseFactor = 1.0;
        this.activeMotion.forEach(motion => {
            if (this.totalSimMinutes < motion.sensitivityEndTime) {
                const timeIntoSensitivityEffect = this.totalSimMinutes - (motion.startTime + motion.duration);
                const totalSensitivityDuration = motion.sensitivityEndTime - (motion.startTime + motion.duration);
                if (totalSensitivityDuration <= 0) return;
                const currentIncrease = (motion.maxSensitivityIncreaseFactor - 1) * (1 - (timeIntoSensitivityEffect / totalSensitivityDuration));
                sensitivityIncreaseFactor = Math.max(sensitivityIncreaseFactor, 1 + currentIncrease);
            }
        });
        return (this.ISF * this.insulinResistanceFactor) / sensitivityIncreaseFactor;
    }
    get currentCarbEffect() { return this.currentISF / this.ICR; }

    // --- Cirkadisk kortisolniveau (dawn effect modelleret som blodbane) ---
    //
    // Kortisol stiger naturligt om morgenen som del af den cirkadiske rytme.
    // Vi modellerer kurven i tre faser med kvart-sinusbuer for et glat forløb:
    //
    //   Kl. 00:00–04:00 │ Baseline: kortisol er lavt, ingen ekstra leverglukose
    //   Kl. 04:00–08:00 │ Stigende fase: sin-kurve fra 0 → peak (¼ sinusbue opad)
    //   Kl. 08:00–12:00 │ Faldende fase: cos-kurve fra peak → 0 (¼ sinusbue nedad)
    //   Kl. 12:00–24:00 │ Baseline: kortisol er lavt resten af dagen
    //
    // Matematikken bag kvart-sinusbuen:
    //   sin(0)    = 0  →  sin(π/2) = 1  (stigning fra 0 til 1 på ¼ periode)
    //   cos(0)    = 1  →  cos(π/2) = 0  (fald fra 1 til 0 på ¼ periode)
    //   "fremgang" er et tal fra 0.0 til 1.0 der angiver hvor langt vi er
    //   inde i den pågældende fase.
    //
    //   Kurveform (amplitude = 0.3):
    //
    //   0.30 │         ▲ peak kl. 08:00
    //        │       ╱   ╲
    //   0.15 │     ╱       ╲
    //        │   ╱           ╲
    //   0.00 │───              ───────────
    //        └──────────────────────────▶ tid
    //       00   04   08   12   16   20  24
    //
    get circadianKortisolNiveau() {
        const maxAmplitude = 0.3; // Maksimal kortisol-bidrag til stressmultiplikator
        const t = this.timeInMinutes;

        const stigStart  = 4 * 60;  // 04:00 — kortisol begynder at stige
        const peak       = 8 * 60;  // 08:00 — peak (dawn effect)
        const falSlut    = 12 * 60; // 12:00 — tilbage til baseline

        if (t >= stigStart && t < peak) {
            // Stigende fase: ¼ sinusbue fra 0 til 1
            const fremgang = (t - stigStart) / (peak - stigStart); // 0.0 → 1.0
            return maxAmplitude * Math.sin(Math.PI / 2 * fremgang);

        } else if (t >= peak && t < falSlut) {
            // Faldende fase: ¼ cosinusbue fra 1 til 0
            const fremgang = (t - peak) / (falSlut - peak);        // 0.0 → 1.0
            return maxAmplitude * Math.cos(Math.PI / 2 * fremgang);

        } else {
            // Resten af døgnet: ingen cirkadisk kortisolbidrag
            return 0;
        }
    }

    update(deltaTimeSeconds) {
        if (this.isGameOver) return;
        const simulatedMinutesPassed = deltaTimeSeconds * this.simulationSpeed / 60;
        this.totalSimMinutes += simulatedMinutesPassed;
        this.timeInMinutes = this.totalSimMinutes % (24 * 60);
        this.day = Math.floor(this.totalSimMinutes / (24*60)) + 1;
        this.totalKcalBurnedBase += RESTING_KCAL_PER_MINUTE * simulatedMinutesPassed;

        let bgChangeThisFrame = 0;

        // Opdater stresshormon-niveauer (washout + nye triggere som hypo)
        this.updateStressHormones(simulatedMinutesPassed);

        // --- Hepatisk glukoseproduktion ---
        // Leveren frigiver konstant lidt glukose til blodet (basalt niveau = 0.02 mmol/L/min).
        // Produktionen skaleres af en samlet stressmultiplikator der kombinerer tre komponenter:
        //
        //   1. acuteStressLevel:      kortlivet stress (hypo-reaktion, intensiv træning)
        //   2. chronicStressLevel:    langvarig stress (sygdom, søvnmangel)
        //   3. circadianKortisolNiveau: den naturlige kortisol-døgnrytme (inkl. dawn effect)
        //
        // Dawn-effekten er IKKE en separat faktor — den er blot kortisol der stiger som
        // en del af den normale cirkadiske rytme. Ved at bruge circadianKortisolNiveau
        // modelleres dette korrekt som fysiologisk sammenhængende med resten af stresssystemet.
        const currentHour = Math.floor(this.timeInMinutes / 60);
        const stressMultiplikator = 1.0 + this.acuteStressLevel + this.chronicStressLevel + this.circadianKortisolNiveau;
        let liverGlucoseProduction = 0.02 * stressMultiplikator;
        bgChangeThisFrame += liverGlucoseProduction * simulatedMinutesPassed;

        this.activeLongInsulin.forEach(ins => {
            const timeSinceInjection = this.totalSimMinutes - ins.injectionTime;
            if (timeSinceInjection < 0) return;
            let effectFactor = 0;
            const timeToPlateau = 4 * 60, endOfPlateau = timeToPlateau + 18 * 60, tailOffDuration = ins.totalDuration - endOfPlateau;
            if (timeSinceInjection < timeToPlateau) effectFactor = timeSinceInjection / timeToPlateau;
            else if (timeSinceInjection < endOfPlateau) effectFactor = 1.0;
            else if (timeSinceInjection < ins.totalDuration) effectFactor = 1.0 - (timeSinceInjection - endOfPlateau) / tailOffDuration;
            const basalRate = (ins.dose * this.currentISF) / (ins.totalDuration - (timeToPlateau + tailOffDuration) * 0.5);
            bgChangeThisFrame -= basalRate * Math.max(0, effectFactor) * simulatedMinutesPassed;
        });
        this.activeLongInsulin = this.activeLongInsulin.filter(ins => (this.totalSimMinutes - ins.injectionTime) < ins.totalDuration);

        this.cob = 0;
        this.activeFood.forEach(food => {
            const timeSinceConsumption = this.totalSimMinutes - food.startTime;
            let carbAbsorptionDuration = 40 + (food.fat * 1.5) + (food.protein * 0.5);
            let carbAbsorptionStartDelay = 20 + (food.fat * 0.5);
            if (food.carbsAbsorbed < food.carbs && timeSinceConsumption > carbAbsorptionStartDelay) {
                const absorbAmount = Math.min(food.carbs - food.carbsAbsorbed, (food.carbs / carbAbsorptionDuration) * simulatedMinutesPassed);
                bgChangeThisFrame += absorbAmount * this.currentCarbEffect;
                food.carbsAbsorbed += absorbAmount;
            }
            if (food.proteinAbsorbed < food.protein && timeSinceConsumption > 30) {
                 const absorbAmountProtein = Math.min(food.protein - food.proteinAbsorbed, (food.protein / (180 + food.fat * 2)) * simulatedMinutesPassed);
                 bgChangeThisFrame += absorbAmountProtein * this.currentCarbEffect * 0.25;
                 food.proteinAbsorbed += absorbAmountProtein;
            }
            this.cob += (food.carbs - food.carbsAbsorbed) + (food.protein - food.proteinAbsorbed) * 0.25;
        });
        this.activeFood = this.activeFood.filter(f => f.carbsAbsorbed < f.carbs || f.proteinAbsorbed < f.protein);

        this.iob = 0;
        this.activeFastInsulin.forEach(ins => {
            const timeSinceInjection = this.totalSimMinutes - ins.injectionTime;
            if (timeSinceInjection >= ins.onset) {
                let insulinEffectiveness = 0;
                if (timeSinceInjection < (ins.onset + ins.timeToPeak)) insulinEffectiveness = (timeSinceInjection - ins.onset) / ins.timeToPeak;
                else if (timeSinceInjection < ins.totalDuration) insulinEffectiveness = 1 - (timeSinceInjection - (ins.onset + ins.timeToPeak)) / (ins.totalDuration - (ins.onset + ins.timeToPeak));
                const insulinRate = (2 * ins.dose * this.currentISF) / (ins.totalDuration - ins.onset);
                bgChangeThisFrame -= insulinRate * Math.max(0, insulinEffectiveness) * simulatedMinutesPassed;

                const remainingDuration = ins.totalDuration - timeSinceInjection;
                if (remainingDuration > 0) {
                    let iobFactor = (timeSinceInjection < (ins.onset + ins.timeToPeak)) ? 1 : (remainingDuration / (ins.totalDuration - (ins.onset + ins.timeToPeak)));
                    this.iob += ins.dose * Math.max(0, iobFactor);
                }
            }
        });
        this.activeFastInsulin = this.activeFastInsulin.filter(ins => (this.totalSimMinutes - ins.injectionTime) < ins.totalDuration);

        this.activeMotion.forEach(motion => {
            if (this.totalSimMinutes >= motion.startTime && this.totalSimMinutes < (motion.startTime + motion.duration)) {
                // Aerob effekt: musklerne optager glukose direkte → BG falder.
                // Effekten er størst ved høj intensitet.
                let bgDropPer10min = (motion.intensity === "Lav") ? 1.0 : (motion.intensity === "Medium") ? 2.0 : 3.0;
                bgChangeThisFrame -= (bgDropPer10min / 10) * (1 + (Math.random()*0.4-0.2)) * simulatedMinutesPassed;

                // Anaerob komponent ved høj intensitet (styrketræning, sprint):
                // Katekolaminer (adrenalin/noradrenalin) frigives og gør to ting:
                //   1. Stimulerer leveren til at frigive ekstra glukose direkte (modvirker det aerobe fald)
                //   2. Opbygger akut stress der fortsætter EFTER træningen er slut
                // Det betyder at BG kan stige eller falde mindre end forventet ved hård træning.
                if (motion.intensity === "Høj") {
                    // Direkte katekolamin-drevet leverglukose under træningen
                    bgChangeThisFrame += 0.05 * simulatedMinutesPassed;
                    // Opbygning af akut stressniveau (aftager efter træning via washout)
                    this.acuteStressLevel = Math.min(2.0, this.acuteStressLevel + 0.02 * simulatedMinutesPassed);
                }
            }
        });

        this.trueBG += bgChangeThisFrame;
        this.trueBG = Math.max(0.1, this.trueBG);

        if (this.totalSimMinutes - this.timeOfLastBGDropCheck >= 1) {
            const bgDropPerMinute = this.lastTrueBGForDropCheck - this.trueBG;
            if (this.trueBG < 4.0 && bgDropPerMinute > 0.15) this.showSteepDropWarning();
            this.lastTrueBGForDropCheck = this.trueBG;
            this.timeOfLastBGDropCheck = this.totalSimMinutes;
        }

        // V13 CGM Logic
        if (this.totalSimMinutes - this.lastCgmCalculationTime >= 5) {
            const cgmDelayMinutes = 5 + Math.random() * 5;
            let delayedTrueBG = this.trueBG;
            const targetTime = this.totalSimMinutes - cgmDelayMinutes;
            for (let i = this.cgmBGHistory.length - 1; i >= 0; i--) {
                if (this.cgmBGHistory[i].time <= targetTime) {
                    delayedTrueBG = this.cgmBGHistory[i].value;
                    break;
                }
            }
            const randomNoise = (Math.random() - 0.5) * 0.15;
            let systemicDeviation = Math.sin(this.totalSimMinutes / this.cgmSystemicPeriod) * this.cgmSystemicAmplitude;
            this.cgmBG = delayedTrueBG + randomNoise + systemicDeviation;
            this.cgmBG = Math.max(2.2, Math.min(25.0, this.cgmBG));
            this.lastCgmCalculationTime = this.totalSimMinutes;

            cgmDataPoints.push({ time: this.totalSimMinutes, value: this.cgmBG });
            trueBgPoints.push({ time: this.totalSimMinutes, value: this.trueBG });
            this.bgHistoryForStats.push({time: this.totalSimMinutes, cgmBG: this.cgmBG, trueBG: this.trueBG });
            this.cgmBGHistory.push({ time: this.totalSimMinutes, value: this.trueBG });
            if(this.cgmBGHistory.length > 120) this.cgmBGHistory.shift();

            if (cgmDataPoints.length > MAX_GRAPH_POINTS_PER_DAY * 2) cgmDataPoints.shift();
            if (trueBgPoints.length > MAX_GRAPH_POINTS_PER_DAY * 2) trueBgPoints.shift();
            if (this.bgHistoryForStats.length > (14 * MAX_GRAPH_POINTS_PER_DAY + 10)) this.bgHistoryForStats.shift();
            if (this.simulationSpeed >= 240) playSound('tick');
        }

        this.graphMessages = this.graphMessages.filter(msg => this.totalSimMinutes < msg.expireTime);
        if (this.day <= 3 && !this.basalReminderGivenForDay[this.day-1] && currentHour >= 8 && currentHour < 12) {
            const startOfDay = (this.day - 1) * 24 * 60;
            const hasTakenBasalToday = this.logHistory.some(e => e.type === 'insulin-basal' && e.time >= startOfDay);
            if (!hasTakenBasalToday) {
                const existingReminder = this.graphMessages.find(msg => msg.id === `basal_reminder_day_${this.day}`);
                if (!existingReminder) {
                    this.graphMessages.push({
                        id: `basal_reminder_day_${this.day}`,
                        text: "Husk Basal Insulin (Normal dosis ca. 10E)",
                        expireTime: this.totalSimMinutes + (120 * (this.simulationSpeed/60)) // Show for 2 simulated hours
                    });
                }
            }
        }

        this.updateNormoPoints(simulatedMinutesPassed);
        this.updateWeight();
        this.updateStats();
        this.checkGameOverConditions();
        this.updateGlucagonStatus();
    }

    updateNormoPoints(minutesPassed) {
         if (this.totalSimMinutes > this.nightInterventionPenaltyEndTime) this.nightInterventionPenaltyFactor = 1.0;

        const inBonusNow = this.trueBG >= 5.0 && this.trueBG <= 6.0;
        if(inBonusNow && !this.isInBonusRange) {
            playSound('bonus');
        }
        this.isInBonusRange = inBonusNow;

        let bgWeight = 0;
        if (inBonusNow) {
            bgWeight = 2;
        } else if (this.trueBG >= 4.0 && this.trueBG <= 10.0) {
            bgWeight = 1;
        } else {
            bgWeight = 0;
        }

        const finalWeight = this.nightInterventionPenaltyFactor * bgWeight;
        this.normoPoints += (minutesPassed / 60) * finalWeight;

        normoPointsWeighting.textContent = `(x${finalWeight.toFixed(1)})`;
    }

    handleNightIntervention(penaltyMinutes = 120) {
        const currentHour = Math.floor(this.timeInMinutes / 60);
        if (currentHour >= 22 || currentHour < 7) {
            if (this.nightInterventionPenaltyFactor === 1.0) {
                logEvent(`Natlig intervention! Pointoptjening halveret i ${penaltyMinutes/60} timer.`, 'event');
                this.graphMessages.push({
                    id: `night_intervention_${this.totalSimMinutes}`,
                    text: "zZzz... Natlig intervention",
                    expireTime: this.totalSimMinutes + penaltyMinutes
                });
            }
            this.nightInterventionPenaltyFactor = 0.5;
            this.nightInterventionPenaltyEndTime = this.totalSimMinutes + penaltyMinutes;
        }
    }

    showSteepDropWarning() {
        if (steepDropWarningDiv.style.display === 'block') return;
        steepDropWarningDiv.style.display = 'block';
        playSound('intervention', 'A5', '2n');
        setTimeout(() => { steepDropWarningDiv.style.display = 'none'; }, 5000);
    }

    addFood(carbs, protein, fat, icon = '🍴') {
        this.handleNightIntervention();
        const foodKcal = (carbs * 4) + (protein * 4) + (fat * 9);
        this.totalKcalConsumed += foodKcal;
        logEvent(`Mad: ${carbs}g K, ${protein}g P, ${fat}g F`, 'food', {kcal: foodKcal, carbs, protein, icon});
        this.activeFood.push({ carbs, protein, fat, startTime: this.totalSimMinutes, carbsAbsorbed: 0, proteinAbsorbed: 0 });
        playSound('intervention', 'E4');
    }

    addFastInsulin(dose) {
        this.handleNightIntervention();
        logEvent(`Hurtig insulin: ${dose}E`, 'insulin-fast', {dose});
        const onset = 10 + Math.random() * 5, timeToPeak = 45 + (dose * 5) + (Math.random() * 20), totalDuration = 120 + (dose * 12) + (Math.random() * 60);
        this.activeFastInsulin.push({ dose, injectionTime: this.totalSimMinutes, onset, timeToPeak, totalDuration });
        this.lastInsulinTime = this.totalSimMinutes;
        this.resetDKAState();
        playSound('intervention', 'A4');
    }

    addLongInsulin(dose, injectionTime = this.totalSimMinutes, isSilent = false) {
         if (!isSilent) {
            this.handleNightIntervention();
            logEvent(`Basal insulin: ${dose}E`, 'insulin-basal', {dose});
            this.basalReminderGivenForDay[this.day-1] = true;
            playSound('intervention', 'G3');
         }
         this.activeLongInsulin.push({ dose, injectionTime, totalDuration: (24 + Math.random() * 12) * 60 });
         this.lastInsulinTime = injectionTime;
         this.resetDKAState();
    }

    resetDKAState() { this.timeOfHighBGwithInsulinDeficit = 0; this.dkaWarning1Given = false; this.dkaGameOverTime = -1; }

    // --- Stresshormon-opdatering ---
    // Kaldes én gang per simuleringstick, før beregning af hepatisk glukose.
    // Håndterer to ting:
    //   1. Eksponentiel washout (niveauerne aftager naturligt over tid)
    //   2. Automatiske triggere (fx Somogyi-reaktion ved lavt blodsukker)
    updateStressHormones(simulatedMinutesPassed) {
        // --- Washout via eksponentielt henfald ---
        // Princippet er det samme som radioaktivt henfald eller medicin i blodet:
        //   nyt_niveau = gammelt_niveau × e^(-henfaldskonstant × tid)
        // Henfaldskonstanten beregnes fra halveringstiden:
        //   henfaldskonstant = ln(2) / halveringstid
        //
        // Akut stress (adrenalin/glukagon): halveringstid ~60 simulerede minutter
        const akutHenfaldskonstant = Math.log(2) / 60;
        this.acuteStressLevel *= Math.exp(-akutHenfaldskonstant * simulatedMinutesPassed);

        // Kronisk stress (kortisol ved sygdom/søvnmangel): halveringstid ~12 simulerede timer
        const kroniskHenfaldskonstant = Math.log(2) / (12 * 60);
        this.chronicStressLevel *= Math.exp(-kroniskHenfaldskonstant * simulatedMinutesPassed);

        // --- Somogyi-effekten ---
        // Når blodsukker falder til < 3.5 mmol/L, registrerer kroppen fare og
        // frigiver glukagon + adrenalin som modregulation. Dette er en automatisk
        // beskyttelsesmekanisme. Effekten er stærkere jo lavere BG er.
        // Resultatet: BG kan "rebound" til for højt niveau efter en hypo —
        // særligt ved natlig hypo hvor man ikke opdager det og korrigerer.
        if (this.trueBG < 3.5) {
            // Kraftigere reaktion ved svær hypo (< 2.5) end ved let hypo (2.5–3.5)
            const hypoStressRate = this.trueBG < 2.5 ? 0.04 : 0.015;
            this.acuteStressLevel = Math.min(2.0, this.acuteStressLevel + hypoStressRate * simulatedMinutesPassed);
        }

        // Sikr at niveauer ikke bliver negative pga. floating point afrundingsfejl
        this.acuteStressLevel = Math.max(0, this.acuteStressLevel);
        this.chronicStressLevel = Math.max(0, this.chronicStressLevel);
    }

    // --- Offentlige metoder til at sætte stress udefra ---
    // Bruges af fremtidige scenarier (sygdom, søvnmangel, feber osv.)
    // Kaldes fx fra game.js eller en fremtidig scenarie-motor.

    // Tilføj akut stress — aftager hurtigt (halveringstid ~60 min).
    // Eksempel: amount=0.5 svarer til en moderat stressreaktion.
    addAcuteStress(amount) {
        this.acuteStressLevel = Math.min(2.0, this.acuteStressLevel + amount);
        logEvent(`Akut stresshormon-stigning: +${amount.toFixed(2)} (fx adrenalin/glukagon)`, 'event');
    }

    // Tilføj kronisk stress — aftager langsomt (halveringstid ~12 timer).
    // Eksempel: amount=0.5 ved sygdom eller én nats søvnmangel.
    addChronicStress(amount) {
        this.chronicStressLevel = Math.min(1.5, this.chronicStressLevel + amount);
        logEvent(`Kronisk stressniveau øget: +${amount.toFixed(2)} (fx kortisol ved sygdom)`, 'event');
    }


    startMotion(intensity, duration) {
        this.handleNightIntervention();
        const durationMinutes = parseInt(duration);
        let kcalPerMinute = intensity === "Lav" ? 4 : (intensity === "Medium" ? 7 : 10);
        this.totalKcalBurnedMotion += kcalPerMinute * durationMinutes;
        logEvent(`Motion: ${intensity}, ${durationMinutes} min`, 'motion', {intensity, duration: durationMinutes});
        let sensitivityDurationMinutes = durationMinutes * (intensity === "Høj" ? 4 : (intensity === "Medium" ? 2 : 1));
        const maxSensIncrease = 1 + (intensity === "Høj" ? 1.0 : (intensity === "Medium" ? 0.75 : 0.5));
        this.activeMotion.push({ intensity, startTime: this.totalSimMinutes, duration: durationMinutes, sensitivityEndTime: this.totalSimMinutes + durationMinutes + sensitivityDurationMinutes, maxSensitivityIncreaseFactor: maxSensIncrease });
        startMotionButton.disabled = true;
        setTimeout(() => { startMotionButton.disabled = false; }, durationMinutes * 60 * 1000 / this.simulationSpeed);
        playSound('intervention', 'F4');
    }

    performFingerprick() {
        this.handleNightIntervention(30);
        const measuredBG = this.trueBG * (1 + (Math.random() * 0.1 - 0.05));
        logEvent(`Fingerprik: ${measuredBG.toFixed(1)} mmol/L`, 'fingerprick', {value: measuredBG.toFixed(1)});
        cgmDataPoints.push({ time: this.totalSimMinutes, value: measuredBG, type: 'fingerprick' });
        playSound('intervention', 'B4');
    }

    updateGlucagonStatus() {
        const cooldownMinutes = 24 * 60;
        const timeSinceUsed = this.totalSimMinutes - this.glucagonUsedTime;
        glucagonButton.disabled = timeSinceUsed < cooldownMinutes;
    }

    useGlucagon() {
        this.handleNightIntervention();
        logEvent("Glycagon brugt! BG stiger hurtigt.", 'event');
        this.trueBG = Math.min(25, this.trueBG + 8 + Math.random() * 4);
        this.glucagonUsedTime = this.totalSimMinutes;
        this.updateGlucagonStatus();
    }

     updateWeight() {
        const netKcal = this.totalKcalConsumed - (this.totalKcalBurnedBase + this.totalKcalBurnedMotion);
        this.weightChangeKg = netKcal / KCAL_PER_KG_WEIGHT;
        weightChangeSlider.value = Math.max(-5, Math.min(5, this.weightChangeKg));
        weightChangeValue.textContent = this.weightChangeKg.toFixed(1);
        const absWeightChange = Math.abs(this.weightChangeKg);
        let thumbColor = '#4CAF50';
        if (absWeightChange > 3.5) thumbColor = '#F44336';
        else if (absWeightChange > 1.5) thumbColor = '#FFC107';
        weightChangeSlider.style.setProperty('--thumb-color', thumbColor);
    }

    checkGameOverConditions() {
        if (this.isGameOver) return; // Don't trigger multiple game overs

        if (this.trueBG < 1.5) { this.gameOver("GAME OVER", `Hypoglykæmi! Dit sande blodsukker faldt under 1.5 mmol/L.<br>Du opnåede ${this.normoPoints.toFixed(1)} Normoglykæmi-points.`); return; }
        if (Math.abs(this.weightChangeKg) > 5.0) { this.gameOver("GAME OVER", `Vægtændring! Din vægtændring oversteg 5 kg (${this.weightChangeKg.toFixed(1)} kg).<br>Du opnåede ${this.normoPoints.toFixed(1)} Normoglykæmi-points.`); return; }

        const insulinDeficient = this.iob < 0.1 && this.activeLongInsulin.length === 0 && (this.totalSimMinutes - this.lastInsulinTime > 8*60);
        if (this.trueBG > 12 && insulinDeficient) {
            if (this.timeOfHighBGwithInsulinDeficit === 0) this.timeOfHighBGwithInsulinDeficit = this.totalSimMinutes;
        } else {
            this.timeOfHighBGwithInsulinDeficit = 0;
        }
        // TODO: DKA-model skal forbedres på to punkter:
        //
        // 1. TIDSLINJE FOR DØD:
        //    Undersøg den kliniske litteratur for realistisk tidsforløb.
        //    Nuværende model: advarsel efter 6 timers højt BG + insulinmangel,
        //    game over 12 timer efter advarslen (dvs. ~18 timer i alt).
        //    Spørgsmål: Hvornår opstår bevidstløshed? Hvornår er det livsfarligt?
        //    Hint: Ubehandlet DKA kan være dødelig inden for 24-72 timer,
        //    men alvorlige symptomer (bevidsthedspåvirkning) opstår typisk
        //    tidligere. Find et realistisk og pædagogisk meningsfuldt interval.
        //
        // 2. KETONMODEL:
        //    I virkeligheden er det ketoner (syrer dannet når kroppen forbrænder
        //    fedt i stedet for glukose pga. insulinmangel) der er det egentlige
        //    dræbende element — ikke høj glukose alene.
        //    En model kunne se sådan ud:
        //      - Ketoner stiger når: BG > 12 OG insulinmangel OG tid
        //      - Ketonrate afhænger af graden af insulinmangel og BG-niveau
        //      - Spiller kan måle ketoner med "ketonstik" (som fingerprik)
        //      - Symptomtærskler: let forhøjet (0.6-1.5 mmol/L) → advarsel,
        //        moderat (1.5-3.0) → kraftig advarsel + symptomer,
        //        svær (> 3.0) → DKA, game over nærmer sig
        //      - Insulin + væske sænker ketoner over tid
        //    Dette giver en mere realistisk og pædagogisk korrekt model hvor
        //    spilleren kan se konsekvenserne af insulinmangel gradvist opbygges.
        //
        // 3. STRESSHORMONER / HEPATISK GLUKOSEUDSKILLELSE:
        //    Overvej at tilføje en samlet "stresshormon-parameter" (kortisol/glukagon)
        //    der styrer leverens glukoseproduktion. Nuværende model har kun en simpel
        //    dawn effect (fast faktor kl. 03-08). En mere generel model kunne dække:
        //
        //    - Dawn effect: kortisol stiger naturligt om morgenen → øget leverglukose
        //    - Somogyi-effekten: rebound hyperglykæmi efter natlig hypoglykæmi,
        //      fordi kroppen udskiller glukagon + kortisol som modregulation
        //    - Faste: langvarig faste øger glukagon → leveren frigiver glukose
        //    - Styrketræning: anaerob træning frigiver katekolaminer (adrenalin)
        //      som midlertidigt HÆVER BG (modsat aerob træning der sænker det)
        //    - Søvnmangel: forhøjet kortisol → øget insulinresistens og leverglukose
        //    - Sygdom/feber: kraftigt forhøjet kortisol → markant øget insulinbehov
        //
        //    Implementeringsidé: én variabel `this.stressHormoneLevel` (0.0–2.0,
        //    baseline = 1.0) der multipliceres på den hepatiske glukoseproduktion.
        //    Forskellige scenarier (feber, søvnmangel, styrketræning) sætter denne
        //    variabel og lader den aftage over tid. Det giver én central knap at
        //    dreje på, frem for mange separate mekanismer.
        if (this.timeOfHighBGwithInsulinDeficit > 0 && (this.totalSimMinutes - this.timeOfHighBGwithInsulinDeficit > 6 * 60) && !this.dkaWarning1Given) {
            this.dkaWarning1Given = true;
            this.dkaGameOverTime = this.totalSimMinutes + 12 * 60;
            showPopup("Advarsel: Risiko for Ketoacidose!", "Højt blodsukker og insulinmangel i over 6 timer. Symptomer: tørst, hyppig vandladning, kvalme, træthed. Tag insulin hurtigst muligt!", false, true, false, false);
        }
        if (this.dkaGameOverTime !== -1 && this.totalSimMinutes >= this.dkaGameOverTime) {
             this.gameOver("GAME OVER", `Diabetisk Ketoacidose! Du reagerede ikke på advarslen om insulinmangel i tide.<br>Du opnåede ${this.normoPoints.toFixed(1)} Normoglykæmi-points.`); return;
        }

        if (this.day > 14) {
            const avg14d = this.calculateAverageBGForPeriod(14 * 24 * 60, true);
            if (avg14d !== null && avg14d > 15.0) {
                this.gameOver(`GAME OVER`, `Sendiabetiske Komplikationer! Dit gennemsnitlige BG over de sidste 14 dage var ${avg14d.toFixed(1)} mmol/L.<br>Du opnåede ${this.normoPoints.toFixed(1)} Normoglykæmi-points.`); return;
            }
        }
    }

    calculateAverageBGForPeriod(periodMinutes, useTrueBG = false) {
        const relevantData = this.bgHistoryForStats.filter(p => p.time >= (this.totalSimMinutes - periodMinutes));
        if (relevantData.length < 50) return null;
        const key = useTrueBG ? 'trueBG' : 'cgmBG';
        return relevantData.reduce((sum, p) => sum + p[key], 0) / relevantData.length;
    }

    updateStats() {
        const periods = [
            { key: '24h', minutes: 24*60, displays: { tir: tir24hDisplay, titr: titr24hDisplay, avg: avgCgm24hDisplay, fast: fastInsulin24hDisplay, basal: basalInsulin24hDisplay, kcal: kcal24hDisplay }},
            { key: '14d', minutes: 14*24*60, displays: { tir: tir14dDisplay, titr: titr14dDisplay, avg: avgCgm14dDisplay }}
        ];
        periods.forEach(p => {
            const dataPoints = this.bgHistoryForStats.filter(point => point.time >= (this.totalSimMinutes - p.minutes));
            if (dataPoints.length > 20) {
                let inRangeCount = 0, inTightRangeCount = 0, sumCgm = 0;
                dataPoints.forEach(pt => {
                    sumCgm += pt.cgmBG;
                    // TIR and TITR are based on True BG
                    if (pt.trueBG >= 4 && pt.trueBG <= 10) inRangeCount++;
                    if (pt.trueBG >= 4 && pt.trueBG <= 8) inTightRangeCount++;
                });
                p.displays.tir.textContent = ((inRangeCount / dataPoints.length) * 100).toFixed(0) + "%";
                p.displays.titr.textContent = ((inTightRangeCount / dataPoints.length) * 100).toFixed(0) + "%";
                p.displays.avg.textContent = (sumCgm / dataPoints.length).toFixed(1);

                if (p.key === '24h') {
                    let totalFast24h = 0, totalBasal24h = 0, totalKcal24h = 0;
                    this.logHistory.filter(ev => ev.time >= (this.totalSimMinutes - p.minutes)).forEach(ev => {
                        if (ev.type === 'insulin-fast') totalFast24h += ev.details.dose;
                        if (ev.type === 'insulin-basal') totalBasal24h += ev.details.dose;
                        if (ev.type === 'food') totalKcal24h += ev.details.kcal;
                    });
                    p.displays.fast.textContent = totalFast24h.toFixed(1) + " E";
                    p.displays.basal.textContent = totalBasal24h.toFixed(0) + " E";
                    p.displays.kcal.textContent = totalKcal24h.toFixed(0) + " kcal";
                }
            } else {
                Object.values(p.displays).forEach(el => { if(el) el.textContent = '--'; });
                if(p.displays.tir) p.displays.tir.textContent = '--%';
                if(p.displays.titr) p.displays.titr.textContent = '--%';
            }
        });
    }
    gameOver(title, message) {
        this.isGameOver = true; isPaused = true;
        playSound('gameOver');
        showPopup(title, message, true, false, false, true);
    }
}
