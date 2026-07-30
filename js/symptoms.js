// =============================================================================
// SYMPTOMS.JS - fælles symptomdata og tilstandsresolver
// =============================================================================
//
// Denne fil er den fælles sandhed for de spiller-synlige symptomer. Desktop,
// mobil, lyd og tipmotor skal alle spørge resolveren i stedet for at vedligeholde
// hver sin kopi af tærsklerne.
//
// Resolveren ændrer IKKE simulatorens fysiologi. Den oversætter kun eksisterende
// tilstande (BG, acidosebelastning, energiunderskud og sygdomshændelser) til:
//   - fem læringsgrupper: hypo, hyper, ketoner, energi og sygdom;
//   - konkrete symptomord med intensitet, farve og animationsfase;
//   - en fælles VFX-tilstand til slør, afmætning og tunnelsyn.
//
// Dependencies: ingen. Funktionerne accepterer et Simulator-lignende objekt.
// Exports (global + CommonJS): resolveSymptomState, resolveSymptomVfxState,
//   isSymptomGroupActive, countActiveSymptomGroups.
// =============================================================================

'use strict';

const SYMPTOM_DEFINITIONS = Object.freeze({
    hypo: Object.freeze([
        { concept: 'sweat', textKey: 'symptom.hypo.sweat', threshold: 4.0, range: 1.0, phase: 0.0, color: [255, 220, 80] },
        { concept: 'heartbeat', textKey: 'symptom.hypo.heartbeat', threshold: 3.8, range: 1.0, phase: 0.7, color: [255, 220, 80] },
        { concept: 'tremor', textKey: 'symptom.hypo.tremor', threshold: 3.5, range: 1.0, phase: 1.4, color: [255, 200, 70] },
        { concept: 'dizziness', textKey: 'symptom.hypo.dizziness', threshold: 3.3, range: 0.8, phase: 2.1, color: [255, 180, 60] },
        { concept: 'confusion', textKey: 'symptom.hypo.confusion', threshold: 3.0, range: 0.8, phase: 2.8, color: [255, 150, 60] },
        { concept: 'blurredVision', textKey: 'symptom.hypo.blurredVision', threshold: 2.8, range: 0.6, phase: 3.5, color: [255, 130, 60] },
        { concept: 'seizures', textKey: 'symptom.hypo.seizures', threshold: 2.5, range: 0.5, phase: 4.2, color: [255, 100, 80] },
    ]),
    ketone: Object.freeze([
        { concept: 'thirst', textKey: 'symptom.dka.thirst', threshold: 0.05, range: 0.20, phase: 0.3, color: [210, 160, 255] },
        { concept: 'urination', textKey: 'symptom.dka.urination', threshold: 0.10, range: 0.20, phase: 1.0, color: [210, 160, 255] },
        { concept: 'fatigue', textKey: 'symptom.dka.fatigue', threshold: 0.15, range: 0.25, phase: 1.7, color: [210, 140, 255] },
        { concept: 'nausea', textKey: 'symptom.dka.nausea', threshold: 0.25, range: 0.25, phase: 2.4, color: [200, 120, 255] },
        { concept: 'stomachPain', textKey: 'symptom.dka.stomachPain', threshold: 0.30, range: 0.25, phase: 3.1, color: [200, 120, 255] },
        { concept: 'acetone', textKey: 'symptom.dka.acetone', threshold: 0.35, range: 0.25, phase: 3.8, color: [200, 120, 255] },
        { concept: 'vomiting', textKey: 'symptom.dka.vomiting', threshold: 0.50, range: 0.25, phase: 4.5, color: [190, 100, 255] },
        { concept: 'kussmaul', textKey: 'symptom.dka.kussmaul', threshold: 0.60, range: 0.25, phase: 5.2, color: [190, 100, 255] },
        { concept: 'confusion', textKey: 'symptom.dka.confusion', threshold: 0.75, range: 0.20, phase: 5.9, color: [180, 80, 255] },
    ]),
    hyper: Object.freeze([
        { concept: 'thirst', textKey: 'symptom.hyper.thirst', threshold: 14.0, range: 4.0, phase: 0.5, color: [255, 180, 120] },
        { concept: 'urination', textKey: 'symptom.hyper.urination', threshold: 14.0, range: 4.0, phase: 1.2, color: [255, 180, 120] },
        { concept: 'fatigue', textKey: 'symptom.hyper.fatigue', threshold: 18.0, range: 4.0, phase: 1.9, color: [255, 160, 100] },
        { concept: 'blurredVision', textKey: 'symptom.hyper.blurred', threshold: 18.0, range: 4.0, phase: 2.6, color: [255, 160, 100] },
        { concept: 'dryMouth', textKey: 'symptom.hyper.dryMouth', threshold: 22.0, range: 3.0, phase: 3.3, color: [255, 140, 80] },
        { concept: 'nausea', textKey: 'symptom.hyper.nausea', threshold: 22.0, range: 3.0, phase: 4.0, color: [255, 140, 80] },
    ]),
    energy: Object.freeze([
        { concept: 'hunger', textKey: 'symptom.hunger.hungry', threshold: 0.5, range: 1.0, phase: 5.5, color: [220, 180, 100] },
        { concept: 'weakness', textKey: 'symptom.hunger.weakness', threshold: 1.0, range: 1.0, phase: 6.2, color: [210, 160, 80] },
        { concept: 'irritability', textKey: 'symptom.hunger.irritability', threshold: 1.5, range: 1.0, phase: 6.9, color: [200, 140, 60] },
        { concept: 'headache', textKey: 'symptom.hunger.headache', threshold: 2.0, range: 1.0, phase: 7.6, color: [190, 120, 50] },
    ]),
    illness: Object.freeze([
        { concept: 'soreThroat', textKey: 'symptom.illness.throat', phase: 8.4, color: [252, 165, 165], scale: 1.0 },
        { concept: 'headache', textKey: 'symptom.illness.headache', phase: 9.1, color: [248, 113, 113], scale: 1.0 },
        { concept: 'fatigue', textKey: 'symptom.illness.tired', phase: 9.8, color: [251, 146, 60], scale: 1.0 },
        { concept: 'sneeze', textKey: 'symptom.illness.sneeze', phase: 10.5, color: [252, 211, 77], scale: 0.65 },
    ]),
});

