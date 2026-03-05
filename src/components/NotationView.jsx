import React, { useRef, useEffect } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Beam, GhostNote } from 'vexflow';
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

function stepDuration(subdiv) {
    if (subdiv <= 2) return '8';
    if (subdiv <= 4) return '16';
    return '32';
}

export const NotationView = ({ grid, beats, subdiv, currentStep, mutedTracks }) => {
    const wrapperRef = useRef(null);   // centering + cursor anchor
    const containerRef = useRef(null); // VexFlow target (innerHTML gets cleared)
    const cursorRef = useRef(null);
    const noteXPositions = useRef([]);
    const svgLeftOffset = useRef(0);   // SVG's x offset inside wrapperRef (for centering)

    useEffect(() => {
        if (!containerRef.current || !wrapperRef.current) return;

        // Natural width: grow with step count, never exceed available space
        const availableWidth = wrapperRef.current.offsetWidth || 900;
        const naturalWidth = Math.max(300, beats * subdiv * 30 + 120);
        const staveWidth = Math.min(naturalWidth, availableWidth - 20);

        containerRef.current.innerHTML = '';

        const totalSteps = beats * subdiv;
        const durStr = stepDuration(subdiv);

        const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
        renderer.resize(staveWidth + 20, 180);
        const context = renderer.getContext();

        const stave = new Stave(10, 30, staveWidth);
        stave.addClef('percussion');
        stave.addTimeSignature(`${beats}/4`);
        stave.setContext(context).draw();

        const handsNotes = [];
        const feetNotes = [];

        for (let step = 0; step < totalSteps; step++) {
            const handHits = instruments.filter(
                (inst, idx) => HAND_IDS.has(inst.id) && !mutedTracks[idx] && grid[idx]?.[step]
            );
            if (handHits.length > 0) {
                const rawKeys = handHits.map(i => INST_KEY[i.id]).filter(Boolean);
                const keys = [...new Set(rawKeys)].sort(
                    (a, b) => KEY_PRIORITY.indexOf(a) - KEY_PRIORITY.indexOf(b)
                );
                handsNotes.push(new StaveNote({ keys, duration: durStr, stem_direction: 1 }));
            } else {
                handsNotes.push(new GhostNote({ duration: durStr }));
            }

            const feetHits = instruments.filter(
                (inst, idx) => FEET_IDS.has(inst.id) && !mutedTracks[idx] && grid[idx]?.[step]
            );
            if (feetHits.length > 0) {
                feetNotes.push(new StaveNote({
                    keys: feetHits.map(i => INST_KEY[i.id]).filter(Boolean),
                    duration: durStr,
                    stem_direction: -1,
                }));
            } else {
                feetNotes.push(new GhostNote({ duration: durStr }));
            }
        }

        const handsVoice = new Voice({ num_beats: beats, beat_value: 4 }).setStrict(false);
        handsVoice.addTickables(handsNotes);
        const feetVoice = new Voice({ num_beats: beats, beat_value: 4 }).setStrict(false);
        feetVoice.addTickables(feetNotes);

        new Formatter()
            .joinVoices([handsVoice, feetVoice])
            .format([handsVoice, feetVoice], staveWidth - 60);

        const handsBeams = Beam.applyAndGetBeams(handsVoice, 1);
        const feetBeams = Beam.applyAndGetBeams(feetVoice, -1);

        handsVoice.draw(context, stave);
        feetVoice.draw(context, stave);
        handsBeams.forEach(b => b.setContext(context).draw());
        feetBeams.forEach(b => b.setContext(context).draw());

        // Track SVG's left offset from wrapperRef so the cursor lines up when centered
        const svgEl = containerRef.current.querySelector('svg');
        if (svgEl) {
            const wrapperRect = wrapperRef.current.getBoundingClientRect();
            const svgRect = svgEl.getBoundingClientRect();
            svgLeftOffset.current = svgRect.left - wrapperRect.left;
        }

        noteXPositions.current = handsNotes.map(n => {
            try {
                const x = n.getAbsoluteX();
                return x > 0 ? x : null;
            } catch {
                return null;
            }
        });
    }, [grid, beats, subdiv, mutedTracks]);

    // Update cursor cheaply without re-rendering notation
    useEffect(() => {
        if (!cursorRef.current) return;
        const x = currentStep >= 0 ? noteXPositions.current[currentStep] : null;
        if (x) {
            cursorRef.current.style.display = 'block';
            cursorRef.current.style.left = `${svgLeftOffset.current + x - 4}px`;
        } else {
            cursorRef.current.style.display = 'none';
        }
    }, [currentStep]);

    return (
        <div className="w-full overflow-x-auto">
            {/* wrapperRef: centering container + cursor anchor */}
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
