import type { TokenPlanRemain } from './types.js';

// ANSI color codes
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

interface StdinData {
  context_window?: {
    context_window_size?: number;
    current_usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    } | null;
    used_percentage?: number | null;
    remaining_percentage?: number | null;
  } | null;
}

// Color based on remaining percentage (high remaining = green, low remaining = red)
function getColor(remainingPercent: number): string {
  if (remainingPercent > 50) return GREEN;
  if (remainingPercent >= 20) return YELLOW;
  return RED;
}

// Calculate used percentage accounting for boost
function calcUsedPercent(remainingPercent: number, boostPermille: number): number {
  const usedBase = 100 - remainingPercent;
  const usedWithBoost = usedBase * boostPermille / 1000;
  return Math.round(usedWithBoost * 10) / 10;
}

// Get total quota percentage
function getTotalPercent(boostPermille: number): number {
  return boostPermille / 10;
}

// Format remaining time
function formatRemainingTime(endTimeMs: number | undefined): string {
  if (!endTimeMs) return '';
  const now = Date.now();
  const remaining = endTimeMs - now;

  if (remaining <= 0) return '';

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

function renderProgressBar(usedPercent: number, remainingPercent: number, width: number = 10): string {
  const usedBlocks = Math.max(1, Math.round((usedPercent / 100) * width));
  const remainingBlocks = width - usedBlocks;
  const color = getColor(remainingPercent);
  return `${color}${'█'.repeat(usedBlocks)}${DIM}${'░'.repeat(remainingBlocks)}${RESET}`;
}

function getContextBar(usedPercent: number | null | undefined, width: number = 10): string {
  if (usedPercent === null || usedPercent === undefined) {
    return `${DIM}${'░'.repeat(width)}${RESET}`;
  }
  const usedBlocks = Math.round((usedPercent / 100) * width);
  const remainingBlocks = width - usedBlocks;
  const color = usedPercent > 80 ? RED : (usedPercent > 50 ? YELLOW : GREEN);
  return `${color}${'█'.repeat(usedBlocks)}${DIM}${'░'.repeat(remainingBlocks)}${RESET}`;
}

export function render(data: TokenPlanRemain | null, stdin: StdinData = {}): void {
  if (!data) {
    console.log('MiniMax ─');
    return;
  }

  // 5h interval uses base 100% (no boost for interval)
  const intervalUsed = 100 - data.current_interval_remaining_percent;
  // 7d weekly uses boosted total
  const weeklyUsed = calcUsedPercent(data.current_weekly_remaining_percent, data.weekly_boost_permille);
  const totalPercent = getTotalPercent(data.weekly_boost_permille);

  // Get context usage from stdin
  const contextUsed = stdin.context_window?.used_percentage ?? null;

  const intervalBar = renderProgressBar(intervalUsed, data.current_interval_remaining_percent);
  const weeklyBar = renderProgressBar(weeklyUsed, data.current_weekly_remaining_percent);
  const contextBar = getContextBar(contextUsed);

  const intervalReset = formatRemainingTime(data.end_time);
  const weeklyReset = formatRemainingTime(data.weekly_end_time);

  if (contextUsed !== null) {
    console.log(
      `Context │ ctx ${contextBar} ${contextUsed}%`
    );
    console.log(
      `MiniMax │ 5h  ${intervalBar} ${intervalUsed}% (100%) ${intervalReset} │ 7d ${weeklyBar} ${weeklyUsed}% (${totalPercent}%) ${weeklyReset}`
    );
  } else {
    console.log(
      `MiniMax │ 5h ${intervalBar} ${intervalUsed}% (100%) ${intervalReset} │ 7d ${weeklyBar} ${weeklyUsed}% (${totalPercent}%) ${weeklyReset}`
    );
  }
}