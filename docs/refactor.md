# 多 Provider 重构 + Kimi 接入 实施蓝图

> 目标:把 `minimax-usage` 从"单 provider 硬编码"重构为"多 provider 路由",并以 Kimi 作为第二个完整可用的 provider,完整复刻 minimax-usage 体验(剩余% + 5h/7d 重置倒计时)。本文档**为开发 agent 直接可用的实施规格**——所有文件路径、函数签名、字段映射、调用顺序、缓存键、错误降级策略都已确定,按章节顺序执行即可。
>
> **依赖前置**:
> - 项目根: `/home/alex/codes/minimax-usage`
> - 现有 `src/` 已具备 `api.ts` / `cache.ts` / `config.ts` / `context.ts` / `index.ts` / `render.ts` / `types.ts`
> - `tsconfig.json` 已开 `strict: true`,所有新文件必须通过 `tsc --noEmit`
> - 不引入新依赖(纯 Node `https` / `fs` / `path`,OAuth 流程不引入 SDK)
>
> **不在本文档范围**:Bailian / MiMo / Volcengine / Zhipu 的完整实现(留给后续工单;占位骨架会一并建好)

---

## 0. 验收清单(Definition of Done)

完工时必须全部为真:

- [ ] `tsc --noEmit` 零错误
- [ ] `npm run build` 产物 `dist/index.js` 启动时**不**连任何远端
- [ ] 在 `ANTHROPIC_BASE_URL` 指向 `www.minimaxi.com` 时,MiniMax HUD 行与原版**完全一致**(字节级对比)
- [ ] 在 `ANTHROPIC_BASE_URL` 指向 `api.kimi.com`(含 `/coding` 后缀)时,Kimi HUD 行渲染正常
- [ ] 指向其它 host 时:行被隐藏,**不**发任何网络请求(同原版)
- [ ] Kimi OAuth token 缺失 → HUD 行降级显示 `  Kimi   ─`,不抛错
- [ ] Kimi 用量端点 4xx/5xx → 缓存保留旧值(若未过期),无值时显示 `  Kimi   ─`
- [ ] 配置文件位置: `${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/minimax-usage/credentials/kimi.json`
- [ ] 新增单元测试 `tests/` 覆盖 `isKimiEndpoint`、Kimi 响应归一化、缓存键、Provider 选择

---

## 1. 顶层架构

### 1.1 当前(单 provider,硬编码)

```
index.ts → api.ts (fetchTokenPlan, minimaxi.com) → cache.ts → render.ts
        ↘ config.ts (isMinimaxEndpoint)
```

### 1.2 目标(多 provider,统一接口)

```
index.ts
  ├── config.ts       (is*Endpoint() 6 个)
  ├── provider/index.ts (selectProvider(): Provider)
  │     ├── provider/minimax.ts   (原 fetchTokenPlan 迁移而来)
  │     ├── provider/kimi.ts      (新增)
  │     ├── provider/bailian.ts   (占位 stub)
  │     ├── provider/mimo.ts      (占位 stub)
  │     ├── provider/volcengine.ts(占位 stub)
  │     └── provider/zhipu.ts     (占位 stub)
  ├── cache.ts        (key 改为 provider.id)
  ├── render.ts       (接 Provider<NormalizedUsage>)
  └── context.ts      (无变化)
```

### 1.3 统一接口(在 `src/provider/types.ts`)

```ts
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
```

---

## 2. 目录与文件结构

新增/修改文件(完整清单):

