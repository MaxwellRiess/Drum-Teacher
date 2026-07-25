// MIDI note → instrument mapping.
//
// Aerodrums stays close to General MIDI but sends extra notes that GM has no
// slot for: separate articulations for snare head vs rim, hi-hat bow vs edge,
// and so on. It is also user-remappable in the Aerodrums software. So these are
// starting guesses only — the learn mode in the practice panel is the reliable
// way to get this right, and the result is persisted per browser.
//
// Each instrument maps to an *array* of notes, so both articulations of a drum
// (snare head and rim, say) can count as a hit on the same track.

import { instruments } from '../hooks/useDrumMachine';

const STORAGE_KEY = 'drumTeacher.midiMap.v1';

export const DEFAULT_MIDI_MAP = {
    metronome: [],              // click track, never played by the drummer
    hihat_open: [46, 26],       // GM open hi-hat; Aerodrums also reports bow as 26
    hihat_closed: [42, 44],     // closed hi-hat; 44 is pedal hi-hat
    clap: [39],
    snare: [38, 40],            // head and rim
    tom_low: [45, 41, 43],      // low / low-floor / high-floor tom
    kick: [36, 35],
};

export function loadMidiMap() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_MIDI_MAP };
        const parsed = JSON.parse(raw);
        // Merge over the defaults so a new instrument added to the app later
        // doesn't come back undefined for someone with a saved map.
        const merged = { ...DEFAULT_MIDI_MAP };
        for (const inst of instruments) {
            if (Array.isArray(parsed[inst.id])) merged[inst.id] = parsed[inst.id];
        }
        return merged;
    } catch {
        return { ...DEFAULT_MIDI_MAP };
    }
}

export function saveMidiMap(map) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch { /* private browsing / quota — mapping just won't persist */ }
}

// Inverts the map into note → instrument index for O(1) lookup on the hot path.
// A note assigned to two instruments resolves to the first one listed.
export function buildNoteLookup(map) {
    const lookup = new Map();
    instruments.forEach((inst, idx) => {
        for (const note of map[inst.id] ?? []) {
            if (!lookup.has(note)) lookup.set(note, idx);
        }
    });
    return lookup;
}

// Assigns a note to one instrument, removing it from any other so a single pad
// can never register as two different drums.
export function assignNote(map, instrumentId, note) {
    const next = {};
    for (const [id, notes] of Object.entries(map)) {
        next[id] = notes.filter(n => n !== note);
    }
    next[instrumentId] = [...(next[instrumentId] ?? []), note].sort((a, b) => a - b);
    return next;
}

export function clearInstrument(map, instrumentId) {
    return { ...map, [instrumentId]: [] };
}
