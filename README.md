# RhythmCraft (Drum Teacher)

**A web application that helps you create, visualize, and learn to play new drum beats.**

RhythmCraft is an interactive drum sequencer designed for drummers and educators. It combines a classic step sequencer with professional music notation, making it easy to bridge the gap between programming a beat and reading it on the stave.

![App Screenshot](https://github.com/MaxwellRiess/Drum-Teacher/assets/placeholder/screenshot.png)
*(Note: You can replace this link with an actual screenshot of your app)*

## Features

-   **Interactive Step Sequencer**: 16-step grid for programming beats.
-   **Professional Notation**: Real-time generation of drum notation with:
    -   **Polyphony**: Separate voices for Hands (stems up) and Feet (stems down).
    -   **Complex Rhythms**: Support for dotted notes, beams, and rests.
    -   **Accurate Placement**: Standard drum key mapping (Snare on C, Kick on F, etc.).
-   **Audio Engine**: Low-latency Web Audio API playback with realistic samples.
-   **Practice Tools**:
    -   **Dynamic BPM**: Change tempo in real-time.
    -   **Swing Control**: Add groove to your beats.
    -   **Metronome**: Built-in click track.
    -   **Click Only**: Silence the kit and keep just the pulse, so you can play a pattern from the notation and grid alone.
-   **Practice Mode**: Play along on a MIDI drum kit and see whether your timing is right. Every hit is scored against the sequenced pattern and the grid and notation colour themselves green (on time), amber (early or late) or red (missed). Includes an automatic tempo ramp so you can start slow and build up speed.
-   **Rudiment Library**: Learn essential drum patterns (Paradiddles, Rolls) with visual sticking guides ('R' / 'L') displayed directly on the grid.
-   **AI Beat Generation**: Describe a beat (e.g., "Funky breakbeat with ghost notes") and let Claude generate it. Bring your own Anthropic API key; it stays in your browser.
-   **MIDI Export**: Download your beats as MIDI files to use in your DAW.

## Tech Stack

-   **Frontend**: React, Vite
-   **Styling**: Tailwind CSS
-   **Icons**: Lucide React
-   **Audio**: Web Audio API (Custom `DrumSynth` engine)
-   **AI**: Anthropic API (`claude-opus-5`) via `@anthropic-ai/sdk`

## Getting Started

### Prerequisites

-   Node.js (v16 or higher)
-   npm

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/MaxwellRiess/Drum-Teacher.git
    cd Drum-Teacher
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  There is nothing to configure. No API keys are needed to build or run the app
    (see [AI beat generation](#ai-beat-generation) for how the AI feature is keyed).

4.  Run the development server:
    ```bash
    npm run dev
    ```

5.  Open your browser and navigate to `http://localhost:5173`.

## Usage

-   **Click** grid cells to add/remove notes.
-   **Press Space** to play/pause.
-   Use the **Sliders** to adjust BPM and Swing.
-   Click **Rudiments** to load standard drum patterns.
-   Click **Generate** to use AI to create a beat.
-   Click the **Download** icon to export as MIDI.

## AI beat generation

Describe a beat in plain language and Claude writes the pattern into the grid.

### Bring your own key

You supply your own Anthropic API key. Open the **AI** panel, paste a key
starting with `sk-ant-`, and it is remembered in that browser.

**Your key never touches this site's server.** It is held in your browser's
local storage and sent directly from your browser to `api.anthropic.com`. The
app has no backend for this — nothing to log your key, nothing to leak it.

The tradeoff of that design is local storage: any script running on this page
could read the key, so a cross-site-scripting hole would expose it. The app
renders no user-supplied HTML and loads no third-party scripts, which keeps that
risk small, but treat the stored key accordingly — scope it to what you are
willing to spend, and don't leave one saved on a shared computer. Use **Forget**
to remove it.

Get a key from the [Anthropic Console](https://console.anthropic.com/settings/keys).

### Why not a shared key

Because there is no safe way to ship one. Vite inlines every `VITE_*` variable
into the public JavaScript bundle at build time, so a key added that way is
plain text in the shipped code, readable by anyone who opens devtools — the
build does not hide it. Serving a shared key properly would mean a backend
holding it plus rate limiting to stop it being drained, which is a different
project.

## Practice mode

Practice mode listens to a MIDI drum kit and tells you whether you are playing
the pattern in time. It was built against **Aerodrums 2**, but works with any
kit that sends MIDI note-on messages.

**Requires Chrome or Edge.** Safari does not implement Web MIDI. Firefox 108+
works. The page must be on `localhost` or `https`.

### Setting it up

Open **Practice setup** (the sliders icon) and work down the panel:

1. **MIDI input.** Plug the kit in first, then press *Connect MIDI* and allow
   the browser prompt. The device is auto-selected if its name looks like an
   Aerodrums kit. Hit a drum and check the raw message readout updates.
2. **Latency calibration.** Run this before your first session, and again if you
   change audio output. It plays sixteen clicks; hit any pad on each one. The
   whole chain from stick to browser adds roughly 15–25 ms, and your speakers
   add another 10–30 ms on top. Without measuring it, every hit reads as late.
3. **Drum mapping.** Defaults follow General MIDI, but Aerodrums sends extra
   notes for articulations and is remappable in its own software, so press
   *Learn* next to a track and hit that pad to be certain.
4. **Tolerances.** How tight "on time" is (25 ms by default), how far out a hit
   can be and still count, and a velocity floor to stop stray movement
   registering as extra hits.
5. **Tempo ramp.** Optional. Once you play a pass cleanly enough, enough times
   in a row, the tempo steps up on its own until it reaches your ceiling.

### Using it

Press **PRACTICE**, then play. As each note passes, its grid cell and its
notehead take a colour:

| Colour | Meaning |
| --- | --- |
| Green | On time |
| Blue | Early — ahead of the beat, but close enough to count |
| Amber | Late — behind the beat, but close enough to count |
| Red | Missed |
| Purple | Hits that did not belong to any note in the pattern |

Early and late are a cool/warm pair rather than two shades of one colour, so you
can read the direction of an error at a glance without stopping to check a
number.

### The live timing panel

Beside the notation, in the space the centred stave leaves empty, sits a
real-time feedback panel:

- **Percentage on time** for the last pass through the bar
- **Feel** — the signed average offset, coloured to match. Usually more useful
  than the percentage, because it tells you which way to correct
- **A timing meter** plotting the last 32 notes across the full match window,
  with the on-time band shaded and older hits fading out. A drifting phrase
  shows up as marks sliding to one side, which is much easier to see than a
  changing number
- **A tally** of on time, early, late, missed and extra

Hover any mark on the meter, or any coloured cell, for the exact millisecond
offset.

Hover any coloured cell to see the exact millisecond offset.

### Everything reads as a miss

Almost always latency, not playing. If your hits arrive a constant 200 ms after
the notes, no tolerance setting will help — 200 ms is wider than any sensible
match window, so every note is scored a miss and every hit becomes an extra.

Play a few bars and open **Practice setup → Latency calibration**. The
**Measured while playing** readout shows how far your hits are actually landing
from their notes, with no match window applied, so it still reports a number
when nothing is scoring. If it shows a large steady offset, press the button to
apply it.

That readout is measured from whichever drum in your pattern has the widest
spacing between notes, and says which one. This matters: a hi-hat playing
sixteenths at 110 bpm has notes 272 ms apart, and a hit 250 ms late lands nearer
the *following* note, so it reads as 22 ms early rather than 250 ms late. A drum
that plays twice a bar cannot alias that way, so it gives the honest number.

Output latency is the usual culprit and it varies enormously by device —
Bluetooth headphones can add 150–200 ms where wired output adds 30 ms. **Change
your audio output and you need to calibrate again.**

### Click only

**CLICK** in the toolbar silences the kit and leaves a bare pulse: one click per
beat, pitched up on the downbeat so you can find the top of the bar. Use it to
practise reading the pattern rather than copying what you hear.

The pattern itself is untouched. Notation still renders in full, and every note
is still scored exactly as it would be with the kit audible, so your accuracy
figures are directly comparable between the two. This is deliberately *not* the
same as muting every track: muting removes a track from the schedule, which also
removes it from the notation and from scoring.

The pulse is generated independently of the Metronome row, so it plays whether
or not that row has anything in it. You can toggle it mid-playback.

## License

This project is open source and available under the [MIT License](LICENSE).
