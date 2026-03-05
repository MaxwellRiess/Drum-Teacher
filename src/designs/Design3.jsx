import React from 'react';
import { useDrumMachine, RUDIMENTS } from '../hooks/useDrumMachine';
import { Play, Pause, RefreshCw, Leaf } from 'lucide-react';

export default function Design3() {
    const machine = useDrumMachine();

    return (
        <div className="min-h-screen bg-[#e8e4db] text-[#4a5d4e] font-sans p-6 md:p-12 transition-colors duration-1000">
            <div className="max-w-5xl mx-auto">

                {/* Header */}
                <div className="flex justify-between items-center mb-12">
                    <h1 className="text-3xl md:text-5xl font-serif italic text-[#2c3e30]">
                        Rhythm Garden
                    </h1>
                    <div className="flex gap-2">
                        <div className={`w-3 h-3 rounded-full transition-colors duration-500 ${machine.isPlaying ? 'bg-[#8fb339]' : 'bg-[#d1d5db]'}`} />
                        <div className={`w-3 h-3 rounded-full transition-colors duration-500 delay-100 ${machine.isPlaying ? 'bg-[#8fb339]' : 'bg-[#d1d5db]'}`} />
                        <div className={`w-3 h-3 rounded-full transition-colors duration-500 delay-200 ${machine.isPlaying ? 'bg-[#8fb339]' : 'bg-[#d1d5db]'}`} />
                    </div>
                </div>

                {/* Big Play Button Overlay */}
                <div className="flex justify-center mb-10">
                    <button
                        onClick={machine.togglePlay}
                        className={`
                    w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-lg hover:shadow-xl hover:scale-105
                    ${machine.isPlaying ? 'bg-[#8fb339] text-white' : 'bg-white text-[#4a5d4e]'}
                `}
                    >
                        {machine.isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
                    </button>
                </div>

                {/* Organic Sequencer */}
                <div className="bg-[#f4f1ea] p-8 rounded-[40px] shadow-[inset_0_4px_20px_rgba(0,0,0,0.03)] overflow-x-auto">
                    <div className="min-w-[800px] flex flex-col gap-6">

                        {machine.instruments.map((inst, instIdx) => (
                            <div key={inst.id} className="flex items-center gap-6">
                                <div className="w-24 text-right font-serif italic text-lg opacity-70">
                                    {inst.name.split(' ')[0]}
                                </div>
                                <div className="flex-1 flex justify-between gap-2 relative">
                                    {/* Connecting line */}
                                    <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-[#d1d5db] -z-10" />

                                    {machine.grid[instIdx].map((isActive, stepIdx) => (
                                        <button
                                            key={stepIdx}
                                            onMouseDown={() => machine.toggleCell(instIdx, stepIdx)}
                                            className={`
                                        w-8 h-8 md:w-10 md:h-10 rounded-full border-2 transition-all duration-300 transform
                                        ${isActive
                                                    ? 'bg-[#5a7d60] border-[#5a7d60] scale-100'
                                                    : 'bg-[#f4f1ea] border-[#d1d5db] hover:border-[#8fb339] scale-75'
                                                }
                                        ${machine.currentStep === stepIdx ? 'ring-4 ring-[#8fb339]/20' : ''}
                                    `}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Controls / Parameters */}
                <div className="mt-12 flex justify-center gap-12">
                    <div className="flex flex-col items-center gap-3">
                        <label className="font-serif italic text-sm opacity-60">Flow</label>
                        <input
                            type="range"
                            min="60"
                            max="180"
                            value={machine.bpm}
                            onChange={(e) => machine.setBpm(Number(e.target.value))}
                            className="w-32 accent-[#4a5d4e]"
                        />
                    </div>

                    <button
                        onClick={machine.clearGrid}
                        className="flex flex-col items-center gap-2 group"
                    >
                        <div className="w-10 h-10 rounded-full border border-[#d1d5db] flex items-center justify-center text-[#d1d5db] group-hover:text-[#bf616a] group-hover:border-[#bf616a] transition-colors">
                            <RefreshCw size={16} />
                        </div>
                        <span className="font-serif italic text-sm opacity-60 group-hover:opacity-100 transition-opacity">Reset</span>
                    </button>
                </div>

            </div>
        </div>
    )
}
