import type { TokenPlanRemain } from './types.js';

// ANSI color codes
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// Color based on remaining percentage (high remaining = green, low remaining = red)
function getColor(remainingPercent: number): string {
  if (remainingPercent > 50) return GREEN;
  if (remainingPercent >= 20) return YELLOW;
  return RED;
}

function renderProgressBar(remainingPercent: number, width: number = 10): string {
  const usedPercent = 100 - remainingPercent;
  const usedBlocks = Math.round((usedPercent / 100) * width);
  const remainingBlocks = width - usedBlocks;
  const color = getColor(remainingPercent);
  // Used portion: colored blocks, Remaining portion: dim blocks
  return `${color}${'█'.repeat(usedBlocks)}${DIM}${'░'.repeat(remainingBlocks)}${RESET}`;
}

export function render(data: TokenPlanRemain | null): void {
  if (!data) {
    console.log('MiniMax ─');
    return;
  }

  const intervalUsed = 100 - data.current_interval_remaining_percent;
  const weeklyUsed = 100 - data.current_weekly_remaining_percent;

  const intervalBar = renderProgressBar(data.current_interval_remaining_percent);
  const weeklyBar = renderProgressBar(data.current_weekly_remaining_percent);

  console.log(
    `MiniMax │ 5h ${intervalBar} ${intervalUsed}% │ 7d ${weeklyBar} ${weeklyUsed}%`
  );
}