function _symptomClamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function _symptomNumber(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function _symptomBG(sim) {
    if (sim && Number.isFinite(sim.trueBG)) return sim.trueBG;
    if (sim && Number.isFinite(sim.cgmBG)) return sim.cgmBG;
    return 7.0;
}

function _symptomAcidosisRatio(sim) {
    const threshold = sim && Number.isFinite(sim.ACIDOSIS_THRESHOLD)
        ? sim.ACIDOSIS_THRESHOLD
        : 600;
    if (threshold <= 0) return 0;
    return Math.max(0, _symptomNumber(sim && sim.acidosisLoad) / threshold);
}

function _symptomClockMinutes(sim) {
    if (sim && Number.isFinite(sim.timeInMinutes)) return sim.timeInMinutes;
    const total = _symptomNumber(sim && sim.totalSimMinutes);
    return ((total % 1440) + 1440) % 1440;
}

function _symptomIllnessIntensity(sim) {
    if (!sim) return 0;
    const now = _symptomNumber(sim.totalSimMinutes);
    const until = _symptomNumber(sim.illnessSymptomsUntil, -Infinity);
    if (!(until > now)) return 0;

    const start = Number.isFinite(sim.illnessSymptomsStart)
        ? sim.illnessSymptomsStart
        : now;
    const elapsed = Math.max(0, now - start);
    const remaining = Math.max(0, until - now);
    return _symptomClamp01(Math.min(elapsed / 90, remaining / 120));
}

function _symptomPushBelow(target, definitions, value, group) {
    for (const definition of definitions) {
        if (value >= definition.threshold) continue;
        target.push({
            ...definition,
            group,
            intensity: _symptomClamp01((definition.threshold - value) / definition.range),
        });
    }
}

function _symptomPushAbove(target, definitions, value, group) {
    for (const definition of definitions) {
        if (value <= definition.threshold) continue;
        target.push({
            ...definition,
            group,
            intensity: _symptomClamp01((value - definition.threshold) / definition.range),
        });
    }
}

/**
 * Oversæt simulatorens aktuelle tilstand til spiller-synlige symptomer.
 * Dobbeltforekommende signaler (fx tørst ved både hyper og acidosebelastning)
 * deduplikeres efter betydning, og den stærkeste aktuelle forekomst beholdes.
 */
function resolveSymptomState(sim) {
    const bg = _symptomBG(sim);
    const acidRatio = _symptomAcidosisRatio(sim);
    const weightLossKg = Math.max(0, -_symptomNumber(sim && sim.weightChangeKg));
    const hour = _symptomClockMinutes(sim) / 60;
    const energyEnabled = !(sim && sim._campaignDisableWeight) && hour >= 7 && hour < 22;
    const illnessIntensity = _symptomIllnessIntensity(sim);

    const groups = {
        hypo: { active: bg < 4.0, severity: _symptomClamp01((4.0 - bg) / 2.0), value: bg },
        hyper: { active: bg > 14.0, severity: _symptomClamp01((bg - 14.0) / 8.0), value: bg },
        ketone: { active: acidRatio > 0.05, severity: _symptomClamp01(acidRatio), value: acidRatio },
        energy: { active: energyEnabled && weightLossKg > 0.5, severity: _symptomClamp01((weightLossKg - 0.5) / 2.0), value: weightLossKg },
        illness: { active: illnessIntensity > 0.05, severity: illnessIntensity, value: illnessIntensity },
    };

    const collected = [];
    if (groups.hypo.active) _symptomPushBelow(collected, SYMPTOM_DEFINITIONS.hypo, bg, 'hypo');
    if (groups.ketone.active) _symptomPushAbove(collected, SYMPTOM_DEFINITIONS.ketone, acidRatio, 'ketone');
    if (groups.hyper.active) _symptomPushAbove(collected, SYMPTOM_DEFINITIONS.hyper, bg, 'hyper');
    if (groups.energy.active) _symptomPushAbove(collected, SYMPTOM_DEFINITIONS.energy, weightLossKg, 'energy');
    if (groups.illness.active) {
        for (const definition of SYMPTOM_DEFINITIONS.illness) {
            collected.push({
                ...definition,
                group: 'illness',
                intensity: illnessIntensity * definition.scale,
            });
        }
    }

    collected.sort((a, b) => b.intensity - a.intensity);
    const conceptsSeen = new Set();
    const symptoms = collected.filter(symptom => {
        if (conceptsSeen.has(symptom.concept)) return false;
        conceptsSeen.add(symptom.concept);
        return true;
    });

    return {
        bg,
        acidRatio,
        weightLossKg,
        groups,
        activeGroups: Object.keys(groups).filter(group => groups[group].active),
        symptoms,
    };
}

/** Fælles driver til de episodiske skærmeffekter på desktop og mobil. */
function resolveSymptomVfxState(sim) {
    const bg = _symptomBG(sim);
    const acidRatio = _symptomAcidosisRatio(sim);
    const brainDeficit = Math.max(0, _symptomNumber(sim && sim.brainEnergyDeficit));
    const glucotoxicLoad = Math.max(0, _symptomNumber(sim && sim.glucotoxicLoad));

    const hypoActive = bg < 3.5 || (brainDeficit > 0 && bg < 4.0);
    const ketoneActive = acidRatio > 0.10;
    const hyperActive = glucotoxicLoad > 5 && bg > 13.0;
    const hypoSeverity = Math.max(
        bg < 3.5 ? _symptomClamp01((3.5 - bg) / 1.5) : 0,
        brainDeficit > 0 && bg < 4.0 ? _symptomClamp01(brainDeficit / 8.0) : 0,
    );
    const ketoneSeverity = ketoneActive ? _symptomClamp01(acidRatio) : 0;
    const hyperSeverity = hyperActive ? Math.min(0.6, glucotoxicLoad / 150) : 0;

    return {
        active: hypoActive || ketoneActive || hyperActive,
        severity: Math.max(hypoSeverity, ketoneSeverity, hyperSeverity),
        hypoActive,
        ketoneActive,
        hyperActive,
        brainDeficit,
        acidRatio,
        bg,
    };
}

function isSymptomGroupActive(sim, group, minimumValue) {
    const state = resolveSymptomState(sim);
    const current = state.groups[group];
    if (!current || !current.active) return false;
    return minimumValue === undefined || current.value >= minimumValue;
}

function countActiveSymptomGroups(sim) {
    return resolveSymptomState(sim).activeGroups.length;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SYMPTOM_DEFINITIONS,
        resolveSymptomState,
        resolveSymptomVfxState,
        isSymptomGroupActive,
        countActiveSymptomGroups,
    };
}
