import { loadConfig } from './config.js';
const cache = new Map();
export function getCached(key) {
    const entry = cache.get(key);
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
    cache.set(key, {
        data,
        timestamp: Date.now(),
    });
}
