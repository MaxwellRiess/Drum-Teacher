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

    // Rudiment State
    const [activeRudiment, setActiveRudiment] = useState(null);

    // Grid State
    const totalSteps = beats * subdiv;
    const [grid, setGrid] = useState(() =>
        instruments.map(() => Array(totalSteps).fill(false))
    );

    // Refs
    const gridRef = useRef(grid);
    const mutedRef = useRef(mutedTracks);
    const bpmRef = useRef(bpm);
    const swingRef = useRef(swing);
    const audioRef = useRef(new DrumSynth());
    const nextNoteTimeRef = useRef(0);
    const currentStepRef = useRef(0);
    const timerIDRef = useRef(null);
    const totalStepsRef = useRef(totalSteps);

    const lookahead = 25.0; // ms
    const scheduleAheadTime = 0.1; // s

    // Sync Refs
    useEffect(() => { gridRef.current = grid; }, [grid]);
    useEffect(() => { mutedRef.current = mutedTracks; }, [mutedTracks]);
    useEffect(() => { bpmRef.current = bpm; }, [bpm]);
    useEffect(() => { swingRef.current = swing; }, [swing]);
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
    };

    const updateSubdiv = (newSubdiv) => {
        setSubdiv(newSubdiv);
        resizeGrid(beats, newSubdiv);
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

    const toggleCell = (instrumentIndex, stepIndex) => {
        const newGrid = [...grid];
        newGrid[instrumentIndex] = [...newGrid[instrumentIndex]];
        newGrid[instrumentIndex][stepIndex] = !newGrid[instrumentIndex][stepIndex];
        setGrid(newGrid);

        // Preview sound
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
        }
    };

    const scheduleNote = (stepNumber, time) => {
        gridRef.current.forEach((row, instrumentIndex) => {
            if (row[stepNumber] && !mutedRef.current[instrumentIndex]) {
                playInstrument(instruments[instrumentIndex].id, time);
            }
        });
    };

    const scheduler = useCallback(() => {
        while (nextNoteTimeRef.current < audioRef.current.ctx.currentTime + scheduleAheadTime) {
            scheduleNote(currentStepRef.current, nextNoteTimeRef.current);
            nextNote();
        }
        timerIDRef.current = window.setTimeout(scheduler, lookahead);
    }, []);

    // Visual Loop
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

    const clearGrid = () => {
        setGrid(instruments.map(() => Array(totalSteps).fill(false)));
        setMutedTracks(instruments.map(() => false));
        setActiveRudiment(null);
    };

    const loadState = ({ bpm: newBpm, beats: newBeats, subdiv: newSubdiv, swing: newSwing, grid: newGrid }) => {
        setBpm(newBpm);
        setBeats(newBeats);
        setSubdiv(newSubdiv);
        setSwing(newSwing);
        setGrid(newGrid);
    };

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
        grid, setGrid, toggleCell, clearGrid,
        loadRudiment, activeRudiment,
        loadState,
        totalSteps,
        instruments
    };
};
