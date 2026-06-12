/**
 * Unit tests for scripts/check-version.ts
 *
 * Run with:
 *   node --test --experimental-strip-types tests/check-version.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { checkVersionConsistency, readVersion } from '../scripts/check-version.js';

const REAL_PLUGIN_JSON = path.resolve(import.meta.dirname, '..', '..', '.claude-plugin', 'plugin.json');
const REAL_PACKAGE_JSON = path.resolve(import.meta.dirname, '..', '..', 'package.json');

test('real repo: plugin.json and package.json currently match', () => {
  const real = JSON.parse(fs.readFileSync(REAL_PLUGIN_JSON, 'utf-8'));
  const pkg = JSON.parse(fs.readFileSync(REAL_PACKAGE_JSON, 'utf-8'));
  // The T-000 bug was caused by these drifting. If this test ever fails,
  // it means the drift returned — re-run the fix (sync plugin.json to package.json).
  assert.equal(real.version, pkg.version, `plugin.json (${real.version}) != package.json (${pkg.version}) — version drift!`);
});

test('readVersion returns the version field as a string', () => {
  const v = readVersion(REAL_PACKAGE_JSON);
  assert.equal(typeof v, 'string');
  assert.match(v, /^\d+\.\d+\.\d+/);
});

test('checkVersionConsistency returns ok=true on real repo (current invariant)', () => {
  const result = checkVersionConsistency();
  assert.equal(result.ok, true);
  assert.equal(result.pluginVersion, result.packageVersion);
});
