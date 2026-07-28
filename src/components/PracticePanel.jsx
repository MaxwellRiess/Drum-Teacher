import React from 'react';
import { Activity, Zap, X, Sliders, Radio, Timer, TrendingUp, Maximize2, Minimize2 } from 'lucide-react';
import { instruments } from '../hooks/useDrumMachine';
import { VERDICT_COLOURS } from '../utils/scoring';

const btn = 'border-2 border-black flex items-center justify-center font-bold transition-colors';
const label = 'text-[9px] font-bold uppercase text-gray-500';

// ── Compact header strip ─────────────────────────────────────────────────────
export function PracticeBar({ practice }) {
    const { enabled, setEnabled, setSetupOpen, midi } = practice;

    const connected = midi.status === 'granted' && midi.selectedId;
    const deviceName = midi.inputs.find(i => i.id === midi.selectedId)?.name;

    return (
        <>
            <button
                onClick={() => setEnabled(!enabled)}
                disabled={!connected}
                title={connected ? 'Toggle practice mode' : 'Connect a MIDI device first'}
                className={`h-10 px-3 gap-2 text-sm ${btn}
                    ${enabled ? 'bg-[#16a34a] border-[#16a34a] text-white' : 'hover:bg-black hover:text-white'}
                    ${!connected ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
                <Activity size={14} /> PRACTICE
            </button>

            <button
                onClick={() => setSetupOpen(true)}
                className={`h-10 w-10 ${btn} hover:bg-black hover:text-white`}
                title="Practice setup"
            >
                <Sliders size={14} />
            </button>

            {/* Accuracy and feel now live in ScorePanel beside the notation,
                where there is room to read them mid-phrase. */}
            {enabled && deviceName && (
                <span className="text-[9px] font-bold uppercase text-gray-400 truncate max-w-[140px]">
                    {deviceName}
                </span>
            )}
        </>
    );
}

// ── Setup modal ──────────────────────────────────────────────────────────────
export function PracticeSetupModal({ practice }) {
    const {
        setupOpen, setSetupOpen, midi,
        midiMap, learnTarget, setLearnTarget, clearMapping, resetMapping,
        settings, updateSettings,
        calibration, calibrating, calibrationProgress, calibrationError,
        startCalibration, setCalibrationOffset,
        recentPasses, timingDiag, applySuggestedOffset,
    } = practice;

    if (!setupOpen) return null;

    const Section = ({ icon: Icon, title, children }) => (
        <div className="border-2 border-black">
            <div className="bg-black text-white px-3 py-1.5 flex items-center gap-2">
                <Icon size={12} />
                <h3 className="text-[11px] font-black uppercase tracking-wide">{title}</h3>
            </div>
            <div className="p-3 space-y-3">{children}</div>
        </div>
    );

    const Slider = ({ text, value, min, max, step = 1, suffix, onChange }) => (
        <div className="flex items-center gap-2">
            <span className={`${label} w-28 flex-shrink-0`}>{text}</span>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="flex-1 h-1.5 cursor-pointer" style={{ accentColor: '#000' }}
            />
            <span className="w-16 text-right text-xs font-bold tabular-nums">{value}{suffix}</span>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white border-4 border-black w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-[16px_16px_0px_#000]">

                <div className="flex justify-between items-center px-6 py-4 border-b-4 border-black sticky top-0 bg-white z-10">
                    <h2 className="text-2xl font-black uppercase flex items-center gap-3">
                        <Activity size={26} /> PRACTICE_SETUP
                    </h2>
                    <button onClick={() => setSetupOpen(false)} className="hover:rotate-90 transition-transform">
                        <X size={26} />
                    </button>
                </div>

                <div className="p-6 space-y-4">

                    {/* ── MIDI device ─────────────────────────────────────── */}
                    <Section icon={Radio} title="1 · MIDI Input">
                        {!midi.supported && (
                            <p className="text-xs text-red-600 font-bold">
                                This browser has no Web MIDI support. Use Chrome or Edge.
                                Safari does not implement it.
                            </p>
                        )}

                        {midi.supported && midi.status !== 'granted' && (
                            <div className="space-y-2">
                                <button
                                    onClick={midi.requestAccess}
                                    className="h-10 px-4 bg-black text-white font-bold text-sm uppercase hover:bg-neutral-700"
                                >
                                    {midi.status === 'requesting' ? 'Requesting…' : 'Connect MIDI'}
                                </button>
                                {midi.error && <p className="text-xs text-red-600 font-bold">{midi.error}</p>}
                                <p className="text-[10px] text-gray-500 leading-relaxed">
                                    Plug the Aerodrums in first, then allow the browser prompt.
                                    Web MIDI needs localhost or https.
                                </p>
                            </div>
                        )}

                        {midi.status === 'granted' && (
                            <div className="space-y-2">
                                {midi.inputs.length === 0 ? (
                                    <p className="text-xs text-amber-600 font-bold">
                                        Access granted but no input devices found. Check the kit is connected
                                        and, if MIDI only flows while the Aerodrums software runs, start it.
                                    </p>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className={`${label} w-28`}>Device</span>
                                        <select
                                            value={midi.selectedId ?? ''}
                                            onChange={e => midi.selectInput(e.target.value)}
                                            className="flex-1 border-2 border-black px-2 h-9 text-xs font-bold bg-white"
                                        >
                                            <option value="">— select —</option>
                                            {midi.inputs.map(i => (
                                                <option key={i.id} value={i.id}>
                                                    {i.name}{i.manufacturer ? ` · ${i.manufacturer}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="bg-gray-100 border border-gray-300 px-3 py-2 text-[10px] font-mono">
                                    LAST MESSAGE ::{' '}
                                    {midi.lastMessage
                                        ? `note ${midi.lastMessage.note} · vel ${midi.lastMessage.velocity} · ch ${midi.lastMessage.channel + 1} · ${midi.lastMessage.type}`
                                        : 'nothing received yet — hit a drum'}
                                </div>
                            </div>
                        )}
                    </Section>

                    {/* ── Calibration ─────────────────────────────────────── */}
                    <Section icon={Timer} title="2 · Latency Calibration">
                        <p className="text-[10px] text-gray-600 leading-relaxed">
                            The chain from stick to browser adds roughly 15–25 ms, and your speakers add
                            more. Without measuring it every hit reads as late. Hit <strong>any</strong> pad
                            on each click, sixteen times.
                        </p>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={startCalibration}
                                disabled={calibrating || midi.status !== 'granted'}
                                className="h-10 px-4 bg-black text-white font-bold text-sm uppercase hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {calibrating ? 'Listening…' : 'Run calibration'}
                            </button>

                            <div className="flex flex-col leading-none">
                                <span className={label}>Offset</span>
                                <span className="text-base font-black tabular-nums">
                                    {calibration.offsetMs} ms
                                </span>
                            </div>

                            {calibration.samples > 0 && (
                                <span className="text-[9px] text-gray-400 uppercase font-bold">
                                    {calibration.samples} samples
                                </span>
                            )}
                            {calibration.failed && (
                                <span className="text-[9px] text-red-600 uppercase font-bold">
                                    Too few hits detected — try again
                                </span>
                            )}
                        </div>

                        {calibrationError && (
                            <p className="text-[11px] font-bold text-red-600">{calibrationError}</p>
                        )}

                        {calibrating && (
                            <div className="h-2 border-2 border-black">
                                <div
                                    className="h-full bg-black transition-all"
                                    style={{ width: `${calibrationProgress * 100}%` }}
                                />
                            </div>
                        )}

                        <Slider
                            text="Manual trim" value={calibration.offsetMs}
                            min={-200} max={600} suffix=" ms"
                            onChange={setCalibrationOffset}
                        />

                        {/* Measured while you actually play, with no match window
                            applied, so it still reports a number when every hit
                            is being scored as a miss. */}
                        {timingDiag && (
                            <div className="border-2 border-black bg-gray-50 p-3 space-y-2">
                                <div className="flex items-baseline gap-3">
                                    <span className={label}>Measured while playing</span>
                                    <span className="text-base font-black tabular-nums">
                                        {timingDiag.medianMs > 0 ? '+' : ''}{timingDiag.medianMs} ms
                                    </span>
                                    <span className="text-[9px] text-gray-400 uppercase font-bold">
                                        {timingDiag.count} hits · {timingDiag.instrument}
                                        {timingDiag.reliableToMs ? ` · ±${timingDiag.reliableToMs}ms range` : ''}
                                    </span>
                                </div>

                                <p className="text-[10px] text-gray-600 leading-relaxed">
                                    {Math.abs(timingDiag.medianMs) <= settings.windows.tight
                                        ? 'Your hits are landing on the notes. Nothing to correct.'
                                        : `Your hits land a consistent ${Math.abs(timingDiag.medianMs)} ms ` +
                                          `${timingDiag.medianMs > 0 ? 'after' : 'before'} their notes. ` +
                                          `A steady offset this size is latency, not playing — correcting it ` +
                                          `is what turns the grid green.`}
                                </p>

                                {Math.abs(timingDiag.medianMs) > settings.windows.tight && (
                                    <button
                                        onClick={applySuggestedOffset}
                                        className="h-9 px-4 bg-black text-white font-bold text-xs uppercase hover:bg-neutral-700"
                                    >
                                        Set offset to {timingDiag.suggestedOffsetMs} ms
                                    </button>
                                )}
                            </div>
                        )}
                    </Section>

                    {/* ── Mapping ─────────────────────────────────────────── */}
                    <Section icon={Zap} title="3 · Drum Mapping">
                        <p className="text-[10px] text-gray-600 leading-relaxed">
                            Aerodrums sends roughly General MIDI, but with extra notes for articulations,
                            and it is remappable in its own software. Press LEARN and hit the pad to be sure.
                        </p>

                        <div className="space-y-1">
                            {instruments.map(inst => {
                                if (inst.id === 'metronome') return null;
                                const notes = midiMap[inst.id] ?? [];
                                const isLearning = learnTarget === inst.id;
                                return (
                                    <div key={inst.id} className="flex items-center gap-2 border border-gray-300 px-2 py-1">
                                        <span className="text-[10px] font-bold uppercase w-24 flex-shrink-0">
                                            {inst.name}
                                        </span>
                                        <span className="flex-1 text-[10px] font-mono text-gray-500">
                                            {isLearning
                                                ? <span className="text-black font-bold animate-pulse">HIT THE PAD NOW…</span>
                                                : notes.length ? notes.join(', ') : <span className="text-red-500">unmapped</span>}
                                        </span>
                                        <button
                                            onClick={() => setLearnTarget(isLearning ? null : inst.id)}
                                            className={`px-2 h-6 border border-black text-[9px] font-bold uppercase
                                                ${isLearning ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}
                                        >
                                            {isLearning ? 'Cancel' : 'Learn'}
                                        </button>
                                        <button
                                            onClick={() => clearMapping(inst.id)}
                                            className="px-2 h-6 border border-gray-400 text-[9px] font-bold uppercase text-gray-500 hover:bg-red-600 hover:text-white hover:border-red-600"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            onClick={resetMapping}
                            className="text-[9px] font-bold uppercase text-gray-400 hover:text-black underline"
                        >
                            Reset to defaults
                        </button>
                    </Section>

                    {/* ── Tolerances ──────────────────────────────────────── */}
                    <Section icon={Sliders} title="4 · Tolerances">
                        <Slider
                            text="On time within" value={settings.windows.tight}
                            min={5} max={60} suffix=" ms"
                            onChange={v => updateSettings({ windows: { ...settings.windows, tight: v } })}
                        />
                        <Slider
                            text="Counts as a hit" value={settings.windows.loose}
                            min={30} max={400} suffix=" ms"
                            onChange={v => updateSettings({ windows: { ...settings.windows, loose: Math.max(v, settings.windows.tight + 5) } })}
                        />
                        <p className="text-[10px] text-gray-500 leading-relaxed">
                            Widening this is not the fix for everything reading as a miss — that is
                            a latency offset, and the diagnostic below measures it.
                        </p>
                        <Slider
                            text="Velocity floor" value={settings.velocityFloor}
                            min={0} max={80}
                            onChange={v => updateSettings({ velocityFloor: v })}
                        />
                        <p className="text-[10px] text-gray-500 leading-relaxed">
                            Raise the velocity floor if stray movement registers as extra hits.
                        </p>
                    </Section>

                    {/* ── Tempo ramp ──────────────────────────────────────── */}
                    <Section icon={TrendingUp} title="5 · Tempo Ramp">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox" checked={settings.rampEnabled}
                                onChange={e => updateSettings({ rampEnabled: e.target.checked })}
                                className="w-4 h-4 accent-black"
                            />
                            <span className="text-[11px] font-bold uppercase">
                                Speed up automatically when I play it clean
                            </span>
                        </label>

                        <Slider
                            text="Clean means" value={Math.round(settings.rampThreshold * 100)}
                            min={50} max={100} suffix="% on time"
                            onChange={v => updateSettings({ rampThreshold: v / 100 })}
                        />
                        <Slider
                            text="Passes needed" value={settings.rampBars}
                            min={1} max={8}
                            onChange={v => updateSettings({ rampBars: v })}
                        />
                        <Slider
                            text="Step up by" value={settings.rampStep}
                            min={1} max={20} suffix=" bpm"
                            onChange={v => updateSettings({ rampStep: v })}
                        />
                        <Slider
                            text="Stop at" value={settings.rampCeiling}
                            min={80} max={220} suffix=" bpm"
                            onChange={v => updateSettings({ rampCeiling: v })}
                        />
                    </Section>

                    {/* ── Recent passes ───────────────────────────────────── */}
                    {recentPasses.length > 0 && (
                        <Section icon={Activity} title="Recent Passes">
                            <div className="flex items-end gap-1 h-20">
                                {recentPasses.map((p, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                        <div
                                            className="w-full"
                                            style={{
                                                height: `${Math.max(2, p.accuracy * 64)}px`,
                                                backgroundColor: p.accuracy >= 0.85 ? VERDICT_COLOURS.good
                                                    : p.accuracy >= 0.5 ? VERDICT_COLOURS.early
                                                        : VERDICT_COLOURS.miss,
                                            }}
                                        />
                                        <span className="text-[8px] font-bold tabular-nums text-gray-400">
                                            {Math.round(p.accuracy * 100)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Live score panel ─────────────────────────────────────────────────────────
// Sits beside the notation, in space the centred stave was leaving empty. Sized
// to be readable from playing distance rather than from a mouse.
export function ScorePanel({ practice, windows, expanded = false, onToggleExpand }) {
    const { passStats, recentHits, extraCount, calibration } = practice;

    const accuracy = passStats ? Math.round(passStats.accuracy * 100) : null;
    const offset = passStats?.meanOffsetMs;

    // The meter spans the "counts as a hit" window, so a mark's distance from
    // centre is directly how much of the tolerance was used up.
    const span = windows.loose;
    const positionPct = (deltaMs) =>
        50 + Math.max(-50, Math.min(50, (deltaMs / span) * 50));

    // Expanded is the same panel scaled for reading from playing distance,
    // rather than a second component that could drift out of step with this one.
    const sz = expanded
        ? {
            wrap: 'flex-1 min-h-0',
            accuracy: 'text-[9rem] leading-[0.85]',
            pct: 'text-6xl',
            feel: 'text-6xl',
            feelUnit: 'text-2xl',
            caption: 'text-sm',
            meter: 'flex-1 min-h-[160px]',
            mark: 'w-[6px]',
            tallyText: 'text-base',
            tallyNum: 'text-2xl',
            swatch: 'w-4 h-4',
            pad: 'p-6 space-y-6',
        }
        : {
            wrap: 'w-[290px] flex-shrink-0',
            accuracy: 'text-5xl',
            pct: 'text-2xl',
            feel: 'text-lg',
            feelUnit: 'text-xs',
            caption: label,
            meter: 'h-14',
            mark: 'w-[3px]',
            tallyText: 'text-[9px]',
            tallyNum: 'text-[11px]',
            swatch: 'w-2.5 h-2.5',
            pad: 'p-3 space-y-3',
        };

    const counts = passStats?.counts;
    const tally = [
        ['On time', counts?.good ?? 0, VERDICT_COLOURS.good],
        ['Early', counts?.early ?? 0, VERDICT_COLOURS.early],
        ['Late', counts?.late ?? 0, VERDICT_COLOURS.late],
        ['Missed', counts?.miss ?? 0, VERDICT_COLOURS.miss],
        ['Extra', extraCount, VERDICT_COLOURS.extra],
    ];

    const feelColour = offset == null ? '#000'
        : Math.abs(offset) < 8 ? VERDICT_COLOURS.good
            : offset < 0 ? VERDICT_COLOURS.early : VERDICT_COLOURS.late;

    return (
        <div className={`${sz.wrap} border-2 border-black bg-white flex flex-col`}>
            <div className="bg-black text-white px-3 py-1 flex items-center gap-2">
                <Activity size={expanded ? 14 : 11} />
                <h3 className={`${expanded ? 'text-sm' : 'text-[10px]'} font-black uppercase tracking-wide`}>
                    Live timing
                </h3>
                {calibration.offsetMs === 0 && !calibration.manual && !calibration.fromLivePlay && (
                    <span className="text-[8px] font-bold uppercase text-amber-400">
                        Uncalibrated
                    </span>
                )}
                <button
                    onClick={onToggleExpand}
                    title={expanded ? 'Shrink (Esc)' : 'Fill the screen'}
                    className="ml-auto hover:opacity-60 transition-opacity"
                >
                    {expanded ? <Minimize2 size={16} /> : <Maximize2 size={13} />}
                </button>
            </div>

            <div className={`${sz.pad} flex-1 flex flex-col min-h-0`}>

                {/* ── Headline accuracy ── */}
                <div className="flex items-end justify-between flex-shrink-0">
                    <div className="leading-none">
                        <div className={`${sz.accuracy} font-black tabular-nums`}>
                            {accuracy === null ? '—' : accuracy}
                            {accuracy !== null && <span className={sz.pct}>%</span>}
                        </div>
                        <div className={`${sz.caption} font-bold uppercase text-gray-500 mt-1`}>
                            On time, last pass
                        </div>
                    </div>
                    <div className="text-right leading-none">
                        <div
                            className={`${sz.feel} font-black tabular-nums`}
                            style={{ color: feelColour }}
                        >
                            {offset == null ? '—' : `${offset > 0 ? '+' : ''}${Math.round(offset)}`}
                            {offset != null && <span className={sz.feelUnit}>ms</span>}
                        </div>
                        <div className={`${sz.caption} font-bold uppercase text-gray-500 mt-1`}>
                            {offset == null ? 'Feel'
                                : Math.abs(offset) < 8 ? 'Locked'
                                    : offset < 0 ? 'Rushing' : 'Dragging'}
                        </div>
                    </div>
                </div>

                {/* ── Timing meter ── */}
                {/* One mark per recent note, oldest faintest, so the drift of a
                    whole phrase is visible rather than just the last hit. */}
                <div className={`${expanded ? 'flex-1 flex flex-col min-h-0 mt-6' : 'mt-3'}`}>
                    <div className="flex justify-between mb-1 flex-shrink-0">
                        <span
                            className={`${expanded ? 'text-sm' : 'text-[8px]'} font-bold uppercase`}
                            style={{ color: VERDICT_COLOURS.early }}
                        >
                            ◀ Early
                        </span>
                        <span className={`${sz.caption} font-bold uppercase text-gray-500`}>±{span}ms</span>
                        <span
                            className={`${expanded ? 'text-sm' : 'text-[8px]'} font-bold uppercase`}
                            style={{ color: VERDICT_COLOURS.late }}
                        >
                            Late ▶
                        </span>
                    </div>

                    <div className={`relative ${sz.meter} border-2 border-black bg-gray-50 overflow-hidden`}>
                        {/* on-time band */}
                        <div
                            className="absolute inset-y-0"
                            style={{
                                left: `${positionPct(-windows.tight)}%`,
                                right: `${100 - positionPct(windows.tight)}%`,
                                backgroundColor: `${VERDICT_COLOURS.good}22`,
                            }}
                        />
                        {/* centre line */}
                        <div className="absolute inset-y-0 left-1/2 w-px bg-black opacity-60" />

                        {/* At full size there is room to label the scale. The
                            outermost two sit exactly on the edges, so they are
                            anchored inward instead of centred or they clip. */}
                        {expanded && [-span, -windows.tight, windows.tight, span].map(v => {
                            const atLeftEdge = v === -span;
                            const atRightEdge = v === span;
                            return (
                                <div
                                    key={v}
                                    className={`absolute bottom-1 text-[10px] font-bold tabular-nums text-gray-400
                                        ${atLeftEdge || atRightEdge ? '' : '-translate-x-1/2'}`}
                                    style={atLeftEdge ? { left: '4px' }
                                        : atRightEdge ? { right: '4px' }
                                            : { left: `${positionPct(v)}%` }}
                                >
                                    {v > 0 ? `+${v}` : v}
                                </div>
                            );
                        })}

                        {recentHits.map((h, i) => {
                            if (h.deltaMs == null) return null;
                            const age = recentHits.length - i;
                            return (
                                <div
                                    key={h.id}
                                    title={`${h.instrument} ${h.deltaMs > 0 ? '+' : ''}${Math.round(h.deltaMs)}ms`}
                                    className={`absolute ${sz.mark} rounded-sm`}
                                    style={{
                                        left: `calc(${positionPct(h.deltaMs)}% - ${expanded ? 3 : 1.5}px)`,
                                        top: '6%',
                                        height: expanded ? '80%' : '88%',
                                        backgroundColor: VERDICT_COLOURS[h.verdict],
                                        opacity: Math.max(0.18, 1 - age * 0.06),
                                    }}
                                />
                            );
                        })}

                        {recentHits.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`${sz.caption} font-bold uppercase text-gray-400`}>
                                    Play to see timing
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Tally ── */}
                <div className={`grid ${expanded ? 'grid-cols-5 gap-4 mt-6' : 'grid-cols-2 gap-x-3 gap-y-1 mt-3'} flex-shrink-0`}>
                    {tally.map(([text, count, colour]) => (
                        <div key={text} className="flex items-center gap-1.5">
                            <span
                                className={`${sz.swatch} border border-black flex-shrink-0`}
                                style={{ backgroundColor: colour }}
                            />
                            <span className={`${sz.tallyText} font-bold uppercase text-gray-500 flex-1 truncate`}>
                                {text}
                            </span>
                            <span className={`${sz.tallyNum} font-black tabular-nums`}>{count}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
