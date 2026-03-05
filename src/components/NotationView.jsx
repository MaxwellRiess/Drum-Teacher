import React, { useRef, useEffect } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Dot, Tuplet } from 'vexflow';
import { instruments } from '../hooks/useDrumMachine';

const INST_KEY = {
    metronome:    'b/5/x',
    hihat_open:   'a/5/x3',
    hihat_closed: 'a/5/x',
    clap:         'e/5/x',
    snare:        'c/5',
    tom_low:      'a/4',
    kick:         'f/4',
};

const HAND_IDS = new Set(['hihat_open', 'hihat_closed', 'clap', 'snare', 'tom_low']);
const FEET_IDS = new Set(['kick']);
const KEY_PRIORITY = ['b/5/x', 'a/5/x3', 'a/5/x', 'e/5/x', 'c/5', 'a/4', 'f/4'];

// Subdivisions that require triplet notation
const TRIPLET_SUBDIVS = new Set([3, 6]);

// ── Note-value table (standard subdivisions) ─────────────────────────────────
function buildNoteTable(subdiv) {
    const q = subdiv;
    const raw = [
        [4 * q, 'w', 0], [3 * q, 'h', 1], [2 * q, 'h', 0],
        [1.5 * q, 'q', 1], [q, 'q', 0],
        [0.75 * q, '8', 1], [0.5 * q, '8', 0],
        [0.375 * q, '16', 1], [0.25 * q, '16', 0],
        [0.125 * q, '32', 0],
    ];
    const seen = new Set();
    return raw
        .filter(([s]) => Number.isInteger(s) && s > 0 && !seen.has(s) && seen.add(s))
        .map(([steps, dur, dots]) => ({ steps, dur, dots }))
        .sort((a, b) => b.steps - a.steps);
}

function stepsToValues(steps, table) {
    const result = [];
    let rem = steps;
    while (rem > 0) {
        const entry = table.find(e => e.steps <= rem) ?? table[table.length - 1];
        result.push(entry);
        rem -= entry.steps;
        if (rem < 0) break;
    }
    return result;
}

// ── VexFlow helpers ──────────────────────────────────────────────────────────
function makeNote(keys, dur, dots, stemDir) {
    const n = new StaveNote({ keys, duration: dur, stem_direction: stemDir });
    for (let i = 0; i < dots; i++) n.addModifier(new Dot(), 0);
    return n;
}

function makeRest(dur, dots, stemDir) {
    const n = new StaveNote({ keys: ['b/4'], duration: dur + 'r', stem_direction: stemDir });
    for (let i = 0; i < dots; i++) n.addModifier(new Dot(), 0);
    return n;
}

function nextBeatBoundary(step, subdiv, totalSteps) {
    return Math.min(Math.ceil((step + 1) / subdiv) * subdiv, totalSteps);
}

// ── Standard voice builder ───────────────────────────────────────────────────
// Notes get the duration of the gap to the next hit (capped at the beat
// boundary). Silent gaps are filled with proper rest notation.
function buildVoice(hitMap, totalSteps, subdiv, stemDir, table) {
    const tickables  = [];
    const hitIndices = new Map();

    const push = t => { tickables.push(t); return tickables.length - 1; };

    const addRests = (from, to) => {
        let pos = from;
        for (const { dur, dots, steps } of stepsToValues(to - from, table)) {
            push(makeRest(dur, dots, stemDir));
            pos += steps;
        }
    };

    const hitSteps = Array.from(hitMap.keys()).sort((a, b) => a - b);
    let i = 0;

    while (i < totalSteps) {
        if (hitMap.has(i)) {
            const nextHit = hitSteps.find(s => s > i) ?? totalSteps;
            const cap = nextBeatBoundary(i, subdiv, totalSteps);
            const dur = Math.min(nextHit - i, cap - i);
            const [{ dur: d, dots, steps }] = stepsToValues(dur, table);

            hitIndices.set(i, push(makeNote(hitMap.get(i), d, dots, stemDir)));

            i += steps;
            if (i < nextHit) { addRests(i, nextHit); i = nextHit; }
        } else {
            const nextHit = hitSteps.find(s => s > i) ?? totalSteps;
            addRests(i, nextHit);
            i = nextHit;
        }
    }

    return { tickables, hitIndices };
}

