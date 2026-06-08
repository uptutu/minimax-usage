// ANSI color codes
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
function getColor(percent) {
    if (percent > 50)
        return GREEN;
    if (percent >= 20)
        return YELLOW;
    return RED;
}
function renderProgressBar(percent, width = 10) {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    const color = getColor(percent);
    return `${color}${'█'.repeat(filled)}${RED}${'░'.repeat(empty)}${RESET}`;
}
export function render(data) {
    if (!data) {
        console.log('MiniMax ─');
        return;
    }
    const intervalBar = renderProgressBar(data.current_interval_remaining_percent);
    const weeklyBar = renderProgressBar(data.current_weekly_remaining_percent);
    console.log(`MiniMax │ 5h ${intervalBar} ${data.current_interval_remaining_percent}% │ 7d ${weeklyBar} ${data.current_weekly_remaining_percent}%`);
}
