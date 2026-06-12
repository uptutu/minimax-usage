/**
 * T-001 ETA extrapolation — pure computation. Reads/writes to disk
 * (append-only ndjson) live in a future slice; this is the math half.
 *
 * The algorithm is L0 (simple linear regression on the most recent
 * 30 minutes of samples). See docs/TODO.md#t-001 for the design.
 */
export interface HistoryEntry {
    ts: number;             // epoch ms
    remaining: number;      // percent (0-100)
}

export interface EtaResult {
    etaMs: number | null;   // epoch ms when remaining hits 0, or null
    display: boolean;       // whether to render the ETA in the HUD
    samplesUsed: number;
    ratePerMin: number;     // negative = consuming; 0 = stable; positive = refilling
}

/**
 * Compute when remaining will hit 0 given a recent history of
 * (timestamp, remaining-percent) tuples. Conservative: only emits
 * an ETA when the rate is negative (we are consuming) AND we have
 * at least 10 samples spanning at least 5 minutes.
 */
export function computeEta(
    now: number,
    history: ReadonlyArray<HistoryEntry>,
    opts: { minSamples?: number; minSpanMs?: number; windowMs?: number } = {},
): EtaResult {
    const minSamples = opts.minSamples ?? 10;
    const minSpanMs = opts.minSpanMs ?? 5 * 60_000;
    const windowMs = opts.windowMs ?? 30 * 60_000;

    if (history.length < minSamples) {
        return { etaMs: null, display: false, samplesUsed: history.length, ratePerMin: 0 };
    }

    const cutoff = now - windowMs;
    const recent = history.filter((e) => e.ts >= cutoff);
    if (recent.length < minSamples) {
        return { etaMs: null, display: false, samplesUsed: recent.length, ratePerMin: 0 };
    }

    const tArr = recent.map((e) => e.ts);
    const rArr = recent.map((e) => e.remaining);
    const tBar = tArr.reduce((a, b) => a + b, 0) / tArr.length;
    const rBar = rArr.reduce((a, b) => a + b, 0) / rArr.length;
    let num = 0, den = 0;
    for (let i = 0; i < tArr.length; i++) {
        const dt = tArr[i] - tBar;
        num += dt * (rArr[i] - rBar);
        den += dt * dt;
    }
    if (den === 0) {
        return { etaMs: null, display: false, samplesUsed: recent.length, ratePerMin: 0 };
    }
    const slope = num / den;  // percent per ms
    const ratePerMin = slope * 60_000;

    const span = tArr[tArr.length - 1] - tArr[0];
    if (span < minSpanMs) {
        return { etaMs: null, display: false, samplesUsed: recent.length, ratePerMin };
    }

    if (slope >= 0) {
        return { etaMs: null, display: false, samplesUsed: recent.length, ratePerMin };
    }

    const b = rBar - slope * tBar;
    const etaMs = -b / slope;
    if (!Number.isFinite(etaMs) || etaMs <= now) {
        return { etaMs: null, display: false, samplesUsed: recent.length, ratePerMin };
    }
    return { etaMs, display: true, samplesUsed: recent.length, ratePerMin };
}

/** Format an epoch-ms timestamp as "HH:MM" in local time. */
export function formatEtaClock(etaMs: number, now: number = Date.now()): string {
    const date = new Date(etaMs);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}
