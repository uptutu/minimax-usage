import { getConfigDir, loadConfig } from './config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
const cache = new Map();
function getCachePath() {
    return path.join(getConfigDir(), 'cache.json');
}
function readCacheFile() {
    try {
        const content = fs.readFileSync(getCachePath(), 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return {};
    }
}
function writeCacheFile(data) {
    try {
        fs.mkdirSync(getConfigDir(), { recursive: true });
        fs.writeFileSync(getCachePath(), JSON.stringify(data, null, 2));
    }
    catch {
        // Cache writes should never break status line rendering.
    }
}
/**
 * Generic cache lookup. The `key` should be namespaced by provider, e.g.
 * `usage:minimax` / `usage:kimi`. Returns the cached payload only when it
 * exists AND is still within `loadConfig().refreshIntervalMs`.
 */
export function getCached(key) {
    const entry = cache.get(key) ?? readCacheFile()[key];
    if (!entry)
        return null;
    const config = loadConfig();
    if (Date.now() - entry.timestamp > config.refreshIntervalMs) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}
export function setCached(key, data) {
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