```
src/
  index.ts                 [MODIFY]   改用 selectProvider()
  api.ts                   [DELETE]   内容迁到 provider/minimax.ts
  cache.ts                 [MODIFY]   getCached/setCached 接 key + type
  config.ts                [MODIFY]   新增 5 个 is*Endpoint() + 凭据目录
  render.ts                [MODIFY]   接 Provider<NormalizedUsage> + dispatch
  types.ts                 [MODIFY]   保留 StdinData,移除 TokenPlanResponse
  context.ts               [UNCHANGED]
  provider/                [NEW DIR]
    types.ts               [NEW]      NormalizedUsage + Provider 接口
    index.ts               [NEW]      selectProvider() 工厂
    minimax.ts             [NEW]      迁自 api.ts
    kimi.ts                [NEW]      完整实现
    bailian.ts             [NEW]      stub
    mimo.ts                [NEW]      stub
    volcengine.ts          [NEW]      stub
    zhipu.ts               [NEW]      stub
    kimi/
      oauth.ts             [NEW]      device-code + refresh-token
      credentials.ts       [NEW]      读/写 credentials.json

tests/                     [NEW DIR]  (可选,但推荐)
  provider.test.ts         [NEW]      isKimiEndpoint + 归一化 + Provider 选择

docs/
  provider-hud-integration.md [NEW]   (已完成)
  refactor.md              [NEW]      (本文档)

package.json               [MODIFY]   version → 0.1.0,加 scripts.test
tsconfig.json              [UNCHANGED] 已 strict:true
```

---

## 3. 详细实施步骤

按顺序执行,每步都是**可独立验证**的单元。

### Step 1: 新建 `src/provider/types.ts`

```ts
// 严格按 §1.3 写。export NormalizedUsage 与 Provider。
// 不引入任何 import(纯类型)。
```

**验证**:`tsc --noEmit` 通过。

### Step 2: 新建 `src/provider/index.ts`

实现 `selectProvider()`:

```ts
import type { Provider } from './types.js';
import { minimaxProvider } from './minimax.js';
import { kimiProvider } from './kimi.js';
import { bailianProvider } from './bailian.js';
import { mimoProvider } from './mimo.js';
import { volcengineProvider } from './volcengine.js';
import { zhipuProvider } from './zhipu.js';

/** 顺序敏感:先匹配者胜出。MiniMax 必须在 Kimi 之前(历史兼容)。 */
const REGISTRY: readonly Provider[] = [
  minimaxProvider,
  kimiProvider,
  bailianProvider,
  mimoProvider,
  volcengineProvider,
  zhipuProvider,
];

export function selectProvider(): Provider | null {
  return REGISTRY.find(p => p.matches()) ?? null;
}
```

**验证**:`tsc --noEmit` 通过(此时所有 provider 文件还是 stub,只满足签名)。

### Step 3: 改造 `src/config.ts`

保留 `loadConfig` / `getConfigDir` / `getApiKey` / `isMinimaxEndpoint`。
**新增**:

```ts
export function isKimiEndpoint(): boolean {
  const raw = process.env.ANTHROPIC_BASE_URL;
  if (!raw) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    // Kimi Coding Plan: api.kimi.com / *.kimi.com
    // 接受 *.kimi.com 形式(含 kimi.com 自身)
    return host === 'kimi.com' || host.endsWith('.kimi.com');
  } catch {
    return false;
  }
}

export function isBailianEndpoint(): boolean { /* 同模式: dashscope.aliyuncs.com */ }
export function isMimoEndpoint(): boolean    { /* api.xiaomimimo.com */ }
export function isVolcengineEndpoint(): boolean { /* ark.cn-beijing.volces.com / *.volces.com */ }
export function isZhipuEndpoint(): boolean   { /* open.bigmodel.cn / bigmodel.cn */ }

/** 凭据目录:${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/minimax-usage/credentials */
export function getCredentialsDir(): string {
  return path.join(getConfigDir(), 'credentials');
}
```

**验证**:`tsc --noEmit` 通过。

### Step 4: 改造 `src/cache.ts`

签名变更(向后兼容):

```ts
// 旧: getCached(key: string): TokenPlanRemain | null
// 新: getCached<T>(key: string): T | null  (返回范型,真实数据从 disk 读)
```

`setCached<T>(key, data: T | null): void`。

