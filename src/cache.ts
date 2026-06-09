import type { CachedData, TokenPlanRemain } from './types.js';
import { getConfigDir, loadConfig } from './config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const cache = new Map<string, CachedData>();

function getCachePath(): string {
  return path.join(getConfigDir(), 'cache.json');
}

function readCacheFile(): Record<string, CachedData> {
  try {
    const content = fs.readFileSync(getCachePath(), 'utf-8');
    return JSON.parse(content) as Record<string, CachedData>;
  } catch {
    return {};
  }
}

function writeCacheFile(data: Record<string, CachedData>): void {
  try {
    fs.mkdirSync(getConfigDir(), { recursive: true });
    fs.writeFileSync(getCachePath(), JSON.stringify(data, null, 2));
  } catch {
    // Cache writes should never break status line rendering.
  }
}

export function getCached(key: string): TokenPlanRemain | null {
  const entry = cache.get(key) ?? readCacheFile()[key];
  if (!entry) return null;

  const config = loadConfig();
  if (Date.now() - entry.timestamp > config.refreshIntervalMs) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

export function setCached(key: string, data: TokenPlanRemain | null): void {
  const cacheFile = readCacheFile();

  if (!data) {
    cache.delete(key);
    delete cacheFile[key];
    writeCacheFile(cacheFile);
    return;
  }

  const entry = {
    data,
    timestamp: Date.now(),
  };

  cache.set(key, entry);
  cacheFile[key] = entry;
  writeCacheFile(cacheFile);
}
