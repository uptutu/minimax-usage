// ANSI color codes
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
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
    return `${color}${'█'.repeat(usedBlocks)}${DIM}${'░'.repeat(remainingBlocks)}${RESET}`;
}
function getContextBar(usedPercent, width = 10) {
    if (usedPercent === null || usedPercent === undefined) {
        return `${DIM}${'░'.repeat(width)}${RESET}`;
    }
    const normalizedUsed = clampPercent(usedPercent);
    const normalizedWidth = Math.max(1, Math.floor(width));
    const usedBlocks = Math.min(normalizedWidth, Math.round((normalizedUsed / 100) * normalizedWidth));
    const remainingBlocks = normalizedWidth - usedBlocks;
    const color = normalizedUsed > 80 ? RED : (normalizedUsed > 50 ? YELLOW : GREEN);
    return `${color}${'█'.repeat(usedBlocks)}${DIM}${'░'.repeat(remainingBlocks)}${RESET}`;
}
export function render(data, stdin = {}) {
    if (!data) {
        console.log('MiniMax ─');
        return;
    }
    // 5h interval uses base 100% (no boost for interval)
    const intervalRemaining = clampPercent(data.current_interval_remaining_percent);
    const weeklyRemaining = clampPercent(data.current_weekly_remaining_percent);
    const intervalUsed = 100 - intervalRemaining;
    // 7d weekly uses boosted total
    const weeklyUsed = calcUsedPercent(weeklyRemaining, data.weekly_boost_permille);
    const totalPercent = getTotalPercent(data.weekly_boost_permille);
    // Get context usage from stdin
    const rawContextUsed = stdin.context_window?.used_percentage ?? null;
    const contextUsed = rawContextUsed === null ? null : clampPercent(rawContextUsed);
    const intervalBar = renderProgressBar(intervalUsed, intervalRemaining);
    const weeklyBar = renderProgressBar(weeklyUsed, weeklyRemaining);
    const contextBar = getContextBar(contextUsed);
    const intervalReset = formatRemainingTime(data.end_time);
    const weeklyReset = formatRemainingTime(data.weekly_end_time);
    if (contextUsed !== null) {
        console.log(`Context │ ctx ${contextBar} ${formatPercent(contextUsed)}%`);
        console.log(`MiniMax │ 5h  ${intervalBar} ${formatPercent(intervalUsed)}% (100%) ${intervalReset} │ 7d ${weeklyBar} ${formatPercent(weeklyUsed)}% (${formatPercent(totalPercent)}%) ${weeklyReset}`);
    }
    else {
        console.log(`MiniMax │ 5h ${intervalBar} ${formatPercent(intervalUsed)}% (100%) ${intervalReset} │ 7d ${weeklyBar} ${formatPercent(weeklyUsed)}% (${formatPercent(totalPercent)}%) ${weeklyReset}`);
    }
}
