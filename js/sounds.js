// --- Sound State ---
let isMuted = false;

// --- Tone.js Sound Setup ---
let sounds = {};
try {
    sounds.tickSynth = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.2, sustain: 0 }, volume: -6 }).toDestination();
    sounds.interventionSynth = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 }, volume: -12 }).toDestination();
    sounds.bonusSynth = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }, volume: -10 }).toDestination();
    sounds.gameOverSynth = new Tone.FMSynth({
        harmonicity: 8, modulationIndex: 2, oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.5, release: 1 },
        modulation: { type: "square" },
        modulationEnvelope: { attack: 0.01, decay: 0.2, release: 0.1 }
    }).toDestination();
} catch (e) {
    console.error("Tone.js initialization failed.", e);
    sounds = null;
}

function playSound(type, note = 'C4', duration = '8n') {
    if (isMuted || !sounds) return;
    try {
        const now = Tone.now();
        if (type === 'tick' && sounds.tickSynth) sounds.tickSynth.triggerAttackRelease("C2", "32n", now);
        else if (type === 'bonus' && sounds.bonusSynth) sounds.bonusSynth.triggerAttackRelease("A5", "16n", now);
        else if (type === 'intervention' && sounds.interventionSynth) sounds.interventionSynth.triggerAttackRelease(note, duration, now);
        else if (type === 'gameOver' && sounds.gameOverSynth) {
            sounds.gameOverSynth.triggerAttackRelease("G3", "8n", now);
            sounds.gameOverSynth.triggerAttackRelease("E3", "8n", now + 0.1);
            sounds.gameOverSynth.triggerAttackRelease("C3", "4n", now + 0.2);
        }
    } catch (e) { console.warn("Error playing sound:", type, e); }
}
