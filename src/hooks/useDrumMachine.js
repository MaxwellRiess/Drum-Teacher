import { useState, useEffect, useRef, useCallback } from 'react';
import { Circle, Square, Sparkles, Clock } from 'lucide-react';

// --- Audio Engine (Web Audio API) ---

const createAudioContext = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    return new AudioContext();
};

export class DrumSynth {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.channels = null;
    }

    async init() {
        if (!this.ctx) {
            this.ctx = createAudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);

            // One gain node per instrument, all feeding master. Playing an
            // electronic kit through the same speakers as the app means the
            // app's own sound competes with what you are playing, so each
            // voice needs to be balanced against that independently.
            this.channels = {};
            for (const inst of instruments) {
                const g = this.ctx.createGain();
                g.gain.value = 1;
                g.connect(this.masterGain);
                this.channels[inst.id] = g;
            }
        }
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    // Falls back to master so a voice with no channel still sounds rather than
    // silently failing to connect.
    channel(id) {
        return this.channels?.[id] ?? this.masterGain;
    }

    setChannelVolume(id, value) {
        const c = this.channels?.[id];
        if (c) c.gain.value = value;
    }

    playKick(time, dest) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(dest || this.masterGain);

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

        osc.start(time);
        osc.stop(time + 0.5);
    }

    playSnare(time, dest) {
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
        noiseGain.connect(dest || this.masterGain);

        noiseGain.gain.setValueAtTime(0.8, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
        noise.start(time);

        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.connect(oscGain);
        oscGain.connect(dest || this.masterGain);
        osc.frequency.value = 200;
        oscGain.gain.setValueAtTime(0.5, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        osc.start(time);
        osc.stop(time + 0.2);
    }

    playHiHat(time, open = false, dest) {
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
        gain.connect(dest || this.masterGain);

        gain.gain.setValueAtTime(0.6, time);
        const decay = open ? 0.4 : 0.05;
        gain.gain.exponentialRampToValueAtTime(0.01, time + decay);

        noise.start(time);
    }

    playTom(time, pitch = 100, dest) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(dest || this.masterGain);

        osc.frequency.setValueAtTime(pitch, time);
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, time + 0.4);
        gain.gain.setValueAtTime(0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

        osc.start(time);
        osc.stop(time + 0.4);
    }

    playClap(time, dest) {
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
        gain.connect(dest || this.masterGain);

        gain.gain.setValueAtTime(0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

        noise.start(time);
    }

    // pitch is raised for the downbeat so the top of the bar is findable by ear
    // when the kit itself is silent.
    playWoodblock(time, pitch = 800, dest) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(dest || this.masterGain);

        // High pitched sine wave with short decay
        osc.frequency.setValueAtTime(pitch, time);
        gain.gain.setValueAtTime(1.0, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        osc.start(time);
        osc.stop(time + 0.1);
    }
}

export const instruments = [
    { id: 'metronome', name: 'Metronome', icon: Clock, color: 'var(--pad-perc)', y: -15, symbol: 'triangle', voice: 0 },
    { id: 'hihat_open', name: 'Hihat Op', icon: Circle, color: 'var(--pad-hat)', y: -5, symbol: 'cross_circle', voice: 0 },
    { id: 'hihat_closed', name: 'Hihat Cl', icon: Circle, color: 'var(--pad-hat)', y: -5, symbol: 'cross', voice: 0 },
    { id: 'clap', name: 'Clap', icon: Sparkles, color: 'var(--pad-perc)', y: 15, symbol: 'x', voice: 0 },
    { id: 'snare', name: 'Snare', icon: Square, color: 'var(--pad-snare)', y: 15, symbol: 'circle', voice: 0 },
    { id: 'tom_low', name: 'Tom Low', icon: Circle, color: 'var(--pad-tom)', y: 25, symbol: 'circle', voice: 0 },
    { id: 'kick', name: 'Kick', icon: Square, color: 'var(--pad-kick)', y: 45, symbol: 'circle', voice: 1 },
];

export const RUDIMENTS = [
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

const VOLUME_KEY = 'drumTeacher.volumes.v1';

export const DEFAULT_BPM = 110;
export const DEFAULT_BEATS = 4;
export const DEFAULT_SUBDIV = 4;

export const useDrumMachine = () => {
    // State
    const [bpm, setBpm] = useState(DEFAULT_BPM);
    const [beats, setBeats] = useState(DEFAULT_BEATS);
    const [subdiv, setSubdiv] = useState(DEFAULT_SUBDIV);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentStep, setCurrentStep] = useState(-1);
    const [swing, setSwing] = useState(0); // 0 to 50
    const [mutedTracks, setMutedTracks] = useState(() => instruments.map(() => false));

    // Click-only practice: silence the kit and keep just the pulse, so a pattern
    // can be played from the notation and grid alone. Deliberately not built on
    // mutedTracks — muting a track removes it from the schedule, which would
    // also remove it from the notation and from practice scoring. Here the
    // pattern is untouched and only the audio changes.
    const [clickOnly, setClickOnly] = useState(false);

    // Per-instrument levels, 0–1. A monitoring preference rather than part of
    // the pattern, so it persists and is not carried in the shared URL.
    const [volumes, setVolumes] = useState(() => {
        const defaults = Object.fromEntries(instruments.map(i => [i.id, 1]));
        try {
            const raw = localStorage.getItem(VOLUME_KEY);
            return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
        } catch { return defaults; }
    });

    // Rudiment State
    const [activeRudiment, setActiveRudiment] = useState(null);

    // Grid State
    const totalSteps = beats * subdiv;
    const [grid, setGrid] = useState(() =>
        instruments.map(() => Array(totalSteps).fill(false))
    );

    // Triplet sub-row grid (always beats×3 cells)
    const [tripletGrid, setTripletGrid] = useState(() =>
        instruments.map(() => Array(beats * 3).fill(false))
    );

    // Refs
    const gridRef = useRef(grid);
    const tripletGridRef = useRef(tripletGrid);
    const mutedRef = useRef(mutedTracks);
    const bpmRef = useRef(bpm);
    const subdivRef = useRef(subdiv);
    const swingRef = useRef(swing);
    const clickOnlyRef = useRef(clickOnly);
    const volumesRef = useRef(volumes);
    const audioRef = useRef(new DrumSynth());
    const nextNoteTimeRef = useRef(0);
    const currentStepRef = useRef(0);
    const timerIDRef = useRef(null);
    const totalStepsRef = useRef(totalSteps);

    // ── Practice-mode timing records ────────────────────────────────────────
    // The scheduler already knows the exact audio-clock time of every note it
    // schedules, so rather than re-deriving expected times (which breaks the
    // moment BPM or swing changes mid-loop) we simply record them as they go.
    //
    // expectedRef: one entry per note that should be *played by the drummer*.
    // stepClockRef: one entry per step, hit or not, used to drive the playhead.
    // Both are trimmed to a few seconds of history each scheduler tick.
    const expectedRef = useRef([]);
    const stepClockRef = useRef([]);
    const barRef = useRef(0);

    const lookahead = 25.0; // ms
    const scheduleAheadTime = 0.1; // s
    const HISTORY_SECONDS = 5;

    // Sync Refs
    useEffect(() => { gridRef.current = grid; }, [grid]);
    useEffect(() => { tripletGridRef.current = tripletGrid; }, [tripletGrid]);
    useEffect(() => { mutedRef.current = mutedTracks; }, [mutedTracks]);
    useEffect(() => { bpmRef.current = bpm; }, [bpm]);
    useEffect(() => { subdivRef.current = subdiv; }, [subdiv]);
    useEffect(() => { swingRef.current = swing; }, [swing]);
    useEffect(() => { clickOnlyRef.current = clickOnly; }, [clickOnly]);
    useEffect(() => { volumesRef.current = volumes; }, [volumes]);
    useEffect(() => { totalStepsRef.current = totalSteps; }, [totalSteps]);

    // Grid Resize Logic Helper
    const resizeGrid = (newBeats, newSubdiv) => {
        const newTotalSteps = newBeats * newSubdiv;
        setGrid(prevGrid => {
            return prevGrid.map(row => {
                const newRow = Array(newTotalSteps).fill(false);
                for (let i = 0; i < Math.min(row.length, newTotalSteps); i++) {
                    newRow[i] = row[i];
                }
                return newRow;
            });
        });
    };

    const updateBeats = (newBeats) => {
        setBeats(newBeats);
        resizeGrid(newBeats, subdiv);
        setTripletGrid(prev => prev.map(row => {
            const newRow = Array(newBeats * 3).fill(false);
            for (let i = 0; i < Math.min(row.length, newBeats * 3); i++) newRow[i] = row[i];
            return newRow;
        }));
    };

    const updateSubdiv = (newSubdiv) => {
        setSubdiv(newSubdiv);
        resizeGrid(beats, newSubdiv);
    };

    const toggleTripletCell = (instrumentIndex, tripletStepIndex) => {
        setTripletGrid(prev => {
            const next = prev.map(r => [...r]);
            next[instrumentIndex][tripletStepIndex] = !next[instrumentIndex][tripletStepIndex];
            return next;
        });
        if (!isPlaying) {
            const synth = audioRef.current;
            synth.init().then(() => playInstrument(instruments[instrumentIndex].id, synth.ctx.currentTime));
        }
    };

    // Stable identity: practice mode holds this in effect dependency lists, and
    // a fresh function each render would tear down its scoring loop constantly.
    const playInstrument = useCallback((id, time) => {
        const synth = audioRef.current;
        const dest = synth.channel(id);
        switch (id) {
            case 'kick': synth.playKick(time, dest); break;
            case 'snare': synth.playSnare(time, dest); break;
            case 'hihat_closed': synth.playHiHat(time, false, dest); break;
            case 'hihat_open': synth.playHiHat(time, true, dest); break;
            case 'tom_low': synth.playTom(time, 100, dest); break;
            case 'clap': synth.playClap(time, dest); break;
            case 'woodblock': synth.playWoodblock(time, 800, dest); break;
            case 'metronome': synth.playWoodblock(time, 800, dest); break;
            default: break;
        }
    }, []);

    const toggleCell = (instrumentIndex, stepIndex) => {
        const newGrid = [...grid];
        newGrid[instrumentIndex] = [...newGrid[instrumentIndex]];
        newGrid[instrumentIndex][stepIndex] = !newGrid[instrumentIndex][stepIndex];
        setGrid(newGrid);

        // Preview sound
        if (!isPlaying && newGrid[instrumentIndex][stepIndex] && !mutedTracks[instrumentIndex]) {
            const synth = audioRef.current;
            synth.init().then(() => {
                playInstrument(instruments[instrumentIndex].id, synth.ctx.currentTime);
            });
        }
    };

    const toggleMute = (index) => {
        setMutedTracks(prev => {
            const newMuted = [...prev];
            newMuted[index] = !newMuted[index];
            return newMuted;
        });
    };

    const nextNote = () => {
        const beatDuration = 60.0 / bpmRef.current;
        const stepDuration = beatDuration / subdiv;
        let currentStepDuration = stepDuration;
        const swingFactor = swingRef.current / 100;

        if (currentStepRef.current % 2 === 0) {
            currentStepDuration = stepDuration * (1 + swingFactor);
        } else {
            currentStepDuration = stepDuration * (1 - swingFactor);
        }

        nextNoteTimeRef.current += currentStepDuration;
        currentStepRef.current++;
        if (currentStepRef.current >= totalStepsRef.current) {
            currentStepRef.current = 0;
            barRef.current++;
        }
    };

    // Records a note the drummer is expected to play, keyed uniquely per pass so
    // the same step in two different loops scores independently.
    //
    // Kept sorted by time. Push order alone is not time order: a beat's triplet
    // notes are all scheduled at the beat boundary, so they interleave with the
    // grid steps that follow. Consumers scan until they meet a note whose match
    // window is still open, and an unsorted array would stall that scan.
    const pushExpected = (bar, step, instrumentIndex, time, isTriplet) => {
        const entry = {
            key: `${bar}:${isTriplet ? 't' : 's'}${step}:${instrumentIndex}`,
            bar, step, instrumentIndex, time, isTriplet,
        };
        const list = expectedRef.current;
        let i = list.length;
        while (i > 0 && list[i - 1].time > time) i--;
        list.splice(i, 0, entry);
    };

    const scheduleNote = (stepNumber, time) => {
        const bar = barRef.current;
        const clickOnly = clickOnlyRef.current;
        stepClockRef.current.push({ bar, step: stepNumber, time });

        // In click-only mode the pulse is generated here rather than taken from
        // the metronome track, so there is always something to play against even
        // when that row is empty. Accented on the downbeat.
        if (clickOnly && stepNumber % subdivRef.current === 0) {
            audioRef.current.playWoodblock(
                time,
                stepNumber === 0 ? 1200 : 800,
                audioRef.current.channel('metronome'),
            );
        }

        // Normal grid
        gridRef.current.forEach((row, instrumentIndex) => {
            if (row[stepNumber] && !mutedRef.current[instrumentIndex]) {
                if (!clickOnly) playInstrument(instruments[instrumentIndex].id, time);
                // Recorded either way: silencing the kit must not change what
                // the drummer is expected to play, or how it is scored.
                pushExpected(bar, stepNumber, instrumentIndex, time, false);
            }
        });
        // Triplet sub-row: schedule all 3 notes for this beat at the beat boundary
        if (stepNumber % subdivRef.current === 0) {
            const beatIndex = Math.floor(stepNumber / subdivRef.current);
            const beatDuration = 60.0 / bpmRef.current;
            tripletGridRef.current.forEach((row, instrumentIndex) => {
                if (mutedRef.current[instrumentIndex]) return;
                for (let t = 0; t < 3; t++) {
                    const tStep = beatIndex * 3 + t;
                    if (row[tStep]) {
                        const noteTime = time + (t / 3) * beatDuration;
                        if (!clickOnly) playInstrument(instruments[instrumentIndex].id, noteTime);
                        pushExpected(bar, tStep, instrumentIndex, noteTime, true);
                    }
                }
            });
        }
    };

    const scheduler = useCallback(() => {
        const now = audioRef.current.ctx.currentTime;
        while (nextNoteTimeRef.current < now + scheduleAheadTime) {
            scheduleNote(currentStepRef.current, nextNoteTimeRef.current);
            nextNote();
        }
        // Trim history so the records don't grow without bound
        const cutoff = now - HISTORY_SECONDS;
        if (expectedRef.current.length && expectedRef.current[0].time < cutoff)
            expectedRef.current = expectedRef.current.filter(e => e.time >= cutoff);
        if (stepClockRef.current.length && stepClockRef.current[0].time < cutoff)
            stepClockRef.current = stepClockRef.current.filter(e => e.time >= cutoff);

        timerIDRef.current = window.setTimeout(scheduler, lookahead);
    }, []);

    // Visual Loop
    // Tracks the step actually being *heard* (latest scheduled step whose time
    // has passed) rather than the scheduler's write pointer, which runs a
    // lookahead window ahead of the audio. Only writes state when the step
    // changes, so an idle playhead doesn't re-render the grid 60 times a second.
    useEffect(() => {
        let animationFrameId;
        let lastStep = -1;

        const loop = () => {
            const ctx = audioRef.current.ctx;
            if (ctx) {
                const now = ctx.currentTime;
                let step = -1;
                const clock = stepClockRef.current;
                for (let i = clock.length - 1; i >= 0; i--) {
                    if (clock[i].time <= now) { step = clock[i].step; break; }
                }
                if (step !== lastStep) {
                    lastStep = step;
                    setCurrentStep(step);
                }
            }
            animationFrameId = requestAnimationFrame(loop);
        };

        if (isPlaying) {
            loop();
        }
        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isPlaying]);

    const togglePlay = async () => {
        if (isPlaying) {
            setIsPlaying(false);
            if (timerIDRef.current) clearTimeout(timerIDRef.current);
            setCurrentStep(-1);
        } else {
            const synth = audioRef.current;
            await synth.init();
            applyVolumes();
            setIsPlaying(true);
            currentStepRef.current = 0;
            barRef.current = 0;
            expectedRef.current = [];
            stepClockRef.current = [];
            nextNoteTimeRef.current = synth.ctx.currentTime + 0.05;
            scheduler();
        }
    };

    const clearGrid = () => {
        setGrid(instruments.map(() => Array(totalSteps).fill(false)));
        setTripletGrid(instruments.map(() => Array(beats * 3).fill(false)));
        setMutedTracks(instruments.map(() => false));
        setActiveRudiment(null);
    };

    const loadState = ({ bpm: newBpm, beats: newBeats, subdiv: newSubdiv, swing: newSwing, grid: newGrid, tripletGrid: newTripletGrid }) => {
        setBpm(newBpm);
        setBeats(newBeats);
        setSubdiv(newSubdiv);
        setSwing(newSwing);
        setGrid(newGrid);
        if (newTripletGrid) setTripletGrid(newTripletGrid);
    };

    const getAudioContext = useCallback(() => audioRef.current.ctx, []);

    // Channels only exist once the context has been built, so levels have to be
    // pushed onto the graph after every init as well as on every change.
    const applyVolumes = useCallback(() => {
        const synth = audioRef.current;
        if (!synth.channels) return;
        for (const [id, v] of Object.entries(volumesRef.current)) {
            synth.setChannelVolume(id, v);
        }
    }, []);

    const setVolume = useCallback((id, value) => {
        const clamped = Math.max(0, Math.min(1, value));
        audioRef.current.setChannelVolume(id, clamped);
        setVolumes(prev => {
            const next = { ...prev, [id]: clamped };
            try { localStorage.setItem(VOLUME_KEY, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    }, []);

    // Creates the audio context if it does not exist yet and resumes it.
    // Anything that needs to make a sound without going through play — the
    // calibration click track, for one — has to call this first, because the
    // context is only built lazily on the first play or first cell preview.
    // Must be reached from a user gesture or the browser will not start audio.
    const initAudio = useCallback(async () => {
        await audioRef.current.init();
        applyVolumes();
        return audioRef.current.ctx;
    }, [applyVolumes]);

    const loadRudiment = (rudiment) => {
        const newGrid = instruments.map(() => Array(totalSteps).fill(false));
        const snareIndex = instruments.findIndex(i => i.id === 'snare');
        if (snareIndex !== -1) {
            for (let i = 0; i < totalSteps; i++) {
                const stickingVal = rudiment.sticking[i % rudiment.sticking.length];
                if (stickingVal) {
                    newGrid[snareIndex][i] = true;
                }
            }
        }
        setGrid(newGrid);
        setActiveRudiment(rudiment);
    };

    return {
        bpm, setBpm,
        beats, setBeats: updateBeats,
        subdiv, setSubdiv: updateSubdiv,
        isPlaying, togglePlay,
        currentStep, setCurrentStep,
        swing, setSwing,
        mutedTracks, toggleMute,
        clickOnly, setClickOnly,
        volumes, setVolume,
        grid, setGrid, toggleCell, clearGrid,
        loadRudiment, activeRudiment,
        loadState,
        totalSteps,
        instruments,
        tripletGrid, toggleTripletCell,

        // ── Practice-mode surface ───────────────────────────────────────────
        // Refs rather than state: practice mode polls these from its own rAF
        // loop, so nothing here triggers a React render.
        getAudioContext,
        initAudio,
        expectedRef,
        playInstrument,
    };
};
