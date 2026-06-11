# 国内 Coding / Token Plan 用量 HUD 接入方案

> 本文件汇总国内 5 家支持 Claude Code / Coding/Token Plan 的厂商在"用量查询端点 + Anthropic 兼容 base"两件事上的最新公开信息。**目的:为后续 agent 重跑验证提供权威入口和可重放的探测脚本,任何字段变化都应回填本文件后再开始实现。**
>
> 标记说明:
> - ✅ 已实测 / 多源交叉确认(高置信)
> - 🟡 公开文档存在但本会话未活体探测(中置信)
> - ❌ 无公开端点(需抓控制台 XHR / 申请内部 beta)
> - ⚠️ 字段命名在社区代码与官方文档之间漂移,落地前需自验
>
> 入口判定约定:`ANTHROPIC_BASE_URL` 的 hostname 决定激活哪个 provider。实现侧参考 `src/config.ts` 的 `isMinimaxEndpoint()` 模式,新增 `isKimiEndpoint()` / `isBailianEndpoint()` / `isMimoEndpoint()` / `isVolcengineEndpoint()` / `isZhipuEndpoint()`。

---

## 0. 当前已支持的基线:MiniMax

| 字段 | 值 |
|---|---|
| 用量端点 | `GET https://www.minimaxi.com/v1/token_plan/remains` |
| 认证 | `Authorization: Bearer <MINIMAXI_API_KEY>`(沿用 `ANTHROPIC_AUTH_TOKEN`) |
| 响应 | `{ base_resp, model_remains: [{ current_interval_remaining_percent, current_weekly_remaining_percent, weekly_boost_permille, end_time, weekly_end_time, ... }] }` |
| Anthropic 兼容 base | `https://www.minimaxi.com/anthropic`(由 host 探测) |
| 状态 | ✅ 已实现于 `src/api.ts` |
| 文档 | 仓库内 `PLAN.md` + `README.md` |

---

## 1. Kimi (Moonshot Coding Plan) ⭐ 唯一可完整复刻 minimax-usage 体验的厂商

### 1.1 入口判定

- `ANTHROPIC_BASE_URL` 命中: `api.kimi.com` / `*.kimi.com` / 第三方代理后端若回 `kimi` 标识
- 严格区分两条产品线(绝不能混用):
  - **Kimi Coding Plan**(`api.kimi.com/coding`):本文唯一相关产品,**有公开用量端点**,需 OAuth
  - **Moonshot Open Platform**(`api.moonshot.cn`):纯按量付费 sk- key,**无公开用量端点**(仅控制台),跳过 HUD

### 1.2 用量端点

