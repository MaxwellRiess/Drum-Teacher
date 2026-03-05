import React from 'react';
import { useDrumMachine, RUDIMENTS } from '../hooks/useDrumMachine';
import { Play, Square, Pause, RotateCw, X, Zap } from 'lucide-react';

export default function Design2() {
    const machine = useDrumMachine();

    return (
        <div className="min-h-screen bg-[#050510] text-[#0ff] font-['Orbitron',_sans-serif] p-4 md:p-8 overflow-x-hidden relative">
            {/* Background Grid */}
            <div className="fixed inset-0 pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    transform: 'perspective(500px) rotateX(60deg) translateY(-100px) scale(2)',
                    opacity: 0.3
                }}
            />

            {/* Scanlines */}
            <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none" />

            <div className="relative z-10 max-w-6xl mx-auto">
                {/* Header */}
                <header className="flex justify-between items-center mb-10 border-b border-[#0ff]/50 pb-4 shadow-[0_0_15px_rgba(0,255,255,0.3)]">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#0ff] to-[#f0f] animate-pulse">
                        CYBER<span className="text-white">BEAT</span>
                    </h1>
                    <div className="flex gap-4 text-[#f0f] text-sm tracking-widest">
                        <div>BPM :: {machine.bpm}</div>
                        <div>SYS :: {machine.isPlaying ? 'ONLINE' : 'STANDBY'}</div>
                    </div>
                </header>

                {/* Controls */}
                <div className="flex flex-wrap gap-4 mb-8">
                    <button
                        onClick={machine.togglePlay}
                        className={`
                    px-8 py-3 clip-path-polygon border border-[#0ff] font-bold tracking-wider transition-all duration-200
                    shadow-[0_0_10px_rgba(0,255,255,0.5)] hover:shadow-[0_0_20px_rgba(0,255,255,0.8)]
                    ${machine.isPlaying ? 'bg-[#0ff] text-black' : 'bg-transparent text-[#0ff] hover:bg-[#0ff]/20'}
                `}
                        style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)' }}
                    >
                        {machine.isPlaying ? 'TERMINATE' : 'INITIALIZE'}
                    </button>

                    <button
                        onClick={machine.clearGrid}
                        className="px-6 py-3 border border-[#f0f] text-[#f0f] hover:bg-[#f0f]/20 transition-all font-bold tracking-wider shadow-[0_0_10px_rgba(255,0,255,0.5)]"
                        style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)' }}
                    >
                        PURGE
                    </button>

                    <div className="flex items-center gap-4 bg-[#0ff]/5 px-4 rounded border border-[#0ff]/30">
                        <span className="text-xs text-[#0ff]/70">TEMPO</span>
                        <input
                            type="range"
                            min="60"
                            max="200"
                            value={machine.bpm}
                            onChange={(e) => machine.setBpm(Number(e.target.value))}
                            className="w-32 h-1 bg-[#0ff]/30 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#0ff] [&::-webkit-slider-thumb]:shadow-[0_0_10px_#0ff]"
                        />
                    </div>
                </div>

                {/* Sequencer Grid */}
                <div className="bg-[#000]/80 border border-[#0ff]/30 p-6 rounded-lg backdrop-blur-sm shadow-[0_0_30px_rgba(0,255,255,0.1)] overflow-x-auto">
                    <div className="min-w-[800px]">
                        {/* Step Indicators */}
                        <div className="flex mb-4 ml-32 gap-1">
                            {Array.from({ length: machine.totalSteps }).map((_, i) => (
                                <div key={i} className="flex-1 text-center">
                                    <div className={`
                                h-1 w-full rounded
                                ${machine.currentStep === i ? 'bg-[#f0f] shadow-[0_0_10px_#f0f]' : 'bg-[#0ff]/20'}
                            `} />
                                </div>
                            ))}
                        </div>

                        {machine.instruments.map((inst, instIdx) => (
                            <div key={inst.id} className="flex items-center mb-3">
                                <div className="w-32 flex-shrink-0 text-sm font-bold tracking-wider text-[#0ff]/80 flex items-center gap-2">
                                    <Zap size={12} className={machine.grid[instIdx].some(x => x) ? 'text-[#f0f]' : 'text-gray-800'} />
                                    {inst.name.toUpperCase()}
                                </div>
                                <div className="flex-1 flex gap-1">
                                    {machine.grid[instIdx].map((isActive, stepIdx) => (
                                        <button
                                            key={stepIdx}
                                            onMouseDown={() => machine.toggleCell(instIdx, stepIdx)}
                                            className={`
                                        flex-1 aspect-[3/2] rounded-sm transition-all duration-100 relative overflow-hidden group
                                        sidebar-item
                                        ${isActive
                                                    ? 'bg-[#0ff] shadow-[0_0_15px_#0ff] border-none'
                                                    : 'bg-[#000] border border-[#0ff]/20 hover:border-[#0ff]/60 hover:bg-[#0ff]/10'
                                                }
                                        ${machine.currentStep === stepIdx ? 'brightness-150 ring-1 ring-white/50' : ''}
                                    `}
                                        >
                                            {isActive && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Rudiments */}
                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {RUDIMENTS.slice(0, 4).map(r => (
                        <button
                            key={r.id}
                            onClick={() => machine.loadRudiment(r)}
                            className="p-3 border border-[#f0f]/50 text-[#f0f] text-xs font-bold hover:bg-[#f0f] hover:text-black transition-all hover:shadow-[0_0_15px_#f0f]"
                        >
                            LOAD: {r.name}
                        </button>
                    ))}
                </div>

            </div>
        </div>
    );
}
