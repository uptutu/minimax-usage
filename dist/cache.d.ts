/**
 * Generic cache lookup. The `key` should be namespaced by provider, e.g.
 * `usage:minimax` / `usage:kimi`. Returns the cached payload only when it
 * exists AND is still within `loadConfig().refreshIntervalMs`.
 */
export declare function getCached<T>(key: string): T | null;
export declare function setCached<T>(key: string, data: T | null): void;
