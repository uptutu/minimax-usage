# MiniMax Token Plan HUD - 实现计划

## Context

用户需要在 Claude Code 中显示 MiniMax token plan 的剩余用量。参考 API 为：
- 端点: `GET https://www.minimaxi.com/v1/token_plan/remains`
- 认证: `Authorization: Bearer <API Key>`
- 项目目录 `/home/lo/code/minimax-usage`

## 方案概述

创建一个独立的 Claude Code HUD 插件 `minimax-usage`，通过调用 MiniMax API 获取 token 剩余用量并显示在 Claude Code 状态栏。通过 GitHub 托管的 marketplace 安装：

```
/plugin marketplace add PureLo/minimax-usage
/plugin install minimax-usage@minimax-plugins
```

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
├── skills/
│   └── setup/
│       ├── SKILL.md      # /minimax-usage:setup 命令
│       └── setup.sh      # 设置脚本
├── dist/
├── package.json
├── package-lock.json
└── tsconfig.json
```

## 关键文件

| 文件 | 用途 |
|------|------|
| `.claude-plugin/plugin.json` | 插件元数据，定义插件名称和版本 |
| `.claude-plugin/marketplace.json` | GitHub 托管 marketplace 定义 |
| `src/index.ts` | 状态栏入口点，读取 stdin 中的模型、上下文信息并输出到 stdout |
| `src/api.ts` | 调用 MiniMax `/v1/token_plan/remains` API |
| `src/cache.ts` | 持久 TTL 缓存，避免频繁 API 调用 |
| `src/config.ts` | 从环境变量 `ANTHROPIC_AUTH_TOKEN` 读取 API Key |
| `src/render.ts` | 格式化为 HUD 输出 |
| `skills/setup/SKILL.md` | `/minimax-usage:setup` 命令 |
| `skills/setup/setup.sh` | 写入 Claude Code statusLine 设置 |

## plugin.json 配置

```json
{
  "name": "minimax-usage",
  "description": "Display MiniMax token plan remaining usage in Claude Code HUD",
  "version": "0.0.5"
}
```

## 配置结构

插件从启动 Claude Code 的环境读取 `ANTHROPIC_AUTH_TOKEN` 作为 MiniMax API Key。

可选配置文件 `${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/minimax-usage/config.json`:
```json
{
  "refreshIntervalMs": 60000
}
```

## API 集成

**请求**:
```http
GET https://www.minimaxi.com/v1/token_plan/remains
Authorization: Bearer <API Key>
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
    "current_weekly_remaining_percent": 96,
    "weekly_boost_permille": 1000
  }],
  "base_resp": {"status_code": 0, "status_msg": "success"}
}
```

## 输出格式 (详细版本)

```
Model   │ MiniMax-M3
Context │ ctx █░░░░░░░░░ 15%
MiniMax │ 5h ████████░ 99% │ 7d ████████░ 96%
```

显示当前模型，并使用进度条 + 百分比显示上下文、五小时限额和周限额。

## 依赖

- Node.js 18+ / Bun
- TypeScript 5
- Node.js `https` 模块

## 验证方案

1. 运行 `npm run build` 编译 TypeScript 到 `dist/`
2. 添加 marketplace 后使用 `/plugin install minimax-usage@minimax-plugins` 安装插件
3. 运行 `/minimax-usage:setup` 注册 `statusLine.command` 到 `settings.json`
4. 验证状态栏显示 MiniMax token 剩余用量 (5h:99% 7d:96%)
