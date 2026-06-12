/**
 * Unit tests for T-004 renderTimeProgress.
 * Run with: node --test --experimental-strip-types tests/render-time-progress.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderTimeProgress } from '../src/render.js';

const W = 16;
const HOUR = 3600 * 1000;

test('renderTimeProgress: 50% elapsed → anchor in middle', () => {
    const start = Date.now() - 2.5 * HOUR;
    const end = Date.now() + 2.5 * HOUR;
    const out = renderTimeProgress(start, end, W);
    // Math.round(0.5*16)=8, so 8 dashes + ● + 7 dashes
    assert.match(out, /^─{7,8}●─{7,8} 50% elapsed$/);
});

test('renderTimeProgress: 10% elapsed → anchor near left', () => {
    const start = Date.now() - 0.5 * HOUR;
    const end = Date.now() + 4.5 * HOUR;
    const out = renderTimeProgress(start, end, W);
    assert.match(out, /^─{1,2}●─{13,14} 10% elapsed$/);
});

test('renderTimeProgress: 90% elapsed → anchor near right', () => {
    const start = Date.now() - 4.5 * HOUR;
    const end = Date.now() + 0.5 * HOUR;
    const out = renderTimeProgress(start, end, W);
    assert.match(out, /^─{13,14}●─{1,2} 90% elapsed$/);
});

test('renderTimeProgress: 100% elapsed → anchor at far right', () => {
    const start = Date.now() - 10 * HOUR;
    const end = Date.now() - 1 * HOUR;
    const out = renderTimeProgress(start, end, W);
    assert.match(out, /^─{15}● 100% elapsed$/);
});

test('renderTimeProgress: null/undefined start or end → degradation path', () => {
    const out = renderTimeProgress(null, null, W);
    assert.equal(out, '─'.repeat(W) + ' elapsed: ?');
    assert.equal(renderTimeProgress(undefined, undefined, W), '─'.repeat(W) + ' elapsed: ?');
});

test('renderTimeProgress: now < start → 0% elapsed (window not yet open)', () => {
    const start = Date.now() + HOUR;
    const end = Date.now() + 6 * HOUR;
    const out = renderTimeProgress(start, end, W);
    assert.match(out, /^─{16} 0% elapsed$/);
});

test('renderTimeProgress: HUD_LEGACY_TIME=1 → empty string (line disabled)', () => {
    const prev = process.env.HUD_LEGACY_TIME;
    process.env.HUD_LEGACY_TIME = '1';
    try {
        const out = renderTimeProgress(Date.now() - HOUR, Date.now() + HOUR, W);
        assert.equal(out, '');
    } finally {
        if (prev === undefined) delete process.env.HUD_LEGACY_TIME;
        else process.env.HUD_LEGACY_TIME = prev;
    }
});
