import type { StdinData } from './types.js';
import type { NormalizedUsage } from './provider/types.js';
/**
 * T-004: 时间进度行(第二行)。编码"当前在窗口的哪个时间点",
 * 与 T-002 的 `│` 用量 anchor 对位形成节奏对比。
 *
 * 字符:`━ ● ─`,宽度 16(比用量 bar 宽,因不承载数字,纯位置感)。
 *
 * 降级:
 *   - windowStartMs/windowEndMs 缺失 → `─...─ elapsed: ?`
 *   - HUD_LEGACY_TIME=1 → 返回空字符串(关闭第二行)
 *   - 终端不支持 `━` → fallback 到 `-`(未来可探测)
 */
export declare function renderTimeProgress(windowStartMs: number | null | undefined, windowEndMs: number | null | undefined, width?: number): string;
/**
 * Sum all token fields from stdin.current_usage to get a single
 * "tokens consumed in this context window" figure. Returns null if
 * any field is missing — we don't guess across providers.
 */
export declare function sumContextTokens(cu: unknown): number | null;
/**
 * Compact human-readable token count: 1234 → "1.2K", 1_500_000 → "1.5M".
 * Returns "?" for non-finite input.
 */
export declare function formatTokenCount(n: number | null | undefined): string;
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
