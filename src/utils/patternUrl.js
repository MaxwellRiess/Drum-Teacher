import { instruments, DEFAULT_BPM, DEFAULT_BEATS, DEFAULT_SUBDIV } from '../hooks/useDrumMachine';

export function encodeState({ bpm, beats, subdiv, swing, grid }) {
    // Pack grid booleans into bytes (LSB first within each byte)
    const bits = grid.flat();
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8 && i + j < bits.length; j++) {
            if (bits[i + j]) byte |= (1 << j);
        }
        bytes.push(byte);
    }
    const pattern = btoa(String.fromCharCode(...bytes));
    const params = new URLSearchParams({ bpm, beats, subdiv, swing, p: pattern });
    return `${window.location.origin}${window.location.pathname}?${params}`;
}

export function decodeState(search) {
    const params = new URLSearchParams(search);
    if (!params.has('p')) return null;

    const bpm = Number(params.get('bpm')) || DEFAULT_BPM;
    const beats = Number(params.get('beats')) || DEFAULT_BEATS;
    const subdiv = Number(params.get('subdiv')) || DEFAULT_SUBDIV;
    const swing = Number(params.get('swing')) || 0;
    const totalSteps = beats * subdiv;

    try {
        const bytes = atob(params.get('p')).split('').map(c => c.charCodeAt(0));
        const bits = bytes.flatMap(byte =>
            Array.from({ length: 8 }, (_, j) => !!(byte & (1 << j)))
        );
        const grid = Array.from({ length: instruments.length }, (_, i) =>
            Array.from({ length: totalSteps }, (_, j) => bits[i * totalSteps + j] ?? false)
        );
        return { bpm, beats, subdiv, swing, grid };
    } catch {
        return null;
    }
}
