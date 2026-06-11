import type { CachedData } from './types.js';
import { getConfigDir, loadConfig } from './config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const cache = new Map<string, CachedData<unknown>>();

function getCachePath(): string {
  return path.join(getConfigDir(), 'cache.json');
}

function readCacheFile(): Record<string, CachedData<unknown>> {
  try {
    const content = fs.readFileSync(getCachePath(), 'utf-8');
    return JSON.parse(content) as Record<string, CachedData<unknown>>;
  } catch {
    return {};
  }
}

function writeCacheFile(data: Record<string, CachedData<unknown>>): void {
  try {
    fs.mkdirSync(getConfigDir(), { recursive: true });
    fs.writeFileSync(getCachePath(), JSON.stringify(data, null, 2));
  } catch {
    // Cache writes should never break status line rendering.
  }
}

/**
 * Generic cache lookup. The `key` should be namespaced by provider, e.g.
 * `usage:minimax` / `usage:kimi`. Returns the cached payload only when it
 * exists AND is still within `loadConfig().refreshIntervalMs`.
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key) ?? readCacheFile()[key];
  if (!entry) return null;

  const config = loadConfig();
  if (Date.now() - entry.timestamp > config.refreshIntervalMs) {
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

export function setCached<T>(key: string, data: T | null): void {
  const cacheFile = readCacheFile();

  if (!data) {
    cache.delete(key);
    delete cacheFile[key];
    writeCacheFile(cacheFile);
    return;
  }

  const entry: CachedData<T> = {
    data,
    timestamp: Date.now(),
  };

  cache.set(key, entry);
  cacheFile[key] = entry as CachedData<unknown>;
  writeCacheFile(cacheFile);
}