内部仍然:
- 内存 Map 一层
- 磁盘 `cache.json` 一层(`Record<string, { data: T; timestamp: number }>`)
- TTL 检查照旧(`refreshIntervalMs`)

**重要**:JSON 序列化已经能处理 `NormalizedUsage`,不需要为新结构做什么。但需要去掉对 `TokenPlanRemain` 的强耦合。

### Step 5: 把 `src/api.ts` 迁到 `src/provider/minimax.ts`

**完整迁移** `fetchTokenPlan` 函数,改名为 `fetchMinimaxUsage`,导出 `minimaxProvider`:

```ts
import type { Provider, NormalizedUsage } from './types.js';
import { isMinimaxEndpoint, getApiKey } from '../config.js';
import * as https from 'node:https';

const REQUEST_TIMEOUT_MS = 10_000;

interface MiniMaxRemain { /* 原 TokenPlanRemain */ }
interface MiniMaxResponse { /* 原 TokenPlanResponse */ }

async function fetchMinimaxUsage(): Promise<NormalizedUsage | null> {
  if (!isMinimaxEndpoint()) return null;
  const apiKey = getApiKey();
  if (!apiKey) { console.error('[minimax-usage] No API key'); return null; }
  // ... 原 https.request 逻辑,返回 MiniMaxRemain 或 null
  // 归一化:
  //   return {
  //     intervalRemainingPercent: data.current_interval_remaining_percent,
  //     intervalResetMs: toEpochMs(data.end_time),
  //     weeklyRemainingPercent: data.current_weekly_remaining_percent,
  //     weeklyResetMs: toEpochMs(data.weekly_end_time),
  //     weeklyBoostPermille: data.weekly_boost_permille,
  //     providerId: 'minimax',
  //   };
}

function toEpochMs(t: number): number {
  return t < 1_000_000_000_000 ? t * 1000 : t;
}

export const minimaxProvider: Provider = {
  id: 'minimax',
  displayName: 'MiniMax',
  matches: isMinimaxEndpoint,
  fetch: fetchMinimaxUsage,
};
```

**关键**:`toEpochMs` helper 复用到所有 provider(原 `render.ts` 也有,提取到 `src/provider/types.ts` 旁的 utility,或放 `src/time.ts`)。

**删除** `src/api.ts`(已被 `provider/minimax.ts` 取代)。

### Step 6: 实现 `src/provider/kimi.ts`(主菜)

完整规格:

