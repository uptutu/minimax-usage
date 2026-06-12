import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
// ANSI color codes
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const BROWN_YELLOW = '\x1b[38;5;178m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GIT_TIMEOUT_MS = 1000;
function clampPercent(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.min(100, Math.max(0, value));
}
function formatPercent(value) {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
// Color based on remaining percentage (high remaining = green, low remaining = red)
function getColor(remainingPercent) {
    const normalized = clampPercent(remainingPercent);
    if (normalized > 50)
        return GREEN;
    if (normalized >= 20)
        return YELLOW;
    return RED;
}
// Calculate used percentage accounting for boost
function calcUsedPercent(remainingPercent, boostPermille) {
    const normalizedBoost = Number.isFinite(boostPermille) && boostPermille > 0
        ? boostPermille
        : 1000;
    const usedBase = 100 - clampPercent(remainingPercent);
    const usedWithBoost = usedBase * normalizedBoost / 1000;
    return Math.round(usedWithBoost * 10) / 10;
}
// Get total quota percentage
function getTotalPercent(boostPermille) {
    const normalizedBoost = Number.isFinite(boostPermille) && boostPermille > 0
        ? boostPermille
        : 1000;
    return normalizedBoost / 10;
}
// Format remaining time
function formatRemainingTime(endTimeMs) {
    if (!endTimeMs || !Number.isFinite(endTimeMs))
        return '';
    const now = Date.now();
    const normalizedEndTimeMs = endTimeMs < 1_000_000_000_000
        ? endTimeMs * 1000
        : endTimeMs;
    const remaining = normalizedEndTimeMs - now;
    if (remaining <= 0)
        return '';
    const totalMinutes = Math.floor(remaining / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) {
        return `⟳ ${days}d${hours}h`;
    }
    if (hours > 0) {
        return `⟳ ${hours}h${minutes}m`;
    }
    return `⟳ ${minutes}m`;
}
function renderProgressBar(usedPercent, remainingPercent, width = 10) {
    const normalizedUsed = clampPercent(usedPercent);
    const normalizedWidth = Math.max(1, Math.floor(width));
    const usedBlocks = normalizedUsed <= 0
        ? 0
        : Math.min(normalizedWidth, Math.max(1, Math.round((normalizedUsed / 100) * normalizedWidth)));
    const remainingBlocks = normalizedWidth - usedBlocks;
    const color = getColor(remainingPercent);
    // T-002: 用量 anchor (│). Disabled via HUD_LEGACY=1 for users on the old visual.
    // Anchor encodes "where on the bar the current usage sits" — its value is
    // redundant with the percentage for sighted users, but it gives a second
    // (non-color) channel that survives NO_COLOR=1 and is invariant to color
    // blindness. See docs/TODO.md#t-002 for the full design.
    if (process.env.HUD_LEGACY === '1') {
        return `${color}${'█'.repeat(usedBlocks)}${DIM}${'░'.repeat(remainingBlocks)}${RESET}`;
    }
    const anchorPos = Math.min(normalizedWidth - 1, usedBlocks);
    const before = '█'.repeat(anchorPos);
    const after = '░'.repeat(normalizedWidth - anchorPos - 1);
    return `${color}${before}${RESET}│${DIM}${after}${RESET}`;
}
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
export function renderTimeProgress(windowStartMs, windowEndMs, width = 10) {
    if (process.env.HUD_LEGACY_TIME === '1')
        return '';
    if (windowStartMs == null || windowEndMs == null) {
        return '─'.repeat(width) + ' elapsed: ?';
    }
    const now = Date.now();
    if (now < windowStartMs) {
        return '─'.repeat(width) + ' 0% elapsed';
    }
    const elapsed = Math.max(0, Math.min(1, (now - windowStartMs) / (windowEndMs - windowStartMs)));
    const anchorPos = Math.min(width - 1, Math.max(0, Math.round(elapsed * width)));
    return '─'.repeat(anchorPos) + '●' + '─'.repeat(width - anchorPos - 1)
        + ` ${Math.round(elapsed * 100)}% elapsed`;
}
/**
 * Sum all token fields from stdin.current_usage to get a single
 * "tokens consumed in this context window" figure. Returns null if
 * any field is missing — we don't guess across providers.
 */
export function sumContextTokens(cu) {
    if (!cu || typeof cu !== 'object')
        return null;
    const fields = ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'];
    let total = 0;
    for (const f of fields) {
        const v = cu[f];
        if (typeof v !== 'number' || !Number.isFinite(v))
            return null;
        total += v;
    }
    return total;
}
/**
 * Compact human-readable token count: 1234 → "1.2K", 1_500_000 → "1.5M".
 * Returns "?" for non-finite input.
 */
export function formatTokenCount(n) {
    if (n === null || n === undefined || !Number.isFinite(n))
        return '?';
    if (n < 1000)
        return String(Math.round(n));
    if (n < 1_000_000)
        return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
    if (n < 1_000_000_000)
        return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`;
    return `${(n / 1_000_000_000).toFixed(n < 10_000_000_000 ? 1 : 0)}B`;
}
function getContextBar(usedPercent, width = 10, usedTokens = null, totalTokens = null) {
    if (usedPercent === null || usedPercent === undefined) {
        return `${DIM}${'░'.repeat(width)}${RESET}`;
    }
    const normalizedUsed = clampPercent(usedPercent);
    const normalizedWidth = Math.max(1, Math.floor(width));
    const usedBlocks = Math.min(normalizedWidth, Math.round((normalizedUsed / 100) * normalizedWidth));
    const remainingBlocks = normalizedWidth - usedBlocks;
    const color = normalizedUsed > 80 ? RED : (normalizedUsed > 50 ? YELLOW : GREEN);
    const bar = `${color}${'█'.repeat(usedBlocks)}${DIM}${'░'.repeat(remainingBlocks)}${RESET}`;
    if (usedTokens === null || totalTokens === null) {
        return `${bar} ${formatPercent(usedPercent)}%`;
    }
    return `${bar} ${formatTokenCount(usedTokens)}/${formatTokenCount(totalTokens)} (${formatPercent(usedPercent)}%)`;
}
function getModelLabel(stdin) {
    const displayName = stdin.model?.display_name?.trim();
    if (displayName)
        return displayName;
    const id = stdin.model?.id?.trim();
    return id || null;
}
function runGit(cwd, args) {
    try {
        return execFileSync('git', args, {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: GIT_TIMEOUT_MS,
        }).trim();
    }
    catch {
        return null;
    }
}
function getCurrentDir(stdin) {
    const candidates = [
        stdin.workspace?.current_dir,
        stdin.cwd,
        stdin.workspace?.project_dir,
        process.cwd(),
    ];
    const currentDir = candidates.find((candidate) => {
        return typeof candidate === 'string' && candidate.trim().length > 0;
    });
    return currentDir?.trim() || process.cwd();
}
function getDirectoryName(currentDir) {
    const resolved = path.resolve(currentDir);
    return path.basename(resolved) || resolved;
}
function getGitBranchLabel(cwd) {
    const branch = runGit(cwd, ['branch', '--show-current']);
    if (branch)
        return branch;
    const head = runGit(cwd, ['rev-parse', '--short', 'HEAD']);
    return head ? `detached@${head}` : null;
}
function getAheadBehindLabel(cwd) {
    const output = runGit(cwd, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']);
    if (!output)
        return '';
    const [aheadRaw, behindRaw] = output.split(/\s+/);
    const ahead = Number.parseInt(aheadRaw ?? '', 10);
    const behind = Number.parseInt(behindRaw ?? '', 10);
    const parts = [];
    if (Number.isFinite(ahead) && ahead > 0) {
        parts.push(`↑${ahead}`);
    }
    if (Number.isFinite(behind) && behind > 0) {
        parts.push(`↓${behind}`);
    }
    return parts.length > 0 ? ` ${parts.join('')}` : '';
}
function getGitStatusLabel(cwd) {
    const isGitRepo = runGit(cwd, ['rev-parse', '--is-inside-work-tree']);
    if (isGitRepo !== 'true')
        return 'no git';
    const branchLabel = getGitBranchLabel(cwd);
    if (!branchLabel)
        return 'no git';
    const dirty = Boolean(runGit(cwd, ['status', '--porcelain']));
    const state = dirty ? '!' : '✓';
    return `${branchLabel} ${state}${getAheadBehindLabel(cwd)}`;
}
function getProjectLabel(stdin) {
    const currentDir = getCurrentDir(stdin);
    return `${getDirectoryName(currentDir)} │ ${BROWN_YELLOW}${getGitStatusLabel(currentDir)}${RESET}`;
}
/**
 * Render the HUD for an arbitrary provider using the normalised payload.
 * Headers (model / project / context) are provider-agnostic; the usage
 * line is suppressed entirely when `data` is null (i.e. fetch failed
 * or returned no rows). When the provider only exposes a single window
 * (Kimi), the `7d` column collapses to a "─" placeholder so the layout
 * stays recognisable.
 */
export function renderProvider(data, stdin = {}) {
    const modelLabel = getModelLabel(stdin);
    const projectLabel = getProjectLabel(stdin);
    const rawContextUsed = stdin.context_window?.used_percentage ?? null;
    const contextUsed = rawContextUsed === null ? null : clampPercent(rawContextUsed);
    const usedTokens = sumContextTokens(stdin.context_window?.current_usage);
    const totalTokens = stdin.context_window?.context_window_size ?? null;
    const contextBar = getContextBar(contextUsed, 10, usedTokens, totalTokens);
    if (modelLabel) {
        console.log(`${BLUE}[${modelLabel}]${RESET}`);
    }
    console.log(`  Project │ ${projectLabel}`);
    if (contextUsed !== null) {
        console.log(`  Context │ ctx ${contextBar}`);
    }
    if (!data)
        return;
    const label = data.providerId === 'minimax' ? 'MiniMax'
        : data.providerId === 'kimi' ? 'Kimi'
            : data.providerId === 'bailian' ? 'Bailian'
                : data.providerId === 'mimo' ? 'MiMo'
                    : data.providerId === 'volcengine' ? 'Volcengine'
                        : 'Zhipu';
    const hasInterval = data.intervalRemainingPercent !== null;
    const hasWeekly = data.weeklyRemainingPercent !== null;
    if (!hasInterval && !hasWeekly) {
        console.log(`  ${label} ─`);
        return;
    }
    if (hasInterval && !hasWeekly) {
        const intervalRemaining = clampPercent(data.intervalRemainingPercent ?? 0);
        const intervalUsed = 100 - intervalRemaining;
        const intervalBar = renderProgressBar(intervalUsed, intervalRemaining);
        const intervalReset = formatRemainingTime(data.intervalResetMs ?? undefined);
        const resetStr = intervalReset ? ` ${intervalReset}` : '';
        console.log(`  ${label} │ 5h  ${intervalBar} ${formatPercent(intervalUsed)}% (100%)${resetStr}`);
        const intervalTime = renderTimeProgress(data.intervalWindowStartMs, data.intervalResetMs);
        if (intervalTime)
            console.log(`  ${label} │ 5h  ${intervalTime}`);
        return;
    }
    // 5h + 7d layout (MiniMax-shaped). When the provider only knows 7d
    // we render an empty 5h column so the 7d progress bar still shows.
    if (!hasInterval) {
        const weeklyRemaining = clampPercent(data.weeklyRemainingPercent ?? 0);
        const weeklyUsed = calcUsedPercent(weeklyRemaining, data.weeklyBoostPermille);
        const totalPercent = getTotalPercent(data.weeklyBoostPermille);
        const weeklyBar = renderProgressBar(weeklyUsed, weeklyRemaining);
        const weeklyReset = formatRemainingTime(data.weeklyResetMs ?? undefined);
        const empty5hBar = `${DIM}${'░'.repeat(10)}${RESET}`;
        const resetStr = weeklyReset ? ` ${weeklyReset}` : '';
        const weeklyTimeOnly = renderTimeProgress(data.weeklyWindowStartMs, data.weeklyResetMs);
        console.log(`  ${label} │ 5h  ${empty5hBar} ─ (100%) │ 7d ${weeklyBar} ${formatPercent(weeklyUsed)}% (${formatPercent(totalPercent)}%)${resetStr}${weeklyTimeOnly ? ' ' + weeklyTimeOnly : ''}`);
        return;
    }
    const intervalRemaining = clampPercent(data.intervalRemainingPercent ?? 0);
    const weeklyRemaining = clampPercent(data.weeklyRemainingPercent ?? 0);
    const intervalUsed = 100 - intervalRemaining;
    const weeklyUsed = calcUsedPercent(weeklyRemaining, data.weeklyBoostPermille);
    const totalPercent = getTotalPercent(data.weeklyBoostPermille);
    const intervalBar = renderProgressBar(intervalUsed, intervalRemaining);
    const weeklyBar = renderProgressBar(weeklyUsed, weeklyRemaining);
    const intervalReset = formatRemainingTime(data.intervalResetMs ?? undefined);
    const weeklyReset = formatRemainingTime(data.weeklyResetMs ?? undefined);
    // 7d 时间行已取消(用户偏好:只看用量 + 倒计时);5h 时间仍独立成行
    console.log(`  ${label} │ 5h  ${intervalBar} ${formatPercent(intervalUsed)}% (100%) ${intervalReset} │ 7d ${weeklyBar} ${formatPercent(weeklyUsed)}% (${formatPercent(totalPercent)}%) ${weeklyReset}`);
    // T-004: 第二行 — 5h 时间进度
    const intervalTime = renderTimeProgress(data.intervalWindowStartMs, data.intervalResetMs);
    if (intervalTime)
        console.log(`  ${label} │ 5h  ${intervalTime}`);
}
/**
 * Backward-compat shim for callers that still pass the legacy
 * `TokenPlanRemain` payload. New code should call `renderProvider()` with a
 * `NormalizedUsage` instead. When `isMinimax` is false the line is
 * suppressed entirely.
 */
export function render(data, stdin = {}, isMinimax = true) {
    if (!isMinimax) {
        // Keep header rendering consistent with the provider path.
        renderProvider(null, stdin);
        return;
    }
    if (!data) {
        renderProvider(null, stdin);
        return;
    }
    const toMs = (t) => t < 1_000_000_000_000 ? t * 1000 : t;
    const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const intervalEnd = toMs(data.end_time);
    const weeklyEnd = toMs(data.weekly_end_time);
    renderProvider({
        intervalRemainingPercent: data.current_interval_remaining_percent,
        intervalResetMs: intervalEnd,
        intervalWindowStartMs: intervalEnd - FIVE_HOURS_MS,
        weeklyRemainingPercent: data.current_weekly_remaining_percent,
        weeklyResetMs: weeklyEnd,
        weeklyWindowStartMs: weeklyEnd - SEVEN_DAYS_MS,
        weeklyBoostPermille: data.weekly_boost_permille,
        providerId: 'minimax',
    }, stdin);
}
