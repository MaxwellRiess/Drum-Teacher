import React from 'react';
import { useDrumMachine, RUDIMENTS } from '../hooks/useDrumMachine';
import { Play, Pause, Plus, Minus, X } from 'lucide-react';

export default function Design4() {
    const machine = useDrumMachine();

    return (
        <div className="min-h-screen bg-white text-black font-sans p-8 md:p-16 flex flex-col items-center">
            {/* Swiss Grid Layout */}
            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-y-8 gap-x-4">

                {/* Header - Left Aligned */}
                <div className="col-span-12 md:col-span-3 border-t-4 border-black pt-4">
                    <h1 className="text-5xl font-bold tracking-tight mb-2">DS—04</h1>
                    <p className="text-sm font-medium text-gray-500">Sequencer Module</p>
                </div>

                {/* Status - Center */}
                <div className="col-span-6 md:col-span-3 border-t-4 border-black pt-4 flex flex-col justify-between h-32">
                    <div className="text-xs uppercase font-bold tracking-widest text-gray-500">Tempo</div>
                    <div className="text-6xl font-bold tracking-tighter">{machine.bpm}</div>
                </div>

                {/* Status - Right */}
                <div className="col-span-6 md:col-span-6 border-t-4 border-black pt-4 flex flex-col justify-between h-32 pl-4">
                    <div className="text-xs uppercase font-bold tracking-widest text-gray-500">State</div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={machine.togglePlay}
                            className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                        >
                            {machine.isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                        </button>
                        <div className="text-xl font-medium">{machine.isPlaying ? 'Active' : 'Standby'}</div>
                    </div>
                </div>

                {/* Main Sequencer Area */}
                <div className="col-span-12 border-t border-gray-200 pt-12">
                    <div className="space-y-6">
                        {machine.instruments.map((inst, instIdx) => (
                            <div key={inst.id} className="grid grid-cols-12 gap-4 items-center group">
                                {/* Instrument Name */}
                                <div className="col-span-2 text-sm font-bold uppercase tracking-wider text-gray-400 group-hover:text-black transition-colors">
                                    {inst.name}
                                </div>

                                {/* Grid */}
                                <div className="col-span-10 grid grid-cols-16 gap-1 h-8">
                                    {machine.grid[instIdx].map((isActive, stepIdx) => (
                                        <button
                                            key={stepIdx}
                                            onMouseDown={() => machine.toggleCell(instIdx, stepIdx)}
                                            className={`
                                        h-full w-full transition-all duration-200 ease-out
                                        ${isActive ? 'bg-black' : 'bg-gray-100 hover:bg-gray-200'}
                                        ${machine.currentStep === stepIdx ? 'bg-red-500' : ''}
                                        ${isActive && machine.currentStep === stepIdx ? 'bg-red-600' : ''}
                                    `}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer / Controls */}
                <div className="col-span-12 md:col-span-6 mt-12 border-t border-gray-200 pt-4">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-gray-500">Adjustment</label>
                            <div className="flex gap-2">
                                <button
                                    className="w-8 h-8 flex items-center justify-center border border-gray-300 hover:bg-black hover:text-white transition-colors"
                                    onClick={() => machine.setBpm(b => Math.max(60, b - 5))}
                                >
                                    <Minus size={14} />
                                </button>
                                <button
                                    className="w-8 h-8 flex items-center justify-center border border-gray-300 hover:bg-black hover:text-white transition-colors"
                                    onClick={() => machine.setBpm(b => Math.min(200, b + 5))}
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-gray-500">Operation</label>
                            <button
                                onClick={machine.clearGrid}
                                className="px-4 h-8 border border-gray-300 text-xs font-bold uppercase hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
                            >
                                Clear Pattern
                            </button>
                        </div>
                    </div>
                </div>

                <div className="col-span-12 md:col-span-6 mt-12 border-t border-gray-200 pt-4 text-right">
                    <div className="text-xs text-gray-400">Helvetica Neue / 500</div>
                </div>

            </div>
        </div>
    );
}
