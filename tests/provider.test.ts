/**
 * Unit tests for the multi-provider refactor. Run with:
 *
 *   node --test --experimental-strip-types tests/provider.test.ts
 *
 * No test framework or transpiler is required: Node 22+ ships the type
 * stripper and a built-in test runner. All tests are isolated: any
 * ANTHROPIC_BASE_URL set by the parent shell is cleared at the start.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Wipe env so endpoint-detector tests behave deterministically.
delete process.env.ANTHROPIC_BASE_URL;
delete process.env.ANTHROPIC_AUTH_TOKEN;
delete process.env.CLAUDE_CONFIG_DIR;

import { isKimiEndpoint, isMinimaxEndpoint, isBailianEndpoint, isMimoEndpoint, isVolcengineEndpoint, isZhipuEndpoint, getCredentialsDir } from '../src/config.js';
import { pickDetail, detailToNormalized } from '../src/provider/kimi.js';
import { selectProvider } from '../src/provider/index.js';
import { toEpochMs } from '../src/time.js';

test('isKimiEndpoint matches api.kimi.com and *.kimi.com but not other hosts', () => {
  process.env.ANTHROPIC_BASE_URL = 'https://api.kimi.com/coding';
  assert.equal(isKimiEndpoint(), true);

  process.env.ANTHROPIC_BASE_URL = 'https://kimi.com/coding';
  assert.equal(isKimiEndpoint(), true);

  process.env.ANTHROPIC_BASE_URL = 'https://api.kimi.com';
  assert.equal(isKimiEndpoint(), true);

  process.env.ANTHROPIC_BASE_URL = 'https://www.kimi.com/coding';
  assert.equal(isKimiEndpoint(), true);

  process.env.ANTHROPIC_BASE_URL = 'https://example.com';
  assert.equal(isKimiEndpoint(), false);

  process.env.ANTHROPIC_BASE_URL = 'https://fakekimi.com';
  assert.equal(isKimiEndpoint(), false);

  delete process.env.ANTHROPIC_BASE_URL;
  assert.equal(isKimiEndpoint(), false);

  process.env.ANTHROPIC_BASE_URL = 'not a url';
  assert.equal(isKimiEndpoint(), false);

  delete process.env.ANTHROPIC_BASE_URL;
});

test('endpoint detectors are mutually exclusive on a real host', () => {
  process.env.ANTHROPIC_BASE_URL = 'https://api.kimi.com/coding';
  assert.equal(isKimiEndpoint(), true);
  assert.equal(isMinimaxEndpoint(), false);
  assert.equal(isBailianEndpoint(), false);
  assert.equal(isMimoEndpoint(), false);
  assert.equal(isVolcengineEndpoint(), false);
  assert.equal(isZhipuEndpoint(), false);

  process.env.ANTHROPIC_BASE_URL = 'https://www.minimaxi.com/anthropic';
  assert.equal(isMinimaxEndpoint(), true);
  assert.equal(isKimiEndpoint(), false);

  process.env.ANTHROPIC_BASE_URL = 'https://dashscope.aliyuncs.com';
  assert.equal(isBailianEndpoint(), true);

  process.env.ANTHROPIC_BASE_URL = 'https://api.xiaomimimo.com';
  assert.equal(isMimoEndpoint(), true);

  process.env.ANTHROPIC_BASE_URL = 'https://ark.cn-beijing.volces.com';
  assert.equal(isVolcengineEndpoint(), true);

  process.env.ANTHROPIC_BASE_URL = 'https://open.bigmodel.cn';
  assert.equal(isZhipuEndpoint(), true);

  delete process.env.ANTHROPIC_BASE_URL;
});

test('pickDetail prefers top-level usage over limits', () => {
  const detail = { limit: 100, used: 30, remaining: 70, resetTime: '2026-06-12T00:00:00Z' };
  const json = { usage: detail, limits: [{ window: { duration: 5, timeUnit: 'HOUR' }, detail }] };
  assert.deepEqual(pickDetail(json), detail);
});

test('pickDetail falls back to longest-duration window when usage is absent', () => {
  const day = { limit: 7000, used: 1000, remaining: 6000, resetTime: '2026-06-18T00:00:00Z' };
  const hour = { limit: 500, used: 100, remaining: 400, resetTime: '2026-06-11T16:00:00Z' };
  const minute = { limit: 50, used: 5, remaining: 45, resetTime: '2026-06-11T11:30:00Z' };
  const json = {
    limits: [
      { window: { duration: 1, timeUnit: 'MINUTE' }, detail: minute },
      { window: { duration: 5, timeUnit: 'HOUR' }, detail: hour },
      { window: { duration: 7, timeUnit: 'DAY' }, detail: day },
    ],
  };
  assert.deepEqual(pickDetail(json), day);
});

test('pickDetail returns null when both fields are absent or empty', () => {
  assert.equal(pickDetail({}), null);
  assert.equal(pickDetail({ limits: [] }), null);
});

test('detailToNormalized maps remaining/limit into intervalRemainingPercent', () => {
  const n = detailToNormalized(
    { limit: 100, used: 30, remaining: 70, resetTime: '2026-06-12T00:00:00Z' },
    'kimi'
  );
  assert.equal(n.intervalRemainingPercent, 70);
  assert.equal(n.weeklyRemainingPercent, null);
  assert.equal(n.weeklyBoostPermille, 1000);
  assert.equal(n.providerId, 'kimi');
  assert.ok(typeof n.intervalResetMs === 'number' && n.intervalResetMs! > 1_700_000_000_000);
});

test('detailToNormalized clamps percent to [0, 100] and handles zero limit', () => {
  const over = detailToNormalized(
    { limit: 100, used: 0, remaining: 9999, resetTime: '' },
    'kimi'
  );
  assert.equal(over.intervalRemainingPercent, 100);
  assert.equal(over.intervalResetMs, null);

  const neg = detailToNormalized(
    { limit: 100, used: 9999, remaining: -10, resetTime: '' },
    'kimi'
  );
  assert.equal(neg.intervalRemainingPercent, 0);

  const zero = detailToNormalized(
    { limit: 0, used: 0, remaining: 0, resetTime: '' },
    'kimi'
  );
  assert.equal(zero.intervalRemainingPercent, null);
});

test('toEpochMs handles seconds, milliseconds, ISO-8601, and bad input', () => {
  // seconds → ms
  assert.equal(toEpochMs(1_700_000_000), 1_700_000_000_000);
  // already ms
  assert.equal(toEpochMs(1_700_000_000_000), 1_700_000_000_000);
  // ISO-8601
  const fromIso = toEpochMs('2026-06-11T00:00:00Z');
  assert.ok(fromIso !== null && fromIso === Date.parse('2026-06-11T00:00:00Z'));
  // invalid / null
  assert.equal(toEpochMs(null), null);
  assert.equal(toEpochMs(undefined), null);
  assert.equal(toEpochMs('not a date'), null);
  assert.equal(toEpochMs(Number.NaN), null);
});

test('selectProvider returns null when ANTHROPIC_BASE_URL is unset', () => {
  delete process.env.ANTHROPIC_BASE_URL;
  assert.equal(selectProvider(), null);
});

test('selectProvider returns the matching provider for known hosts', () => {
  process.env.ANTHROPIC_BASE_URL = 'https://api.kimi.com/coding';
  const p = selectProvider();
  assert.ok(p !== null);
  assert.equal(p!.id, 'kimi');
  assert.equal(p!.displayName, 'Kimi');

  process.env.ANTHROPIC_BASE_URL = 'https://www.minimaxi.com/anthropic';
  const m = selectProvider();
  assert.ok(m !== null);
  assert.equal(m!.id, 'minimax');
  delete process.env.ANTHROPIC_BASE_URL;
});

test('getCredentialsDir lives under the plugin config dir', () => {
  const dir = getCredentialsDir();
  assert.ok(dir.endsWith('/credentials'));
  assert.ok(dir.includes('minimax-usage'));
});
