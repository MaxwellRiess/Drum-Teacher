import React from 'react';
import { useDrumMachine, RUDIMENTS } from '../hooks/useDrumMachine';
import { Play, Pause, Star, Music, Zap, Heart } from 'lucide-react';

export default function Design5() {
    const machine = useDrumMachine();

    const bgColors = ['bg-yellow-300', 'bg-pink-300', 'bg-blue-300', 'bg-green-300', 'bg-purple-300', 'bg-orange-300', 'bg-red-300'];

    return (
        <div className="min-h-screen bg-[#fffdf5] font-['Comic_Sans_MS',_'Chalkboard_SE',_sans-serif] p-4 md:p-8 overflow-hidden">

            {/* Floating Shapes Background (Decorative) */}
            <div className="fixed top-10 left-10 w-32 h-32 bg-yellow-400 rounded-full blur-3xl opacity-50 pointer-events-none mix-blend-multiply" />
            <div className="fixed bottom-10 right-10 w-40 h-40 bg-pink-400 rounded-full blur-3xl opacity-50 pointer-events-none mix-blend-multiply" />
            <div className="fixed top-1/2 left-1/2 w-64 h-64 bg-blue-300 rounded-full blur-3xl opacity-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2" />

            <div className="max-w-4xl mx-auto relative z-10">

                {/* Title Card */}
                <div className="bg-white border-[3px] border-black shadow-[8px_8px_0px_#000] rounded-xl p-6 mb-8 transform -rotate-1 hover:rotate-0 transition-transform duration-300">
                    <div className="flex justify-between items-center">
                        <h1 className="text-4xl md:text-6xl font-black text-black tracking-tighter drop-shadow-sm flex items-center gap-2">
                            <span className="text-pink-500">POP</span>
                            <span className="text-blue-500">DRUMS</span>
                            <Music className="w-8 h-8 md:w-12 md:h-12 text-yellow-500 animate-bounce" />
                        </h1>

                        <div className="bg-black text-white px-4 py-2 rounded-full font-bold text-xl rotate-3 shadow-lg">
                            {machine.bpm} BPM
                        </div>
                    </div>
                </div>

                {/* Play Button - Big & Chunky */}
                <div className="flex justify-center mb-8">
                    <button
                        onClick={machine.togglePlay}
                        className={`
                    w-24 h-24 rounded-2xl border-[4px] border-black shadow-[6px_6px_0px_#000] flex items-center justify-center transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#000]
                    ${machine.isPlaying ? 'bg-red-400 rotate-3' : 'bg-green-400 -rotate-3 hover:scale-110'}
                `}
                    >
                        {machine.isPlaying ? <Pause size={40} strokeWidth={3} /> : <Play size={40} className="ml-2" strokeWidth={3} />}
                    </button>
                </div>

                {/* The Grid - Card Style */}
                <div className="bg-white border-[3px] border-black shadow-[12px_12px_0px_#000] rounded-3xl p-6 md:p-8">
                    <div className="space-y-4">
                        {machine.instruments.map((inst, instIdx) => (
                            <div key={inst.id} className="flex flex-col md:flex-row gap-4 items-center">
                                {/* Instrument Icon/Label */}
                                <div className={`
                            w-full md:w-32 h-12 rounded-xl border-[2px] border-black shadow-[3px_3px_0px_#000] flex items-center justify-center font-bold text-sm uppercase
                            ${bgColors[instIdx % bgColors.length]}
                        `}>
                                    {inst.name}
                                </div>

                                {/* Steps */}
                                <div className="flex-1 flex gap-2 w-full overflow-x-auto pb-4 md:pb-0 px-2">
                                    {machine.grid[instIdx].map((isActive, stepIdx) => (
                                        <button
                                            key={stepIdx}
                                            onMouseDown={() => machine.toggleCell(instIdx, stepIdx)}
                                            className={`
                                        flex-shrink-0 w-8 h-10 md:w-full md:h-12 rounded-lg border-[2px] border-black transition-all duration-150 relative
                                        ${isActive
                                                    ? 'bg-black shadow-[0px_0px_0px_transparent] translate-y-[2px]'
                                                    : 'bg-white shadow-[3px_3px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#000]'
                                                }
                                        ${machine.currentStep === stepIdx ? 'ring-4 ring-yellow-400 ring-opacity-50 z-10 scale-110' : ''}
                                    `}
                                        >
                                            {isActive && (
                                                <span className="text-white text-xs">
                                                    {['★', '●', '▲', '■'][stepIdx % 4]}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-8 flex justify-center gap-4">
                    <button
                        onClick={machine.clearGrid}
                        className="bg-white px-6 py-3 rounded-full border-[2px] border-black shadow-[4px_4px_0px_#000] font-bold hover:bg-neutral-100 active:translate-y-[2px] active:shadow-[1px_1px_0px_#000]"
                    >
                        Clear All 🗑️
                    </button>
                    <div className="flex items-center gap-2 bg-white px-6 py-3 rounded-full border-[2px] border-black shadow-[4px_4px_0px_#000]">
                        <span>Speed 🐢</span>
                        <input
                            type="range"
                            min="60"
                            max="200"
                            value={machine.bpm}
                            onChange={(e) => machine.setBpm(Number(e.target.value))}
                            className="w-24 accent-black"
                        />
                        <span>🐇</span>
                    </div>
                </div>

            </div>
        </div>
    );
}