- **方法 / URL**:`GET https://api.kimi.com/coding/v1/usages`
- **认证**:`Authorization: Bearer <oauth_access_token>`,`Accept: application/json`,**不发送 Moonshot Open Platform 的 sk- key**
- **User-Agent**:`kimi-for-coding` 后端存在 UA 白名单;若 statusline 进程被拒,在 `fetchKimiUsage()` 内部把 UA 临时替换为一个已知的允许值(参考 lemon07r/opencode-kimi-full、cc-switch PR #3671)
- **请求体**:无
- **响应**(`JSON`):
  ```json
  {
    "usage": {
      "limit": 15000,
      "used": 1234,
      "remaining": 13766,
      "resetTime": "2026-06-15T00:00:00+08:00"
    },
    "limits": [
      {
        "window": { "duration": 5, "timeUnit": "HOUR" },
        "detail": { "limit": 200, "used": 12, "remaining": 188, "resetTime": "2026-06-11T17:00:00+08:00" }
      },
      {
        "window": { "duration": 7, "timeUnit": "DAY" },
        "detail": { "limit": 15000, "used": 1234, "remaining": 13766, "resetTime": "2026-06-15T00:00:00+08:00" }
      }
    ]
  }
  ```
- **字段映射**:
  - `usage.remaining / usage.limit` → 5h/7d 主百分比(等价 MiniMax 的 `current_interval_remaining_percent`)
  - `usage.resetTime` 或 `limits[DAY].detail.resetTime` → 倒计时基准
  - `limits[HOUR].detail` → 5h 滚动窗口(若 5h 端点为该值则用之)
  - 缺省策略:若顶层 `usage` 缺失但 `limits` 存在,选 `timeUnit === "DAY"` 的条目作为主百分比来源

### 1.3 Anthropic 兼容

- `ANTHROPIC_BASE_URL=https://api.kimi.com/coding`
- 消息路径 `/v1/messages`,模型默认 `kimi-for-coding`
- OpenAI 兼容:`/v1/chat/completions`

### 1.4 OAuth 凭据管理

- **OAuth host**:`https://auth.kimi.com`
- **device 授权**:`POST https://auth.kimi.com/api/oauth/device_authorization`
- **token 端点**:`POST https://auth.kimi.com/api/oauth/token`
  - grant_type: `urn:ietf:params:oauth:grant-type:device_code`(首次) / `refresh_token`(续期)
- **client_id**:`17e5f671-d194-4dfb-9706-5516cb48c098`(从 openusage 插件源码观察到,可能因客户端而异,需在落地时实测确认)
- **凭据落盘**:`~/.kimi/credentials/kimi-code.json`,字段:`access_token`, `refresh_token`, `expires_at`(Unix sec), `scope`, `token_type`
- **续期缓冲**:5 分钟(`refresh_buffer_sec = 300`)
- **配置覆盖路径**:`${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/minimax-usage/credentials/kimi.json`(约定,详见 refactor.md)

### 1.5 落地实现要点

- 新增 `src/providers/kimi.ts`,导出 `fetchKimiUsage(): Promise<KimiUsageNormalized | null>`
- 内部:
  1. 读取本地缓存的 OAuth token(若距过期 < 300s 先 `refresh_token` 续期)
  2. `fetch('https://api.kimi.com/coding/v1/usages', { headers: { Authorization: 'Bearer ...', Accept: 'application/json', 'User-Agent': <allowed UA> } })`
  3. 解析 → 统一归一化为 `KimiUsageNormalized`,字段 `intervalRemainingPercent`, `weeklyRemainingPercent`, `intervalResetMs`, `weeklyResetMs`(让 `render.ts` 复用)
- 用户感知:在 statusline 增加 `  Kimi   │ 5h  ████░░░░ 12% (100%) ⟳ 4h21m │ 7d ██░░░░░░░ 8% (100%) ⟳ 6d3h` 一行(完全沿用 MiniMax 行的渲染模板)

### 1.6 可重放探测脚本

```bash
# 1. 拿到 OAuth access_token(假设已落盘)
TOKEN=$(jq -r .access_token ~/.kimi/credentials/kimi-code.json)

# 2. 探测
curl -sS \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" \
  -H "User-Agent: Claude-Code-Statusline/0.0.9" \
  https://api.kimi.com/coding/v1/usages | jq

# 3. 若返回 403 / "User-Agent not allowed",换一个已知 UA 再试(参考 cc-switch PR #3671)
```

### 1.7 证据来源

| 来源 | 链接 / 路径 |
|---|---|
| 主端点(高置信) | `https://api.kimi.com/coding/v1/usages`(经 20+ 仓库源码引用) |
| 仓库引用 | `farion1231/cc-switch` `src-tauri/src/services/coding_plan.rs` |
| 仓库引用 | `openchamber/openchamber` `packages/web/server/lib/quota/providers/kimi.js` |
| 仓库引用 | `raycast/extensions` `extensions/agent-usage/src/kimi/fetcher.ts` |
| 仓库引用 | `robinebers/openusage` `plugins/kimi/plugin.js` |
| 仓库引用 | `diegosouzapw/OmniRoute` `open-sse/services/usage.ts` |
| 仓库引用 | `BenedictKing/ccx` `docs/providers/kimi.md` |
| 仓库引用 | `ASmallMatch/statusline` `config/providers/kimi.sh` |
| OAuth host | `MoonshotAI/kimi-cli` `src/kimi_cli/auth/oauth.py`(`DEFAULT_OAUTH_HOST = 'https://auth.kimi.com'`) |
| 文档 | `https://kimi.moonshot.cn`(产品页);`https://platform.moonshot.cn`(Open Platform 文档,本场景无关) |
| 注意事项 | `https://github.com/lemon07r/opencode-kimi-full`(UA 伪装参考) |

---

## 2. 阿里云百炼 (Bailian / DashScope)

### 2.1 入口判定

- `ANTHROPIC_BASE_URL` 命中: `dashscope.aliyuncs.com` / `*.aliyuncs.com` / 第三方代理回包含 Bailian 标识
- 警告:不与"阿里云控制面"(`aliyun.com`)混为一谈;DashScope 是模型推理网关,用量走单独路径

### 2.2 用量端点

- ❌ **未发现**与 `minimaxi.com/v1/token_plan/remains` 对应的公开用量 REST
- 候选路径(均不满足"5h/7d 编码套餐 + reset"语义):
  - `https://billing.aliyuncs.com/`(BSS OpenAPI)→ 仅代金券/账户余额,需 AK/SK 签名,非 Bearer
  - `https://dashscope.console.aliyun.com/api/v1/...`→ 控制台会话,需 cookie,非公开
- **当前结论**:无可程序化的编码套餐剩余/重置端点。WebFetch 在本会话被防火墙拦截,无法做活体探测

### 2.3 Anthropic 兼容

- ✅ `https://dashscope.aliyuncs.com/apps/anthropic`
- 认证: `Authorization: Bearer <DASHSCOPE_API_KEY>`(key 形如 `sk-...`,在 `bailian.console.aliyun.com` 申请)
- 消息路径: `/v1/messages`
- OpenAI 兼容: `/compatible-mode/v1/chat/completions`

### 2.4 可重放探测脚本

```bash
# 1. 探测 Anthropic 兼容层
curl -sS -i \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  https://dashscope.aliyuncs.com/apps/anthropic/v1/messages | head -20

# 2. 探测可能存在的用量端点(返回 404 即证实无公开)
for path in \
  /v1/token_plan/remains \
  /v1/usages \
  /v1/usage \
  /v1/balance \
  /v1/quota \
  /api/v1/usage; do
  echo "=== $path ==="
  curl -sS -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer $DASHSCOPE_API_KEY" \
    "https://dashscope.aliyuncs.com$path"
done

# 3. BSS OpenAPI(账户余额,非编码套餐)
# 需 AlibabaCloud SDK 或手写 RPC 签名;不在本 HUD 范围
```

### 2.5 当前推荐实现

- **不实现用量 HUD**(无 JSON 字段)
- 可在 statusline 增加一行占位:`  Bailian │ (控制台: bailian.console.aliyun.com)`,仅当 `isBailianEndpoint()` 为真时显示
- 等 DashScope 官方发布用量端点后再升级为 `provider/bailian.ts`

### 2.6 证据来源

| 来源 | 链接 |
|---|---|
| 文档(本次拦截) | `https://help.aliyun.com/zh/model-studio` |
| 控制台 | `https://bailian.console.aliyun.com/` |
| OpenAPI 入口 | `https://dashscope.aliyuncs.com/` |
| 文档(备份) | `https://www.alibabacloud.com/help/en/model-studio` |

---

## 3. 小米 MiMo

### 3.1 入口判定

- `ANTHROPIC_BASE_URL` 命中: `api.xiaomimimo.com` / `*.xiaomimimo.com`
- 区分两条产品线:
  - **MiMo Token Plan**(API key 前缀 `tp-`,集群 `token-plan-{cn|sgp|ams}.xiaomimimo.com`,Lite/Standard/Pro/Max 分级):**有产品,无公开用量 API**
  - **MiMo Open Platform**(通用 sk- key):不在本文范围

### 3.2 用量端点

- ❌ **无**。实测以下路径全部 `404`:
  - `/v1/usage`
  - `/v1/dashboard/billing/credit`
  - `/v1/coding_plan/usage`
  - `/v1/usage/coding_plan`
  - `/v1/quota`
- 重置周期:按"自然月"计,在购买日续费(等价 Zhipu 模式)
- **当前结论**:仅控制台 `https://platform.xiaomimimo.com/#/console/usage` 可见

### 3.3 Anthropic 兼容

- 🟡 `https://api.xiaomimimo.com/anthropic`
- 认证: `x-api-key: <api_key>` + `anthropic-version: 2023-06-01`
- 消息路径: `/v1/messages`

### 3.4 可重放探测脚本

```bash
TOKEN="tp-..."  # MiMo Token Plan 形如 tp- 开头
for path in \
  /anthropic/v1/usages \
  /v1/usages \
  /v1/usage \
  /v1/quota \
  /v1/dashboard/billing/credit \
  /v1/coding_plan/usage; do
  echo "=== $path ==="
  curl -sS -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer $TOKEN" \
    "https://api.xiaomimimo.com$path"
done
```

### 3.5 当前推荐实现

- **不实现用量 HUD**
- 占位行: `  MiMo   │ (控制台: platform.xiaomimimo.com)`
- 等官方开放 API

### 3.6 证据来源

| 来源 | 链接 |
|---|---|
| 主站 | `https://platform.xiaomimimo.com/` |
| 文档 | `https://platform.xiaomimimo.com/docs`(本次拦截) |
| 控制台 | `https://platform.xiaomimimo.com/#/console/usage` |
| 备用 | `https://xiaomi.com`(产品页) |
| 备注 | 小米未公开 MiMo 推理 API 的用量 API 文档 |

---

## 4. 火山引擎 (Volcengine ARK / 豆包)

### 4.1 入口判定

- `ANTHROPIC_BASE_URL` 命中: `ark.cn-beijing.volces.com` / `ark.volces.com` / `*.volces.com`
- 区分两条产品线:
  - **ARK 预付费余额**:`/api/v3/dashboard/billing/credit` 可查
  - **豆包编程套餐**(订阅制):**不可程序化查询**,仅控制台

### 4.2 用量端点(部分)

- **预付费余额**:`GET https://ark.cn-beijing.volces.com/api/v3/dashboard/billing/credit`
- 认证: `Authorization: Bearer <ARK_API_KEY>`(UUID 形,在 ARK 控制台创建)
- 响应(社区文档引用,**官方未正式确认字段名**):
  ```json
  {
    "granted_credit": 100.0,
    "topped_up_credit": 50.0,
    "available_credit": 75.5,
    "credit_remained": 75.5,
    "reset_at": 1735660800
  }
  ```
- 实测 401 错误 envelope(证实端点存在并要求 Bearer):
  ```json
  {"error": {"code": "AuthenticationError", "message": "...", "param": "", "type": "Unauthorized"}}
  ```
- ⚠️ `reset_at` 字段命名在社区代码中漂移(`reset_at` / `next_reset_at`),落地前必测
- **账单级**:`/api/v3/dashboard/billing/usage`、`/api/v3/dashboard/billing/subscription` 同样仅账单级
- ❌ 豆包编程套餐(订阅制)**无公开 REST 端点**

### 4.3 Anthropic 兼容

- ❌ **不直接托管** Claude 模型。ARK 模型目录无 `claude-*` 字段
- 若需在 Claude Code 中使用,必须经 OpenAI→Anthropic 适配代理(社区方案,非官方)
- 第三方代理候选: `https://ark.cn-beijing.volces.com/api/v3/v1`(实测 404,不存在)
- 真正方案:用 Aliyun Bailian 的 `/apps/anthropic` 端点(走 Qwen)而非 ARK

### 4.4 可重放探测脚本

```bash
ARK_KEY="..."
# 1. 预付费余额
curl -sS \
  -H "Authorization: Bearer $ARK_KEY" \
  https://ark.cn-beijing.volces.com/api/v3/dashboard/billing/credit | jq

# 2. 探测编码套餐(返回 404 / 401 即证实无公开 API)
for path in \
  /api/v3/coding_plan/usage \
  /api/v3/usages \
  /api/v3/dashboard/billing/subscription; do
  echo "=== $path ==="
  curl -sS -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer $ARK_KEY" \
    "https://ark.cn-beijing.volces.com$path"
done

# 3. 探测是否存在 Anthropic 路径
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $ARK_KEY" \
  -H "anthropic-version: 2023-06-01" \
  https://ark.cn-beijing.volces.com/api/v3/v1/messages
```

### 4.5 当前推荐实现

- **可实现"现金余额 HUD"**(部分体验):新增 `src/providers/volcengine.ts`,仅展示 `available_credit` 数字,无重置倒计时
- **不实现豆包编程套餐 HUD**
- 占位行: `  Volcengine │ ¥75.50 余额`

### 4.6 证据来源

| 来源 | 链接 |
|---|---|
| 主文档(JS 渲染) | `https://www.volcengine.com/docs/82379` |
| 主站 | `https://www.volcengine.com/` |
| ARK 端点 | `https://ark.cn-beijing.volces.com/api/v3` |
| 控制台 | `https://console.volcengine.com/ark` |
| 兄弟文档 ID | 1099450 / 1099455 / 1099459 / 1099461 / 1221660 / 1256348 / 1393085 / 1515355 / 1544106(均需 JS 渲染) |

---

## 5. 智谱 GLM (Zhipu)

### 5.1 入口判定

- `ANTHROPIC_BASE_URL` 命中: `open.bigmodel.cn` / `bigmodel.cn` / 第三方代理回包含 zhipu/glm 标识
- 区分两条产品线:
  - **GLM 编码套餐**(订阅制):按月 token 池,**无公开用量 REST**
  - **GLM 按量付费**:`/api/paas/v4/...`,无"用量剩余"概念(扣余额即可)

### 5.2 用量端点

- ❌ **无公开 REST**
- 配额可见性:
  - 控制台: `https://bigmodel.cn`(会员中心 → 套餐用量)
  - 响应头: `X-RateLimit-Remaining-Requests` / `X-RateLimit-Remaining-Tokens`(只反映 RPM/TPM,不是月度套餐余额)
- 重置机制: 按购买日自然月续费(plan-SKU 依赖)
- 错误码: `1302`(账户级限流,套餐超出并发) / `1305`(平台过载)

### 5.3 Anthropic 兼容

- 🟡 `https://open.bigmodel.cn/api/anthropic`
- 认证: `x-api-key: <api_key>` + `anthropic-version: 2023-06-01`
- 消息路径: `/v1/messages`
- GLM 编码套餐专属端点: `https://open.bigmodel.cn/api/coding/paas/v4`(OpenAI 兼容 `/chat/completions`)

### 5.4 可重放探测脚本

```bash
ZHIPU_KEY="..."
# 1. 探测 Anthropic 路径是否响应
curl -sS -i \
  -H "x-api-key: $ZHIPU_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"glm-4.5","messages":[{"role":"user","content":"ping"}],"max_tokens":1}' \
  https://open.bigmodel.cn/api/anthropic/v1/messages | head -20

# 2. 探测用量端点
for path in \
  /api/paas/v4/usages \
  /api/anthropic/v1/usages \
  /api/coding/paas/v4/usages \
  /api/v1/usage \
  /api/v1/quota \
  /api/v1/balance; do
  echo "=== $path ==="
  curl -sS -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer $ZHIPU_KEY" \
    "https://open.bigmodel.cn$path"
done

# 3. 抓取响应头(在一次正常 /v1/messages 调用中看 X-RateLimit-*)
# 该调用不消耗 token,可用最大 max_tokens=1
```

### 5.5 当前推荐实现

- **不实现用量 HUD**
- 占位行: `  Zhipu   │ (RPM/TPM 头仅, 控制台: bigmodel.cn)`
- 可选: 解析最近一次 `X-RateLimit-` 响应头并展示,但意义有限

### 5.6 证据来源

| 来源 | 链接 |
|---|---|
| 文档 | `https://bigmodel.cn/dev/api` |
| 文档 | `https://docs.bigmodel.cn/cn/api/introduction` |
| 文档 | `https://docs.bigmodel.cn/cn/api/rate-limit` |
| 控制台 | `https://bigmodel.cn`(会员中心) |
| Anthropic 入口 | `https://open.bigmodel.cn/api/anthropic` |
| 编码套餐 | `https://open.bigmodel.cn/api/coding/paas/v4` |

---

## 6. 跨厂商对比矩阵

| 厂商 | 用量端点 | 公开认证 | Anthropic 兼容 | 剩余% + 重置 | 整体可行性 | 文档来源 |
|---|---|---|---|---|---|---|
| MiniMax | ✅ `GET /v1/token_plan/remains` | Bearer sk | ✅ `minimaxi.com/anthropic` | ✅ | ✅ 已在用 | `PLAN.md` |
| Kimi | ✅ `GET /v1/usages` | OAuth Bearer | ✅ `api.kimi.com/coding` | ✅ | ✅ 强烈推荐 | api.kimi.com / 20+ 仓库 |
| Bailian | ❌(BSS OpenAPI 不等价) | Bearer sk(仅推理) | ✅ `dashscope.aliyuncs.com/apps/anthropic` | ❌ | 🟡 仅占位 | help.aliyun.com |
| MiMo | ❌(控制台 only) | Bearer tp- | 🟡 `api.xiaomimimo.com/anthropic` | ❌ | 🟡 仅占位 | platform.xiaomimimo.com |
| Volcengine | ⚠️ 仅 `credit` | Bearer ARK | ❌(无 Claude 模型) | ⚠️ 部分 | 🟡 现金余额 HUD | volcengine.com/docs/82379 |
| Zhipu | ❌(控制台 + 响应头) | Bearer | 🟡 `open.bigmodel.cn/api/anthropic` | ❌ | 🟡 仅占位 | bigmodel.cn/dev/api |

---

## 7. 重跑验证流程(给未来 agent)

1. **环境准备**:确认能访问 `api.kimi.com` / `dashscope.aliyuncs.com` / `api.xiaomimimo.com` / `ark.cn-beijing.volces.com` / `open.bigmodel.cn` 五个域名
2. **凭据准备**:为每家申请一个测试 API key(OAuth 走 device-code)
3. **逐家跑探测脚本**(第 1–5 节的 curl 片段),把结果粘回对应章节
4. **关注变更信号**:
   - Kimi: `usage` / `limits` 字段消失或新增 → 影响 `KimiUsageNormalized` 类型
   - Bailian: 新增 `/v1/token_plan/remains` 等价端点 → 触发 `BailianProvider` 实现
   - MiMo / Zhipu / Volcengine: 任何 200 响应的"用量"端点 → 重新评估可行性档位
5. **更新本文件**后再开始编码,避免基于过期结论写死 provider

---

## 8. 不在本文件范围但需关注的相邻信息

- **Claude Code 官方 provider 列表**: `https://docs.claude.com/en/docs/claude-code/providers`
- **statusline 协议**: stdin 接收 JSON(含 `model`, `cwd`, `context_window`, `transcript_path`),stdout 输出 ANSI 字符串。本项目已在 `src/index.ts` 落地
- **OAuth device-code 流程参考**: RFC 8628
- **Anthropic-compatible base 通用约定**:`/v1/messages` POST + `x-api-key` 头 + `anthropic-version: 2023-06-01`
