import { instruments, DEFAULT_BPM, DEFAULT_BEATS, DEFAULT_SUBDIV } from '../hooks/useDrumMachine';

function packBits(booleans) {
    const bytes = [];
    for (let i = 0; i < booleans.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8 && i + j < booleans.length; j++) {
            if (booleans[i + j]) byte |= (1 << j);
        }
        bytes.push(byte);
    }
    return btoa(String.fromCharCode(...bytes));
}

function unpackBits(b64, expectedLength) {
    const bytes = atob(b64).split('').map(c => c.charCodeAt(0));
    const bits = bytes.flatMap(byte =>
        Array.from({ length: 8 }, (_, j) => !!(byte & (1 << j)))
    );
    return bits.slice(0, expectedLength);
}

export function encodeState({ bpm, beats, subdiv, swing, grid, tripletGrid }) {
    const params = new URLSearchParams({
        bpm, beats, subdiv, swing,
        p: packBits(grid.flat()),
    });
    if (tripletGrid) {
        const tBits = tripletGrid.flat();
        if (tBits.some(Boolean)) params.set('tg', packBits(tBits));
    }
    return `${window.location.origin}${window.location.pathname}?${params}`;
}

export function decodeState(search) {
    const params = new URLSearchParams(search);
    if (!params.has('p')) return null;

    const bpm    = Number(params.get('bpm'))    || DEFAULT_BPM;
    const beats  = Number(params.get('beats'))  || DEFAULT_BEATS;
    const subdiv = Number(params.get('subdiv')) || DEFAULT_SUBDIV;
    const swing  = Number(params.get('swing'))  || 0;
    const totalSteps = beats * subdiv;
    const n = instruments.length;

    try {
        const gridBits = unpackBits(params.get('p'), n * totalSteps);
        const grid = Array.from({ length: n }, (_, i) =>
            gridBits.slice(i * totalSteps, (i + 1) * totalSteps)
        );

        let tripletGrid = null;
        if (params.has('tg')) {
            try {
                const tLen = n * beats * 3;
                const tBits = unpackBits(params.get('tg'), tLen);
                tripletGrid = Array.from({ length: n }, (_, i) =>
                    tBits.slice(i * beats * 3, (i + 1) * beats * 3)
                );
            } catch { /* ignore bad tg param */ }
        }

        return { bpm, beats, subdiv, swing, grid, tripletGrid };
    } catch {
        return null;
    }
}
