/**
 * Pre-release check: .claude-plugin/plugin.json version must equal package.json version.
 *
 * Usage:
 *   node --experimental-strip-types scripts/check-version.ts
 *
 * Exits 0 on match, exits 1 on mismatch. Designed to be called from a release
 * script or pre-push hook so a version drift is caught before it ships.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const PLUGIN_JSON = path.join(REPO_ROOT, '.claude-plugin', 'plugin.json');
const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');

export function readVersion(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content);
  if (typeof parsed.version !== 'string' || parsed.version.length === 0) {
    throw new Error(`${filePath} has no "version" field`);
  }
  return parsed.version;
}

export function checkVersionConsistency(): { ok: boolean; pluginVersion: string; packageVersion: string; } {
  const pluginVersion = readVersion(PLUGIN_JSON);
  const packageVersion = readVersion(PACKAGE_JSON);
  return { ok: pluginVersion === packageVersion, pluginVersion, packageVersion };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkVersionConsistency();
  if (result.ok) {
    console.log(`[check-version] OK: plugin.json (${result.pluginVersion}) == package.json (${result.packageVersion})`);
    process.exit(0);
  } else {
    console.error(`[check-version] MISMATCH:`);
    console.error(`  .claude-plugin/plugin.json: ${result.pluginVersion}`);
    console.error(`  package.json:               ${result.packageVersion}`);
    console.error(`[check-version] Fix: update .claude-plugin/plugin.json to match package.json`);
    process.exit(1);
  }
}