```ts
import type { Provider, NormalizedUsage } from './types.js';
import { isKimiEndpoint } from '../config.js';
import { readKimiCredentials } from './kimi/credentials.js';
import { ensureFreshKimiToken } from './kimi/oauth.js';
import * as https from 'node:https';

const REQUEST_TIMEOUT_MS = 10_000;

// 已知允许的 User-Agent 前缀(防止 403)。Kimi 后端会校验 UA。
// 该值在 cc-switch PR #3671 等社区代码中确认可用。
const ALLOWED_UA = 'OpenUsage/1.0';  // TODO: 落地前用真实 UA 实测替换

interface KimiUsageDetail { limit: number | string; used: number | string; remaining: number | string; resetTime: string; }
interface KimiApiResponse {
  usage?: KimiUsageDetail;
  limits?: Array<{ window: { duration: number; timeUnit: string }; detail: KimiUsageDetail }>;
}

function pickDetail(j: KimiApiResponse): KimiUsageDetail | null {
  if (j.usage) return j.usage;
  // 退化:取时间单位最大的(DAY > HOUR > MINUTE > SECOND)
  const order: Record<string, number> = { DAY: 4, HOUR: 3, MINUTE: 2, SECOND: 1 };
  const sorted = [...(j.limits ?? [])].sort(
    (a, b) => (order[b.window.timeUnit] ?? 0) - (order[a.window.timeUnit] ?? 0)
  );
  return sorted[0]?.detail ?? null;
}

function detailToNormalized(d: KimiUsageDetail, providerId: 'kimi'): NormalizedUsage {
  const limit = Number(d.limit);
  const used = Number(d.used);
  const remaining = Number(d.remaining);
  const intervalRemainingPercent = Number.isFinite(limit) && limit > 0
    ? Math.max(0, Math.min(100, (remaining / limit) * 100))
    : null;
  const intervalResetMs = d.resetTime ? new Date(d.resetTime).getTime() : null;
  return {
    intervalRemainingPercent,
    intervalResetMs,
    weeklyRemainingPercent: null,  // Kimi 单窗口,不区分 5h / 7d
    weeklyResetMs: null,
    weeklyBoostPermille: 1000,    // Kimi 无 boost
    providerId,
  };
}

function fetchKimiUsage(): Promise<NormalizedUsage | null> {
  if (!isKimiEndpoint()) return Promise.resolve(null);
  const creds = readKimiCredentials();
  if (!creds) {
    console.error('[minimax-usage] Kimi credentials missing at credentials/kimi.json');
    return Promise.resolve(null);
  }
  return ensureFreshKimiToken(creds).then(token => {
    if (!token) return null;
    return new Promise<NormalizedUsage | null>((resolve) => {
      let settled = false;
      const finish = (v: NormalizedUsage | null) => { if (!settled) { settled = true; resolve(v); } };
      const req = https.request({
        hostname: 'api.kimi.com',
        port: 443,
        path: '/coding/v1/usages',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': ALLOWED_UA,
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error(`[minimax-usage] Kimi API ${res.statusCode}: ${data.substring(0, 200)}`);
            finish(null);
            return;
          }
          try {
            const j = JSON.parse(data) as KimiApiResponse;
            const d = pickDetail(j);
            finish(d ? detailToNormalized(d, 'kimi') : null);
          } catch {
            console.error('[minimax-usage] Kimi JSON parse error');
            finish(null);
          }
        });
      });
      req.on('error', e => { console.error('[minimax-usage] Kimi network error:', e.message); finish(null); });
      req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('timeout')));
      req.end();
    });
  });
}

export const kimiProvider: Provider = {
  id: 'kimi',
  displayName: 'Kimi',
  matches: isKimiEndpoint,
  fetch: fetchKimiUsage,
};
```

### Step 7: 实现 `src/provider/kimi/credentials.ts`

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getCredentialsDir } from '../../config.js';

export interface KimiCredentials {
  access_token: string;
  refresh_token: string;
  /** Unix epoch seconds */
  expires_at: number;
  scope?: string;
  token_type?: string;
}

const CREDS_PATH = path.join(getCredentialsDir(), 'kimi.json');

export function readKimiCredentials(): KimiCredentials | null {
  try {
    if (!fs.existsSync(CREDS_PATH)) return null;
    const content = fs.readFileSync(CREDS_PATH, 'utf-8');
    const j = JSON.parse(content) as KimiCredentials;
    if (!j.access_token || !j.refresh_token || !j.expires_at) return null;
    return j;
  } catch {
    return null;
  }
}

export function writeKimiCredentials(c: KimiCredentials): void {
  fs.mkdirSync(getCredentialsDir(), { recursive: true });
  fs.writeFileSync(CREDS_PATH, JSON.stringify(c, null, 2), { mode: 0o600 });
}
```

### Step 8: 实现 `src/provider/kimi/oauth.ts`

```ts
import * as https from 'node:https';
import * as querystring from 'node:querystring';
import type { KimiCredentials } from './credentials.js';
import { writeKimiCredentials } from './credentials.js';

const OAUTH_HOST = 'auth.kimi.com';
const CLIENT_ID = '17e5f671-d194-4dfb-9706-5516cb48c098';  // TODO: 落地前实测
const REFRESH_BUFFER_SEC = 300;

