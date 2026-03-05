import { instruments } from '../hooks/useDrumMachine';

export const exportMidi = (grid, bpm, subdiv, mutedTracks) => {
    const TICKS_PER_BEAT = 480;
    const totalSteps = grid[0].length;
    const swing = 0; // Simplified export without accessing internal swing ref for now, or pass it in if needed

    const toVLQ = (num) => {
        const ret = [];
        let t = num;
        ret.push(t & 0x7F);
        t >>= 7;
        while (t > 0) {
            ret.push((t & 0x7F) | 0x80);
            t >>= 7;
        }
        return ret.reverse();
    };

    const events = [];
    const midiMap = {
        'woodblock': 76, 'hihat_open': 46, 'hihat_closed': 42,
        'clap': 39, 'snare': 38, 'tom_low': 45, 'kick': 36, 'metronome': 76
    };

    let currentTick = 0;
    const baseStepTicks = TICKS_PER_BEAT / subdiv;

    for (let step = 0; step < totalSteps; step++) {
        const duration = baseStepTicks;
        // Note: Swing logic omitted for simplicity in this utility version unless swing passed explicitly

        instruments.forEach((inst, idx) => {
            if (grid[idx][step] && !mutedTracks[idx]) {
                const note = midiMap[inst.id] || 38;
                events.push({ type: 'on', note, velocity: 100, tick: Math.round(currentTick) });
                events.push({ type: 'off', note, velocity: 0, tick: Math.round(currentTick + Math.min(60, duration)) });
            }
        });
        currentTick += duration;
    }

    events.sort((a, b) => a.tick - b.tick);

    const trackData = [];
    let lastTick = 0;

    const mpqn = Math.round(60000000 / bpm);
    trackData.push(0x00, 0xFF, 0x51, 0x03, (mpqn >> 16) & 0xFF, (mpqn >> 8) & 0xFF, mpqn & 0xFF);

    events.forEach(e => {
        const delta = e.tick - lastTick;
        lastTick = e.tick;
        trackData.push(...toVLQ(delta));
        if (e.type === 'on') {
            trackData.push(0x99, e.note, e.velocity);
        } else {
            trackData.push(0x89, e.note, e.velocity);
        }
    });

    trackData.push(0x00, 0xFF, 0x2F, 0x00);

    const header = [
        0x4D, 0x54, 0x68, 0x64,
        0x00, 0x00, 0x00, 0x06,
        0x00, 0x00,
        0x00, 0x01,
        (TICKS_PER_BEAT >> 8) & 0xFF, TICKS_PER_BEAT & 0xFF
    ];

    const trackHeader = [
        0x4D, 0x54, 0x72, 0x6B,
        (trackData.length >> 24) & 0xFF, (trackData.length >> 16) & 0xFF, (trackData.length >> 8) & 0xFF, trackData.length & 0xFF
    ];

    const fileBytes = new Uint8Array([...header, ...trackHeader, ...trackData]);
    const blob = new Blob([fileBytes], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rhythm-craft-beat.mid';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
