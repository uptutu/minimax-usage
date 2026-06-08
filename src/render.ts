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

function renderProgressBar(usedPercent: number, remainingPercent: number, width: number = 10): string {
  const usedBlocks = Math.round((usedPercent / 100) * width);
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

  if (contextUsed !== null) {
    console.log(
      `Ctx ${contextBar} ${contextUsed}% │ MiniMax │ 5h ${intervalBar} ${intervalUsed}% (100%) │ 7d ${weeklyBar} ${weeklyUsed}% (${totalPercent}%)`
    );
  } else {
    console.log(
      `MiniMax │ 5h ${intervalBar} ${intervalUsed}% (100%) │ 7d ${weeklyBar} ${weeklyUsed}% (${totalPercent}%)`
    );
  }
}