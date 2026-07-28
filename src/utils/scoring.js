// Timing-scoring engine. Pure functions — no React, no clocks, no I/O — so the
// matching rules can be reasoned about (and tested) on their own.
//
// All times in this module are audio-clock *seconds*; all tolerances and
// reported offsets are *milliseconds*. A positive offset means the drummer
// played late.

export const DEFAULT_WINDOWS = {
    tight: 25,  // ms — inside this counts as on time
    loose: 70,  // ms — outside this the hit isn't credited to the note at all
};

// Reference points for the window sizes: a 16th note is 125 ms at 120 bpm and
// 94 ms at 160 bpm, so a 70 ms match window stays comfortably inside one
// subdivision across the usable tempo range.

export const VERDICTS = ['good', 'early', 'late', 'miss', 'extra'];

// Early and late are deliberately a cool/warm pair rather than two shades of
// one hue: temperature reads as direction at a glance, so you can tell which
// way you are drifting without stopping to read a number. It also keeps the two
// distinguishable for red-green colour blindness, where the green/red pair is
// the weak point of this palette.
export const VERDICT_COLOURS = {
    good: '#16a34a',   // green-600
    early: '#0ea5e9',  // sky-500 — cool, ahead of the beat
    late: '#f59e0b',   // amber-500 — warm, behind it
    miss: '#dc2626',   // red-600
    extra: '#9333ea',  // purple-600
};

export function classify(deltaMs, windows = DEFAULT_WINDOWS) {
    const magnitude = Math.abs(deltaMs);
    if (magnitude <= windows.tight) return 'good';
    if (magnitude <= windows.loose) return deltaMs < 0 ? 'early' : 'late';
    return null; // outside the match window entirely
}

// Finds the best unconsumed hit for one expected note.
//
// Greedy nearest-match, applied to expected notes in time order. Not globally
// optimal, but it is predictable, and for drum patterns the ambiguous cases
// (two notes on the same drum within one match window) only arise at
// subdivisions faster than anyone practises against a grid.
export function matchExpected(expected, hits, windows = DEFAULT_WINDOWS) {
    const toleranceSec = windows.loose / 1000;
    let best = null;
    let bestDistance = Infinity;

    for (const hit of hits) {
        if (hit.consumed) continue;
        if (hit.instrumentIndex !== expected.instrumentIndex) continue;

        const delta = hit.audioTime - expected.time;
        const distance = Math.abs(delta);
        if (distance > toleranceSec) continue;

        if (distance < bestDistance) {
            bestDistance = distance;
            best = hit;
        }
    }

    if (!best) {
        return { key: expected.key, verdict: 'miss', deltaMs: null, expected };
    }

    const deltaMs = (best.audioTime - expected.time) * 1000;
    best.consumed = true;

    return {
        key: expected.key,
        verdict: classify(deltaMs, windows) ?? 'miss',
        deltaMs,
        expected,
        velocity: best.velocity,
    };
}

// Rolls a set of results into the numbers the UI and the tempo ramp need.
export function summarise(results) {
    const counts = { good: 0, early: 0, late: 0, miss: 0, extra: 0 };
    let offsetSum = 0;
    let offsetCount = 0;

    for (const r of results) {
        counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;
        if (r.deltaMs !== null && r.verdict !== 'extra') {
            offsetSum += r.deltaMs;
            offsetCount += 1;
        }
    }

    // 'extra' hits aren't notes in the pattern, so they don't belong in the
    // denominator — they're reported separately as a count.
    const total = counts.good + counts.early + counts.late + counts.miss;

    return {
        counts,
        total,
        // Strict: only dead-on hits count. This is what the tempo ramp gates on,
        // because "played every note but loosely" is exactly the state you don't
        // want to build speed from.
        accuracy: total > 0 ? counts.good / total : 0,
        // Lenient: did they hit the note at all, at any timing?
        hitRate: total > 0 ? (counts.good + counts.early + counts.late) / total : 0,
        // Signed mean tells you *which way* you're drifting: negative is rushing,
        // positive is dragging. More useful for practice than the absolute error.
        meanOffsetMs: offsetCount > 0 ? offsetSum / offsetCount : null,
    };
}

// Hits that were never claimed by an expected note, once nothing can still
// claim them.
//
// The cutoff is *two* match windows back, not one. A hit at H can be claimed by
// any expected note sitting at T within [H - loose, H + loose], and the latest
// of those notes is not itself resolved until T + loose — so H + 2·loose is the
// first moment the hit is genuinely orphaned. Using a single window here marks
// every early hit as an extra shortly before its own note gets evaluated, which
// double-counts it as both 'early' and 'extra'.
export function collectExtras(hits, nowAudioTime, windows = DEFAULT_WINDOWS) {
    const cutoff = nowAudioTime - (2 * windows.loose) / 1000;
    return hits
        .filter(h => !h.consumed && !h.reported && h.audioTime < cutoff)
        .map(h => {
            h.reported = true;
            return {
                key: `extra:${h.id}`,
                verdict: 'extra',
                deltaMs: null,
                instrumentIndex: h.instrumentIndex,
                audioTime: h.audioTime,
            };
        });
}

// Distance from an expected note to the closest hit on the same drum, with no
// window applied at all.
//
// This is the diagnostic that `matchExpected` cannot give you: once a hit falls
// outside `loose` it is simply a miss, and a miss reports no offset — so a
// setup that is uniformly 300 ms out looks identical to one where the drummer
// played nothing. Measuring without a window is what makes a large constant
// latency visible instead of silent.
export function nearestDeltaMs(expected, hits, searchSeconds = 1.5) {
    let best = null;
    for (const hit of hits) {
        if (hit.instrumentIndex !== expected.instrumentIndex) continue;
        const delta = (hit.audioTime - expected.time) * 1000;
        if (Math.abs(delta) > searchSeconds * 1000) continue;
        if (best === null || Math.abs(delta) < Math.abs(best)) best = delta;
    }
    return best;
}

// Gap in ms from a note to its closest neighbour on the same drum.
//
// This is what bounds a nearest-match measurement. Hi-hats 272 ms apart cannot
// distinguish "250 ms late" from "22 ms early on the next one" — the late hit
// simply aliases onto the following note and reports a small, healthy-looking
// number. The usable range is half the gap, so a sparse track (a kick landing
// twice a bar) measures a large latency that a busy one structurally cannot.
export function neighbourGapMs(expected, allExpected) {
    let best = null;
    for (const other of allExpected) {
        if (other === expected) continue;
        if (other.instrumentIndex !== expected.instrumentIndex) continue;
        const gap = Math.abs(other.time - expected.time) * 1000;
        if (gap > 0 && (best === null || gap < best)) best = gap;
    }
    return best;
}

// Median is the right statistic for latency calibration: a couple of badly
// mistimed taps during the routine shouldn't drag the offset.
export function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}
