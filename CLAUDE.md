# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:5173
npm run build    # Production build
npm run preview  # Preview production build
```

No test runner is configured.

## Environment Setup

Copy `.env.example` to `.env` and add a Google Gemini API key:
```
VITE_GEMINI_API_KEY=your_key_here
```

Get a free key at Google AI Studio. The app still works without it (AI generation will fail gracefully).

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

### AI Hook: `useAiDrummer` (`src/hooks/useAiDrummer.js`)

Calls Google Gemini API (`gemini-2.5-flash`) to generate a 2D boolean grid matching the `instruments` array dimensions. Takes `totalSteps` and `setGrid` as arguments.

### Notation: `src/components/NotationView.jsx`

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