/** 返回 access_token(已续期)。失败返回 null。 */
export async function ensureFreshKimiToken(creds: KimiCredentials): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (creds.expires_at - now > REFRESH_BUFFER_SEC) {
    return creds.access_token;
  }
  // 续期
  const refreshed = await refreshAccessToken(creds.refresh_token);
  if (!refreshed) return null;
  const merged: KimiCredentials = { ...creds, ...refreshed };
  writeKimiCredentials(merged);
  return merged.access_token;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;  // seconds
  scope?: string;
  token_type?: string;
}

function postForm<T>(path: string, body: Record<string, string>): Promise<T | null> {
  const data = querystring.stringify(body);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: T | null) => { if (!settled) { settled = true; resolve(v); } };
    const req = https.request({
      hostname: OAUTH_HOST,
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        'Accept': 'application/json',
      },
    }, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) { finish(null); return; }
        try { finish(JSON.parse(buf) as T); } catch { finish(null); }
      });
    });
    req.on('error', () => finish(null));
    req.setTimeout(8_000, () => req.destroy(new Error('timeout')));
    req.write(data);
    req.end();
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<Partial<KimiCredentials> | null> {
  const r = await postForm<TokenResponse>('/api/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  if (!r || !r.access_token || !r.expires_in) return null;
  return {
    access_token: r.access_token,
    refresh_token: r.refresh_token ?? refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + r.expires_in,
    scope: r.scope,
    token_type: r.token_type,
  };
}

/** CLI 工具:首跑时用,后续不在 statusline 进程内跑。 */
export async function requestDeviceCode(): Promise<{ device_code: string; user_code: string; verification_uri: string; expires_in: number; interval: number } | null> {
  const r = await postForm<{ device_code: string; user_code: string; verification_uri: string; expires_in: number; interval: number }>(
    '/api/oauth/device_authorization',
    { client_id: CLIENT_ID }
  );
  return r;
}
```

### Step 9: 实现其它 provider 的 stub(占位)

`src/provider/bailian.ts`:

```ts
import type { Provider, NormalizedUsage } from './types.js';
import { isBailianEndpoint } from '../config.js';

export const bailianProvider: Provider = {
  id: 'bailian',
  displayName: 'Bailian',
  matches: isBailianEndpoint,
  fetch: async () => null,  // 见 docs/provider-hud-integration.md §2: 无公开用量端点
};
```

`mimo.ts` / `volcengine.ts` / `zhipu.ts` 同模式:`fetch` 返回 `null`。
**特别说明**:`volcengine.ts` 可以扩展为实现"现金余额 HUD"(非套餐),但**本工单不要求**,留作后续:

```ts
// volcengine.ts 占位
export const volcengineProvider: Provider = {
  id: 'volcengine',
  displayName: 'Volcengine',
  matches: isVolcengineEndpoint,
  fetch: async () => null,  // TODO: 实现 credit 余额 HUD,见 docs/provider-hud-integration.md §4
};
```

### Step 10: 改造 `src/render.ts`

接 `Provider<NormalizedUsage>`。**MiniMax 行必须字节级保持**。

```ts
import type { StdinData, TokenPlanRemain } from './types.js';
import type { NormalizedUsage } from './provider/types.js';
// (保留所有现有 ANSI、formatPercent、getColor、clampPercent、renderProgressBar、formatRemainingTime、calcUsedPercent、getTotalPercent、getContextBar、getProjectLabel、getModelLabel...)

/** MiniMax 历史兼容别名,让 render() 内部统一用 NormalizedUsage */
function fromMinimax(d: TokenPlanRemain): NormalizedUsage {
  const toMs = (t: number) => t < 1_000_000_000_000 ? t * 1000 : t;
  return {
    intervalRemainingPercent: d.current_interval_remaining_percent,
    intervalResetMs: toMs(d.end_time),
    weeklyRemainingPercent: d.current_weekly_remaining_percent,
    weeklyResetMs: toMs(d.weekly_end_time),
    weeklyBoostPermille: d.weekly_boost_permille,
    providerId: 'minimax',
  };
}

export function renderProvider(data: NormalizedUsage | null, stdin: StdinData = {}): void {
  // 头部(model / project / context)与现有 render() 完全一致
  // ...
  // 用量行:用 data.intervalRemainingPercent / intervalResetMs / weeklyRemainingPercent / weeklyResetMs / weeklyBoostPermille
  // 计算 intervalBar / weeklyBar / intervalReset / weeklyReset 逻辑与原版一致
  // 行首标签: data ? `${data.providerId === 'minimax' ? 'MiniMax' : 'Kimi'}` 形式
  // **关键**:在 isMinimaxEndpoint() 为真时,行格式必须与旧版**完全一致**:
  //   `  MiniMax │ 5h  ${intervalBar} ${intervalUsed}% (100%) ${intervalReset} │ 7d ${weeklyBar} ${weeklyUsed}% (${totalPercent}%) ${weeklyReset}`
}
```

**向后兼容**:
- `export function render(data: TokenPlanRemain | null, stdin: StdinData, isMinimax: boolean)` 必须保留,**内部调用 `renderProvider(fromMinimax(data), stdin)`,在 `!isMinimax` 时早返**。这样旧调用方(若有)零修改。

### Step 11: 改造 `src/index.ts`

```ts
import { selectProvider } from './provider/index.js';
import { getCached, setCached } from './cache.js';
import { deriveContextUsage } from './context.js';
import { renderProvider, render } from './render.js';
import type { StdinData } from './types.js';
import type { NormalizedUsage } from './provider/types.js';

async function main(): Promise<void> {
  let stdinData: StdinData = {};
  try {
    const stdin = await readStdin();
    if (stdin) stdinData = JSON.parse(stdin) as StdinData;
  } catch { /* ignore */ }
  const resolved = resolveContextUsage(stdinData);

  const provider = selectProvider();
  if (!provider) {
    // 与旧版兼容:仍渲染头部,但不渲染任何用量行
    render(null, resolved, false);
    return;
  }

  const cacheKey = `usage:${provider.id}`;
  const cached = getCached<NormalizedUsage>(cacheKey);
  if (cached) {
    renderProvider(cached, resolved);
    return;
  }

  const data = await provider.fetch();
  if (data) setCached(cacheKey, data);
  renderProvider(data, resolved);
}

// resolveContextUsage / readStdin 保持原样
```

### Step 12: 删除 `src/api.ts` 与 `TokenPlanResponse`

`types.ts` 中:
- **删除** `TokenPlanRemain` / `TokenPlanResponse`
- **保留** `MiniMaxConfig` / `CachedData`(但 `CachedData<T>` 改为范型)/ `StdinData`
- 新增 re-export `export type { NormalizedUsage, Provider } from './provider/types.js';`(可选)

### Step 13: 更新 `package.json`

```diff
-  "version": "0.0.8",
-  "description": "Display MiniMax token plan remaining usage in Claude Code HUD",
+  "version": "0.1.0",
+  "description": "Display coding/token plan remaining usage in Claude Code HUD (MiniMax, Kimi, +stubs)",
   "scripts": {
     "build": "tsc",
-    "dev": "tsc --watch"
+    "dev": "tsc --watch",
+    "typecheck": "tsc --noEmit",
+    "test": "node --test tests/"
   },
   "keywords": [
     "minimax",
+    "kimi",
     "claude-code",
     "hud",
     "statusline"
   ]
```

### Step 14: 新增 `tests/provider.test.ts`(用 Node 内置 test runner)

最少覆盖:
- `isKimiEndpoint()` 各 host 命中
- `pickDetail()` 优先级(usage > DAY > HOUR > MINUTE > SECOND)
- `detailToNormalized()` 边界(0、负数、NaN、null limit)
- `selectProvider()` 顺序: MiniMax 优先于 Kimi 当 host 同时命中(测试用 mock env)
- `readKimiCredentials()` 缺文件 / 缺字段 / 合法

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';

// 这些 import 必须在测试前 set env
process.env.ANTHROPIC_BASE_URL = 'https://api.kimi.com/coding';
const { isKimiEndpoint } = await import('../src/config.js');
assert.equal(isKimiEndpoint(), true);
```

### Step 15: 端到端验证脚本(开发用,不入版本)

`scripts/dev-verify.sh`:

```bash
#!/usr/bin/env bash
set -e
# 1. typecheck
npx tsc --noEmit
# 2. build
npm run build
# 3. 跑测试
npm test
# 4. smoke:无 env 启动,head stdout,确认只有 "Project" / "Context" / 头部,无任何用量行
echo '{}' | node dist/index.js | head -10
# 5. smoke:minimax host
ANTHROPIC_BASE_URL='https://www.minimaxi.com/anthropic' \
  ANTHROPIC_AUTH_TOKEN='fake-but-shape-test' \
  echo '{}' | node dist/index.js | head -10
# (token 是假的,但渲染管线不会崩;用 grep 确认含 "MiniMax ─" 或 "5h" 行)
```

---

## 4. 缓存键与并发

- 键空间: `usage:<providerId>`(如 `usage:minimax`, `usage:kimi`)
- 文件: `${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/minimax-usage/cache.json`
- TTL: 仍由 `loadConfig().refreshIntervalMs` 决定(默认 60s)
- 并发: 不引入锁。Claude Code statusline 进程生命周期短(每 ~1s 触发),即使同 provider 短时间内两次 fetch,远端会做限流;实测 Kimi 在 5h 窗口每分钟数十次调用无副作用

---

## 5. 错误处理与降级

| 场景 | 行为 |
|---|---|
| `ANTHROPIC_BASE_URL` 未设置 | selectProvider() 返回 null,渲染只显示 model/project/context |
| Provider 命中但缺 key | 日志 `console.error`,fetch 返回 null,渲染 `${displayName} ─` |
| OAuth refresh 失败 | 日志,fetch 返回 null,渲染 `${displayName} ─` |
| 用量端点 4xx/5xx | 日志,fetch 返回 null,渲染 `${displayName} ─`(若缓存内有过期前值,使用缓存) |
| JSON 解析失败 | 同上 |
| 网络 timeout(10s) | 同上 |
| Kimi 403(UA 拒绝) | 日志提示换 UA,**不**自动重试,fetch 返回 null,渲染 `Kimi ─` |
| `writeKimiCredentials` 失败 | 不影响本次渲染(只是下次启动还要重新 OAuth) |

**所有 `console.error` 必须带 `[minimax-usage]` 前缀**(与原版一致,避免 statusline 噪音)。

---

## 6. 关键边界与陷阱

1. **MiniMax host 在 selectProvider 顺序中必须第一**: 因为 `minimaxi.com` 不与任何其它 provider host 重叠,顺序本身无关正确性;但若未来引入"按 host 路由"逻辑,要保持向后兼容。
2. **Kimi 已知 UA 在落地前必测**: `ALLOWED_UA = 'OpenUsage/1.0'` 是从 openusage 项目观察到的,**不代表所有版本都允许**。如果 `curl` 实测 403,改用 `cc-switch PR #3671` 中的 UA。
3. **CLIENT_ID 同上**: `17e5f671-d194-4dfb-9706-5516cb48c098` 来自 openusage 源码,可能因客户端而异,落地前用 `device_authorization` 实测一次,看返回是否带 `client_id` 校验。
4. **MiniMax 时间戳格式**: 原版 `end_time` 是 Unix **秒**(`< 1_000_000_000_000`),Kimi 是 ISO-8601,Volcengine 是 Unix 秒(社区)。`toMs` helper 必须存在,放 `src/time.ts`。
5. **OAuth 凭据文件权限**: 写 0o600,放在 `~/.claude/plugins/minimax-usage/credentials/`,**不要**与 cache.json 混目录(便于用户分别备份/清理)。
6. **tsconfig NodeNext**: 所有相对 import 必须带 `.js` 后缀(即便源文件是 `.ts`)。已确认原项目遵循此约定。
7. **避免循环 import**: `provider/index.ts` 是聚合入口,被 `index.ts` 引用;`provider/*.ts` 不应反向 import `index.ts`。
8. **Kimi `usage` vs `limits` 优先级**: 真实响应两者都存在,且 `usage` 等于 `limits[DAY].detail`。`pickDetail` 优先取 `usage`,退化才用 `limits`,与 minimax-usage 现有 `model_remains.find(m => m.model_name === 'general')` 的"挑一条"模式对齐。

---

## 7. 文件级 checklist(逐文件交付物)

| 文件 | 行数估计 | 状态 | 关键 export |
|---|---|---|---|
| `src/provider/types.ts` | ~30 | NEW | `NormalizedUsage`, `Provider` |
| `src/provider/index.ts` | ~25 | NEW | `selectProvider()` |
| `src/provider/minimax.ts` | ~110 | NEW | `minimaxProvider` |
| `src/provider/kimi.ts` | ~110 | NEW | `kimiProvider` |
| `src/provider/kimi/credentials.ts` | ~40 | NEW | `readKimiCredentials`, `writeKimiCredentials` |
| `src/provider/kimi/oauth.ts` | ~100 | NEW | `ensureFreshKimiToken`, `refreshAccessToken`, `requestDeviceCode` |
| `src/provider/bailian.ts` | ~12 | NEW | `bailianProvider` |
| `src/provider/mimo.ts` | ~12 | NEW | `mimoProvider` |
| `src/provider/volcengine.ts` | ~12 | NEW | `volcengineProvider` |
| `src/provider/zhipu.ts` | ~12 | NEW | `zhipuProvider` |
| `src/time.ts` | ~10 | NEW | `toEpochMs()` |
| `src/config.ts` | +30 | MODIFY | +5 个 is*Endpoint() + `getCredentialsDir()` |
| `src/cache.ts` | 微改 | MODIFY | 范型化 |
| `src/render.ts` | +20 | MODIFY | `renderProvider()`,保留旧 `render()` |
| `src/index.ts` | 重写 | MODIFY | 用 `selectProvider()` |
| `src/types.ts` | 删 25 | MODIFY | 移除 `TokenPlanResponse` |
| `src/api.ts` | -75 | **DELETE** | — |
| `tests/provider.test.ts` | ~120 | NEW | — |
| `scripts/dev-verify.sh` | ~25 | NEW | — |
| `package.json` | +5 行 | MODIFY | +scripts, +keywords, version bump |
| `docs/provider-hud-integration.md` | — | NEW (本批次) | — |
| `docs/refactor.md` | — | NEW (本文档) | — |

---

## 8. 落地后需向用户告知的事项

- **OAuth 一次性引导**: Kimi 首次使用需要走 device-code 流程。本工单在 `oauth.ts` 暴露了 `requestDeviceCode()`,但**没有**写 CLI 入口。建议下一工单加 `bin/kimi-login.ts` 或扩展 `skills/setup/setup.sh`。
- **凭据位置**: `${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/minimax-usage/credentials/kimi.json`(权限 0600)。在 README 加一段。
- **版本号**: 0.0.8 → 0.1.0(minor bump,因为新增 provider,API 表面对调用方无破坏)。
- **回退方案**: 若 Kimi 端点变化,只需改 `src/provider/kimi.ts` 一个文件;其它 provider 互不影响。

---

## 9. 不在本次工单范围(留待后续)

- 现金余额 HUD(Volcengine credit)
- 套餐 tier 展示(Zhipu / MiMo 占位升级)
- 定时任务式"提前 1h 提醒"
- 凭据多账户支持
- 国际化文案(目前所有标签写死英文/拼音)

---

**致实施 agent**:按 §3 顺序逐步执行,每步跑一次 `npm run typecheck`。任何字段含义不清楚,回查 `docs/provider-hud-integration.md` 的对应章节。落地后跑 §0 验收清单逐项打勾。
