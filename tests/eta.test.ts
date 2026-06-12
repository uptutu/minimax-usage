/**
 * Unit tests for T-001 ETA extrapolation.
 * Run with: node --test --experimental-strip-types tests/eta.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeEta, formatEtaClock } from '../src/history.js';

const MIN = 60_000;

function linearHistory(now: number, n: number, totalMin: number, startRemaining: number, endRemaining: number) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const t = now - totalMin * MIN + (i / (n - 1)) * totalMin * MIN;
        const r = startRemaining + (i / (n - 1)) * (endRemaining - startRemaining);
        out.push({ ts: t, remaining: r });
    }
    return out;
}

test('computeEta: < minSamples → no ETA', () => {
    const now = Date.now();
    const r = computeEta(now, [{ ts: now - 1, remaining: 80 }]);
    assert.equal(r.display, false);
    assert.equal(r.etaMs, null);
});

test('computeEta: span < minSpanMs → no ETA', () => {
    const now = Date.now();
    const r = computeEta(now, linearHistory(now, 20, 1, 80, 70));
    assert.equal(r.display, false);
});

test('computeEta: stable rate (slope ≈ 0) → no ETA', () => {
    const now = Date.now();
    const r = computeEta(now, linearHistory(now, 20, 20, 50, 50));
    assert.equal(r.display, false);
});

test('computeEta: positive slope (refilling) → no ETA', () => {
    const now = Date.now();
    const r = computeEta(now, linearHistory(now, 20, 20, 30, 70));
    assert.equal(r.display, false);
});

test('computeEta: 80% → 60% over 30min → ETA ~90 min from now', () => {
    const now = Date.now();
    const h = linearHistory(now, 20, 30, 80, 60);
    const r = computeEta(now, h);
    assert.equal(r.display, true);
    assert.ok(r.etaMs! > now + 85 * MIN && r.etaMs! < now + 95 * MIN, `etaMs=${r.etaMs}`);
    assert.ok(r.ratePerMin < 0);
    assert.ok(r.ratePerMin > -1.0 && r.ratePerMin < -0.5);
});

test('computeEta: 50% → 30% over 30min → ETA ~45 min from now', () => {
    const now = Date.now();
    const h = linearHistory(now, 30, 30, 50, 30);
    const r = computeEta(now, h);
    assert.equal(r.display, true);
    assert.ok(r.etaMs! > now + 40 * MIN && r.etaMs! < now + 50 * MIN);
});

test('formatEtaClock: returns HH:MM string', () => {
    const etaMs = new Date(2026, 5, 12, 14, 30, 0).getTime();
    const out = formatEtaClock(etaMs);
    assert.match(out, /^\d{2}:\d{2}$/);
    assert.equal(out, '14:30');
});
