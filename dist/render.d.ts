import type { StdinData } from './types.js';
import type { NormalizedUsage } from './provider/types.js';
/**
 * Render the HUD for an arbitrary provider using the normalised payload.
 * Headers (model / project / context) are provider-agnostic; the usage
 * line is suppressed entirely when `data` is null (i.e. fetch failed
 * or returned no rows). When the provider only exposes a single window
 * (Kimi), the `7d` column collapses to a "─" placeholder so the layout
 * stays recognisable.
 */
export declare function renderProvider(data: NormalizedUsage | null, stdin?: StdinData): void;
/**
 * Backward-compat shim for callers that still pass the legacy
 * `TokenPlanRemain` payload. New code should call `renderProvider()` with a
 * `NormalizedUsage` instead. When `isMinimax` is false the line is
 * suppressed entirely.
 */
export declare function render(data: {
    current_interval_remaining_percent: number;
    current_weekly_remaining_percent: number;
    weekly_boost_permille: number;
    end_time: number;
    weekly_end_time: number;
} | null, stdin?: StdinData, isMinimax?: boolean): void;
