/**
 * Unit tests for the T-002 anchor in renderProgressBar.
 * Run with: node --test --experimental-strip-types tests/render-anchor.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderProvider } from '../src/render.js';

const ANSI = /\x1b\[[0-9;]*m/g;
function strip(s: string): string { return s.replace(ANSI, ''); }

function dataAt(pct: number) {
    return {
        intervalRemainingPercent: pct,
        intervalResetMs: Date.now() + 5 * 60 * 60 * 1000,
        intervalWindowStartMs: null,
        weeklyRemainingPercent: null,
        weeklyResetMs: null,
        weeklyWindowStartMs: null,
        weeklyBoostPermille: 1000,
        providerId: 'minimax' as const,
        source: { kind: 'official' as const },
        fetchedAt: Date.now(),
        confidence: 1.0,
    };
}

function captureRender(pct: number, stdin: Record<string, unknown> = {}): string {
    const lines: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '));
    try {
        renderProvider(dataAt(pct), stdin as Parameters<typeof renderProvider>[1]);
    } finally {
        console.log = orig;
    }
    return lines.join('\n');
}

test('renderProvider: 100% remaining → anchor at left edge of bar', () => {
    const out = captureRender(100, { model: { id: 'm' }, workspace: { current_dir: '/tmp' } });
    const line = out.split('\n').find((l) => l.includes('5h')) ?? '';
    // After the '5h  ' prefix, the first bar character should be │ (anchor at pos 0)
    assert.match(strip(line), /5h {2}│░{9}/);
});

test('renderProvider: 50% remaining → anchor in middle of bar', () => {
    const out = captureRender(50, { model: { id: 'm' }, workspace: { current_dir: '/tmp' } });
    const line = out.split('\n').find((l) => l.includes('5h')) ?? '';
    assert.match(strip(line), /5h {2}█{5}│░{4}/);
});

test('renderProvider: 0% remaining → anchor at right edge of bar', () => {
    const out = captureRender(0, { model: { id: 'm' }, workspace: { current_dir: '/tmp' } });
    const line = out.split('\n').find((l) => l.includes('5h')) ?? '';
    assert.match(strip(line), /5h {2}█{9}│/);
});

test('renderProvider: 95% remaining (5% used) → anchor at pos 1, no zero-collapse', () => {
    const out = captureRender(95, { model: { id: 'm' }, workspace: { current_dir: '/tmp' } });
    const line = out.split('\n').find((l) => l.includes('5h')) ?? '';
    assert.match(strip(line), /5h {2}█│░{8}/);
});

test('renderProvider: HUD_LEGACY=1 disables anchor in bar (keeps label separator)', () => {
    const prev = process.env.HUD_LEGACY;
    process.env.HUD_LEGACY = '1';
    try {
        const out = captureRender(50, { model: { id: 'm' }, workspace: { current_dir: '/tmp' } });
        const line = out.split('\n').find((l) => l.includes('5h')) ?? '';
        const s = strip(line);
        // Bar (after '5h  ') is pure blocks, no │ embedded
        assert.match(s, /5h {2}█{5}░{5}/);
        // The 'MiniMax │' label separator is still present (different │, different position)
        assert.match(s, /MiniMax │ 5h/);
    } finally {
        if (prev === undefined) delete process.env.HUD_LEGACY;
        else process.env.HUD_LEGACY = prev;
    }
});

test('renderProvider: anchor survives NO_COLOR=1 (character not color)', () => {
    const prev = process.env.NO_COLOR;
    process.env.NO_COLOR = '1';
    try {
        const out = captureRender(50, { model: { id: 'm' }, workspace: { current_dir: '/tmp' } });
        const line = out.split('\n').find((l) => l.includes('5h')) ?? '';
        assert.match(strip(line), /5h {2}█{5}│░{4}/);
    } finally {
        if (prev === undefined) delete process.env.NO_COLOR;
        else process.env.NO_COLOR = prev;
    }
});
