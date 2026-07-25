// Bridges the two clocks this app has to reconcile:
//
//   • AudioContext.currentTime — what the sequencer schedules against (seconds)
//   • performance.now()        — what Web MIDI stamps incoming hits with (ms)
//
// The naive bridge (pair currentTime with performance.now() once at start) is
// wrong in a way that matters here: currentTime runs *ahead* of the speakers by
// the output latency, typically 10–30 ms on macOS. Since the drummer plays
// along to what they hear, every hit would read as consistently late.
//
// getOutputTimestamp() solves this properly. It returns a {contextTime,
// performanceTime} pair where contextTime is the audio time of the sample
// *currently reaching the output*, already latency-compensated.

const RESYNC_INTERVAL_MS = 1000;

export class ClockBridge {
    constructor(ctx) {
        this.ctx = ctx;
        this.anchor = null;
        this.lastSync = 0;
        this.sync();
    }

    sync() {
        const ctx = this.ctx;
        if (!ctx) return;

        let contextTime, performanceTime;

        // Preferred path: latency-compensated pair straight from the browser.
        if (typeof ctx.getOutputTimestamp === 'function') {
            const ts = ctx.getOutputTimestamp();
            // Some browsers stub this out and return zeroes — detect and fall through.
            if (ts && ts.contextTime > 0 && ts.performanceTime > 0) {
                contextTime = ts.contextTime;
                performanceTime = ts.performanceTime;
            }
        }

        // Fallback: pair the clocks by hand and subtract the reported latency.
        // Any residual constant error here is absorbed by user calibration.
        if (contextTime === undefined) {
            const latency = (ctx.baseLatency || 0) + (ctx.outputLatency || 0);
            contextTime = ctx.currentTime - latency;
            performanceTime = performance.now();
        }

        this.anchor = { contextTime, performanceTime };
        this.lastSync = performance.now();
    }

    // Re-anchor periodically. The two clocks are derived from different
    // hardware sources and drift apart slowly over a long practice session.
    maybeSync() {
        if (performance.now() - this.lastSync > RESYNC_INTERVAL_MS) this.sync();
    }

    // Audio-clock seconds → performance.now() milliseconds.
    audioToPerf(audioTime) {
        if (!this.anchor) return null;
        return this.anchor.performanceTime + (audioTime - this.anchor.contextTime) * 1000;
    }

    // performance.now() milliseconds → audio-clock seconds.
    perfToAudio(perfTime) {
        if (!this.anchor) return null;
        return this.anchor.contextTime + (perfTime - this.anchor.performanceTime) / 1000;
    }
}
