# minimax-usage — TODO

> 持续维护的产品/工程待办。来源:连续发现 + brainstorm sessions。
> 优先级:🔴 P0 (高 ROI/小动作) → 🟡 P1 (重要但需评估) → 🟢 P2 (战略,大投入)

## 维护规则

- 每条 TODO 包含:**目标 / 验收 / 估算 / 状态**
- 完成一条 → 移到 `## Done` 区,标注 commit
- 新增条目 → 注明 brainstorm 来源 session,便于回溯

---

## 🔴 P0 — 当前 backlog(下一迭代)

### T-001 · 历史斜率外推:5h/7d 配额耗尽时刻预测

- **来源**: brainstorm session 2026-06-12(Round 1 #2 + Round 2 #2,合并)
- **目标**: 插件本地记录每次成功的 quota 拉取,基于历史斜率外推"按当前速率,5h/7d 配额预计何时耗尽",以**纯时间戳**形式注入 HUD
- **价值**: 解决"多家 LLM 没公开 quota API"约束;预测不替代决策,用户保留控制权;跨 provider 通用
- **数据底座**: `${CLAUDE_CONFIG_DIR}/plugins/minimax-usage/cache/usage-history.ndjson`(append-only,JSONL)
  ```jsonl
  {"ts":1749623400000,"provider":"minimax","interval":5,"remaining":78.3}
  ```
- **算法(L0 首版)**: 取最近 30 分钟样本,简单线性外推 `eta = now + remaining / rate_per_min`
- **HUD 渲染**:
  - 当前: `MiniMax │ 5h  ████████░░ 81% (100%) ⟳ 15m │ 7d ...`
  - 新增: `MiniMax │ 5h  ████████░░ 81% (100%) ⟳ 15m · ⌛ 14:20 │ 7d ...`
  - 样本不足(<10 条)/ 速率 ≤ 0 → 整段消失,降级不报错
- **边界**:
  - 30 天滚动窗口,可配置 `historyRetentionDays`
  - Provider 隔离,互不污染
  - 检测 remaining 跳变(重置发生)→ 清空旧斜率
  - 文件锁:append + 偶尔 prune
- **验收**:
  - 单元测试覆盖外推算法、样本不足降级、重置检测
  - 烟雾测试覆盖 HUD 注入路径
  - 文档说明本地历史文件位置与隐私边界
- **分阶段**:
  - [ ] **M1** ndjson 写盘 + 30 天 prune + 文件锁(0.5d)
  - [ ] **M2** L0 线性外推 + ETA 时间戳计算(0.5d)
  - [ ] **M3** HUD 渲染层注入 + 样本不足时退化(0.5d)
  - [ ] **M4** 单元测试 + 烟雾测试 + 用户文档(0.5d)
- **依赖**: 无前置,可独立发布为 `0.1.x`
- **关联假设**:
  - [H-1] 30 min 样本足够稳定
  - [H-2] 简单线性回归对个人开发者精度可接受
  - [H-3] 30 天保留覆盖周期性使用模式
  - [H-4] HUD 加 ETA 字符后 ≤140 字符 terminal 仍可显示完整
  - [H-5] ETA 跨重置时刻时用户不困惑

---

## 🟡 P1 — 评估中(下一两次迭代讨论)

### T-002 · 时间锚点 + 节奏条(HUD 重设计)

- **来源**: brainstorm 2026-06-12 D1 + D8,设计稿 2026-06-12 落地
- **目标**: 在 5h/7d bar 上画一根 `│` 表示"现在时刻",用户能立刻读出"已用 80% 用量 / 20% 时间"的对比,补充 bar 长度缺少的"时间位置感"
- **设计稿(5 个核心场景,2026-06-12 更新为双行)**:

  | 场景 | 渲染 | 含义 |
  |------|------|------|
  | 刚起步 | `5h  ██│░░░░░░░░ 15% (100%)`<br>`5h  ━━│━━━━━━━━ 20% ⟳ 4h12m` | 用量 15% / 时间 20%,健康(anchor 几乎对齐) |
  | 中段健康 | `5h  ████│░░░░░░ 40% (100%)`<br>`5h  ━━━━━━━━│━━ 80% ⟳ 48m` | 用量 40% / 时间 80%,节流(用量 anchor 在左) |
  | 末段透支 | `5h  █████████│░ 90% (100%)`<br>`5h  ━━━━━━━━│━━ 80% ⟳ 12m` | 用量 90% / 时间 80%,危险(用量 anchor 在右) |
  | 早期透支 | `5h  ██████████│ 95% (100%)`<br>`5h  ━━━━━│━━━━━━ 50% ⟳ 2h30m` | 用量 95% / 时间 50%,提前透支(差距巨大) |
  | 末段省用 | `5h  █│░░░░░░░░░ 5% (100%)`<br>`5h  ━━━━━━━━│━━ 80% ⟳ 2h30m` | 用量 5% / 时间 80%,极度节流 |

  注:`│` 是用量 anchor;`│` 在第二行同一宽度位置是时间 anchor(`●`)——但 T-002 草稿用 `│` 作占位简化展示,正式实现是 `━ ● ─`(T-004)。

- **关键设计决策**:
  - Anchor 字符:`│`(U+2502 BOX DRAWINGS LIGHT VERTICAL),宽度 1,与 `█/░` 风格统一
  - Anchor 颜色:**不染色**,默认文本色,作为参考线不喧宾夺主
  - 位置算法:`pos = round(usedPercent / 100 * width)`,clamp 到 `[0, width-1]`
  - Anchor 行为:**覆盖**该位置的 bar 块(替换 `█/░`),总宽度严格不变
  - 5h + 7d 双窗口同步加 anchor,体验一致
  - `⟳ 倒计时` 仍保留,anchor 不替代它(进度 + 倒计时互补)
  - `NO_COLOR=1` 时 anchor 仍可见(字符而非颜色)

- **算法骨架**(`src/render.ts`):
  ```typescript
  function renderProgressBarWithAnchor(
    usedPercent: number,
    remainingPercent: number,
    width = 10,
  ): string {
    const clamped = clampPercent(usedPercent);
    const blocksUsed = Math.round((clamped / 100) * width);
    const anchorPos = Math.min(width - 1, Math.max(0, blocksUsed));
    const color = getColor(remainingPercent);

    const before = '█'.repeat(anchorPos);
    const after  = '░'.repeat(width - anchorPos - 1);
    return `${color}${before}${RESET}│${DIM}${after}${RESET}`;
  }
  ```

- **边界处理**:
  - `usedPercent = 0` → anchor 在位置 0,显示 `│░░░░░░░░░`
  - `usedPercent = 100` → anchor 在最右,显示 `█████████│`
  - `usedPercent > 100`(跨窗口未重置)→ clamp 到 `width-1`,anchor 贴右
  - 终端不支持 `│` → 自动探测 fallback 到 `|`
  - `NO_COLOR=1` → 颜色码省略,bar 退化为 `█`/`░`,anchor 仍清晰

- **与 T-001 协同**(最终 HUD 行):
  ```
  5h  ████████│░░ 81% (100%) ⟳ 15m · ⌛ 14:20 │ 7d ...
                  ↑ anchor      ↑ 倒计时  ↑ ETA 预测
  ```

- **可访问性**:
  - 色盲: anchor 是字符而非颜色,色盲用户仍能定位
  - screen reader: 隐藏行 `now: 81% at 80% time elapsed`(可由 `HUD_A11Y=1` 启用)

- **验收**:
  - 单元测试(`tests/render.test.ts`):
    - [ ] `renderProgressBarWithAnchor(0, 100)` → `│░░░░░░░░░`
    - [ ] `renderProgressBarWithAnchor(100, 0)` → `█████████│`
    - [ ] `renderProgressBarWithAnchor(50, 50)` → `█████│░░░░`
    - [ ] `renderProgressBarWithAnchor(5, 95)` → `█│░░░░░░░░`
    - [ ] `renderProgressBarWithAnchor(150, -50)` → clamp 到 width-1
    - [ ] `NO_COLOR=1` 时输出无 ANSI 颜色码
  - 烟雾测试(`scripts/dev-verify.sh`):
    - [ ] 5h/7d 两窗口都出现 anchor
    - [ ] 字符总宽度严格不变(替换前 10 块,替换后 10 块 + 1 anchor)
    - [ ] reset time 显示仍在
  - 视觉快照(5 个场景渲染输出固定):
    - [ ] 场景 1-5 全部 inline snapshot 通过

- **可回滚**: `HUD_LEGACY=1` 临时关闭 anchor,保留旧样式(便于不喜欢新视觉的用户过渡)

- **工作量**: 1d(算法 0.5d + HUD 注入 0.25d + 视觉快照 0.25d)

- **风险**:
  - 终端不支持 `│` → 自动 fallback 到 `|`
  - Bar 对齐错位 → 总宽度严格不变,已用 inline snapshot 锁死
  - 用户不适 → `HUD_LEGACY=1` 临时回滚 + README "v0.2.x 新视觉" 说明

- **关联**: 与 T-001(ETA 外推)共用渲染层;两者可同 PR 上(独立 commit)

### T-003 · 三态颜色 + 三态字符(可访问性)

- **来源**: brainstorm 2026-06-12 D6
- **目标**: 当前用 ANSI 红/黄/绿,色盲用户分辨不出;增加字符冗余(▲▮▮ 健康 / ◆▮▯ 紧张 / ▽▯▯ 告急)
- **验收**: 字符冗余在 `$TERM` 不支持颜色时仍能传递状态

### T-004 · 时间进度行(双 anchor 节奏对比)

- **来源**: brainstorm 2026-06-12 P2 → 重构为方案 D,2026-06-12 定稿
- **目标**: 在 statusline **加第二行**,编码"时间进度"维度,与第一行(用量进度)形成**双 anchor 对比**——让用户用眼睛比较两 anchor 的**相对位置**,直接读出"节奏健康 / 透支 / 节流"
- **核心洞察**: T-002 的 `│` anchor 在单 bar 内部信息有限(数字已说 40%);但**与第二行 `●` 时间锚对位**,价值翻倍——`│` 升级为"用量 X 轴锚",`●` 是"时间 X 轴锚",**两 anchor 的距离 = 节奏感**
- **最终渲染**(已采纳,2026-06-12 微调:`⟳ 48m` 从第一行搬到第二行,7d 同步):

  ```
  5h  ████████│░░░░░░ 40% (100%)
  5h  ━━━━━━━━━━━━●── 80% ⟳ 48m
                  ↑          ↑      ↑
                用量 anchor │ 时间 anchor  倒计时
  ```

  7d 双窗口完整渲染:

  ```
  5h  ████████│░░░░░░ 40% (100%)
  5h  ━━━━━━━━━━━━●── 80% ⟳ 48m
  7d  █│░░░░░░░░░ 9% (150%)
  7d  ━━━━●━━━━━━━━━ 30% ⟳ 4d9h
  ```

- **信息架构(每行一个纯维度)**:

  | 行 | 编码 | 包含 |
  |----|------|------|
  | 第 1 行 | **纯用量** | 用量 bar + 用量 `│` anchor + 百分比 + 总额 |
  | 第 2 行 | **纯时间** | 时间线 + 时间 `●` anchor + elapsed 百分比 + **倒计时 `⟳ X`** |

  **倒计时只在时间行**,用户扫读路径:上看用量,下看时间,倒计时在底部——无歧义。

- **视觉重量核对**(层级关系):

  | 元素 | 字符 | 重量 |
  |------|------|------|
  | 用量 bar 满块 | `█` | 重(主) |
  | 用量 anchor | `│` | 中 |
  | 时间线 | `━` | 轻(辅) |
  | 时间 anchor | `●` | 中 |
  | 倒计时 | `⟳ 48m` | 轻 |

  用量行视觉重、时间行视觉轻——符合"时间行是参考"的设计意图。

- **为何搬到第二行**:
  - 避免"48m 是用量还是时间的"歧义
  - 每行管一个纯维度,扫读路径短
  - 迁移成本低(倒计时仍 `⟳ X` 形态,只是位置从第一行末挪到第二行末)

- **关键设计决策**:
  - **保留 T-002 的 `│`**(不删):它编码"用量位置",与时间锚形成对比
  - **第二行用 `━ ● ─`**:box-drawing 字符,visual weight 比 `█` 轻,表明"参考线"而非"主数据"
  - **第二行只显示时间进度**,不重复数字(`80% elapsed` 后缀提供精确百分比)
  - **第二行宽度 16 字符**(比用量 bar 的 10 字符宽):无数字干扰,纯位置感,扫读更顺
  - **`─` 字符的视觉重量 < `█`**:第二行天然成为"辅助信息",不抢第一行主角
  - **`●` 实心圆点**(vs `│` 线条):两 anchor 形状不同,视觉上能区分

- **信息价值表(双 anchor 相对位置)**:

  | 场景 | 第一行 `│` | 第二行 `●` | 用户读出 |
  |------|----------|----------|----------|
  | 节奏健康 | 40% | 40% | 两 anchor 重合 → 同步 |
  | 提前透支 | 90% | 40% | `│` 在右,`●` 在左 → 用量跑得快 |
  | 节流 | 5% | 80% | `│` 在左,`●` 在右 → 用量跑得慢 |
  | 刚重置 | 1% | 1% | 两 anchor 都在最左 → 新窗口 |
  | 即将重置 | 95% | 99% | 两 anchor 都在最右 → 即将换新 |

- **算法骨架**(`src/render.ts`):
  ```typescript
  function renderTimeProgress(
    windowStartMs: number | null,
    windowEndMs: number | null,
    width = 16,
  ): string {
    if (!windowStartMs || !windowEndMs) {
      return '─'.repeat(width) + ' elapsed: ?';  // 降级
    }
    const now = Date.now();
    const elapsed = (now - windowStartMs) / (windowEndMs - windowStartMs);
    const elapsedPct = Math.max(0, Math.min(1, elapsed));
    const blocksElapsed = Math.round(elapsedPct * width);
    const anchorPos = Math.min(width - 1, Math.max(0, blocksElapsed));
    return '─'.repeat(anchorPos) + '●' + '─'.repeat(width - anchorPos - 1)
         + ` ${Math.round(elapsedPct * 100)}% elapsed`;
  }
  ```

- **数据需求**(provider 层补字段):

  | Provider | 当前数据 | 需补 |
  |----------|----------|------|
  | MiniMax | `end_time` (epoch s) | `start_time` (epoch s) |
  | Kimi | `resetTime` | 从 `resetTime` 推断(假设连续窗口) |
  | Bailian/MiMo/Volcengine/Zhipu | stub | 后续接入时一并补 |

  NormalizedUsage 新增字段:
  ```typescript
  {
    intervalResetMs: number,           // 已有
    intervalWindowStartMs: number,     // 新增
    weeklyResetMs: number,             // 已有
    weeklyWindowStartMs: number,       // 新增
  }
  ```

- **降级路径**:
  - `windowStartMs` 缺失 → 第二行显示 `─...─ elapsed: ?`(不报错)
  - `HUD_LEGACY_TIME=1` → 完全关闭第二行
  - 终端不支持 `━ ● ─` → fallback 到 `- o -`(与 T-002 ASCII fallback 同一机制)

- **与 T-002 协同关系**:

  | 单独 T-002 | T-002 + T-004 D 方案 |
  |-----------|---------------------|
  | `│` 是单 bar 内位置锚,价值有限(数字已说 40%) | `│` 升级为"用量 X 轴锚",与时间 X 轴锚 `●` 对位,价值翻倍 |
  | 信息:用量 % | 信息:**用量 % + 时间 % + 节奏对比**(三件事) |
  | 行数 1 | 行数 2 |

  **结论**: T-002 没白做。方案 D 让 T-002 真正有意义。

- **验收**:

  - 单元测试(`tests/time-progress.test.ts`):
    - [ ] `renderTimeProgress(now=50%, width=16)` → `━━━━━━━●━━━━━━━━` (8 + `●` + 7)
    - [ ] `renderTimeProgress(now=10%, width=16)` → `●━━━━━━━━━━━━━━━` (anchor 在最左)
    - [ ] `renderTimeProgress(now=90%, width=16)` → `━━━━━━━━━━━━━━━●` (anchor 在最右)
    - [ ] `renderTimeProgress(now=100%, width=16)` → clamp 到最右
    - [ ] `renderTimeProgress(now=0%, width=16)` → clamp 到最左
    - [ ] `renderTimeProgress(null, null)` → `─...─ elapsed: ?`
    - [ ] 边界(now < start) → 全部 `─`
  - 视觉快照(5 场景,inline snapshot):
    - [ ] 节奏健康(两 anchor 重合)
    - [ ] 提前透支(用量 anchor 在右)
    - [ ] 节流(用量 anchor 在左)
    - [ ] 刚重置(两 anchor 都在左)
    - [ ] 即将重置(两 anchor 都在右)
  - provider 层(`tests/provider.test.ts`):
    - [ ] MiniMax normalized 输出含 `intervalWindowStartMs`
    - [ ] Kimi normalized 输出含 `intervalWindowStartMs`(推断版)
  - 降级:
    - [ ] `windowStartMs` 缺失 → 不崩
    - [ ] `HUD_LEGACY_TIME=1` → 第二行消失

- **工作量**:

  | 项 | 工时 |
  |---|---|
  | provider 层补 `windowStartMs` (MiniMax + Kimi) | 0.5d |
  | render 层加第二行 + 时间 anchor | 0.5d |
  | 单测 + 视觉快照(5 场景) | 0.5d |
  | README 文档图示(双 anchor 心智模型) | 0.25d |
  | **合计** | **1.75d** |

- **风险**:

  | 风险 | 缓解 |
  |------|------|
  | statusline +1 行(信息密度提升但占用更多行) | `HUD_LEGACY_TIME=1` 关闭 |
  | provider 数据缺口(Kimi `startTime` 缺失) | Kimi 假设连续窗口,从 `resetTime - windowDuration` 推断 |
  | 两行字符宽度对齐 | 第二行用固定 `width=16`,第一行保持 `width=10`(宽度错开是设计,不是 bug) |
  | 用户建立"双 anchor 对比"心智模型需学习 | README 5 场景图示;视觉天然自解释,看一眼就懂 |

- **依赖**: T-002 已完成(commit 中)
- **关联**:
  - 与 T-001(ETA 外推)独立,可同 PR 上但独立 commit
  - 复用 T-002 的 anchor 字符 fallback 机制

---

## 🟢 P2 — 战略(大投入,需单独 sprint)

### T-005 · 统一 Provider 接口 + 协议探测

- **来源**: brainstorm 2026-06-12 E1,2026-06-12 定稿(含 diagnose 命令 + 探测静默策略)
- **目标**: 重构 Provider 接口,使数据来源(`official`/`oauth`/`derived`)显式化,支持协议探测,落地**方案 D:statusline 永远只显示有数据的内容,能力问题通过显式命令查询**
- **核心洞察**: "未支持 Provider 不显示用量行"(用户纠偏)— 这不是简单的 if/else,而是**信息架构问题**:
  - statusline 永远干净(用户的核心诉求:不累赘)
  - 探测结果通过 `/minimax-usage:diagnose` 显式查询
  - "为什么不显示"通过 `/minimax-usage:why-no-usage` 专项查询
  - 完全静默 vs 噪音,选前者

- **新接口设计**:

  ```typescript
  type UsageSource =
    | { kind: 'official' }
    | { kind: 'oauth'; provider: string }
    | { kind: 'derived'; method: string };

  interface NormalizedUsage {
    // 现有字段(不变)
    intervalRemainingPercent: number | null;
    intervalResetMs: number | null;
    intervalWindowStartMs: number | null;
    weeklyRemainingPercent: number | null;
    weeklyResetMs: number | null;
    weeklyWindowStartMs: number | null;
    weeklyBoostPermille: number;
    providerId: string;

    // 新增
    source: UsageSource;
    fetchedAt: number;       // epoch ms,新鲜度
    confidence: number;       // 0-1
  }

  interface ProviderCapability {
    hasOfficialQuotaApi: boolean;
    hasOAuth: boolean;
    supportsInterval: boolean;
    supportsWeekly: boolean;
  }

  interface Provider {
    id: string;
    displayName: string;     // "MiniMax" / "Kimi" / "Bailian" 等,直接用于 HUD 标签
    matches(): boolean;
    fetch(): Promise<NormalizedUsage | null>;
    capability: ProviderCapability;
    baseConfidence: number;  // official=1.0, oauth=0.9, derived=0.5
  }
  ```

- **协议探测**(`src/provider/probe.ts`):

  ```typescript
  const PROBE_PATHS = [
    { path: '/.well-known/quota',        scheme: 'custom-well-known' },
    { path: '/v1/usage',                scheme: 'openai-usage' },
    { path: '/coding/v1/usages',        scheme: 'kimi-usages' },
    { path: '/v1/token_plan/remains',   scheme: 'minimax-token-plan' },
  ];

  async function probeEndpoint(baseUrl: string): Promise<ProbeResult> {
    // 并发探测,取最先响应,3s 硬超时
    // 仅看 status code(2xx = 协议存在),不读 body
  }

  type ProbeResult =
    | { matches: true; scheme: QuotaScheme; confidence: number }
    | { matches: false };
  ```

- **HUD 显示规则**(按 source 决定后缀字符):

  | source | 后缀 | 含义 | ASCII fallback |
  |--------|------|------|----------------|
  | `official` | (无) | 全可信 | (无) |
  | `oauth` | `ⓘ` U+24D8 | 已鉴权 | `(oauth)` |
  | `derived` | `~` U+007E | 估计值,精度低 | `~` |

  Provider 标签由 `displayName` 决定:`MiniMax` / `Kimi` / `Bailian` / `MiMo` / `Volcengine` / `Zhipu`,**未支持的 Provider 该行不显示**。

- **方案 D 落地**(用户纠偏后,2026-06-12):

  | 场景 | statusline 显示 | 探测行为 |
  |------|----------------|----------|
  | MiniMax endpoint + 官方 API | `MiniMax │ 5h  ████│░░░░░░ 81%` | 匹配 REGISTRY,正常渲染 |
  | Kimi endpoint + OAuth | `Kimi │ 5h  ████│░░░░░░ 81% ⓘ` | 匹配 REGISTRY,OAuth 后缀 |
  | 未支持 endpoint + 探测命中协议 | **完全不显示** | 静默探测,记录到 log |
  | 未支持 endpoint + 探测失败 | **完全不显示**(已是旧行为) | 无 |
  | 未支持 endpoint + 探测超时 | **完全不显示** | 静默 |

  **核心原则**: statusline 永远只显示有**真实数据**的内容。探测命中但未实现 → 完全静默,**不**显示占位行、不污染 HUD。

- **`/minimax-usage:diagnose` 命令**(新增,1d 工时):

  ```
  $ /minimax-usage:diagnose

  Provider detection
  ──────────────────
  ✓ MiniMax (official) — api.minimaxi.com
  ✗ Kimi (oauth) — credentials missing at ~/.claude/plugins/minimax-usage/credentials/kimi.json
  ? OpenAI-usage scheme — detected at api.openai.com, no adapter yet
    → Track: https://github.com/PureLo/minimax-usage/issues/42

  Active: 1 provider, 1 detected-not-supported, 1 failed
  ```

  - 显式命令触发,**不影响 statusline**
  - 列出所有 provider 状态:✓ active / ✗ failed / ? detected-not-supported
  - 失败原因明确(凭证缺失、API 错误、网络超时)
  - 未支持协议附 issue 链接(可扩展:赞助入口)

- **`/minimax-usage:why-no-usage` 快速查询**(新增,0.25d):

  ```
  $ /minimax-usage:why-no-usage

  当前 ANTHROPIC_BASE_URL: api.openai.com
  探测结果: openai-usage scheme detected (confidence 0.7)
  未实现原因: 暂无 OpenAI 用量 API adapter
  建议:
    1. 等待社区贡献
    2. 提交 issue 催办
    3. 如果你用的是 OpenAI 官方 API,目前没有公开 quota 端点
  ```

  - 专项问诊:为什么当前 statusline 没显示用量行
  - 比 diagnose 更聚焦
  - 输出仍是显式命令触发

- **T-001 ETA 协同**:

  ```typescript
  function computeEta(usage, history): EtaResult {
    const adjustedConfidence = usage.confidence * history.stability;
    
    // derived 来源 + history < 30 条 → 不显示 ETA
    if (usage.source.kind === 'derived' && history.length < 30) {
      return { eta: null, display: false };
    }
    
    return {
      eta: computeLinearEta(history),
      display: true,
      adjustedConfidence,
    };
  }
  ```

- **待定决策**(已采纳默认值):

  | 项 | 默认值 | 备注 |
  |----|--------|------|
  | `baseConfidence` | official=1.0, oauth=0.9, derived=0.5 | ✅ 接受 |
  | 探测行为 | 静默(失败/超时/命中都不打 stderr) | ✅ 接受 |
  | 探测可关闭 | `DISABLE_PROBE=1` | ✅ 接受 |
  | 派生阈值 | history < 30 条不显示 ETA | ✅ 接受 |
  | REGISTRY | 保留静态 + 探测补充 | ✅ 接受 |
  | diagnose 命令名 | `/minimax-usage:diagnose` | ✅ 接受 |
  | why-no-usage | 同步提供 | ✅ 接受 |

- **验收**:

  - 单元测试(`tests/probe.test.ts`):
    - [ ] `probeEndpoint('https://api.kimi.com/coding/v1/usages')` → `matches: true, scheme: 'kimi-usages'`
    - [ ] `probeEndpoint('https://www.minimaxi.com/v1/token_plan/remains')` → `matches: true, scheme: 'minimax-token-plan'`
    - [ ] `probeEndpoint('https://api.openai.com/v1/usage')` → `matches: true, scheme: 'openai-usage'`
    - [ ] `probeEndpoint('https://example.com')` → `matches: false`(超时)
    - [ ] `probeEndpoint('not-a-url')` → `matches: false`
  - 单元测试(`tests/provider-registry.test.ts`):
    - [ ] `selectProviderAsync()` 在已知 endpoint 返回对应 provider
    - [ ] 已知 provider `enabled=false` 时跳过
    - [ ] 未知 endpoint 探测命中时**不渲染用量行**,只在 diagnose 中可见
    - [ ] `DISABLE_PROBE=1` 时不探测
  - 集成测试:
    - [ ] MiniMax endpoint → `source.kind === 'official'`, `confidence === 1.0`
    - [ ] Kimi endpoint → `source.kind === 'oauth'`, `confidence === 0.9`
  - HUD 视觉快照:
    - [ ] official 数据无后缀
    - [ ] oauth 数据带 `ⓘ`
    - [ ] derived 数据带 `~`
    - [ ] 未支持 endpoint + 探测命中 → 用量行不出现
  - diagnose 命令(端到端):
    - [ ] `/minimax-usage:diagnose` 输出 provider 状态列表
    - [ ] 失败的 provider 显示具体原因
    - [ ] 未支持协议附 issue 链接
  - why-no-usage 命令:
    - [ ] 当前 endpoint 状态正确显示
    - [ ] 未支持时给出建议

- **工作量**:

  | 项 | 工时 |
  |---|---|
  | `UsageSource` + `NormalizedUsage` 扩展 | 0.25d |
  | `ProviderCapability` + `baseConfidence` | 0.25d |
  | `probe.ts` + 探测逻辑 | 0.5d |
  | `selectProviderAsync` 重构 | 0.25d |
  | HUD 字符后缀渲染 | 0.25d |
  | `/minimax-usage:diagnose` 命令实现 | 1d |
  | `/minimax-usage:why-no-usage` 快速查询 | 0.25d |
  | 单测 + 集成测试 + 视觉快照 | 0.5d |
  | 文档 + 示例 | 0.25d |
  | **合计** | **3.5d** |

- **风险**:

  | 风险 | 缓解 |
  |------|------|
  | 探测超时拖累 statusline 启动 | 3s 硬超时 + 并发探测,取最先响应 |
  | 探测命中但不实现 → 用户困惑 | diagnose 命令 + issue 链接,主动查询 |
  | `ⓘ` 字符在某些字体不渲染 | ASCII fallback `(oauth)` |
  | `source` 字段破坏现有调用方 | render.ts 集中修改;其他模块不动 |
  | 探测被 CDN/WAF 拦截返回 200 | 只看 status code,容忍误报 |

- **依赖与关联**:
  - **前置**: T-001 ETA 外推(`source` 类型在本任务定义)
  - **后置**: ~~T-007 接入向导(已否决)~~;改为 diagnose 在探测命中未支持协议时输出**外部指引链接**(用户用 CC 原生 `/login` 或第三方 CLI 获取凭证)
  - **独立发布**: 可独立 PR,无强阻塞依赖
  - **复用**: T-002 / T-004 的渲染层 + 字符 fallback 机制

- **架构原则**(本次定稿):
  - **statusline 只显示有真实数据的内容**(方案 D 核心)
  - **能力问题通过显式命令查询**(diagnose / why-no-usage)
  - **静默探测 + 静默失败**(避免噪音,用户主动查询)
  - **Provider 标签由 `displayName` 决定**(MiniMax / Kimi / 等)
  - **未支持 Provider 完全不显示**(不是占位、不是降级、不是 hint)

### T-006 · OAuth device-code 流模板

- **来源**: brainstorm 2026-06-12 E3
- **目标**: 把 Kimi 的 OAuth 抽成 `OAuthDeviceCodeProvider` 通用接口
- **影响**: 未来 4 家 stub → 实现的边际成本降到 ~10 行/provider

### ~~T-007 · Provider 接入向导(guided setup CLI)~~ ❌ 否决

- **来源**: brainstorm 2026-06-12 P1
- **否决时间**: 2026-06-12
- **否决理由**: **该工具不做登录、凭证管理**——超出 minimax-usage 的职责范围。凭证获取、存储、刷新是用户/上游工具的责任,本工具只**消费**已配置好的凭证
- **影响范围**:
  - T-006(OAuth 模板)保留通用能力(读凭证、refresh),但**不暴露任何 setup 入口**——`requestDeviceCode` / `pollForToken` 仍可被未来的外部 CLI 调用,但不内置
  - T-005(`/minimax-usage:diagnose` + `/minimax-usage:why-no-usage`)仍保留——只读,不写凭证
  - 用户凭证缺失时,`/diagnose` 输出**指引**(在外部工具中如何获取),但本工具不直接接管

- **用户替代路径**(外部工具):
  - **Claude Code 的 `/login` 流程**:用户用 CC 原生命令登录,凭证存 CC 配置
  - **第三方 OAuth 工具**:如 `kimi-cli` / `zhipu-cli` 等
  - **手动**:用户按 provider 文档获取 access_token,自己写到 `credentials/<id>.json`(0o600),插件读取

- **未来重新评估条件**: 如果用户/社区强烈反馈"凭证管理缺位是 onboarding 最大障碍",可重新打开本任务——但产品定位会从"用量 HUD 工具"演化为"用量 + 凭证管理一体化",需重新讨论职责边界

### T-008 · 可配置 HUD schema(mini-DSL)

- **来源**: brainstorm 2026-06-12 E8
- **目标**: 引入 `hud.config.json`,用户可自己组合模块
- **风险**: 维护成本高,需评估用户真实需求

---

## ✅ Done

### T-000 · 缓存与 dist 错配 bug 修复

- **完成**: 2026-06-12
- **动作**: 复制缺失的 `provider/`、`time.js`、`time.d.ts` 到 `~/.claude/plugins/cache/minimax-plugins/minimax-usage/0.0.8/dist/`
- **根因**: `package.json` bump 到 `0.1.0` 但 `.claude-plugin/plugin.json` 仍是 `0.0.8`,CC 解析器选中部分同步的 0.0.8 缓存

### T-009 · 版本一致性(plugin.json vs package.json)

- **来源**: T-000 衍生
- **目标**: 让 `.claude-plugin/plugin.json` 版本始终与 `package.json` 同步
- **验收**: 任意 release 时两者一致
- **动作**: 写 pre-release 校验脚本,或 README/release 流程加 checklist

---

## 修订记录

| 日期 | 动作 | 内容 |
|------|------|------|
| 2026-06-12 | 初始化 | T-000/T-009 完成入 Done,T-001 从 brainstorm 转 P0 |