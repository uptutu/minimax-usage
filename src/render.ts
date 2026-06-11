import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import type { StdinData } from './types.js';
import type { NormalizedUsage } from './provider/types.js';

// ANSI color codes
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const BROWN_YELLOW = '\x1b[38;5;178m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GIT_TIMEOUT_MS = 1000;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

// Color based on remaining percentage (high remaining = green, low remaining = red)
function getColor(remainingPercent: number): string {
  const normalized = clampPercent(remainingPercent);
  if (normalized > 50) return GREEN;
  if (normalized >= 20) return YELLOW;
  return RED;
}

// Calculate used percentage accounting for boost
function calcUsedPercent(remainingPercent: number, boostPermille: number): number {
  const normalizedBoost = Number.isFinite(boostPermille) && boostPermille > 0
    ? boostPermille
    : 1000;
  const usedBase = 100 - clampPercent(remainingPercent);
  const usedWithBoost = usedBase * normalizedBoost / 1000;
  return Math.round(usedWithBoost * 10) / 10;
}

// Get total quota percentage
function getTotalPercent(boostPermille: number): number {
  const normalizedBoost = Number.isFinite(boostPermille) && boostPermille > 0
    ? boostPermille
    : 1000;
  return normalizedBoost / 10;
}

// Format remaining time
function formatRemainingTime(endTimeMs: number | undefined): string {
  if (!endTimeMs || !Number.isFinite(endTimeMs)) return '';
  const now = Date.now();
  const normalizedEndTimeMs = endTimeMs < 1_000_000_000_000
    ? endTimeMs * 1000
    : endTimeMs;
  const remaining = normalizedEndTimeMs - now;

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
  const normalizedUsed = clampPercent(usedPercent);
  const normalizedWidth = Math.max(1, Math.floor(width));
  const usedBlocks = normalizedUsed <= 0
    ? 0
    : Math.min(normalizedWidth, Math.max(1, Math.round((normalizedUsed / 100) * normalizedWidth)));
  const remainingBlocks = normalizedWidth - usedBlocks;
  const color = getColor(remainingPercent);
  return `${color}${'█'.repeat(usedBlocks)}${DIM}${'░'.repeat(remainingBlocks)}${RESET}`;
}

function getContextBar(usedPercent: number | null | undefined, width: number = 10): string {
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

function getModelLabel(stdin: StdinData): string | null {
  const displayName = stdin.model?.display_name?.trim();
  if (displayName) return displayName;

  const id = stdin.model?.id?.trim();
  return id || null;
}

function runGit(cwd: string, args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: GIT_TIMEOUT_MS,
    }).trim();
  } catch {
    return null;
  }
}

function getCurrentDir(stdin: StdinData): string {
  const candidates = [
    stdin.workspace?.current_dir,
    stdin.cwd,
    stdin.workspace?.project_dir,
    process.cwd(),
  ];
  const currentDir = candidates.find((candidate): candidate is string => {
    return typeof candidate === 'string' && candidate.trim().length > 0;
  });

  return currentDir?.trim() || process.cwd();
}

function getDirectoryName(currentDir: string): string {
  const resolved = path.resolve(currentDir);
  return path.basename(resolved) || resolved;
}

function getGitBranchLabel(cwd: string): string | null {
  const branch = runGit(cwd, ['branch', '--show-current']);
  if (branch) return branch;

  const head = runGit(cwd, ['rev-parse', '--short', 'HEAD']);
  return head ? `detached@${head}` : null;
}

function getAheadBehindLabel(cwd: string): string {
  const output = runGit(cwd, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']);
  if (!output) return '';

  const [aheadRaw, behindRaw] = output.split(/\s+/);
  const ahead = Number.parseInt(aheadRaw ?? '', 10);
  const behind = Number.parseInt(behindRaw ?? '', 10);
  const parts: string[] = [];

  if (Number.isFinite(ahead) && ahead > 0) {
    parts.push(`↑${ahead}`);
  }
  if (Number.isFinite(behind) && behind > 0) {
    parts.push(`↓${behind}`);
  }

  return parts.length > 0 ? ` ${parts.join('')}` : '';
}

function getGitStatusLabel(cwd: string): string {
  const isGitRepo = runGit(cwd, ['rev-parse', '--is-inside-work-tree']);
  if (isGitRepo !== 'true') return 'no git';

  const branchLabel = getGitBranchLabel(cwd);
  if (!branchLabel) return 'no git';

  const dirty = Boolean(runGit(cwd, ['status', '--porcelain']));
  const state = dirty ? '!' : '✓';
  return `${branchLabel} ${state}${getAheadBehindLabel(cwd)}`;
}

function getProjectLabel(stdin: StdinData): string {
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
export function renderProvider(data: NormalizedUsage | null, stdin: StdinData = {}): void {
  const modelLabel = getModelLabel(stdin);
  const projectLabel = getProjectLabel(stdin);

  const rawContextUsed = stdin.context_window?.used_percentage ?? null;
  const contextUsed = rawContextUsed === null ? null : clampPercent(rawContextUsed);
  const contextBar = getContextBar(contextUsed);

  if (modelLabel) {
    console.log(`${BLUE}[${modelLabel}]${RESET}`);
  }

  console.log(`  Project │ ${projectLabel}`);

  if (contextUsed !== null) {
    console.log(
      `  Context │ ctx ${contextBar} ${formatPercent(contextUsed)}%`
    );
  }

  if (!data) return;

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
    console.log(
      `  ${label} │ 5h  ${empty5hBar} ─ (100%) │ 7d ${weeklyBar} ${formatPercent(weeklyUsed)}% (${formatPercent(totalPercent)}%)${resetStr}`
    );
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

  console.log(
    `  ${label} │ 5h  ${intervalBar} ${formatPercent(intervalUsed)}% (100%) ${intervalReset} │ 7d ${weeklyBar} ${formatPercent(weeklyUsed)}% (${formatPercent(totalPercent)}%) ${weeklyReset}`
  );
}

/**
 * Backward-compat shim for callers that still pass the legacy
 * `TokenPlanRemain` payload. New code should call `renderProvider()` with a
 * `NormalizedUsage` instead. When `isMinimax` is false the line is
 * suppressed entirely.
 */
export function render(
  data: { current_interval_remaining_percent: number; current_weekly_remaining_percent: number; weekly_boost_permille: number; end_time: number; weekly_end_time: number } | null,
  stdin: StdinData = {},
  isMinimax: boolean = true
): void {
  if (!isMinimax) {
    // Keep header rendering consistent with the provider path.
    renderProvider(null, stdin);
    return;
  }
  if (!data) {
    renderProvider(null, stdin);
    return;
  }
  const toMs = (t: number): number => t < 1_000_000_000_000 ? t * 1000 : t;
  renderProvider({
    intervalRemainingPercent: data.current_interval_remaining_percent,
    intervalResetMs: toMs(data.end_time),
    weeklyRemainingPercent: data.current_weekly_remaining_percent,
    weeklyResetMs: toMs(data.weekly_end_time),
    weeklyBoostPermille: data.weekly_boost_permille,
    providerId: 'minimax',
  }, stdin);
}
