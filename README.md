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
-   **Rudiment Library**: Learn essential drum patterns (Paradiddles, Rolls) with visual sticking guides ('R' / 'L') displayed directly on the grid.
-   **AI Beat Generation**: Describe a beat (e.g., "Funky breakbeat with ghost notes") and let Google Gemini generate it for you.
-   **MIDI Export**: Download your beats as MIDI files to use in your DAW.

## Tech Stack

-   **Frontend**: React, Vite
-   **Styling**: Tailwind CSS
-   **Icons**: Lucide React
-   **Audio**: Web Audio API (Custom `DrumSynth` engine)
-   **AI**: Google Gemini API

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

3.  Set up Environment Variables:
    -   Copy the example env file:
        ```bash
        cp .env.example .env
        ```
    -   Open `.env` and add your Google Gemini API key:
        ```
        VITE_GEMINI_API_KEY=your_api_key_here
        ```
    -   *Note: You can get a free API key from [Google AI Studio](https://aistudio.google.com/).*

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

## License

This project is open source and available under the [MIT License](LICENSE).
