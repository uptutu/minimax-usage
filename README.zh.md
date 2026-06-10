# minimax-usage

[English](./README.md) | **简体中文**

在 Claude Code HUD 中显示 MiniMax 令牌计划的剩余用量。

直接在 Claude Code 状态栏中展示您的 MiniMax API 令牌用量限制,内容包括:
- **当前模型** — Claude Code 正在使用的模型
- **当前项目** — 目录名称、Git 分支与工作区状态
- **5 小时窗口** 用量及总配额
- **7 天窗口** 用量及总配额(含 boost)
- **彩色进度条** (绿色 > 50%、黄色 20-50%、红色 < 20%)

## 输出格式

```
[MiniMax-M3]
  Project │ minimax-usage │ main ✓
  Context │ ctx ███░░░░░░░ 29%
  MiniMax │ 5h  ███████░░░ 66% (100%) ⟳ 3h19m │ 7d ██░░░░░░░░ 19.5% (150%) ⟳ 4d12h
```

- `[<model>]` — 当前 Claude Code 模型的显示名称,使用 **蓝色** (ANSI `\x1b[34m`) 单独成行
- `Project` — 当前目录名称及 Git 分支/状态(以棕黄色显示;`✓` 表示干净,`!` 表示有改动,可附加 `↑N` / `↓N` 表示领先/落后提交数;非 Git 目录显示 `no git`)
- `Context` — 当前上下文窗口使用百分比(2 空格缩进,详见 [上下文解析](#上下文解析))
- `MiniMax` — 令牌计划用量(2 空格缩进)
  - `5h` — 五小时用量窗口(基准 100% 配额)
  - `7d` — 七天周窗口(可能包含 boost,例如 150%)
- 进度条按用量着色(绿 / 黄 / 红)
- 百分比显示格式:已用%(总额%)
- 配额重置倒计时使用 `⟳` 符号(格式:`XdXh` 或 `XhXm`)

### 上下文解析

`Context` 采用回退链解析,只要有数据就会显示:

1. `stdin.context_window.used_percentage` — Claude Code 的原生值(最准确)
2. `stdin.context_window.current_usage` + `context_window_size` — 由 token 计数计算得到
3. `transcript_path` JSONL — 本地解析,取最近一条 `assistant` 消息的 `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`,除以 `context_window_size`

如果以上均无法得到值(例如全新会话,没有 transcript),该行会隐藏。

## 功能特性

- **基于用量的显示**:展示已消耗百分比,剩余部分以暗色显示
- **彩色进度条**:绿色 (>50% 剩余)、黄色 (20-50%)、红色 (<20%)
- **支持 Boost**:识别配额 boost(例如 150% 总额)
- **总配额展示**:同时显示已用量与总配额
- **重置倒计时**:使用 `⟳` 符号显示距离 5h 和 7d 配额重置的剩余时间
- **模型显示**:从 status line 输入中展示当前 Claude Code 模型(蓝色方括号,单独成行)
- **项目显示**:展示当前目录名及 Git 分支/状态
- **上下文追踪**:三层回退展示上下文窗口压缩进度(由 `stdin used_percentage` → `stdin current_usage` → transcript JSONL 依次回退)
- **最低进度条**:即使在极低用量下也始终显示至少 1 个块

## 环境要求

- Node.js 18+ 或 Bun
- 支持 HUD 的 Claude Code

## 安装

```bash
# 添加 GitHub 托管的市场,然后安装插件
/plugin marketplace add PureLo/minimax-usage
/plugin install minimax-usage@minimax-plugins
```

## 配置

安装完成后,运行自动化配置:

```
/minimax-usage:setup
```

该命令会:
1. 配置 `${CLAUDE_CONFIG_DIR:-~/.claude}/settings.json`
2. 在 `${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/minimax-usage/` 下安装一个可移植的 status line 包装器
3. 在替换现有 status line 之前,先备份为 `statusline.backup.json`
4. 引导您重新加载插件

如需在不动现有 status line 的前提下进行检查:

```
/minimax-usage:setup --no-overwrite
```

## StatusLine 冲突

Claude Code 的 `statusLine.command` 字段只支持 **一条** 命令。如果您已经配置了其他 statusline 插件:

**二选一**
如果优先展示 MiniMax 用量,请用 `minimax-usage` 替换现有 statusline。

注意:由于 HUD 插件是持续输出的长驻命令,无法使用管道 (`|`) 来组合多个 HUD 插件。

## 配置说明

status line 通过环境变量 `ANTHROPIC_AUTH_TOKEN` 完成 MiniMax API 鉴权。请确保启动 Claude Code 的环境中已经导出该变量。

您也可以在 `${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/minimax-usage/config.json` 下创建配置文件(可选):

```json
{
  "refreshIntervalMs": 60000
}
```

默认 API 缓存刷新间隔为 60 秒。

## API 数据

插件调用 MiniMax API 端点:

```
GET https://www.minimaxi.com/v1/token_plan/remains
Authorization: Bearer <API_KEY>
```

使用的响应字段:
- `current_interval_remaining_percent` — 5 小时窗口剩余百分比
- `current_weekly_remaining_percent` — 7 天窗口剩余百分比
- `weekly_boost_permille` — Boost 数值(例如 1500 = 150% 配额)

## 项目结构

```
minimax-usage/
├── .claude-plugin/
│   ├── plugin.json          # 插件清单
│   └── marketplace.json     # 市场定义
├── src/
│   ├── index.ts           # 入口,使用回退链解析上下文
│   ├── context.ts         # transcript JSONL 解析(上下文回退)
│   ├── api.ts             # MiniMax API 调用
│   ├── cache.ts           # 结果缓存 (TTL: 60s)
│   ├── config.ts          # 配置文件加载
│   ├── types.ts           # TypeScript 接口
│   └── render.ts          # 带颜色支持的输出格式化
├── skills/
│   └── setup/
│       ├── SKILL.md      # /minimax-usage:setup 命令
│       └── setup.sh      # 自动化配置脚本
├── package.json
├── tsconfig.json
└── README.md
```

## 故障排查

**没有显示任何输出?**
- 确认环境变量 `ANTHROPIC_AUTH_TOKEN` 已设置
- 确认 Claude Code 的 PATH 中能找到 Node.js 18+ 或 Bun
- 确认 Claude Code 状态栏已启用
- 尝试 `/reload-plugins` 或重启 Claude Code

**API 报错?**
- 确认您的 API Key 有权访问 token plan API
- 检查到 `www.minimaxi.com` 的网络连通性

## 许可协议

MIT