// ── Triplet voice builder ────────────────────────────────────────────────────
// One note or rest per step; groups of 3 are wrapped in VexFlow Tuplets.
// subdiv=3 → triplet 8th notes (3 per beat)
// subdiv=6 → triplet 16th notes (6 per beat, two triplet brackets per beat)
function buildTripletVoice(hitMap, totalSteps, subdiv, stemDir) {
    const baseDur   = subdiv === 3 ? '8' : '16';
    const tickables = [];
    const hitIndices = new Map();
    const isRestArr  = [];

    for (let step = 0; step < totalSteps; step++) {
        if (hitMap.has(step)) {
            hitIndices.set(step, tickables.length);
            tickables.push(makeNote(hitMap.get(step), baseDur, 0, stemDir));
            isRestArr.push(false);
        } else {
            tickables.push(makeRest(baseDur, 0, stemDir));
            isRestArr.push(true);
        }
    }

    // Tuplets: every 3 consecutive steps form one triplet bracket
    const location = stemDir === 1 ? 1 : -1; // 1=above, -1=below
    const tuplets = [];
    for (let i = 0; i < totalSteps; i += 3) {
        const group = tickables.slice(i, Math.min(i + 3, totalSteps));
        if (group.length === 3) {
            tuplets.push(new Tuplet(group, { num_notes: 3, notes_occupied: 2, location }));
        }
    }

    // Manual beams: within each triplet bracket, beam adjacent non-rest notes
    const beams = [];
    for (let i = 0; i < totalSteps; i += 3) {
        const toBeam = [];
        for (let j = i; j < Math.min(i + 3, totalSteps); j++) {
            if (!isRestArr[j]) toBeam.push(tickables[j]);
        }
        if (toBeam.length >= 2) {
            try { beams.push(new Beam(toBeam, false)); } catch { /* ignore */ }
        }
    }

    return { tickables, hitIndices, tuplets, beams };
}

