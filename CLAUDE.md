# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:5173
npm run build    # Production build
npm run preview  # Preview production build
npm test         # Scoring logic tests (tests/scoring.test.mjs)
```

`npm test` covers `src/utils/scoring.js` — the part of practice mode with no React and no clocks in it, where a subtle error is invisible in the UI. Several cases are regressions for bugs that shipped. Everything above that layer needs a browser and is not covered.

## Environment Setup

No environment variables and no API keys are needed to build or run the app.

AI beat generation is **bring your own key**: the visitor enters an Anthropic API key in the AI modal, it is kept in their browser's localStorage, and requests go straight from their browser to `api.anthropic.com`.

Do not reintroduce a `VITE_`-prefixed key. Vite inlines every `VITE_*` variable into the public JavaScript bundle at build time, so such a key is readable by anyone who opens devtools — the build does not hide it. If a shared key is ever wanted, it needs a server-side proxy holding it, plus rate limiting.

## Architecture

This is a React + Vite + Tailwind app. The entry point is `main.jsx` → `App.jsx` (router) → `src/designs/` (individual UIs).

### Design System

The app has **5 distinct visual designs** for the same drum sequencer, selectable from a home screen:
- `src/designs/Home.jsx` — design picker (routes `/`)
- `src/designs/Design1.jsx` through `Design5.jsx` — each a fully self-contained UI at routes `/1`–`/5`
  - Design1: Industrial/Brutalist
  - Design2: Cyberpunk/Neon
  - Design3: Organic/Natural
  - Design4: Swiss/Minimalist
  - Design5: Neo-Pop/Playful

Each Design component consumes `useDrumMachine()` and optionally `useAiDrummer()`.

### Core Hook: `useDrumMachine` (`src/hooks/useDrumMachine.js`)

This file is the heart of the app. It exports:
- **`useDrumMachine()`** hook — all sequencer state and controls (grid, BPM, swing, play/pause, mute, rudiments)
- **`DrumSynth`** class — Web Audio API synthesizer (kick, snare, hihat, tom, clap, woodblock)
- **`instruments`** array — defines the 7 tracks with their IDs, names, colors, notation positions (`y`), note symbols, and voices (0=hands/stems-up, 1=feet/stems-down)
- **`RUDIMENTS`** array — preset sticking patterns
- **`DEFAULT_BPM`**, **`DEFAULT_BEATS`**, **`DEFAULT_SUBDIV`** constants

The scheduler uses the Web Audio API clock (not `setInterval`) via a lookahead scheduler pattern for precise timing.

**Per-instrument levels.** `DrumSynth.init()` builds one gain node per instrument, all feeding `masterGain`, and every voice method takes a destination so `playInstrument` can route through the right one. Two things to keep in mind: channels only exist once the context is built, so `applyVolumes()` has to run after every `init()` as well as on change; and the click-only pulse calls `playWoodblock` directly rather than going through `playInstrument`, so it must be passed the metronome channel explicitly or it ignores that fader.

**`clickOnly`** silences the kit during playback and emits a generated pulse instead: one woodblock per beat, at 1200 Hz on step 0 and 800 Hz elsewhere. Two things matter about how it is built:

- It is **not** implemented via `mutedTracks`. Muting removes a track from `scheduleNote` entirely, which also removes it from the notation and stops `pushExpected` firing for it, so muted notes are never scored. Click-only skips `playInstrument` but still calls `pushExpected`, leaving the pattern, notation and scoring identical.
- The pulse is generated from the step index, not read from the metronome track, so it plays regardless of what that row contains and does not double up with it.

It also records what it scheduled, for practice mode:
- `expectedRef` — one entry per note the drummer should play, with its exact audio-clock time
- `stepClockRef` — one entry per step, hit or not, which drives the playhead

The playhead reflects the step being *heard* (latest scheduled step whose time has passed), not the scheduler's write pointer, which runs a lookahead window ahead of the audio.

### Practice Mode

Listens to a MIDI drum kit (built for Aerodrums 2) and scores how close each hit
lands to the sequenced pattern. Grid cells and noteheads turn green, amber or red.

Five pieces, deliberately layered so the pure logic is testable on its own:

- **`src/utils/scoring.js`** — pure matching and classification. No React, no
  clocks. Greedy nearest-match of hits to expected notes within a tolerance,
  then `good` / `early` / `late` / `miss` / `extra`. `summarise()` produces the
  numbers the tempo ramp gates on.
- **`src/utils/clockBridge.js`** — converts between `AudioContext.currentTime`
  (what the sequencer schedules in) and `performance.now()` (what Web MIDI
  stamps hits with). Uses `getOutputTimestamp()` so the reference is what the
  drummer *hears*, not what the audio graph has processed. Re-anchors every
  second to absorb drift.
- **`src/utils/midiMap.js`** — MIDI note → instrument mapping, many notes per
  instrument (a drum's articulations), persisted to localStorage.
- **`src/hooks/useMidiInput.js`** — Web MIDI access, port selection, note-on
  capture. Delivers hits through a callback ref, never state, so a busy bar
  doesn't render the app on every hit.
- **`src/hooks/usePracticeMode.js`** — wires it together: hit intake, the
  resolution loop, calibration, and the tempo ramp.

Three things about this that are easy to get wrong:

1. **Latency must be calibrated, not assumed.** Stick to browser is roughly
   15–25 ms and output latency adds 10–30 ms more. Without the calibration
   routine every hit reads as late. The measured offset is subtracted from
   incoming hit times.
2. **The scheduler records expected note times rather than re-deriving them.**
   `useDrumMachine` pushes an entry into `expectedRef` for every note it
   schedules. Recomputing expected times from BPM would break the moment tempo
   or swing changed mid-loop. The list is kept sorted by time because triplet
   notes are all scheduled at their beat boundary and so interleave with the
   grid steps that follow them.
3. **The audio context is created lazily, so anything that makes a sound outside playback must call `machine.initAudio()` first.** `audioRef.current.ctx` is null until `DrumSynth.init()` runs, which happens on first play or first cell preview. Calibration is typically the first thing a new user does, before ever pressing play — reading `getAudioContext()` without creating it made the button silently do nothing. `initAudio()` must be reached from a user gesture or the browser will refuse to start audio.

4. **Calibration measures the RAW hit time, never the corrected one.** `handleNoteOn` subtracts the stored offset before scoring, but pushes the uncorrected time into the calibration samples. Feeding the corrected time in would make each run measure only the residual left by the previous run and then overwrite the offset with it — so a second calibration would reset a good offset back to roughly zero.

5. **Nearest-match measurement aliases, and the fix is to pick the sparsest drum.** A hit later than half the gap between notes on that drum lands nearer the *following* note, so a 250 ms latency on sixteenth-note hi-hats (272 ms apart) reads as 22 ms early. This is not detectable within one drum. `timingDiag` therefore collects per instrument alongside `neighbourGapMs` and reports whichever has the widest spacing. Calibration sidesteps the same problem by clicking every 0.9 s, giving a ±450 ms unambiguous range — it was 0.6 s with a 0.2 s tolerance, which rejected the samples of any rig near 200 ms latency and told it "too few hits detected".

6. **A hit is only an `extra` after two match windows, not one.** A note at time
   T can claim hits in `[T-loose, T+loose]` and isn't itself resolved until
   `T+loose`, so an early hit is still claimable until `H + 2·loose`. Using one
   window double-counts every early hit as both `early` and `extra`.

Practice mode only reads `expectedRef` and the audio context, both via refs, so
scoring never triggers a React render. Verdicts are flushed to state on a 50 ms
throttle.

**Measured clock behaviour** (2-minute run, 492 samples, macOS/Chrome, audio playing):

| | Measured | Implication |
|---|---|---|
| Clock rate drift, `performance.now()` vs `ctx.currentTime` | 23 ppm (1.4 ms/min) | 0.02 ms of error per 1 s resync interval — negligible |
| Output lag (`currentTime − contextTime`) | 33.3 ms, SD 0.42 ms | Stable |
| Largest single step in output lag | 5.4 ms | Real but small; the resync absorbs it within 1 s |
| Bridge error vs anchor staleness | ~2.6 ms mean / 5.4 ms worst, **flat** at 250 ms, 1 s, 5 s and 30 s | Error does not grow with staleness, so it is `getOutputTimestamp` noise, not drift |
| Scheduler beat spacing over 297 beats | SD 0.000 ms, 0.000 ms cumulative drift | The beat grid itself is exact |

The flat error-vs-staleness result is the important one: `RESYNC_INTERVAL_MS`
could be raised a long way without harm, and drift is not a plausible cause of
scoring problems. Suspect calibration or output-device changes first.

Browser support: Chrome and Edge. Firefox 108+. Safari has no Web MIDI at all.
Needs a secure context (localhost or https).

### AI Hook: `useAiDrummer` (`src/hooks/useAiDrummer.js`)

Calls the Anthropic API (`claude-opus-5`) via `@anthropic-ai/sdk` with `dangerouslyAllowBrowser: true`. Takes `{ totalSteps, beats, subdiv, setGrid }`.

- **Key handling** lives in `src/utils/apiKey.js` — localStorage, format validation, masking. The key is never sent anywhere but `api.anthropic.com`. Proxying it through our own backend was rejected deliberately: that would make us custodian of visitors' keys, with request headers a leak risk in logs.
- **Structured outputs** (`output_config.format` with a JSON schema) guarantee the response parses and matches the schema, so there is no parse-and-hope path.
- **The schema is keyed by instrument id**, not a 2D boolean matrix. A matrix has to be read positionally, so a model emitting rows in a different order would silently produce a scrambled beat with nothing to detect it against. Step-index arrays are also far more compact.
- **Range bounds are enforced client-side** in `patternToGrid` — structured outputs does not support numeric constraints, so the ranges in the schema descriptions are advisory to the model only.
- `max_tokens` is deliberately generous: on this model it caps thinking *and* response text together, so sizing it around the small JSON payload would truncate mid-object.
- Errors are matched on the SDK's typed classes, with `APIConnectionError` checked before `APIError` because it subclasses it.

### Notation: `src/components/NotationView.jsx`

The stave is laid out at a fixed natural size (200px tall) and then **scaled** to whatever box it is given, so growing the strip enlarges the notation instead of revealing whitespace. Scaling is uniform, so a stave already limited by width cannot grow taller — it is centred vertically in that case. Hiding the timing panel gives it the full width and lets it scale up further.

The `ResizeObserver` watches the **root**, not the inner wrapper. The wrapper's height *is* the SVG's height, so observing it and then resizing the SVG in response is a feedback loop; the root is sized by its flex parent and so is a stable measure of the space on offer.

VexFlow 4.2.5-based drum notation renderer. Uses two voices on one percussion stave:
- **Hands voice** (stems up): metronome, hi-hats, clap, snare, toms
- **Feet voice** (stems down): kick

Notehead types are embedded in the VexFlow key string: `'a/5/x'` = x notehead (closed hi-hat), `'a/5/x3'` = circle-x (open hi-hat), no suffix = filled (snare/kick). Beaming is automatic via `Beam.applyAndGetBeams()`. The playback cursor is a separate absolutely-positioned div updated via a second `useEffect` (keyed on `currentStep`) so notation only re-renders when the grid/layout changes.

### MIDI Export: `src/utils/midiExport.js`

Standalone utility function `exportMidi(grid, bpm, subdiv, mutedTracks)` that builds a MIDI file from scratch (no library) and triggers a browser download.

### Instrument Data Shape

Each instrument in the `instruments` array has:
```js
{ id, name, icon, color, y, symbol, voice }
```
- `y`: vertical offset in the notation SVG (negative = above stave)
- `voice`: 0 = hands (stems up), 1 = feet (stems down)
- `symbol`: how the note head appears in notation

The grid state is a 2D array `grid[instrumentIndex][stepIndex]` of booleans. Grid dimensions are `instruments.length × (beats × subdiv)`.
