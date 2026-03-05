import React, { useState, useEffect, useRef } from 'react';
import { useDrumMachine, RUDIMENTS } from '../hooks/useDrumMachine';
import { useAiDrummer } from '../hooks/useAiDrummer';
import { NotationView } from '../components/NotationView';
import { exportMidi } from '../utils/midiExport';
import { Play, Pause, X, Music, Sparkles, Download, Terminal, ChevronDown, Link } from 'lucide-react';
import { encodeState, decodeState } from '../utils/patternUrl';

// Accent color shown when the playhead hits an active pad
const ACCENT = '#f43f5e'; // rose-500

export default function Design1() {
    const machine = useDrumMachine();
    const ai = useAiDrummer(machine.totalSteps, machine.setGrid);
    const [showRudiments, setShowRudiments] = useState(false);
    const [copied, setCopied] = useState(false);

    // Keep a ref to togglePlay so the keydown listener never goes stale
    const togglePlayRef = useRef(machine.togglePlay);
    useEffect(() => { togglePlayRef.current = machine.togglePlay; }, [machine.togglePlay]);

    // Load state from URL on mount
    useEffect(() => {
        const state = decodeState(window.location.search);
        if (state) machine.loadState(state);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleShare = () => {
        const url = encodeState({
            bpm: machine.bpm,
            beats: machine.beats,
            subdiv: machine.subdiv,
            swing: machine.swing,
            grid: machine.grid,
        });
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    // Spacebar always plays / pauses (except when typing in a form element)
    useEffect(() => {
        const handler = (e) => {
            if (e.code !== 'Space') return;
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            e.preventDefault();
            togglePlayRef.current();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    return (
        <div className="h-screen flex flex-col bg-[#f0f0f0] text-black font-mono overflow-hidden selection:bg-black selection:text-white">

            {/* ── HEADER ── */}
            <div className="border-b-4 border-black bg-white px-5 py-3 flex items-center gap-4 flex-shrink-0 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tighter uppercase whitespace-nowrap">
                    RHYTHM<span className="text-gray-400">_CONSTRUCT</span>
                </h1>

                <div className="w-px h-8 bg-black flex-shrink-0" />

                <button
                    onClick={machine.togglePlay}
                    className={`h-10 px-4 border-2 border-black font-bold text-sm flex items-center gap-2 transition-colors ${machine.isPlaying ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}
                >
                    {machine.isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    {machine.isPlaying ? 'HALT' : 'EXECUTE'}
                </button>
                <button
                    onClick={machine.clearGrid}
                    className="h-10 w-10 border-2 border-black flex items-center justify-center hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors flex-shrink-0"
                    title="Clear grid"
                >
                    <X size={15} />
                </button>

                <div className="w-px h-8 bg-black flex-shrink-0" />

                <button
                    onClick={() => ai.setShowAiModal(true)}
                    className="h-10 px-3 border-2 border-black flex items-center gap-2 text-sm font-bold hover:bg-black hover:text-white transition-colors"
                >
                    <Sparkles size={14} /> AI
                </button>
                <button
                    onClick={() => exportMidi(machine.grid, machine.bpm, machine.subdiv, machine.mutedTracks)}
                    className="h-10 px-3 border-2 border-black flex items-center gap-2 text-sm font-bold hover:bg-black hover:text-white transition-colors"
                >
                    <Download size={14} /> MIDI
                </button>
                <button
                    onClick={handleShare}
                    className={`h-10 px-3 border-2 border-black flex items-center gap-2 text-sm font-bold transition-colors ${copied ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}
                >
                    <Link size={14} /> {copied ? 'COPIED!' : 'SHARE'}
                </button>

                <div className="w-px h-8 bg-black flex-shrink-0" />

                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold uppercase text-gray-500">BPM</span>
                    <button onClick={() => machine.setBpm(Math.max(60, machine.bpm - 5))} className="w-6 h-7 border border-black text-sm font-bold flex items-center justify-center hover:bg-black hover:text-white transition-colors">−</button>
                    <span className="w-10 text-center font-bold text-base tabular-nums">{machine.bpm}</span>
                    <button onClick={() => machine.setBpm(Math.min(200, machine.bpm + 5))} className="w-6 h-7 border border-black text-sm font-bold flex items-center justify-center hover:bg-black hover:text-white transition-colors">+</button>
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold uppercase text-gray-500">SWING</span>
                    <input
                        type="range" min="0" max="50" value={machine.swing}
                        onChange={e => machine.setSwing(Number(e.target.value))}
                        className="w-20 h-1.5 accent-black cursor-pointer"
                    />
                    <span className="w-6 text-sm font-bold tabular-nums">{machine.swing}</span>
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold uppercase text-gray-500">BEATS</span>
                    <button onClick={() => machine.setBeats(Math.max(2, machine.beats - 1))} className="w-6 h-7 border border-black text-sm font-bold flex items-center justify-center hover:bg-black hover:text-white transition-colors">−</button>
                    <span className="w-5 text-center font-bold text-base">{machine.beats}</span>
                    <button onClick={() => machine.setBeats(Math.min(8, machine.beats + 1))} className="w-6 h-7 border border-black text-sm font-bold flex items-center justify-center hover:bg-black hover:text-white transition-colors">+</button>
                </div>

                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold uppercase text-gray-500">SUBDIV</span>
                    <button onClick={() => machine.setSubdiv(Math.max(2, machine.subdiv - 1))} className="w-6 h-7 border border-black text-sm font-bold flex items-center justify-center hover:bg-black hover:text-white transition-colors">−</button>
                    <span className="w-5 text-center font-bold text-base">{machine.subdiv}</span>
                    <button onClick={() => machine.setSubdiv(Math.min(8, machine.subdiv + 1))} className="w-6 h-7 border border-black text-sm font-bold flex items-center justify-center hover:bg-black hover:text-white transition-colors">+</button>
                </div>

                <div className="ml-auto text-xs font-bold text-gray-400 whitespace-nowrap">
                    {machine.isPlaying
                        ? `STEP ${String(machine.currentStep + 1).padStart(2, '0')} / ${machine.totalSteps}`
                        : 'IDLE · SPACE TO PLAY'}
                </div>
            </div>

            {/* ── NOTATION (full width, fixed height) ── */}
            <div className="border-b-2 border-black bg-gray-50 px-3 pt-1 pb-1 flex-shrink-0">
                <div className="text-[9px] font-bold uppercase mb-0.5 flex items-center gap-1 text-gray-400">
                    <Music size={9} /> VISUAL_NOTATION
                </div>
                <NotationView
                    grid={machine.grid}
                    beats={machine.beats}
                    subdiv={machine.subdiv}
                    currentStep={machine.currentStep}
                    mutedTracks={machine.mutedTracks}
                    activeRudiment={machine.activeRudiment}
                />
            </div>

            {/* ── SEQUENCER GRID (fills all remaining height) ── */}
            <div className="flex-1 flex flex-col min-h-0 px-3 pt-2 pb-1">

                {/* Step number header */}
                <div className="flex flex-shrink-0 mb-1">
                    <div className="w-28 flex-shrink-0" />
                    <div className="flex-1 flex gap-0.5">
                        {Array.from({ length: machine.totalSteps }).map((_, i) => (
                            <div
                                key={i}
                                className={`flex-1 text-center text-[9px] font-bold leading-none py-0.5
                                    ${i % machine.subdiv === 0 ? 'border-l-2 border-black' : ''}
                                    ${machine.currentStep === i ? 'bg-black text-white' : 'text-gray-400'}`}
                            >
                                {i + 1}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Instrument rows — each expands equally to fill space */}
                <div className="flex-1 flex flex-col min-h-0 gap-0.5">
                    {machine.instruments.map((inst, instIdx) => (
                        <div key={inst.id} className="flex flex-1 min-h-0">

                            {/* Label */}
                            <div className="w-28 flex-shrink-0 flex items-center gap-1.5 pr-2 border-r-2 border-black">
                                <div
                                    className="w-1 flex-shrink-0 self-stretch"
                                    style={{ backgroundColor: machine.grid[instIdx].some(s => s) ? '#000' : '#d1d5db' }}
                                />
                                <span className="font-bold text-[10px] tracking-tight uppercase truncate leading-none flex-1 min-w-0">
                                    {inst.name}
                                </span>
                                <button
                                    onClick={() => machine.toggleMute(instIdx)}
                                    title={machine.mutedTracks[instIdx] ? 'Unmute' : 'Mute'}
                                    className={`flex-shrink-0 w-5 h-5 border border-black text-[8px] font-black flex items-center justify-center transition-colors
                                        ${machine.mutedTracks[instIdx] ? 'bg-black text-white' : 'hover:bg-gray-200'}`}
                                >
                                    M
                                </button>
                            </div>

                            {/* Step cells */}
                            <div className="flex-1 flex gap-0.5 pl-0.5">
                                {machine.grid[instIdx].map((isActive, stepIdx) => {
                                    const isBeatStart = stepIdx % machine.subdiv === 0;
                                    const isCurrentStep = machine.currentStep === stepIdx;

                                    // R/L sticking label on snare when a rudiment is active
                                    let sticking = null;
                                    if (inst.id === 'snare' && machine.activeRudiment) {
                                        sticking = machine.activeRudiment.sticking[stepIdx % machine.activeRudiment.sticking.length];
                                    }

                                    // Compute background/border inline so we can use the accent variable
                                    let bg, border, textColor;
                                    if (isActive && isCurrentStep) {
                                        // Playing right now → accent highlight
                                        bg = ACCENT;
                                        border = ACCENT;
                                        textColor = '#fff';
                                    } else if (isActive) {
                                        // Programmed but not currently playing
                                        if (sticking === 'L') {
                                            bg = '#737373'; // neutral-500
                                            border = '#737373';
                                        } else {
                                            bg = '#000';
                                            border = '#000';
                                        }
                                        textColor = '#fff';
                                    } else if (isCurrentStep) {
                                        // Playhead passing over empty cell
                                        bg = '#e5e7eb';
                                        border = '#d1d5db';
                                        textColor = 'transparent';
                                    } else {
                                        bg = 'transparent';
                                        border = isBeatStart ? '#000' : '#d1d5db';
                                        textColor = 'transparent';
                                    }

                                    return (
                                        <button
                                            key={stepIdx}
                                            onMouseDown={() => machine.toggleCell(instIdx, stepIdx)}
                                            disabled={machine.mutedTracks[instIdx]}
                                            className={`flex-1 flex items-center justify-center text-[10px] font-black transition-colors duration-75
                                                ${isBeatStart ? 'border-l-2' : 'border-l'}
                                                ${machine.mutedTracks[instIdx] ? 'opacity-25 cursor-not-allowed' : ''}
                                                ${!isActive && !isCurrentStep ? 'hover:bg-gray-200' : ''}
                                            `}
                                            style={{
                                                backgroundColor: bg,
                                                borderColor: border,
                                                borderTopWidth: '1px',
                                                borderBottomWidth: '1px',
                                                borderRightWidth: '1px',
                                                color: textColor,
                                            }}
                                        >
                                            {isActive && sticking && <span>{sticking}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── RUDIMENTS ── */}
            <div className="border-t-2 border-black bg-white flex-shrink-0">
                <button
                    onClick={() => setShowRudiments(!showRudiments)}
                    className="w-full flex justify-between items-center px-4 py-2 hover:bg-gray-100 text-xs font-bold uppercase"
                >
                    <span>
                        RUDIMENTS
                        {machine.activeRudiment && (
                            <span className="text-gray-400 font-normal ml-2">// {machine.activeRudiment.name.toUpperCase()}</span>
                        )}
                    </span>
                    <ChevronDown size={14} className={`transition-transform ${showRudiments ? 'rotate-180' : ''}`} />
                </button>

                {showRudiments && (
                    <div className="px-4 pb-3 pt-2 border-t-2 border-black bg-gray-50 flex flex-wrap gap-2 overflow-y-auto max-h-48">
                        {RUDIMENTS.map(rudiment => (
                            <button
                                key={rudiment.id}
                                onClick={() => { machine.loadRudiment(rudiment); setShowRudiments(false); }}
                                className="border border-black px-3 py-2 bg-white hover:bg-black hover:text-white transition-all text-left group min-w-[160px]"
                            >
                                <div className="text-[10px] font-bold uppercase mb-1 flex justify-between">
                                    {rudiment.name}
                                    <span className="opacity-0 group-hover:opacity-100">LOAD</span>
                                </div>
                                <div className="text-[9px] font-mono flex gap-0.5">
                                    {rudiment.sticking.slice(0, 8).map((s, i) => (
                                        <span
                                            key={i}
                                            className="px-0.5"
                                            style={{
                                                backgroundColor: s === 'R' ? '#000' : s === 'L' ? '#737373' : 'transparent',
                                                color: s ? '#fff' : '#9ca3af',
                                            }}
                                        >
                                            {s || '·'}
                                        </span>
                                    ))}
                                    {rudiment.sticking.length > 8 && <span className="text-gray-300">…</span>}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── AI MODAL ── */}
            {ai.showAiModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white border-4 border-black p-8 w-full max-w-2xl shadow-[16px_16px_0px_#000]">
                        <div className="flex justify-between items-center mb-8 border-b-4 border-black pb-4">
                            <h2 className="text-3xl font-black uppercase flex items-center gap-4">
                                <Terminal size={32} /> AI_SEQ_GEN
                            </h2>
                            <button onClick={() => ai.setShowAiModal(false)} className="hover:rotate-90 transition-transform">
                                <X size={32} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold uppercase">Input Prompt</label>
                                <textarea
                                    value={ai.aiPrompt}
                                    onChange={e => ai.setAiPrompt(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && ai.handleGeneratePattern()}
                                    placeholder="DESCRIBE_PATTERN :: e.g. 'HEAVY INDUSTRIAL TECHNO', 'BROKEN BEAT JUNGLE'"
                                    className="w-full h-32 border-2 border-black p-4 font-mono text-lg resize-none focus:outline-none focus:bg-gray-50 placeholder:text-gray-300"
                                />
                            </div>

                            {ai.aiError && (
                                <div className="bg-red-600 text-white p-2 text-xs font-bold">
                                    ERROR :: {ai.aiError}
                                </div>
                            )}

                            <button
                                onClick={ai.handleGeneratePattern}
                                disabled={ai.isGenerating || !ai.aiPrompt.trim()}
                                className="w-full h-16 bg-black text-white font-black text-xl uppercase tracking-widest hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4"
                            >
                                {ai.isGenerating
                                    ? <span className="animate-pulse">PROCESSING...</span>
                                    : <><Sparkles /> GENERATE_SEQUENCE</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
