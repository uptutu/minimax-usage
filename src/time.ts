/**
 * Provider-agnostic time helpers.
 *
 * `toEpochMs` normalises the two timestamp shapes seen across providers:
 *   - MiniMax / Volcengine: Unix **seconds** (e.g. 1718_000_000)
 *   - Kimi: ISO-8601 strings (e.g. "2026-06-11T15:00:00Z")
 * Anything already in milliseconds is passed through unchanged.
 */
export function toEpochMs(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}
