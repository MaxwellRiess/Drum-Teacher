import { useState, useEffect, useRef, useCallback } from 'react';
import { useMidiInput } from './useMidiInput';
import { instruments } from './useDrumMachine';
import { ClockBridge } from '../utils/clockBridge';
import {
    loadMidiMap, saveMidiMap, buildNoteLookup, assignNote, clearInstrument, DEFAULT_MIDI_MAP,
} from '../utils/midiMap';
import {
    DEFAULT_WINDOWS, matchExpected, summarise, collectExtras, median, nearestDeltaMs, neighbourGapMs,
} from '../utils/scoring';

const CALIBRATION_KEY = 'drumTeacher.calibration.v1';
const SETTINGS_KEY = 'drumTeacher.practiceSettings.v1';

const CALIBRATION_CLICKS = 16;

// Slower than a musical click on purpose. Each hit is matched to its nearest
// click, so the largest offset that can be measured without ambiguity is half
// the interval. At the original 0.6 s the ceiling was 300 ms, and the 200 ms
// tolerance cut it to less — which meant a rig whose true latency was around
// 200 ms had its samples rejected and was told "too few hits detected". The
// setups most in need of calibration were exactly the ones it refused to
// measure. At 0.9 s the measurable range is ±450 ms.
const CALIBRATION_INTERVAL = 0.9;
const CALIBRATION_TOLERANCE = CALIBRATION_INTERVAL / 2;

const FLUSH_INTERVAL_MS = 50;

const DEFAULT_SETTINGS = {
    velocityFloor: 20,      // ignore incidental low-velocity noise
    windows: DEFAULT_WINDOWS,
    rampEnabled: false,
    rampThreshold: 0.85,    // fraction of notes that must be dead-on
    rampBars: 2,            // consecutive clean passes required
    rampStep: 5,            // bpm added each time
    rampCeiling: 180,
};

const loadPersisted = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch {
        return fallback;
    }
};

const persist = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
};

