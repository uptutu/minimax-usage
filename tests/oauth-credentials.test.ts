/**
 * Unit tests for T-006 OAuth credentials I/O.
 * Run with: node --test --experimental-strip-types tests/oauth-credentials.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { readCredentials, writeCredentials, deleteCredentials, isExpiredSoon, credentialsPath } from '../src/provider/oauth/credentials-io.js';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'minimax-test-'));
process.env.CLAUDE_CONFIG_DIR = tmpRoot;

const PID = 'unit-test-provider';

test('readCredentials: file missing → null', () => {
    deleteCredentials(PID);
    assert.equal(readCredentials(PID), null);
});

test('readCredentials: malformed JSON → null (no throw)', () => {
    const p = credentialsPath(PID);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, 'not json {{{');
    assert.equal(readCredentials(PID), null);
});

test('readCredentials: missing required fields → null', () => {
    const p = credentialsPath(PID);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ access_token: 'x' }));
    assert.equal(readCredentials(PID), null);
});

test('writeCredentials + readCredentials round-trip', () => {
    const c = { access_token: 'a', refresh_token: 'r', expires_at: 1234567890, scope: 'read', token_type: 'bearer' };
    writeCredentials(PID, c);
    const back = readCredentials(PID);
    assert.deepEqual(back, c);
});

test('writeCredentials creates directory on demand', () => {
    const customPid = `nested-${Date.now()}`;
    const dir = path.dirname(credentialsPath(customPid));
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    writeCredentials(customPid, { access_token: 'a', refresh_token: 'r', expires_at: 1 });
    assert.ok(fs.existsSync(credentialsPath(customPid)));
});

test('isExpiredSoon: far in future → false', () => {
    const c = { access_token: 'a', refresh_token: 'r', expires_at: 10_000_000 };
    assert.equal(isExpiredSoon(c, 1_000_000, 300), false);
});

test('isExpiredSoon: within buffer → true', () => {
    const c = { access_token: 'a', refresh_token: 'r', expires_at: 1_000_050 };
    assert.equal(isExpiredSoon(c, 1_000_000, 300), true);
});

test('isExpiredSoon: already expired → true', () => {
    const c = { access_token: 'a', refresh_token: 'r', expires_at: 999_000 };
    assert.equal(isExpiredSoon(c, 1_000_000, 300), true);
});

test('deleteCredentials: removes file', () => {
    writeCredentials(PID, { access_token: 'a', refresh_token: 'r', expires_at: 1 });
    deleteCredentials(PID);
    assert.equal(readCredentials(PID), null);
});

test('teardown: remove tmp root', () => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});
