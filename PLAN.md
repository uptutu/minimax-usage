# MiniMax Token Plan HUD - 实现计划

## Context

用户需要在 Claude Code 中显示 MiniMax token plan 的剩余用量。参考 API 为：
- 端点: `POST https://www.minimaxi.com/v1/token_plan/remains`
- 认证: `Authorization: Bearer <API Key>`
- 项目目录 `/home/lo/codespace/minimax-usage` 目前为空

## 方案概述

创建一个独立的 Claude Code HUD 插件 `minimax-usage`，通过调用 MiniMax API 获取 token 剩余用量并显示在 Claude Code 状态栏。支持通过 `/plugin install minimax-usage` 安装。

## 项目结构

```
minimax-usage/
├── .claude-plugin/
│   └── plugin.json          # 插件元数据 (支持 /plugin install)
├── src/
│   ├── index.ts            # 入口点
│   ├── api.ts             # MiniMax API 调用
│   ├── cache.ts           # 结果缓存 (TTL: 60s)
│   ├── config.ts          # 配置加载
│   ├── types.ts           # TypeScript 接口
│   └── render.ts          # 输出格式化
├── commands/
│   └── setup.md # 设置命令
├── package.json
└── tsconfig.json
```

## 关键文件

| 文件 | 用途 |
|------|------|
| `.claude-plugin/plugin.json` | 插件元数据，定义插件名称、版本、命令，支持 `/plugin install` 安装 |
| `src/index.ts` | 入口点，每 ~300ms 被 Claude Code 调用，读取 stdin 并输出到 stdout |
| `src/api.ts` | 调用 MiniMax `/v1/token_plan/remains` API |
| `src/cache.ts` | 60秒缓存，避免频繁 API 调用 |
| `src/config.ts` | 从环境变量 `ANTHROPIC_AUTH_TOKEN` 读取 API Key |
| `src/render.ts` | 格式化为 HUD 输出 |
| `commands/setup.md` | `/minimax-usage:setup` 命令 |

## plugin.json 配置

```json
{
  "name": "minimax-usage",
  "description": "Display MiniMax token plan remaining usage in Claude Code HUD",
  "version": "0.0.1",
  "commands": ["./commands/setup.md"]
}
```

## 配置结构

插件直接从 Claude Code 运行环境读取 `ANTHROPIC_AUTH_TOKEN` 环境变量作为 API Key，无需用户额外配置。

可选配置文件 `~/.claude/plugins/minimax-usage/config.json`:
```json
{
  "refreshIntervalMs": 60000
}
```

## API 集成

**请求**:
```http
POST https://www.minimaxi.com/v1/token_plan/remains
Authorization: Bearer <API Key>
Content-Type: application/json
```

**实际响应**:
```json
{
  "model_remains": [{
    "model_name": "general",
    "current_interval_total_count": 3,
    "current_interval_usage_count": 0,
    "current_interval_remaining_percent": 99,
    "current_weekly_total_count": 21,
    "current_weekly_usage_count": 0,
    "weekly_remaining_percent": 96
  }],
  "base_resp": {"status_code": 0, "status_msg": "success"}
}
```

## 输出格式 (详细版本)

```
MiniMax │ 5h ████████░ 99% │ 7d ████████░ 96%
```

使用进度条 + 百分比显示五小时限额和周限额。

## 依赖

- Node.js 18+ / Bun
- TypeScript 5
- 内置 `fetch` (Node 18+)

## 验证方案

1. 运行 `npm run build` 编译 TypeScript 到 `dist/`
2. 使用 `/plugin install minimax-usage` 安装插件
3. 插件自动注册 `statusLine.command` 到 `settings.json`
4. 验证状态栏显示 MiniMax token 剩余用量 (5h:99% 7d:96%)