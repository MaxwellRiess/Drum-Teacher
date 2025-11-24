import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Pause, RefreshCw, Volume2, VolumeX, Grid, Clock, Settings, Trash2, Plus, Minus, Music, Sparkles, X, Loader2, Download, BookOpen, Circle } from 'lucide-react';

// --- Audio Engine (Web Audio API) ---

const createAudioContext = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    return new AudioContext();
};

class DrumSynth {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = createAudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playKick(time) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

        osc.start(time);
        osc.stop(time + 0.5);
    }

    playSnare(time) {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        const noiseGain = this.ctx.createGain();

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noiseGain.gain.setValueAtTime(0.8, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
        noise.start(time);

        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.frequency.value = 200;
        oscGain.gain.setValueAtTime(0.5, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        osc.start(time);
        osc.stop(time + 0.2);
    }

    playHiHat(time, open = false) {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7000;

        const gain = this.ctx.createGain();

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.setValueAtTime(0.6, time);
        const decay = open ? 0.4 : 0.05;
        gain.gain.exponentialRampToValueAtTime(0.01, time + decay);

        noise.start(time);
    }

    playTom(time, pitch = 100) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.frequency.setValueAtTime(pitch, time);
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, time + 0.4);
        gain.gain.setValueAtTime(0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

        osc.start(time);
        osc.stop(time + 0.4);
    }

    playClap(time) {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1500;

        const gain = this.ctx.createGain();
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.setValueAtTime(0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

        noise.start(time);
    }

    playWoodblock(time) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        // High pitched sine wave with short decay
        osc.frequency.setValueAtTime(800, time);
        gain.gain.setValueAtTime(1.0, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        osc.start(time);
        osc.stop(time + 0.1);
    }
}

// --- Components ---

// Instruments mapping
const instruments = [
    { id: 'metronome', name: 'Metronome', icon: Clock, color: 'bg-slate-500', y: -15, symbol: 'triangle', voice: 0 }, // High above
    { id: 'hihat_open', name: 'Hihat Op', icon: Circle, color: 'bg-emerald-500', y: -5, symbol: 'cross_circle', voice: 0 }, // Above top line
    { id: 'hihat_closed', name: 'Hihat Cl', icon: Circle, color: 'bg-emerald-600', y: -5, symbol: 'cross', voice: 0 }, // Above top line
    { id: 'clap', name: 'Clap', icon: Sparkles, color: 'bg-pink-500', y: 15, symbol: 'x', voice: 0 }, // Middle
    { id: 'snare', name: 'Snare', icon: Square, color: 'bg-amber-500', y: 15, symbol: 'circle', voice: 0 }, // 2nd space from top (C)
    { id: 'tom_low', name: 'Tom Low', icon: Circle, color: 'bg-violet-500', y: 25, symbol: 'circle', voice: 0 }, // 2nd space from bottom (A)
    { id: 'kick', name: 'Kick', icon: Square, color: 'bg-rose-500', y: 45, symbol: 'circle', voice: 1 }, // Below bottom line (F)
];

const DEFAULT_BPM = 110;
const DEFAULT_BEATS = 4;
const DEFAULT_SUBDIV = 4; // 16th notes
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

const RUDIMENTS = [
    {
        id: 'single_stroke',
        name: 'Single Stroke Roll',
        sticking: ['R', 'L', 'R', 'L', 'R', 'L', 'R', 'L', 'R', 'L', 'R', 'L', 'R', 'L', 'R', 'L'],
        description: 'Alternating single strokes. The foundation of all drumming.'
    },
    {
        id: 'double_stroke',
        name: 'Double Stroke Roll',
        sticking: ['R', 'R', 'L', 'L', 'R', 'R', 'L', 'L', 'R', 'R', 'L', 'L', 'R', 'R', 'L', 'L'],
        description: 'Alternating double strokes. Essential for smooth rolls.'
    },
    {
        id: 'paradiddle',
        name: 'Single Paradiddle',
        sticking: ['R', 'L', 'R', 'R', 'L', 'R', 'L', 'L', 'R', 'L', 'R', 'R', 'L', 'R', 'L', 'L'],
        description: 'Combination of single and double strokes.'
    },
    {
        id: 'double_paradiddle',
        name: 'Double Paradiddle',
        sticking: ['R', 'L', 'R', 'L', 'R', 'R', 'L', 'R', 'L', 'R', 'L', 'L'],
        description: 'Two single strokes followed by a double stroke.'
    },
    {
        id: 'triple_paradiddle',
        name: 'Triple Paradiddle',
        sticking: ['R', 'L', 'R', 'L', 'R', 'L', 'R', 'R', 'L', 'R', 'L', 'R', 'L', 'R', 'L', 'L'],
        description: 'Three single strokes followed by a double stroke.'
    },
    {
        id: 'paradiddle_diddle',
        name: 'Paradiddle-Diddle',
        sticking: ['R', 'L', 'R', 'R', 'L', 'L', 'R', 'L', 'R', 'R', 'L', 'L'],
        description: 'A paradiddle followed by a double stroke. Great for 6/8 time.'
    },
    {
        id: 'five_stroke',
        name: 'Five Stroke Roll',
        sticking: ['R', 'R', 'L', 'L', 'R', null, null, null],
        description: 'Two doubles followed by an accent.'
    },
    {
        id: 'six_stroke',
        name: 'Six Stroke Roll',
        sticking: ['R', 'L', 'L', 'R', 'R', 'L', null, null],
        description: 'Single, two doubles, single. (Adapted for 16ths)'
    },
    {
        id: 'single_stroke_four',
        name: 'Single Stroke Four',
        sticking: ['R', 'L', 'R', 'L', null, null, null, null],
        description: 'Four single strokes followed by rests.'
    }
];

// SVG Notation Component
const NotationView = ({ grid, beats, subdiv, currentStep, mutedTracks }) => {
    const stepWidth = 30;
    const totalWidth = grid[0].length * stepWidth + 40; // Padding
    const staveY = 50;
    const staveHeight = 40; // 4 spaces of 10px

    // Generate Stave Lines (5 lines)
    const staveLines = [0, 10, 20, 30, 40].map(y => (
        <line
            key={y}
            x1="10"
            y1={staveY + y}
            x2={totalWidth}
            y2={staveY + y}
            stroke="#94a3b8"
            strokeWidth="1"
        />
    ));

    // Rest SVG Paths
    const QuarterRest = ({ x, y }) => (
        <path d={`M${x} ${y} l2 -4 l3 4 l-2 6 l2 4 l-1 2 c-1 2 -3 2 -4 0`} stroke="currentColor" strokeWidth="2" fill="none" transform="scale(0.8) translate(2,0)" />
    );

    const EighthRest = ({ x, y }) => (
        <circle cx={x} cy={y} r="2.5" fill="currentColor" />
    );
    // Actually standard 8th rest is a 7-like shape with a bead. Let's try a path.
    const EighthRestPath = ({ x, y }) => (
        <path d={`M${x} ${y + 4} l4 -8 q2 -2 0 -4 q-2 -2 -4 0`} stroke="currentColor" strokeWidth="2" fill="none" />
    );
    // Let's use a simpler representation or standard path.
    // 8th rest: dot at top left, line down and right.
    const RestEighth = ({ x, y }) => (
        <g transform={`translate(${x}, ${y}) scale(0.8)`}>
            <circle cx="2" cy="4" r="2.5" fill="currentColor" />
            <path d="M4 4 L8 12 L4 18" stroke="currentColor" strokeWidth="2" fill="none" />
        </g>
    );

    const RestSixteenth = ({ x, y }) => (
        <g transform={`translate(${x}, ${y}) scale(0.8)`}>
            <circle cx="2" cy="0" r="2.5" fill="currentColor" />
            <path d="M4 0 L8 8" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="0" cy="8" r="2.5" fill="currentColor" />
            <path d="M2 8 L8 16 L4 22" stroke="currentColor" strokeWidth="2" fill="none" />
        </g>
    );

    const RestQuarter = ({ x, y }) => (
        <path
            d={`M${x + 2} ${y} l3 -6 l4 6 l-3 8 l3 6 l-1 3 c-1 2 -4 2 -5 0`}
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            transform="scale(0.9)"
        />
    );

    // Group notes by beat for beaming
    const renderNotes = () => {
        const notes = [];
        const voices = [0, 1]; // 0: Hands (Up), 1: Feet (Down)

        voices.forEach(voice => {
            // Iterate through beats
            for (let b = 0; b < beats; b++) {
                // Analyze beat content for this voice
                let notesInBeat = [];
                for (let s = 0; s < subdiv; s++) {
                    const globalStep = b * subdiv + s;
                    // Check if ANY instrument in this voice is active at this step
                    const hasNote = instruments.some((inst, idx) =>
                        (inst.voice === undefined ? 0 : inst.voice) === voice &&
                        !mutedTracks[idx] && grid[idx] && grid[idx][globalStep]
                    );
                    if (hasNote) {
                        notesInBeat.push({ s, globalStep });
                    }
                }

                const beatStartX = 20 + (b * subdiv * stepWidth);
                const restY = voice === 0 ? staveY + 15 : staveY + 35; // Hands high, Feet low

                // Logic for Rests
                if (notesInBeat.length === 0) {
                    // Empty Beat -> Quarter Rest
                    notes.push(<RestQuarter key={`rest-q-${voice}-${b}`} x={beatStartX + 10} y={restY} />);
                } else {
                    // Check for leading rests (gaps before first note)
                    const firstNoteS = notesInBeat[0].s;
                    if (firstNoteS > 0) {
                        // If first note is at s=1 (e of 1) -> 16th rest at s=0
                        if (firstNoteS === 1) {
                            notes.push(<RestSixteenth key={`rest-16-${voice}-${b}-0`} x={beatStartX} y={restY} />);
                        }
                        // If first note is at s=2 (and of 1) -> 8th rest at s=0
                        else if (firstNoteS === 2) {
                            notes.push(<RestEighth key={`rest-8-${voice}-${b}-0`} x={beatStartX} y={restY} />);
                        }
                        // If first note is at s=3 (a of 1) -> 8th rest at s=0 + 16th rest at s=2
                        else if (firstNoteS === 3) {
                            notes.push(<RestEighth key={`rest-8-${voice}-${b}-0`} x={beatStartX} y={restY} />);
                            notes.push(<RestSixteenth key={`rest-16-${voice}-${b}-2`} x={beatStartX + (2 * stepWidth)} y={restY} />);
                        }
                    }

                    // Note: Trailing rests are implicit in standard notation usually, or handled by duration dots.
                    // We won't implement trailing rests for now to keep it clean, unless requested.
                }

                // Calculate durations (per voice!)
                notesInBeat = notesInBeat.map((note, i) => {
                    const nextNoteS = notesInBeat[i + 1] ? notesInBeat[i + 1].s : subdiv;
                    return { ...note, duration: nextNoteS - note.s };
                });

                // Draw Notes & Stems
                notesInBeat.forEach((note) => {
                    const { s, globalStep, duration } = note;
                    const x = 20 + (globalStep * stepWidth);
                    let minNoteY = 1000;
                    let maxNoteY = -1000;
                    let hasHit = false;

                    instruments.forEach((inst, instIdx) => {
                        if ((inst.voice === undefined ? 0 : inst.voice) !== voice) return;
                        if (mutedTracks[instIdx]) return;

                        if (grid[instIdx] && grid[instIdx][globalStep]) {
                            hasHit = true;
                            // Correct Y calculation: staveY is top, add inst.y to go down
                            const y = staveY + inst.y;

                            // Draw Note Head
                            if (inst.symbol === 'circle') {
                                notes.push(<circle key={`n-${globalStep}-${inst.id}`} cx={x} cy={y} r="4.5" fill="currentColor" />);
                            } else if (inst.symbol === 'cross') {
                                notes.push(
                                    <g key={`n-${globalStep}-${inst.id}`} stroke="currentColor" strokeWidth="2">
                                        <line x1={x - 3} y1={y - 3} x2={x + 3} y2={y + 3} />
                                        <line x1={x + 3} y1={y - 3} x2={x - 3} y2={y + 3} />
                                    </g>
                                );
                            } else if (inst.symbol === 'cross_circle') {
                                notes.push(
                                    <g key={`n-${globalStep}-${inst.id}`} stroke="currentColor" strokeWidth="1.5" fill="none">
                                        <circle cx={x} cy={y} r="4.5" />
                                        <line x1={x - 2} y1={y - 2} x2={x + 2} y2={y + 2} />
                                        <line x1={x + 2} y1={y - 2} x2={x - 2} y2={y + 2} />
                                    </g>
                                );
                            } else if (inst.symbol === 'x') {
                                notes.push(
                                    <text key={`n-${globalStep}-${inst.id}`} x={x} y={y + 4} textAnchor="middle" fontSize="12" fill="currentColor" fontWeight="bold">X</text>
                                )
                            } else if (inst.symbol === 'triangle') {
                                notes.push(
                                    <polygon key={`n-${globalStep}-${inst.id}`} points={`${x},${y - 4} ${x - 4},${y + 4} ${x + 4},${y + 4}`} fill="currentColor" />
                                )
                            }

                            minNoteY = Math.min(minNoteY, y);
                            maxNoteY = Math.max(maxNoteY, y);
                        }
                    });

                    if (hasHit) {
                        // Stem Logic
                        if (voice === 0) {
                            // Up Stem (Hands) - From highest note UP
                            const stemEnd = staveY - 25; // Above top line
                            notes.push(<line key={`stem-${voice}-${globalStep}`} x1={x + 4} y1={maxNoteY} x2={x + 4} y2={stemEnd} stroke="currentColor" strokeWidth="1.5" />);
                        } else {
                            // Down Stem (Feet) - From lowest note DOWN
                            const stemEnd = staveY + 65; // Below bottom line
                            notes.push(<line key={`stem-${voice}-${globalStep}`} x1={x - 4} y1={minNoteY} x2={x - 4} y2={stemEnd} stroke="currentColor" strokeWidth="1.5" />);
                        }

                        // Dot Logic
                        if (duration === 3) {
                            notes.push(<circle key={`dot-${voice}-${globalStep}`} cx={x + 10} cy={voice === 0 ? maxNoteY : minNoteY} r="2" fill="currentColor" />);
                        }
                    }
                });

                // Beaming Logic (Per Voice)
                if (notesInBeat.length > 0) {
                    const firstNote = notesInBeat[0];
                    const lastNote = notesInBeat[notesInBeat.length - 1];
                    const firstX = 20 + ((b * subdiv + firstNote.s) * stepWidth);
                    const lastX = 20 + ((b * subdiv + lastNote.s) * stepWidth);

                    const beamY = voice === 0 ? staveY - 25 : staveY + 65;
                    const stemXOffset = voice === 0 ? 4 : -4;
                    const beamOffset = voice === 0 ? 5 : -5; // Move towards center for secondary

                    // If multiple notes, draw beam
                    if (notesInBeat.length > 1) {
                        // Primary Beam (8th)
                        notes.push(
                            <line key={`beam-8-${voice}-${b}`} x1={firstX + stemXOffset} y1={beamY} x2={lastX + stemXOffset} y2={beamY} stroke="currentColor" strokeWidth="4" />
                        );

                        // Secondary Beam (16th) logic
                        notesInBeat.forEach((note, i) => {
                            const currX = 20 + ((b * subdiv + note.s) * stepWidth);
                            const prevNote = notesInBeat[i - 1];
                            const nextNote = notesInBeat[i + 1];

                            const connectedLeft = prevNote && (note.s - prevNote.s === 1);
                            const connectedRight = nextNote && (nextNote.s - note.s === 1);

                            if (note.duration === 1) { // This note is a 16th
                                if (connectedRight) {
                                    // Handled by next block
                                } else if (connectedLeft) {
                                    // Handled by prev block
                                } else {
                                    // Isolated 16th stub
                                    const stubDir = (i === 0) ? 1 : -1; // Right if first, Left otherwise
                                    notes.push(
                                        <line key={`stub-16-${voice}-${b}-${i}`} x1={currX + stemXOffset} y1={beamY + beamOffset} x2={currX + stemXOffset + (8 * stubDir)} y2={beamY + beamOffset} stroke="currentColor" strokeWidth="4" />
                                    );
                                }
                            }

                            // Full secondary beams
                            if (nextNote && nextNote.s - note.s === 1) {
                                if (note.duration === 1 || nextNote.duration === 1) {
                                    notes.push(
                                        <line key={`beam-16-${voice}-${b}-${i}`} x1={currX + stemXOffset} y1={beamY + beamOffset} x2={20 + ((b * subdiv + nextNote.s) * stepWidth) + stemXOffset} y2={beamY + beamOffset} stroke="currentColor" strokeWidth="4" />
                                    );
                                }
                            }
                        });

                    } else {
                        // Single note in beat - Flags
                        const note = notesInBeat[0];
                        const flagY = voice === 0 ? staveY - 25 : staveY + 65;
                        const flagDir = voice === 0 ? 1 : -1; // Up vs Down curve?
                        // Actually standard flags always curve right?
                        // Stem Up: Flag Right, Curve Down.
                        // Stem Down: Flag Right, Curve Up.

                        if (note.duration === 4) {
                            // Quarter - No flag
                        } else if (note.duration === 3 || note.duration === 2) {
                            // 8th / Dotted 8th - Single Flag
                            notes.push(
                                <path
                                    key={`flag-${voice}-${b}`}
                                    d={`M${firstX + stemXOffset} ${flagY} Q${firstX + stemXOffset + 8} ${flagY + (5 * flagDir)} ${firstX + stemXOffset + 8} ${flagY + (15 * flagDir)}`}
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    fill="none"
                                />
                            );
                        } else if (note.duration === 1) {
                            // 16th - Double Flag
                            notes.push(
                                <g key={`flag-${voice}-${b}`}>
                                    <path d={`M${firstX + stemXOffset} ${flagY} Q${firstX + stemXOffset + 8} ${flagY + (5 * flagDir)} ${firstX + stemXOffset + 8} ${flagY + (15 * flagDir)}`} stroke="currentColor" strokeWidth="2" fill="none" />
                                    <path d={`M${firstX + stemXOffset} ${flagY + (6 * flagDir)} Q${firstX + stemXOffset + 8} ${flagY + (11 * flagDir)} ${firstX + stemXOffset + 8} ${flagY + (21 * flagDir)}`} stroke="currentColor" strokeWidth="2" fill="none" />
                                </g>
                            );
                        }
                    }
                }
            }
        });
        return notes;
    };

    return (
        <div className="w-full overflow-x-auto bg-slate-100 rounded-lg p-4 border border-slate-300 mb-6 shadow-inner relative">
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 absolute top-2 left-4 flex items-center gap-2">
                <Music className="w-3 h-3" /> Notation View
            </h3>
            <svg height="140" width={totalWidth} className="text-slate-800 mx-auto">
                {/* Stave Background */}
                {staveLines}

                {/* Clef (Simple rectangle rep for Percussion Clef) */}
                <rect x="0" y={staveY} width="4" height="40" fill="#334155" />
                <rect x="8" y={staveY + 10} width="4" height="20" fill="#334155" />

                {/* Bar Lines */}
                <line x1={totalWidth - 2} y1={staveY} x2={totalWidth - 2} y2={staveY + 40} stroke="#334155" strokeWidth="4" />

                {/* Notes */}
                {renderNotes()}

                {/* Playhead */}
                {currentStep >= 0 && (
                    <line
                        x1={20 + (currentStep * stepWidth)}
                        y1="10"
                        x2={20 + (currentStep * stepWidth)}
                        y2="130"
                        stroke="#f43f5e"
                        strokeWidth="2"
                        strokeDasharray="4"
                        className="transition-all duration-75"
                    />
                )}
            </svg>
        </div>
    )
}


export default function App() {
    // State
    const [bpm, setBpm] = useState(DEFAULT_BPM);
    const [beats, setBeats] = useState(DEFAULT_BEATS);
    const [subdiv, setSubdiv] = useState(DEFAULT_SUBDIV);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentStep, setCurrentStep] = useState(-1);
    const [swing, setSwing] = useState(0); // 0 to 50
    const [mutedTracks, setMutedTracks] = useState(() => instruments.map(() => false));

    // AI State
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState(null);

    // Rudiment State
    const [showRudiments, setShowRudiments] = useState(false);
    const [activeRudiment, setActiveRudiment] = useState(null);

    // Grid State: array of rows, each row is array of booleans
    const totalSteps = beats * subdiv;
    const [grid, setGrid] = useState(() =>
        instruments.map(() => Array(totalSteps).fill(false))
    );

    // Refs for audio engine and scheduling to prevent stale state
    const gridRef = useRef(grid);
    const mutedRef = useRef(mutedTracks);
    const bpmRef = useRef(bpm);
    const swingRef = useRef(swing);

    // Keep refs updated
    useEffect(() => { gridRef.current = grid; }, [grid]);
    useEffect(() => { mutedRef.current = mutedTracks; }, [mutedTracks]);
    useEffect(() => { bpmRef.current = bpm; }, [bpm]);
    useEffect(() => { swingRef.current = swing; }, [swing]);

    const audioRef = useRef(new DrumSynth());
    const nextNoteTimeRef = useRef(0);
    const currentStepRef = useRef(0);
    const timerIDRef = useRef(null);
    const lookahead = 25.0; // ms
    const scheduleAheadTime = 0.1; // s

    // --- Logic ---

    const handleResizeGrid = useCallback((newBeats, newSubdiv) => {
        const newTotalSteps = newBeats * newSubdiv;
        setGrid(prevGrid => {
            return prevGrid.map(row => {
                const newRow = Array(newTotalSteps).fill(false);
                // Copy old data to new row
                for (let i = 0; i < Math.min(row.length, newTotalSteps); i++) {
                    newRow[i] = row[i];
                }
                return newRow;
            });
        });
    }, []);

    useEffect(() => {
        handleResizeGrid(beats, subdiv);
    }, [beats, subdiv, handleResizeGrid]);

    const toggleCell = (instrumentIndex, stepIndex) => {
        const newGrid = [...grid];
        newGrid[instrumentIndex] = [...newGrid[instrumentIndex]];
        newGrid[instrumentIndex][stepIndex] = !newGrid[instrumentIndex][stepIndex];
        setGrid(newGrid);

        // Preview sound only if track is not muted
        if (!isPlaying && newGrid[instrumentIndex][stepIndex] && !mutedTracks[instrumentIndex]) {
            const synth = audioRef.current;
            synth.init();
            const now = synth.ctx.currentTime;
            playInstrument(instruments[instrumentIndex].id, now);
        }
    };

    const toggleMute = (index) => {
        setMutedTracks(prev => {
            const newMuted = [...prev];
            newMuted[index] = !newMuted[index];
            return newMuted;
        });
    };

    const playInstrument = (id, time) => {
        const synth = audioRef.current;
        switch (id) {
            case 'kick': synth.playKick(time); break;
            case 'snare': synth.playSnare(time); break;
            case 'hihat_closed': synth.playHiHat(time, false); break;
            case 'hihat_open': synth.playHiHat(time, true); break;
            case 'tom_low': synth.playTom(time, 100); break;
            case 'clap': synth.playClap(time); break;
            case 'woodblock': synth.playWoodblock(time); break;
            case 'metronome': synth.playWoodblock(time); break;
            default: break;
        }
    };

    const nextNote = () => {
        const beatDuration = 60.0 / bpmRef.current;
        const stepDuration = beatDuration / subdiv;

        // Swing Calculation
        let currentStepDuration = stepDuration;
        const swingFactor = swingRef.current / 100; // 0 to 0.5

        if (currentStepRef.current % 2 === 0) {
            // On-beat (Longer)
            currentStepDuration = stepDuration * (1 + swingFactor);
        } else {
            // Off-beat (Shorter)
            currentStepDuration = stepDuration * (1 - swingFactor);
        }

        nextNoteTimeRef.current += currentStepDuration;

        currentStepRef.current++;
        if (currentStepRef.current >= totalSteps) {
            currentStepRef.current = 0;
        }
    };

    const scheduleNote = (stepNumber, time) => {
        // Use gridRef.current to get the absolute latest state
        gridRef.current.forEach((row, instrumentIndex) => {
            // Check if active AND NOT muted
            if (row[stepNumber] && !mutedRef.current[instrumentIndex]) {
                playInstrument(instruments[instrumentIndex].id, time);
            }
        });
    };

    const scheduler = () => {
        while (nextNoteTimeRef.current < audioRef.current.ctx.currentTime + scheduleAheadTime) {
            scheduleNote(currentStepRef.current, nextNoteTimeRef.current);
            nextNote();
        }
        timerIDRef.current = window.setTimeout(scheduler, lookahead);
    };

    // --- Visual Loop ---
    useEffect(() => {
        let animationFrameId;

        const loop = () => {
            let visualStep = currentStepRef.current - 1;
            if (visualStep < 0) visualStep = totalSteps - 1;
            setCurrentStep(visualStep);
            animationFrameId = requestAnimationFrame(loop);
        };

        if (isPlaying) {
            loop();
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isPlaying, totalSteps]);


    const togglePlay = () => {
        if (isPlaying) {
            setIsPlaying(false);
            if (timerIDRef.current) clearTimeout(timerIDRef.current);
            setCurrentStep(-1);
        } else {
            const synth = audioRef.current;
            synth.init();
            setIsPlaying(true);
            currentStepRef.current = 0;
            nextNoteTimeRef.current = synth.ctx.currentTime + 0.05;
            scheduler();
        }
    };

    // Keyboard Controls
    // Use a ref to keep the latest togglePlay function available to the event listener
    // without re-binding the listener on every render (which happens every frame during playback).
    const togglePlayRef = useRef(togglePlay);
    useEffect(() => {
        togglePlayRef.current = togglePlay;
    });

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space') {
                // Ignore if user is typing in an input or textarea
                if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
                    return;
                }
                e.preventDefault(); // Prevent scrolling
                if (togglePlayRef.current) {
                    togglePlayRef.current();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const clearGrid = () => {
        setGrid(instruments.map(() => Array(totalSteps).fill(false)));
        setMutedTracks(instruments.map(() => false)); // Optional: reset mutes on clear
        setActiveRudiment(null);
    };

    const handleLoadRudiment = (rudiment) => {
        const newGrid = instruments.map(() => Array(totalSteps).fill(false));
        const snareIndex = instruments.findIndex(i => i.id === 'snare');

        if (snareIndex !== -1) {
            // Fill snare with rudiment pattern
            for (let i = 0; i < totalSteps; i++) {
                // Loop the sticking pattern if it's shorter than the grid
                const stickingVal = rudiment.sticking[i % rudiment.sticking.length];

                // Only set active if stickingVal is not null (rest)
                if (stickingVal) {
                    newGrid[snareIndex][i] = true;
                }
            }
        }

        setGrid(newGrid);
        setActiveRudiment(rudiment);
        setShowRudiments(false);
    };

    const getVisualizerOpacity = (idx) => {
        // Muted tracks should always be dim in visualizer
        if (mutedTracks[idx]) return 0.2;

        if (currentStep === -1) return 0.3;
        if (grid[idx][currentStep]) return 1;
        return 0.3;
    };

    // --- MIDI Export ---
    const exportMidi = () => {
        const TICKS_PER_BEAT = 480;

        // Helper: Convert number to Variable Length Quantity (VLQ) for MIDI
        const toVLQ = (num) => {
            const ret = [];
            let t = num;
            ret.push(t & 0x7F);
            t >>= 7;
            while (t > 0) {
                ret.push((t & 0x7F) | 0x80);
                t >>= 7;
            }
            return ret.reverse();
        };

        // 1. Build Event List (Absolute Ticks)
        const events = [];
        const midiMap = {
            'woodblock': 76, 'hihat_open': 46, 'hihat_closed': 42,
            'clap': 39, 'snare': 38, 'tom_low': 45, 'kick': 36
        };

        let currentTick = 0;
        // Calculate base ticks per step (assuming subdiv 4 = 16ths = 1/4 of beat)
        // Fixed formula:
        const baseStepTicks = TICKS_PER_BEAT / subdiv;

        for (let step = 0; step < totalSteps; step++) {
            let duration = baseStepTicks;
            const swingFactor = swing / 100;

            // Match swing logic: Even steps longer, Odd steps shorter
            if (step % 2 === 0) {
                duration = baseStepTicks * (1 + swingFactor);
            } else {
                duration = baseStepTicks * (1 - swingFactor);
            }

            instruments.forEach((inst, idx) => {
                if (grid[idx][step] && !mutedTracks[idx]) {
                    const note = midiMap[inst.id];
                    // Note On
                    events.push({ type: 'on', note, velocity: 100, tick: Math.round(currentTick) });
                    // Note Off (drums are one-shot, but we give them a short duration)
                    events.push({ type: 'off', note, velocity: 0, tick: Math.round(currentTick + Math.min(60, duration)) });
                }
            });
            currentTick += duration;
        }

        events.sort((a, b) => a.tick - b.tick);

        // 2. Convert to Delta Times & Byte Array
        const trackData = [];
        let lastTick = 0;

        // Set Tempo (Meta 0x51)
        const mpqn = Math.round(60000000 / bpm);
        trackData.push(0x00, 0xFF, 0x51, 0x03, (mpqn >> 16) & 0xFF, (mpqn >> 8) & 0xFF, mpqn & 0xFF);

        events.forEach(e => {
            const delta = e.tick - lastTick;
            lastTick = e.tick;
            trackData.push(...toVLQ(delta));
            if (e.type === 'on') {
                trackData.push(0x99, e.note, e.velocity); // Note On Ch 10
            } else {
                trackData.push(0x89, e.note, e.velocity); // Note Off Ch 10
            }
        });

        // End of Track
        trackData.push(0x00, 0xFF, 0x2F, 0x00);

        // 3. Header Chunk
        const header = [
            0x4D, 0x54, 0x68, 0x64, // MThd
            0x00, 0x00, 0x00, 0x06, // Len 6
            0x00, 0x00,             // Format 0
            0x00, 0x01,             // 1 Track
            (TICKS_PER_BEAT >> 8) & 0xFF, TICKS_PER_BEAT & 0xFF
        ];

        // Track Chunk Header
        const trackHeader = [
            0x4D, 0x54, 0x72, 0x6B, // MTrk
            (trackData.length >> 24) & 0xFF, (trackData.length >> 16) & 0xFF, (trackData.length >> 8) & 0xFF, trackData.length & 0xFF
        ];

        // 4. Download
        const fileBytes = new Uint8Array([...header, ...trackHeader, ...trackData]);
        const blob = new Blob([fileBytes], { type: 'audio/midi' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rhythm-craft-beat.mid';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- Gemini Integration ---

    const handleGeneratePattern = async () => {
        if (!aiPrompt.trim()) return;

        setIsGenerating(true);
        setAiError(null);

        try {
            const instrumentList = instruments.map(i => i.name).join(', ');
            const systemInstruction = `
            You are a professional drum sequencer.
            Create a drum pattern based on the user's description.
            The grid has ${instruments.length} rows (instruments) and ${totalSteps} columns (time steps).
            The rows are ordered EXACTLY as follows: ${instrumentList}.
            
            Output ONLY valid JSON. Do not output markdown code blocks.
            The JSON must be an object with a 'pattern' property.
            'pattern' must be a 2D array of booleans (true for hit, false for silence).
            Dimensions must be exactly ${instruments.length} rows x ${totalSteps} columns.
            
            Example format:
            { "pattern": [[false, true, ...], [true, false, ...], ...] }
        `;

            const userMessage = `Create a drum pattern for: "${aiPrompt}". Make it rhythmic and interesting.`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: userMessage }] }],
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!response.ok) throw new Error('Failed to generate pattern');

            const data = await response.json();
            const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!generatedText) throw new Error('No pattern generated');

            const parsed = JSON.parse(generatedText);

            if (parsed.pattern && Array.isArray(parsed.pattern)) {
                // Validate dimensions just in case
                const newGrid = parsed.pattern.slice(0, instruments.length).map(row => {
                    // Ensure row is boolean and correct length
                    const cleanRow = Array.isArray(row) ? row : [];
                    // Pad or truncate to match current totalSteps
                    if (cleanRow.length < totalSteps) {
                        return [...cleanRow, ...Array(totalSteps - cleanRow.length).fill(false)];
                    }
                    return cleanRow.slice(0, totalSteps);
                });
                setGrid(newGrid);
                setShowAiModal(false);
                setAiPrompt('');
            } else {
                throw new Error('Invalid pattern format received');
            }

        } catch (err) {
            console.error(err);
            setAiError('Failed to create beat. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-cyan-500 selection:text-white pb-20">
            {/* Header */}
            <header className="bg-slate-800 border-b border-slate-700 p-4 sticky top-0 z-30 shadow-lg">
                <div className="max-w-6xl mx-auto flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500 rounded-lg shadow-cyan-500/50 shadow-md">
                            <Volume2 className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                            RhythmCraft
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 bg-slate-900/50 p-2 rounded-xl border border-slate-700/50">
                        {/* Play Controls */}
                        <button
                            onClick={togglePlay}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all duration-200 transform active:scale-95 ${isPlaying
                                ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30 shadow-lg'
                                : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30 shadow-lg'
                                }`}
                        >
                            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                            {isPlaying ? 'STOP' : 'PLAY'}
                        </button>

                        {/* AI Generator Button */}
                        <button
                            onClick={() => setShowAiModal(!showAiModal)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all duration-200 border border-purple-500/50 ${showAiModal ? 'bg-purple-500 text-white' : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                                }`}
                            title="Generate with AI"
                        >
                            <Sparkles className="w-4 h-4" />
                            <span className="hidden sm:inline">Generate</span>
                        </button>

                        {/* Rudiments Button */}
                        <button
                            onClick={() => setShowRudiments(!showRudiments)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all duration-200 border border-blue-500/50 ${showRudiments ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                                }`}
                            title="Rudiment Library"
                        >
                            <BookOpen className="w-4 h-4" />
                            <span className="hidden sm:inline">Rudiments</span>
                        </button>

                        {/* MIDI Export Button */}
                        <button
                            onClick={exportMidi}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 transition-colors"
                            title="Export MIDI"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline text-xs font-bold">MIDI</span>
                        </button>

                        <div className="w-px h-8 bg-slate-700 mx-2 hidden md:block"></div>

                        {/* Tempo */}
                        <div className="flex flex-col">
                            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> BPM
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="40"
                                    max="240"
                                    value={bpm}
                                    onChange={(e) => setBpm(Number(e.target.value))}
                                    className="w-24 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                                <span className="font-mono text-xl w-12 text-right text-cyan-400">{bpm}</span>
                            </div>
                        </div>

                        {/* Swing */}
                        <div className="flex flex-col hidden sm:flex">
                            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center gap-2">
                                Swing <span className="text-purple-400">{swing}%</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="50"
                                    step="5"
                                    value={swing}
                                    onChange={(e) => setSwing(Number(e.target.value))}
                                    className="w-24 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                />
                            </div>
                        </div>

                        <div className="w-px h-8 bg-slate-700 mx-2 hidden md:block"></div>

                        {/* Reset */}
                        <button
                            onClick={clearGrid}
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                            title="Clear Pattern"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* AI Modal */}
                {showAiModal && (
                    <div className="absolute top-full left-0 right-0 bg-slate-800 border-b border-purple-500/30 shadow-2xl z-40 animate-in slide-in-from-top-2 duration-200">
                        <div className="max-w-6xl mx-auto p-6 flex flex-col md:flex-row gap-6 items-start">
                            <div className="flex-1 w-full">
                                <h3 className="text-purple-400 font-bold flex items-center gap-2 mb-2">
                                    <Sparkles className="w-4 h-4" /> AI Beat Generator
                                </h3>
                                <p className="text-slate-400 text-sm mb-4">Describe a beat and the AI will compose it for you on the current grid.</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleGeneratePattern()}
                                        placeholder="e.g., 'Funky 90s hip hop beat', 'Fast jazz swing', 'Aggressive techno'"
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 transition-colors"
                                    />
                                    <button
                                        onClick={handleGeneratePattern}
                                        disabled={isGenerating || !aiPrompt.trim()}
                                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 min-w-[120px] justify-center"
                                    >
                                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                                    </button>
                                </div>
                                {aiError && <p className="text-rose-400 text-sm mt-2">{aiError}</p>}
                            </div>
                            <button onClick={() => setShowAiModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Rudiments Modal */}
                {showRudiments && (
                    <div className="absolute top-full left-0 right-0 bg-slate-800 border-b border-blue-500/30 shadow-2xl z-40 animate-in slide-in-from-top-2 duration-200">
                        <div className="max-w-6xl mx-auto p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-blue-400 font-bold flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" /> Rudiment Library
                                </h3>
                                <button onClick={() => setShowRudiments(false)} className="text-slate-500 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {RUDIMENTS.map(rudiment => (
                                    <button
                                        key={rudiment.id}
                                        onClick={() => handleLoadRudiment(rudiment)}
                                        className="bg-slate-900 border border-slate-700 hover:border-blue-500/50 hover:bg-slate-700 p-4 rounded-xl text-left transition-all group"
                                    >
                                        <div className="font-bold text-slate-200 group-hover:text-blue-400 mb-1">{rudiment.name}</div>
                                        <div className="text-xs text-slate-500 mb-3">{rudiment.description}</div>
                                        <div className="flex gap-1 flex-wrap">
                                            {rudiment.sticking.slice(0, 8).map((hand, i) => (
                                                <span key={i} className={`text-[10px] font-mono px-1 rounded ${hand === 'R' ? 'bg-rose-500/20 text-rose-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                                                    {hand}
                                                </span>
                                            ))}
                                            {rudiment.sticking.length > 8 && <span className="text-slate-600 text-[10px]">...</span>}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto p-4 space-y-8">

                {/* Time Signature Settings */}
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 backdrop-blur-sm">
                    <div className="flex flex-col sm:flex-row gap-8 justify-center items-center">
                        <div className="flex flex-col items-center gap-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Beats per Bar</span>
                            <div className="flex items-center gap-3 bg-slate-900 p-1 rounded-lg border border-slate-700">
                                <button
                                    onClick={() => setBeats(Math.max(2, beats - 1))}
                                    className="p-2 hover:bg-slate-800 rounded-md text-cyan-500 transition-colors"
                                ><Minus className="w-4 h-4" /></button>
                                <span className="text-2xl font-mono font-bold w-8 text-center">{beats}</span>
                                <button
                                    onClick={() => setBeats(Math.min(8, beats + 1))}
                                    className="p-2 hover:bg-slate-800 rounded-md text-cyan-500 transition-colors"
                                ><Plus className="w-4 h-4" /></button>
                            </div>
                        </div>

                        <div className="text-slate-600 font-light hidden sm:block">×</div>

                        <div className="flex flex-col items-center gap-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subdivisions</span>
                            <div className="flex items-center gap-3 bg-slate-900 p-1 rounded-lg border border-slate-700">
                                <button
                                    onClick={() => setSubdiv(Math.max(2, subdiv - 1))}
                                    className="p-2 hover:bg-slate-800 rounded-md text-purple-500 transition-colors"
                                ><Minus className="w-4 h-4" /></button>
                                <span className="text-2xl font-mono font-bold w-8 text-center">{subdiv}</span>
                                <button
                                    onClick={() => setSubdiv(Math.min(8, subdiv + 1))}
                                    className="p-2 hover:bg-slate-800 rounded-md text-purple-500 transition-colors"
                                ><Plus className="w-4 h-4" /></button>
                            </div>
                        </div>

                        <div className="sm:ml-8 flex flex-col text-sm text-slate-400 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                            <div className="flex justify-between gap-4">
                                <span>Total Steps:</span>
                                <span className="font-mono text-white">{totalSteps}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span>Signature Hint:</span>
                                <span className="font-mono text-cyan-400">
                                    {beats}/{subdiv === 4 ? '4' : subdiv === 3 ? '8 (Triplet)' : 'x'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notation View */}
                <div className="w-full">
                    <NotationView grid={grid} beats={beats} subdiv={subdiv} currentStep={currentStep} mutedTracks={mutedTracks} activeRudiment={activeRudiment} />
                </div>

                {/* Sequencer Grid */}
                <div className="overflow-x-auto pb-4">
                    <div className="min-w-[800px] bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 relative">

                        {/* Step Indicators */}
                        <div className="flex mb-2 relative z-10 gap-4">
                            <div className="w-32 shrink-0"></div> {/* Spacer for labels */}
                            <div className="flex-1 flex gap-1">
                                {Array(totalSteps).fill(0).map((_, i) => {
                                    const isBeatStart = i % subdiv === 0;
                                    const beatBorder = isBeatStart ? 'border-l-2 border-l-slate-600' : 'border-l-2 border-l-transparent';
                                    return (
                                        <div
                                            key={i}
                                            className={`flex-1 h-2 rounded-full transition-all duration-75 ${beatBorder} ${currentStep === i
                                                ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e] scale-110 ring-1 ring-white'
                                                : isBeatStart ? 'bg-slate-600' : 'bg-slate-700'
                                                }`}
                                        ></div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 relative z-10">
                            {grid.map((row, instIdx) => (
                                <div key={instruments[instIdx].id} className={`flex items-center gap-4 transition-opacity duration-200 ${mutedTracks[instIdx] ? 'opacity-50' : 'opacity-100'}`}>
                                    {/* Instrument Label with Mute */}
                                    <div className="w-32 shrink-0 flex items-center gap-2">
                                        <button
                                            onClick={() => toggleMute(instIdx)}
                                            className={`p-1.5 rounded-md transition-colors ${mutedTracks[instIdx] ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                                            title={mutedTracks[instIdx] ? "Unmute" : "Mute"}
                                        >
                                            {mutedTracks[instIdx] ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                        </button>

                                        <div className={`w-2 h-8 rounded-full ${instruments[instIdx].color} shadow-lg shadow-black/50`}></div>
                                        <span className="font-bold text-slate-300 uppercase text-xs tracking-wider truncate">
                                            {instruments[instIdx].name}
                                        </span>
                                    </div>

                                    {/* Grid Row */}
                                    <div className="flex-1 flex gap-1">
                                        {row.map((isActive, stepIdx) => {
                                            const isBeatStart = stepIdx % subdiv === 0;
                                            const beatBorder = isBeatStart ? 'border-l-2 border-l-slate-600' : '';
                                            const isPlayingStep = currentStep === stepIdx;

                                            return (
                                                <button
                                                    key={stepIdx}
                                                    onClick={() => toggleCell(instIdx, stepIdx)}
                                                    className={`
                                    grid-cell flex-1 h-12 rounded-md transition-all duration-75 relative
                                    ${beatBorder}
                                    ${/* Base State */ ''}
                                    ${isActive
                                                            ? `${instruments[instIdx].color} shadow-lg scale-95 hover:brightness-110`
                                                            : 'bg-slate-700/50 hover:bg-slate-700'
                                                        }
                                    ${/* Playhead Highlight (Cell Highlighting) */ ''}
                                    ${isPlayingStep
                                                            ? isActive
                                                                ? 'brightness-150 ring-2 ring-white z-20 shadow-[0_0_15px_rgba(255,255,255,0.5)]'
                                                                : 'bg-white/10 ring-1 ring-white/30 z-10'
                                                            : ''
                                                        }
                                `}
                                                >
                                                    {isActive && (
                                                        <div className={`absolute inset-0 flex items-center justify-center ${activeRudiment && instruments[instIdx].id === 'snare'
                                                            ? activeRudiment.sticking[stepIdx % activeRudiment.sticking.length] === 'R'
                                                                ? 'bg-rose-500'
                                                                : 'bg-cyan-500'
                                                            : ''
                                                            } rounded-md`}>
                                                            {activeRudiment && instruments[instIdx].id === 'snare' ? (
                                                                <span className="text-xl font-black text-white">
                                                                    {activeRudiment.sticking[stepIdx % activeRudiment.sticking.length]}
                                                                </span>
                                                            ) : (
                                                                <div className={`w-2 h-2 bg-white/80 rounded-full blur-[1px] ${isPlayingStep ? 'scale-150' : ''}`}></div>
                                                            )}
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Live Visualizer */}
                <div className="grid grid-cols-7 gap-4 mt-8">
                    {instruments.map((inst, i) => (
                        <div
                            key={inst.id}
                            className={`bg-slate-800 rounded-xl p-4 flex flex-col items-center gap-2 border border-slate-700 transition-all duration-75 ${mutedTracks[i] ? 'opacity-40 grayscale' : ''}`}
                            style={{
                                transform: grid[i][currentStep] && isPlaying && !mutedTracks[i] ? 'scale(1.05) translateY(-4px)' : 'scale(1)',
                                borderColor: grid[i][currentStep] && isPlaying && !mutedTracks[i] ? 'rgba(255,255,255,0.5)' : 'rgba(51,65,85,0.5)',
                                boxShadow: grid[i][currentStep] && isPlaying && !mutedTracks[i] ? `0 10px 30px -10px ${inst.color.replace('bg-', 'var(--tw-shadow-color)')}` : 'none'
                            }}
                        >
                            <div
                                className={`w-12 h-12 rounded-full ${inst.color} transition-opacity duration-75 flex items-center justify-center shadow-inner`}
                                style={{ opacity: getVisualizerOpacity(i) }}
                            >
                                <div className="w-8 h-8 rounded-full border-2 border-white/20"></div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase truncate w-full text-center">{inst.name}</span>
                        </div>
                    ))}
                </div>

                {/* Instructions */}
                <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4 text-sm text-slate-400 text-center">
                    <p>Tip: Use the <strong>Swing</strong> slider to add a "human" groove. 0% is straight robotic timing, 16-20% is a light groove, 50% is a full shuffle.</p>
                </div>

            </main>
        </div>
    );
}