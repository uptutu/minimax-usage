/**
 * T-005 tracer bullet: protocol probe skeleton.
 * Run with: node --test --experimental-strip-types tests/probe.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as https from 'node:https';

const PROBE_PATHS = [
    { path: '/.well-known/quota',        scheme: 'custom-well-known' },
    { path: '/v1/usage',                scheme: 'openai-usage' },
    { path: '/coding/v1/usages',        scheme: 'kimi-usages' },
    { path: '/v1/token_plan/remains',   scheme: 'minimax-token-plan' },
];

export type QuotaScheme = 'custom-well-known' | 'openai-usage' | 'kimi-usages' | 'minimax-token-plan';
export type ProbeResult = { matches: true; scheme: QuotaScheme; confidence: number } | { matches: false };

function hostOf(baseUrl: string): string | null {
    try { return new URL(baseUrl).hostname.toLowerCase(); } catch { return null; }
}

function tryProbe(host: string, p: string, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (v: boolean) => { if (settled) return; settled = true; resolve(v); };
        const req = https.request({ hostname: host, port: 443, path: p, method: 'GET', timeout: timeoutMs, headers: { Accept: 'application/json' } }, (res) => {
            finish(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300);
            res.resume();
        });
        req.on('error', () => finish(false));
        req.on('timeout', () => { req.destroy(); finish(false); });
        req.end();
    });
}

export async function probeEndpoint(baseUrl: string, timeoutMs = 1500): Promise<ProbeResult> {
    const host = hostOf(baseUrl);
    if (!host) return { matches: false };
    const results = await Promise.all(PROBE_PATHS.map(async ({ path, scheme }) => {
        const ok = await tryProbe(host, path, timeoutMs);
        return ok ? { matches: true as const, scheme, confidence: 0.7 } : null;
    }));
    const hit = results.find((r): r is { matches: true; scheme: QuotaScheme; confidence: number } => r !== null);
    return hit ?? { matches: false };
}

test('probeEndpoint: invalid URL returns matches=false', async () => {
    const r = await probeEndpoint('not-a-url');
    assert.equal(r.matches, false);
});

test('probeEndpoint: 127.0.0.1 unreachable host returns matches=false quickly', async () => {
    const r = await probeEndpoint('http://127.0.0.1:1/x');
    assert.equal(r.matches, false);
});
