// =============================================================================
// SOUNDS.JS — Audio feedback system using Tone.js
// =============================================================================
//
// This file sets up all sound effects for the game using the Tone.js library
// (loaded from CDN in index.html). Sounds provide auditory feedback for game
// events like eating, injecting insulin, entering bonus BG range, and game over.
//
// Tone.js is a Web Audio framework that lets you create synthesizers in the
// browser. Each "synth" is like a virtual instrument with configurable
// waveform shape (sine, triangle, square) and amplitude envelope (ADSR:
// attack, decay, sustain, release — controls how the volume changes over time).
//
// If Tone.js fails to load (e.g., browser blocks audio), sounds are disabled
// gracefully and the game runs silently.
//
// Dependencies: Tone.js (global, loaded via CDN before this file)
// Exports (global): isMuted, sounds, playSound()
// =============================================================================

// --- Sound State ---
// Global flag to mute/unmute all sounds. Toggled by the mute button in the UI.
let isMuted = false;

// --- Tone.js Sound Setup ---
// Each property is a different synthesizer for a different type of game event.
// The try/catch ensures the game still works if audio initialization fails
// (e.g., if the browser hasn't received a user gesture yet, or Tone.js CDN is down).
let sounds = {};
try {
    // Tick sound: plays every CGM update at high simulation speeds (>=240x).
    // MembraneSynth simulates a drum-like percussive hit — short and unobtrusive.
    // pitchDecay: how fast the pitch drops (like a drum skin vibrating slower)
    // octaves: range of the pitch sweep
    sounds.tickSynth = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.2, sustain: 0 }, volume: -6 }).toDestination();

    // Intervention sound: plays when the player takes an action (eat, inject, exercise).
    // Triangle wave is softer than a square wave — pleasant for frequent feedback.
    // The note and duration are configurable per event (passed to playSound()).
    sounds.interventionSynth = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 }, volume: -12 }).toDestination();

    // Bonus sound: plays when BG enters the tight "bonus range" (5.0-6.0 mmol/L).
    // Sine wave is the purest tone — a brief, rewarding "ping".
    sounds.bonusSynth = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }, volume: -10 }).toDestination();

    // Game over sound: plays a descending three-note sequence (G3 → E3 → C3).
    // FMSynth uses frequency modulation for a richer, more dramatic timbre.
    // harmonicity: ratio of modulator to carrier frequency (8 = very harmonically rich)
    // modulationIndex: depth of FM — higher = more complex/buzzy timbre
    sounds.gameOverSynth = new Tone.FMSynth({
        harmonicity: 8, modulationIndex: 2, oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.5, release: 1 },
        modulation: { type: "square" },
        modulationEnvelope: { attack: 0.01, decay: 0.2, release: 0.1 }
    }).toDestination();
} catch (e) {
    // If Tone.js can't initialize (missing library, audio context blocked, etc.),
    // set sounds to null. playSound() checks for this and becomes a no-op.
    console.error("Tone.js initialization failed.", e);
    sounds = null;
}

/**
 * playSound — Triggers a sound effect for a given game event type.
 *
 * @param {string} type      - The event type: 'tick', 'bonus', 'intervention', or 'gameOver'
 * @param {string} note      - Musical note in scientific pitch notation (e.g., 'C4', 'A5').
 *                              Only used for 'intervention' type. Default: 'C4'
 * @param {string} duration  - Tone.js duration string (e.g., '8n' = eighth note, '16n' = sixteenth).
 *                              Only used for 'intervention' type. Default: '8n'
 *
 * Note names follow the pattern: letter (A-G) + optional # + octave number.
 * Higher octave = higher pitch. Middle C is C4. A4 = 440 Hz (concert pitch).
 *
 * Duration notation: '4n' = quarter note, '8n' = eighth note, '16n' = sixteenth note, etc.
 * These are relative to the Tone.js transport tempo (defaults to 120 BPM).
 */
function playSound(type, note = 'C4', duration = '8n') {
    // Early exit if muted or if Tone.js failed to initialize
    if (isMuted || !sounds) return;
    try {
        // Tone.now() returns the current audio context time in seconds.
        // All triggerAttackRelease calls are scheduled relative to this time
        // to ensure precise synchronization.
        const now = Tone.now();

        if (type === 'tick' && sounds.tickSynth) sounds.tickSynth.triggerAttackRelease("C2", "32n", now);
        else if (type === 'bonus' && sounds.bonusSynth) sounds.bonusSynth.triggerAttackRelease("A5", "16n", now);
        else if (type === 'intervention' && sounds.interventionSynth) sounds.interventionSynth.triggerAttackRelease(note, duration, now);
        else if (type === 'gameOver' && sounds.gameOverSynth) {
            // Descending three-note sequence with 100ms spacing between notes.
            // G3 → E3 → C3 creates a minor-feel "failure" motif.
            sounds.gameOverSynth.triggerAttackRelease("G3", "8n", now);
            sounds.gameOverSynth.triggerAttackRelease("E3", "8n", now + 0.1);
            sounds.gameOverSynth.triggerAttackRelease("C3", "4n", now + 0.2);
        }
    } catch (e) { console.warn("Error playing sound:", type, e); }
}
