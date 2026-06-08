import type { TokenPlanRemain } from './types.js';

function renderProgressBar(percent: number, width: number = 10): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export function render(data: TokenPlanRemain | null): void {
  if (!data) {
    console.log('MiniMax ─');
    return;
  }

  const intervalBar = renderProgressBar(data.current_interval_remaining_percent);
  const weeklyBar = renderProgressBar(data.current_weekly_remaining_percent);

  console.log(
    `MiniMax │ 5h ${intervalBar} ${data.current_interval_remaining_percent}% │ 7d ${weeklyBar} ${data.current_weekly_remaining_percent}%`
  );
}