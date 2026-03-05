import React, { useRef, useEffect } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Beam, Dot } from 'vexflow';
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

const HAND_IDS = new Set(['metronome', 'hihat_open', 'hihat_closed', 'clap', 'snare', 'tom_low']);
const FEET_IDS = new Set(['kick']);
const KEY_PRIORITY = ['b/5/x', 'a/5/x3', 'a/5/x', 'e/5/x', 'c/5', 'a/4', 'f/4'];

// Build lookup table: step counts → { dur, dots } for a given subdiv
function buildNoteTable(subdiv) {
    const q = subdiv; // steps per quarter note
    const entries = [];

    const add = (steps, dur, dots) => {
        if (Number.isInteger(steps) && steps > 0) entries.push({ steps, dur, dots });
    };

    add(4 * q,        'w',   0); // whole
    add(3 * q,        'h',   1); // dotted half
    add(2 * q,        'h',   0); // half
    add(1.5 * q,      'q',   1); // dotted quarter
    add(q,            'q',   0); // quarter
    add(0.75 * q,     '8',   1); // dotted 8th
    add(0.5 * q,      '8',   0); // 8th
    add(0.375 * q,    '16',  1); // dotted 16th
    add(0.25 * q,     '16',  0); // 16th
    add(0.125 * q,    '32',  0); // 32nd

    // Deduplicate by step count (keep first), sort largest first
    const seen = new Set();
    return entries
        .filter(e => { if (seen.has(e.steps)) return false; seen.add(e.steps); return true; })
        .sort((a, b) => b.steps - a.steps);
}

// Greedy decomposition: steps → [{dur, dots, steps}]
function stepsToValues(steps, table) {
    const result = [];
    let remaining = steps;
    while (remaining > 0) {
        const entry = table.find(e => e.steps <= remaining);
        if (!entry) {
            // Fallback: smallest entry in table
            const smallest = table[table.length - 1];
            result.push(smallest);
            remaining -= smallest.steps;
        } else {
            result.push(entry);
            remaining -= entry.steps;
        }
        if (remaining < 0) break; // safety
    }
    return result;
}

function makeNote(keys, dur, dots, stemDir) {
    const n = new StaveNote({ keys, duration: dur, stem_direction: stemDir });
    for (let i = 0; i < dots; i++) n.addModifier(new Dot(), 0);
    return n;
}

function makeRest(dur, dots, stemDir) {
    // 'b/4' is a neutral rest position on a percussion stave
    const n = new StaveNote({ keys: ['b/4'], duration: dur + 'r', stem_direction: stemDir });
    for (let i = 0; i < dots; i++) n.addModifier(new Dot(), 0);
    return n;
}

// Next beat boundary strictly after `step`
function nextBeat(step, subdiv, totalSteps) {
    return Math.min(Math.ceil((step + 1) / subdiv) * subdiv, totalSteps);
}

/**
 * Build one VexFlow voice from a hit map.
 * Returns { tickables, stepIndex } where stepIndex maps each step to the
 * index of the tickable that covers it (for cursor tracking).
 */
function buildVoice(hitMap, totalSteps, subdiv, stemDir, table) {
    const tickables = [];
    const stepIndex = new Map(); // step → tickable index

    const push = (tickable, startStep, stepCount) => {
        const idx = tickables.length;
        tickables.push(tickable);
        for (let s = startStep; s < Math.min(startStep + stepCount, totalSteps); s++) {
            stepIndex.set(s, idx);
        }
    };

    const addRests = (from, to) => {
        const values = stepsToValues(to - from, table);
        let pos = from;
        for (const { dur, dots, steps } of values) {
            push(makeRest(dur, dots, stemDir), pos, steps);
            pos += steps;
        }
    };

    const hitSteps = Array.from(hitMap.keys()).sort((a, b) => a - b);
    let i = 0;

    while (i < totalSteps) {
        if (hitMap.has(i)) {
            const nextHit = hitSteps.find(s => s > i) ?? totalSteps;

            // Cap note duration at the beat boundary so notes never span beats
            const cap = nextBeat(i, subdiv, totalSteps);
            const noteDur = Math.min(nextHit - i, cap - i);
            const [{ dur, dots, steps }] = stepsToValues(noteDur, table);

            push(makeNote(hitMap.get(i), dur, dots, stemDir), i, steps);
            i += steps;

            // Fill any gap between end of note and next hit with rests
            if (i < nextHit) {
                addRests(i, nextHit);
                i = nextHit;
            }
        } else {
            const nextHit = hitSteps.find(s => s > i) ?? totalSteps;
            addRests(i, nextHit);
            i = nextHit;
        }
    }

    return { tickables, stepIndex };
}

