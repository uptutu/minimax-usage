import type { CachedData, TokenPlanRemain } from './types.js';
import { loadConfig } from './config.js';

const cache = new Map<string, CachedData>();

export function getCached(key: string): TokenPlanRemain | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const config = loadConfig();
  if (Date.now() - entry.timestamp > config.refreshIntervalMs) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

export function setCached(key: string, data: TokenPlanRemain | null): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}