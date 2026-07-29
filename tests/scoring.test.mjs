// Tests for the pure scoring logic. Run with `npm test`.
//
// Deliberately dependency-free: this covers the part of practice mode that has
// no React and no clocks in it, which is exactly the part where a subtle error
// is invisible in the UI. Several of these are regressions for bugs that
// shipped and had to be found the hard way.

import {
    classify, matchExpected, summarise, collectExtras, median,
    nearestDeltaMs, neighbourGapMs, DEFAULT_WINDOWS,
} from '../src/utils/scoring.js';

let pass = 0, fail = 0;
const check = (name, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) { pass++; console.log(`  ok   ${name}`); }
    else {
        fail++;
        console.log(`  FAIL ${name}\n       got      ${JSON.stringify(actual)}\n       expected ${JSON.stringify(expected)}`);
    }
};

const mk = (t, inst) => ({ key: `k${t}`, time: t, instrumentIndex: inst, bar: 0, step: 0 });
const hit = (t, inst, v = 100) => ({
    id: t, audioTime: t, instrumentIndex: inst, velocity: v, consumed: false, reported: false,
});

console.log('\nclassify');
check('dead on', classify(0), 'good');
check('at tight edge', classify(25), 'good');
check('just past tight, late', classify(26), 'late');
check('just past tight, early', classify(-26), 'early');
check('at loose edge', classify(70), 'late');
check('past loose', classify(71), null);

console.log('\nmatchExpected');
{
    const hits = [hit(1.010, 0)];
    const r = matchExpected(mk(1.0, 0), hits, DEFAULT_WINDOWS);
    check('10ms late is good', r.verdict, 'good');
    check('delta reported', Math.round(r.deltaMs), 10);
    check('hit consumed', hits[0].consumed, true);
}
check('40ms late is late', matchExpected(mk(1.0, 0), [hit(1.040, 0)], DEFAULT_WINDOWS).verdict, 'late');
check('40ms early is early', matchExpected(mk(1.0, 0), [hit(0.960, 0)], DEFAULT_WINDOWS).verdict, 'early');
check('way out is a miss', matchExpected(mk(1.0, 0), [hit(1.200, 0)], DEFAULT_WINDOWS).verdict, 'miss');
check('wrong drum does not count', matchExpected(mk(1.0, 0), [hit(1.005, 3)], DEFAULT_WINDOWS).verdict, 'miss');
{
    // nearest-match, not first-match
    const hits = [hit(1.050, 0), hit(1.005, 0)];
    const r = matchExpected(mk(1.0, 0), hits, DEFAULT_WINDOWS);
    check('picks the nearest hit', Math.round(r.deltaMs), 5);
    check('nearer hit consumed', hits[1].consumed, true);
    check('further hit left alone', hits[0].consumed, false);
}
{
    // one hit cannot satisfy two notes
    const hits = [hit(1.000, 0)];
    const a = matchExpected(mk(1.0, 0), hits, DEFAULT_WINDOWS);
    const b = matchExpected({ ...mk(1.03, 0), key: 'k2' }, hits, DEFAULT_WINDOWS);
    check('first note claims it', a.verdict, 'good');
    check('second note misses', b.verdict, 'miss');
}

console.log('\nsummarise');
{
    const s = summarise([
        { verdict: 'good', deltaMs: 10 },
        { verdict: 'good', deltaMs: -6 },
        { verdict: 'late', deltaMs: 40 },
        { verdict: 'miss', deltaMs: null },
    ]);
    check('total', s.total, 4);
    check('strict accuracy', s.accuracy, 0.5);
    check('hit rate', s.hitRate, 0.75);
    check('mean offset', Math.round(s.meanOffsetMs), 15);
}
{
    const s = summarise([{ verdict: 'good', deltaMs: 0 }, { verdict: 'extra', deltaMs: null }]);
    check('extras stay out of the denominator', s.total, 1);
    check('accuracy unaffected by extras', s.accuracy, 1);
    check('extras counted separately', s.counts.extra, 1);
}
check('empty is not NaN', summarise([]).accuracy, 0);

console.log('\ncollectExtras');
{
    const hits = [hit(1.0, 0), hit(2.0, 0)];
    hits[0].consumed = true;
    check('one unclaimed hit reported', collectExtras(hits, 2.5, DEFAULT_WINDOWS).length, 1);
    check('and marked so it is not double counted', collectExtras(hits, 2.5, DEFAULT_WINDOWS).length, 0);
}
check('window still open', collectExtras([hit(2.0, 0)], 2.02, DEFAULT_WINDOWS).length, 0);
{
    // Regression: an early hit must not be called an extra before the note it
    // belongs to has even been evaluated. Hit at 1.95 for a note at 2.0; that
    // note does not resolve until 2.07. Using a single window here counted
    // every early hit as both 'early' and 'extra'.
    const hits = [hit(1.95, 0)];
    check('early hit not extra before its note resolves',
        collectExtras(hits, 2.05, DEFAULT_WINDOWS).length, 0);
    check('still not extra at the moment its note resolves',
        collectExtras(hits, 2.07, DEFAULT_WINDOWS).length, 0);
    check('extra only once nothing can claim it',
        collectExtras(hits, 2.10, DEFAULT_WINDOWS).length, 1);
}

console.log('\nnearestDeltaMs / neighbourGapMs — the latency diagnostic');
{
    // A hit 250ms late is outside every match window, so matchExpected can only
    // call it a miss with no offset. The diagnostic must still report the 250,
    // or a uniformly mistimed rig looks identical to one playing nothing.
    const exp = mk(1.0, 0);
    const hits = [hit(1.25, 0)];
    check('miss reports no offset', matchExpected(exp, hits, DEFAULT_WINDOWS).deltaMs, null);
    hits[0].consumed = false;
    check('diagnostic still sees it', Math.round(nearestDeltaMs(exp, hits)), 250);
}
check('early hit reports negative', Math.round(nearestDeltaMs(mk(1.0, 0), [hit(0.8, 0)])), -200);
check('other drums ignored', nearestDeltaMs(mk(1.0, 0), [hit(1.05, 3)]), null);
check('beyond search range ignored', nearestDeltaMs(mk(1.0, 0), [hit(5.0, 0)]), null);
{
    // Aliasing: notes 272ms apart cannot measure a 250ms latency — the hit
    // lands nearer the following note and reads as a small early one.
    const dense = [mk(1.0, 0), { ...mk(1.272, 0), key: 'b' }];
    check('dense spacing', Math.round(neighbourGapMs(dense[0], dense)), 272);
    check('a 250ms-late hit aliases to -22 on a dense track',
        Math.round(nearestDeltaMs(dense[1], [hit(1.25, 0)])), -22);

    // The same latency on a sparse track measures correctly, which is why the
    // diagnostic reports whichever drum has the widest note spacing.
    const sparse = [mk(1.0, 0), { ...mk(2.09, 0), key: 'b' }];
    check('sparse spacing', Math.round(neighbourGapMs(sparse[0], sparse)), 1090);
    check('and measures the real 250ms',
        Math.round(nearestDeltaMs(sparse[0], [hit(1.25, 0)])), 250);
}
check('single note has no neighbour', neighbourGapMs(mk(1.0, 0), [mk(1.0, 0)]), null);

console.log('\nmedian');
check('odd count', median([5, 1, 3]), 3);
check('even count', median([1, 2, 3, 4]), 2.5);
check('resists outliers', median([18, 20, 19, 21, 400]), 20);
check('empty', median([]), null);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