export const usePracticeMode = ({ machine }) => {
    const [enabled, setEnabled] = useState(false);
    const [setupOpen, setSetupOpen] = useState(false);
    const [midiMap, setMidiMap] = useState(() => loadMidiMap());
    const [learnTarget, setLearnTarget] = useState(null);
    const [settings, setSettings] = useState(() => loadPersisted(SETTINGS_KEY, DEFAULT_SETTINGS));
    const [calibration, setCalibration] = useState(
        () => loadPersisted(CALIBRATION_KEY, { offsetMs: 0, samples: 0, at: null })
    );
    const [calibrating, setCalibrating] = useState(false);
    const [calibrationProgress, setCalibrationProgress] = useState(0);

    // Scoring output, flushed to state on a throttle
    const [cellScores, setCellScores] = useState({});
    const [passStats, setPassStats] = useState(null);
    const [recentPasses, setRecentPasses] = useState([]);
    const [extraCount, setExtraCount] = useState(0);
    // Window-free view of how far hits are landing from their notes. Distinct
    // from passStats.meanOffsetMs, which only averages hits that matched — and
    // so goes blank in exactly the situation this is for.
    const [timingDiag, setTimingDiag] = useState(null);
    // Last few notes in resolution order, for the scrolling timing meter. Kept
    // separate from cellScores, which is keyed by cell and so has no sense of
    // sequence.
    const [recentHits, setRecentHits] = useState([]);

    // ── Hot-path refs (never cause renders) ─────────────────────────────────
    const hitsRef = useRef([]);
    const hitIdRef = useRef(0);
    const bridgeRef = useRef(null);
    const resolvedRef = useRef(new Set());
    const cellScoresRef = useRef({});
    const dirtyRef = useRef(false);
    const lastFlushRef = useRef(0);
    const barResultsRef = useRef(new Map());
    const lastBarRef = useRef(-1);
    const extraCountRef = useRef(0);
    const cleanRunRef = useRef(0);
    const diagRef = useRef(new Map());
    const recentHitsRef = useRef([]);

    const noteLookupRef = useRef(buildNoteLookup(midiMap));
    const settingsRef = useRef(settings);
    const calibrationRef = useRef(calibration);
    const enabledRef = useRef(enabled);
    const learnTargetRef = useRef(learnTarget);

    // Calibration state lives in refs so the click scheduler doesn't re-render
    const calibratingRef = useRef(false);
    const calibClicksRef = useRef([]);
    const calibSamplesRef = useRef([]);

    useEffect(() => { noteLookupRef.current = buildNoteLookup(midiMap); }, [midiMap]);
    useEffect(() => { settingsRef.current = settings; }, [settings]);
    useEffect(() => { calibrationRef.current = calibration; }, [calibration]);
    useEffect(() => { enabledRef.current = enabled; }, [enabled]);
    useEffect(() => { learnTargetRef.current = learnTarget; }, [learnTarget]);

    const updateSettings = useCallback((patch) => {
        setSettings(prev => {
            const next = { ...prev, ...patch };
            persist(SETTINGS_KEY, next);
            return next;
        });
    }, []);

    // ── Incoming hits ───────────────────────────────────────────────────────
    const handleNoteOn = useCallback(({ note, velocity, perfTime }) => {
        // Learn mode claims the hit instead of scoring it
        const target = learnTargetRef.current;
        if (target) {
            setMidiMap(prev => {
                const next = assignNote(prev, target, note);
                saveMidiMap(next);
                return next;
            });
            setLearnTarget(null);
            return;
        }

        if (velocity < settingsRef.current.velocityFloor) return;

        const bridge = bridgeRef.current;
        if (!bridge) return;
        bridge.maybeSync();

        const rawAudioTime = bridge.perfToAudio(perfTime);
        if (rawAudioTime === null) return;

        // Subtract the measured pipeline latency so hits land on the timeline
        // where the drummer actually played them.
        const audioTime = rawAudioTime - calibrationRef.current.offsetMs / 1000;

        if (calibratingRef.current) {
            // Deliberately the RAW time. Feeding the already-corrected time in
            // here would make each run measure only the residual left by the
            // previous run and then overwrite the offset with it — so a second
            // calibration would reset a correct offset back to roughly zero.
            calibSamplesRef.current.push({ rawAudioTime });
            return;
        }

        if (!enabledRef.current) return;

        const instrumentIndex = noteLookupRef.current.get(note);
        if (instrumentIndex === undefined) return;

        // The resolution loop trims this, but it only runs during playback.
        // Without a cap here, hits taken while stopped would accumulate.
        if (hitsRef.current.length > 512) hitsRef.current.splice(0, 256);

        hitsRef.current.push({
            id: hitIdRef.current++,
            instrumentIndex,
            audioTime,
            velocity,
            consumed: false,
            reported: false,
        });
    }, []);

    const midi = useMidiInput({
        onNoteOn: handleNoteOn,
        // Only mirror raw messages into state while the setup panel is open —
        // otherwise every hit would render the app.
        verbose: setupOpen || calibrating,
    });

    // ── Reset ───────────────────────────────────────────────────────────────
    const resetScoring = useCallback(() => {
        hitsRef.current = [];
        resolvedRef.current = new Set();
        cellScoresRef.current = {};
        barResultsRef.current = new Map();
        lastBarRef.current = -1;
        extraCountRef.current = 0;
        cleanRunRef.current = 0;
        dirtyRef.current = false;
        diagRef.current = new Map();
        recentHitsRef.current = [];
        setCellScores({});
        setPassStats(null);
        setRecentPasses([]);
        setExtraCount(0);
        setTimingDiag(null);
        setRecentHits([]);
    }, []);

    // Clear scores whenever a run starts or practice mode is toggled
    useEffect(() => { resetScoring(); }, [machine.isPlaying, enabled, resetScoring]);

    // Keep a clock bridge alive against the live audio context
    useEffect(() => {
        const ctx = machine.getAudioContext();
        if (ctx && (!bridgeRef.current || bridgeRef.current.ctx !== ctx)) {
            bridgeRef.current = new ClockBridge(ctx);
        }
    });

    // ── Resolution loop ─────────────────────────────────────────────────────
    // Walks the scheduler's expected-note record and settles each note once its
    // match window has closed. Runs on rAF but does no rendering itself; state
    // is flushed on a throttle so a busy bar can't cause 20 renders a second.
    useEffect(() => {
        if (!enabled || !machine.isPlaying) return;

        let frame;
        const tick = () => {
            const ctx = machine.getAudioContext();
            const bridge = bridgeRef.current;
            if (ctx && bridge) {
                bridge.maybeSync();

                const now = ctx.currentTime;
                const windows = settingsRef.current.windows;
                const closeAfter = windows.loose / 1000;
                const expected = machine.expectedRef.current;

                // Scan the whole record rather than tracking an index. The
                // scheduler trims its history by reassigning a filtered array,
                // which shifts every index down — a cursor would silently skip
                // notes each time that happened. The record is capped at a few
                // seconds, so this is a short scan and the resolved-key set
                // does the deduplication.
                for (let i = 0; i < expected.length; i++) {
                    const note = expected[i];
                    if (note.time + closeAfter > now) break; // window still open

                    if (resolvedRef.current.has(note.key)) continue;
                    resolvedRef.current.add(note.key);

                    // The metronome is a click track, not something you play
                    if (instruments[note.instrumentIndex]?.id === 'metronome') continue;

                    // Measured before matching, and with no window, so a rig
                    // that is uniformly hundreds of milliseconds out still
                    // reports a number instead of a silent wall of misses.
                    //
                    // Kept per instrument together with that instrument's note
                    // spacing, because a measurement is only meaningful out to
                    // half the spacing — beyond that a late hit aliases onto the
                    // next note and reads as a small early one. The flush picks
                    // whichever drum has the widest spacing.
                    const rawDelta = nearestDeltaMs(note, hitsRef.current);
                    if (rawDelta !== null) {
                        const gapMs = neighbourGapMs(note, expected);
                        if (gapMs === null || Math.abs(rawDelta) < gapMs / 2) {
                            const key = note.instrumentIndex;
                            const entry = diagRef.current.get(key)
                                ?? { gapMs: gapMs ?? Infinity, deltas: [] };
                            entry.gapMs = Math.min(entry.gapMs, gapMs ?? Infinity);
                            entry.deltas.push(rawDelta);
                            if (entry.deltas.length > 40) entry.deltas.shift();
                            diagRef.current.set(key, entry);
                        }
                    }

                    const result = matchExpected(note, hitsRef.current, windows);

                    const cellKey = `${note.isTriplet ? 't' : 's'}${note.step}:${note.instrumentIndex}`;
                    cellScoresRef.current[cellKey] = {
                        verdict: result.verdict,
                        deltaMs: result.deltaMs,
                    };
                    recentHitsRef.current.push({
                        id: note.key,
                        verdict: result.verdict,
                        deltaMs: result.deltaMs,
                        instrument: instruments[note.instrumentIndex]?.name ?? '',
                    });
                    if (recentHitsRef.current.length > 32) recentHitsRef.current.shift();
                    dirtyRef.current = true;

                    if (!barResultsRef.current.has(note.bar)) barResultsRef.current.set(note.bar, []);
                    barResultsRef.current.get(note.bar).push(result);

                    // A note from a later bar means the previous pass is settled
                    if (note.bar > lastBarRef.current) {
                        if (lastBarRef.current >= 0) finalisePass(lastBarRef.current);
                        lastBarRef.current = note.bar;
                    }
                }

                const extras = collectExtras(hitsRef.current, now, windows);
                if (extras.length) {
                    extraCountRef.current += extras.length;
                    dirtyRef.current = true;
                }

                // Drop hits that can no longer match anything
                if (hitsRef.current.length > 256) {
                    const cutoff = now - 5;
                    hitsRef.current = hitsRef.current.filter(h => h.audioTime >= cutoff);
                }

                // The resolved-key set would otherwise grow for the whole
                // session. Rebuild it from the keys still in the record.
                if (resolvedRef.current.size > 2000) {
                    const live = new Set();
                    for (const note of expected) {
                        if (resolvedRef.current.has(note.key)) live.add(note.key);
                    }
                    resolvedRef.current = live;
                }

                const elapsed = performance.now() - lastFlushRef.current;
                if (dirtyRef.current && elapsed >= FLUSH_INTERVAL_MS) {
                    lastFlushRef.current = performance.now();
                    dirtyRef.current = false;
                    setCellScores({ ...cellScoresRef.current });
                    setExtraCount(extraCountRef.current);
                    setRecentHits([...recentHitsRef.current]);

                    // Trust the sparsest drum: it has the widest unambiguous
                    // measuring range, so it is the one that can still see a
                    // large latency rather than aliasing it away.
                    let bestEntry = null;
                    let bestInst = null;
                    for (const [inst, entry] of diagRef.current) {
                        if (entry.deltas.length < 4) continue;
                        if (!bestEntry || entry.gapMs > bestEntry.gapMs) {
                            bestEntry = entry;
                            bestInst = inst;
                        }
                    }
                    if (bestEntry) {
                        const med = median(bestEntry.deltas);
                        setTimingDiag({
                            count: bestEntry.deltas.length,
                            medianMs: Math.round(med),
                            instrument: instruments[bestInst]?.name ?? '',
                            // How far the measurement can be trusted before
                            // aliasing makes it meaningless.
                            reliableToMs: Number.isFinite(bestEntry.gapMs)
                                ? Math.round(bestEntry.gapMs / 2) : null,
                            // Hits landing consistently +N ms from their notes
                            // means the pipeline delay is N ms larger than what
                            // is currently being subtracted.
                            suggestedOffsetMs:
                                Math.round((calibrationRef.current.offsetMs + med) * 10) / 10,
                        });
                    }
                }
            }
            frame = requestAnimationFrame(tick);
        };

        // finalisePass is declared here so it closes over the current machine
        function finalisePass(bar) {
            const results = barResultsRef.current.get(bar);
            if (!results || results.length === 0) return;
            barResultsRef.current.delete(bar);

            const stats = summarise(results);
            setPassStats(stats);
            setRecentPasses(prev => [...prev.slice(-9), { bar, ...stats }]);

            // ── Tempo ramp ──────────────────────────────────────────────────
            const s = settingsRef.current;
            if (!s.rampEnabled) { cleanRunRef.current = 0; return; }

            if (stats.total > 0 && stats.accuracy >= s.rampThreshold) {
                cleanRunRef.current += 1;
                if (cleanRunRef.current >= s.rampBars) {
                    cleanRunRef.current = 0;
                    machine.setBpm(prev => Math.min(s.rampCeiling, prev + s.rampStep));
                }
            } else {
                cleanRunRef.current = 0;
            }
        }

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [enabled, machine.isPlaying, machine.getAudioContext, machine.expectedRef, machine.setBpm]);

    // ── Calibration ─────────────────────────────────────────────────────────
    // Plays a bare click track and asks the drummer to hit any pad on each
    // click. The median offset is the round-trip latency of the whole chain:
    // camera frame quantisation, USB MIDI, CoreMIDI, the browser, and the
    // app's own audio output latency. Without this every hit reads as late.
    const startCalibration = useCallback(async () => {
        const ctx = machine.getAudioContext();
        if (!ctx) return;

        // Nudge the context awake — calibration may run before first playback
        if (ctx.state === 'suspended') await ctx.resume();
        bridgeRef.current = new ClockBridge(ctx);

        calibClicksRef.current = [];
        calibSamplesRef.current = [];
        calibratingRef.current = true;
        setCalibrating(true);
        setCalibrationProgress(0);

        const start = ctx.currentTime + 1.0;
        for (let i = 0; i < CALIBRATION_CLICKS; i++) {
            const t = start + i * CALIBRATION_INTERVAL;
            machine.playInstrument('metronome', t);
            calibClicksRef.current.push(t);
        }

        const totalMs = (CALIBRATION_CLICKS * CALIBRATION_INTERVAL + 1.2) * 1000;
        const startedAt = performance.now();

        const poll = setInterval(() => {
            setCalibrationProgress(Math.min(1, (performance.now() - startedAt) / totalMs));
        }, 100);

        window.setTimeout(() => {
            clearInterval(poll);
            calibratingRef.current = false;
            setCalibrating(false);
            setCalibrationProgress(1);

            // Match each recorded hit to its nearest click. The first two clicks
            // are dropped — people are still finding the pulse.
            const clicks = calibClicksRef.current.slice(2);
            const deltas = [];
            for (const hit of calibSamplesRef.current) {
                let best = null;
                let bestDistance = Infinity;
                for (const click of clicks) {
                    const d = Math.abs(hit.rawAudioTime - click);
                    if (d < bestDistance) { bestDistance = d; best = click; }
                }
                if (best !== null && bestDistance <= CALIBRATION_TOLERANCE) {
                    deltas.push((hit.rawAudioTime - best) * 1000);
                }
            }

            if (deltas.length >= 4) {
                const offsetMs = median(deltas);
                const next = {
                    offsetMs: Math.round(offsetMs * 10) / 10,
                    samples: deltas.length,
                    at: new Date().toISOString(),
                };
                persist(CALIBRATION_KEY, next);
                setCalibration(next);
            } else {
                setCalibration(prev => ({ ...prev, samples: deltas.length, failed: true }));
            }
        }, totalMs);
    }, [machine]);

    // Takes the offset the live diagnostic is suggesting and applies it, which
    // is usually faster than re-running the click routine and works even when
    // the drummer's timing is loose — the median is robust to that.
    const applySuggestedOffset = useCallback(() => {
        setTimingDiag(current => {
            if (!current) return current;
            const next = {
                offsetMs: current.suggestedOffsetMs,
                samples: current.count,
                at: new Date().toISOString(),
                fromLivePlay: true,
            };
            persist(CALIBRATION_KEY, next);
            setCalibration(next);
            // Everything already on screen was scored against the old offset,
            // so clear it rather than leaving a bar of stale reds behind.
            resetScoring();
            return null;
        });
    }, [resetScoring]);

    const setCalibrationOffset = useCallback((offsetMs) => {
        const next = { offsetMs, samples: 0, at: new Date().toISOString(), manual: true };
        persist(CALIBRATION_KEY, next);
        setCalibration(next);
    }, []);

    // ── Mapping helpers ─────────────────────────────────────────────────────
    const clearMapping = useCallback((instrumentId) => {
        setMidiMap(prev => {
            const next = clearInstrument(prev, instrumentId);
            saveMidiMap(next);
            return next;
        });
    }, []);

    const resetMapping = useCallback(() => {
        const next = { ...DEFAULT_MIDI_MAP };
        saveMidiMap(next);
        setMidiMap(next);
    }, []);

    return {
        enabled, setEnabled,
        setupOpen, setSetupOpen,
        midi,
        midiMap, learnTarget, setLearnTarget, clearMapping, resetMapping,
        settings, updateSettings,
        calibration, calibrating, calibrationProgress, startCalibration, setCalibrationOffset,
        cellScores, passStats, recentPasses, extraCount, recentHits,
        timingDiag, applySuggestedOffset,
        resetScoring,
    };
};