export const NotationView = ({ grid, beats, subdiv, currentStep, mutedTracks }) => {
    const wrapperRef   = useRef(null);
    const containerRef = useRef(null);
    const cursorRef    = useRef(null);
    const handsRef     = useRef([]);       // tickables array after draw
    const stepIndexRef = useRef(new Map()); // step → tickable index
    const svgLeftOffset = useRef(0);

    useEffect(() => {
        if (!containerRef.current || !wrapperRef.current) return;

        const availableWidth = wrapperRef.current.offsetWidth || 900;
        const naturalWidth   = Math.max(300, beats * subdiv * 30 + 120);
        const staveWidth     = Math.min(naturalWidth, availableWidth - 20);

        containerRef.current.innerHTML = '';

        const totalSteps = beats * subdiv;
        const table      = buildNoteTable(subdiv);

        const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
        renderer.resize(staveWidth + 20, 180);
        const context = renderer.getContext();

        const stave = new Stave(10, 30, staveWidth);
        stave.addClef('percussion');
        stave.addTimeSignature(`${beats}/4`);
        stave.setContext(context).draw();

        // Collect hits per voice
        const handHits = new Map();
        const feetHits = new Map();

        for (let step = 0; step < totalSteps; step++) {
            const handInsts = instruments.filter(
                (inst, idx) => HAND_IDS.has(inst.id) && !mutedTracks[idx] && grid[idx]?.[step]
            );
            if (handInsts.length > 0) {
                const keys = [...new Set(handInsts.map(i => INST_KEY[i.id]).filter(Boolean))]
                    .sort((a, b) => KEY_PRIORITY.indexOf(a) - KEY_PRIORITY.indexOf(b));
                handHits.set(step, keys);
            }

            const feetInsts = instruments.filter(
                (inst, idx) => FEET_IDS.has(inst.id) && !mutedTracks[idx] && grid[idx]?.[step]
            );
            if (feetInsts.length > 0) {
                const keys = feetInsts.map(i => INST_KEY[i.id]).filter(Boolean);
                feetHits.set(step, keys);
            }
        }

        const { tickables: handsTick, stepIndex: handsStepIdx } =
            buildVoice(handHits, totalSteps, subdiv, 1, table);
        const { tickables: feetTick } =
            buildVoice(feetHits, totalSteps, subdiv, -1, table);

        const handsVoice = new Voice({ num_beats: beats, beat_value: 4 }).setStrict(false);
        handsVoice.addTickables(handsTick);
        const feetVoice = new Voice({ num_beats: beats, beat_value: 4 }).setStrict(false);
        feetVoice.addTickables(feetTick);

        new Formatter()
            .joinVoices([handsVoice, feetVoice])
            .format([handsVoice, feetVoice], staveWidth - 60);

        const handsBeams = Beam.applyAndGetBeams(handsVoice, 1);
        const feetBeams  = Beam.applyAndGetBeams(feetVoice, -1);

        handsVoice.draw(context, stave);
        feetVoice.draw(context, stave);
        handsBeams.forEach(b => b.setContext(context).draw());
        feetBeams.forEach(b => b.setContext(context).draw());

        // Track SVG offset for cursor positioning
        const svgEl = containerRef.current.querySelector('svg');
        if (svgEl) {
            const wrapperRect = wrapperRef.current.getBoundingClientRect();
            const svgRect     = svgEl.getBoundingClientRect();
            svgLeftOffset.current = svgRect.left - wrapperRect.left;
        }

        handsRef.current    = handsTick;
        stepIndexRef.current = handsStepIdx;
    }, [grid, beats, subdiv, mutedTracks]);

    // Cheap cursor update — no notation re-render
    useEffect(() => {
        if (!cursorRef.current) return;
        const idx = stepIndexRef.current.get(currentStep);
        if (idx !== undefined) {
            try {
                const x = handsRef.current[idx]?.getAbsoluteX();
                if (x > 0) {
                    cursorRef.current.style.display = 'block';
                    cursorRef.current.style.left = `${svgLeftOffset.current + x - 4}px`;
                    return;
                }
            } catch { /* ignore */ }
        }
        cursorRef.current.style.display = 'none';
    }, [currentStep]);

    return (
        <div className="w-full overflow-x-auto">
            <div ref={wrapperRef} className="relative flex justify-center">
                <div ref={containerRef} />
                <div
                    ref={cursorRef}
                    style={{
                        position: 'absolute',
                        top: '10px',
                        height: '160px',
                        width: '2px',
                        backgroundColor: '#f43f5e',
                        opacity: 0.8,
                        pointerEvents: 'none',
                        display: 'none',
                    }}
                />
            </div>
        </div>
    );
};
