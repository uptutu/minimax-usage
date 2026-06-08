// ANSI color codes
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
// Color based on remaining percentage (high remaining = green, low remaining = red)
function getColor(remainingPercent) {
    if (remainingPercent > 50)
        return GREEN;
    if (remainingPercent >= 20)
        return YELLOW;
    return RED;
}
// Calculate used percentage accounting for boost
// Formula: used% = (100 - remaining%) * (boost_permille / 1000)
// Example: boost=1500 (150%), remaining=96% -> used = 4 * 1.5 = 6%
function calcUsedPercent(remainingPercent, boostPermille) {
    const usedBase = 100 - remainingPercent;
    const usedWithBoost = usedBase * boostPermille / 1000;
    return Math.round(usedWithBoost * 10) / 10;
}
function renderProgressBar(remainingPercent, width = 10) {
    const usedBlocks = Math.round((remainingPercent / 100) * width);
    const remainingBlocks = width - usedBlocks;
    const color = getColor(remainingPercent);
    // Used portion: colored blocks, Remaining portion: dim blocks
    return `${color}${'█'.repeat(usedBlocks)}${DIM}${'░'.repeat(remainingBlocks)}${RESET}`;
}
export function render(data) {
    if (!data) {
        console.log('MiniMax ─');
        return;
    }
    const intervalUsed = calcUsedPercent(data.current_interval_remaining_percent, data.weekly_boost_permille);
    const weeklyUsed = calcUsedPercent(data.current_weekly_remaining_percent, data.weekly_boost_permille);
    const intervalBar = renderProgressBar(data.current_interval_remaining_percent);
    const weeklyBar = renderProgressBar(data.current_weekly_remaining_percent);
    console.log(`MiniMax │ 5h ${intervalBar} ${intervalUsed}% │ 7d ${weeklyBar} ${weeklyUsed}%`);
}
