import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const designs = [
    { id: 1, name: "Industrial / Brutalist", desc: "Raw, unpolished, structural." },
    { id: 2, name: "Cyberpunk / Neon", desc: "Glowing, dark, futuristic." },
    { id: 3, name: "Organic / Natural", desc: "Soft, flowing, earth tones." },
    { id: 4, name: "Swiss / Minimalist", desc: "Clean, grid-based, typographic." },
    { id: 5, name: "Neo-Pop / Playful", desc: "Bold, colorful, tactile." },
];

export default function Home() {
    return (
        <div className="min-h-screen bg-neutral-900 text-white p-10 font-sans flex flex-col items-center justify-center">
            <h1 className="text-4xl md:text-6xl font-black mb-12 tracking-tighter uppercase">
                Drum <span className="text-neutral-500">Sequencer</span>
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl w-full">
                {designs.map((d) => (
                    <Link
                        key={d.id}
                        to={`/${d.id}`}
                        className="group relative bg-neutral-800 border border-neutral-700 p-8 rounded-2xl hover:bg-neutral-100 hover:text-black transition-all duration-300 overflow-hidden"
                    >
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight className="w-6 h-6" />
                        </div>
                        <span className="block text-6xl font-bold mb-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            0{d.id}
                        </span>
                        <h2 className="text-2xl font-bold mb-2">{d.name}</h2>
                        <p className="text-sm opacity-60 group-hover:opacity-80">{d.desc}</p>
                    </Link>
                ))}
            </div>

            <footer className="mt-20 text-neutral-600 text-sm">
                Select a design to begin sequencing.
            </footer>
        </div>
    );
}