// ── Component ────────────────────────────────────────────────────────────────
export const NotationView = ({ grid, beats, subdiv, currentStep, mutedTracks }) => {
    const wrapperRef    = useRef(null);
    const containerRef  = useRef(null);
    const cursorRef     = useRef(null);
    const stepXRef      = useRef([]);
    const svgLeftOffset = useRef(0);

    useEffect(() => {
        if (!containerRef.current || !wrapperRef.current) return;

        const availableWidth = wrapperRef.current.offsetWidth || 900;
        const naturalWidth   = Math.max(300, beats * subdiv * 30 + 120);
        const staveWidth     = Math.min(naturalWidth, availableWidth - 20);

        containerRef.current.innerHTML = '';

        const totalSteps = beats * subdiv;
        const isTriplet  = TRIPLET_SUBDIVS.has(subdiv);
        const table      = isTriplet ? null : buildNoteTable(subdiv);

        const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
        renderer.resize(staveWidth + 20, 180);
        const ctx = renderer.getContext();

        const stave = new Stave(10, 30, staveWidth);
        stave.addClef('percussion');
        stave.addTimeSignature(`${beats}/4`);
        stave.setContext(ctx).draw();

        // ── Collect hits ─────────────────────────────────────────────────────
        const handHits = new Map();
        const feetHits = new Map();

        for (let step = 0; step < totalSteps; step++) {
            const hi = instruments.filter(
                (inst, idx) => HAND_IDS.has(inst.id) && !mutedTracks[idx] && grid[idx]?.[step]
            );
            if (hi.length > 0) {
                const keys = [...new Set(hi.map(i => INST_KEY[i.id]).filter(Boolean))]
                    .sort((a, b) => KEY_PRIORITY.indexOf(a) - KEY_PRIORITY.indexOf(b));
                handHits.set(step, keys);
            }
            const fi = instruments.filter(
                (inst, idx) => FEET_IDS.has(inst.id) && !mutedTracks[idx] && grid[idx]?.[step]
            );
            if (fi.length > 0)
                feetHits.set(step, fi.map(i => INST_KEY[i.id]).filter(Boolean));
        }

        // ── Build voices ─────────────────────────────────────────────────────
        let hTick, hIdx, hTuplets = [], hPreBeams = null;
        let fTick, fIdx, fTuplets = [], fPreBeams = null;

        if (isTriplet) {
            ({ tickables: hTick, hitIndices: hIdx, tuplets: hTuplets, beams: hPreBeams } =
                buildTripletVoice(handHits, totalSteps, subdiv, 1));
            ({ tickables: fTick, hitIndices: fIdx, tuplets: fTuplets, beams: fPreBeams } =
                buildTripletVoice(feetHits, totalSteps, subdiv, -1));
        } else {
            ({ tickables: hTick, hitIndices: hIdx } =
                buildVoice(handHits, totalSteps, subdiv, 1, table));
            ({ tickables: fTick, hitIndices: fIdx } =
                buildVoice(feetHits, totalSteps, subdiv, -1, table));
        }

        const hVoice = new Voice({ num_beats: beats, beat_value: 4 }).setStrict(false);
        hVoice.addTickables(hTick);
        const fVoice = new Voice({ num_beats: beats, beat_value: 4 }).setStrict(false);
        fVoice.addTickables(fTick);

        new Formatter()
            .joinVoices([hVoice, fVoice])
            .format([hVoice, fVoice], staveWidth - 60);

        // Beams: auto for standard, manual for triplet
        const hBeams = isTriplet ? hPreBeams : Beam.applyAndGetBeams(hVoice,  1);
        const fBeams = isTriplet ? fPreBeams : Beam.applyAndGetBeams(fVoice, -1);

        hVoice.draw(ctx, stave);
        fVoice.draw(ctx, stave);
        hBeams.forEach(b => b.setContext(ctx).draw());
        fBeams.forEach(b => b.setContext(ctx).draw());
        hTuplets.forEach(t => t.setContext(ctx).draw());
        fTuplets.forEach(t => t.setContext(ctx).draw());

        // ── SVG offset for cursor ─────────────────────────────────────────────
        const svgEl = containerRef.current.querySelector('svg');
        if (svgEl) {
            const wr = wrapperRef.current.getBoundingClientRect();
            svgLeftOffset.current = svgEl.getBoundingClientRect().left - wr.left;
        }

        // ── Cursor X positions ────────────────────────────────────────────────
        // Only use actual hit-note positions (never rest positions, since VexFlow
        // places whole/half rests at fixed stave locations unrelated to step timing).
        // Forward-fill through silent regions.
        const stepX = new Array(totalSteps).fill(null);

        for (const [step, idx] of hIdx) {
            try { const x = hTick[idx].getAbsoluteX(); if (x > 0) stepX[step] = x; }
            catch { /* ignore */ }
        }
        for (const [step, idx] of fIdx) {
            if (stepX[step] === null) {
                try { const x = fTick[idx].getAbsoluteX(); if (x > 0) stepX[step] = x; }
                catch { /* ignore */ }
            }
        }
        let lastX = null;
        for (let s = 0; s < totalSteps; s++) {
            if (stepX[s] !== null) { lastX = stepX[s]; }
            else if (lastX !== null) { stepX[s] = lastX; }
        }
        stepXRef.current = stepX;
    }, [grid, beats, subdiv, mutedTracks]);

    useEffect(() => {
        if (!cursorRef.current) return;
        const x = stepXRef.current[currentStep];
        if (x) {
            cursorRef.current.style.display = 'block';
            cursorRef.current.style.left = `${svgLeftOffset.current + x - 4}px`;
        } else {
            cursorRef.current.style.display = 'none';
        }
    }, [currentStep]);

    return (
        <div className="w-full overflow-x-auto">
            <div ref={wrapperRef} className="relative flex justify-center">
                <div ref={containerRef} />
                <div
                    ref={cursorRef}
                    style={{
                        position: 'absolute', top: '10px', height: '160px',
                        width: '2px', backgroundColor: '#f43f5e',
                        opacity: 0.8, pointerEvents: 'none', display: 'none',
                    }}
                />
            </div>
        </div>
    );
};
