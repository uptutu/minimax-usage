/**
 * Unit tests for T-005 protocol probe.
 * Run with: node --test --experimental-strip-types tests/probe.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { probeEndpoint } from '../src/provider/probe.js';

test('probeEndpoint: invalid URL returns matches=false (no throw)', async () => {
    const r = await probeEndpoint('not-a-url');
    assert.equal(r.matches, false);
});

test('probeEndpoint: empty string URL returns matches=false', async () => {
    const r = await probeEndpoint('');
    assert.equal(r.matches, false);
});

test('probeEndpoint: 127.0.0.1:1 unreachable returns matches=false within 5s', async () => {
    const start = Date.now();
    const r = await probeEndpoint('http://127.0.0.1:1/x');
    const elapsed = Date.now() - start;
    assert.equal(r.matches, false);
    assert.ok(elapsed < 5000, `probe took ${elapsed}ms, expected <5000ms`);
});
