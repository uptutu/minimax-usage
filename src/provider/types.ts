/**
 * Provider registry contracts.
 *
 * Each provider (MiniMax, Kimi, Bailian, MiMo, Volcengine, Zhipu) implements
 * the {@link Provider} interface and returns a {@link NormalizedUsage} on
 * successful fetch. Renderers consume only `NormalizedUsage` so the HUD line
 * stays uniform regardless of which upstream is plugged in.
 */

/** 归一化后的用量,所有 provider 都要返回这个 shape,让 render 复用。 */
export interface NormalizedUsage {
  /** 5h 窗口剩余百分比(0–100);null = 不可知 */
  intervalRemainingPercent: number | null;
  /** 5h 窗口结束时间(epoch ms);null = 不可知 */
  intervalResetMs: number | null;
  /** 7d 周窗口剩余百分比(0–100);null = 不可知 */
  weeklyRemainingPercent: number | null;
  /** 7d 周窗口结束时间(epoch ms);null = 不可知 */
  weeklyResetMs: number | null;
  /** 5h 窗口开始时间(epoch ms);null = 不可知(用于 T-004 时间进度行) */
  intervalWindowStartMs: number | null;
  /** 7d 窗口开始时间(epoch ms);null = 不可知(用于 T-004 时间进度行) */
  weeklyWindowStartMs: number | null;
  /** 套餐 boost 系数(‰,MiniMax 用);Kimi 传 1000 */
  weeklyBoostPermille: number;
  /** 原始 provider 标识(用于 debug 日志) */
  providerId: 'minimax' | 'kimi' | 'bailian' | 'mimo' | 'volcengine' | 'zhipu';
}

/** 单一 provider 抽象,所有真实/stub provider 必须实现。 */
export interface Provider {
  readonly id: NormalizedUsage['providerId'];
  /** 显示名(用于 HUD 第一列):"MiniMax" / "Kimi" / "Bailian" 等 */
  readonly displayName: string;
  /** 路由:用 ANTHROPIC_BASE_URL 判定本 provider 是否应该被激活 */
  matches(): boolean;
  /** 拉取并归一化为 NormalizedUsage;失败/无 key 返回 null */
  fetch(): Promise<NormalizedUsage | null>;
}
