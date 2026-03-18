# PromptXY

<div align="center">

<img src="https://raw.githubusercontent.com/BeGild/promptxy/master/frontend/public/favicon.svg" alt="PromptXY Logo" width="128" height="128">

![PromptXY Logo](https://img.shields.io/badge/PromptXY-v2.1.3-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)

**AI 工具本地 HTTP 代理规则管理器**

拦截、修改、可视化 AI 服务请求 | 支持 Anthropic、OpenAI、Gemini

[功能特性](#-核心功能) • [快速开始](#-快速开始) • [安装方式](#-安装方式) • [配置说明](#-配置文件)

</div>

## ✨ 核心功能

### 🎯 请求拦截与修改

- **实时捕获**: 记录所有经过代理的请求
- **规则引擎**: 7种操作类型，支持正则表达式
- **多客户端支持**: Claude Code, Codex CLI, Gemini CLI
- **差异对比**: 可视化原始 vs 修改后请求

### 📊 请求历史

- **SQLite存储**: 高效的本地数据库
- **自动清理**: 保留最近1000条请求（可配置）
- **实时推送**: SSE实时更新UI
- **搜索筛选**: 按客户端、时间、内容筛选

### 🎨 Web UI

- **规则管理**: 可视化CRUD操作
- **请求监控**: 实时查看请求流
- **预览测试**: 沙盒环境测试规则
- **配置管理**: 导入/导出配置

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                         用户操作                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    前端 (React + HeroUI)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  规则管理    │  │  请求查看    │  │  预览测试    │     │
│  │  (UI层)      │  │  (UI层)      │  │  (UI层)      │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │              │
│         └────────┬────────┴────────┬────────┘              │
│                  │                 │                       │
│         ┌────────▼────────┐  ┌─────▼──────┐               │
│         │  API客户端      │  │  SSE客户端 │               │
│         │  (fetch/axios)  │  │  (EventSource)│             │
│         └────────┬────────┘  └─────┬──────┘               │
└──────────────────┼──────────────────┼──────────────────────┘
                   │                  │
                   ↓                  ↓
┌─────────────────────────────────────────────────────────────┐
│              PromptXY 统一服务器 (端口 7070)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  │  API路由     │  │  SSE推送     │  │  代理核心    │  │
│  │  │  /_promptxy/*│  │  /_promptxy  │  │  /claude/*   │  │
│  │  │              │  │              │  │  /codex/*    │  │
│  │  │              │  │              │  │  /chat/*     │  │
│  │  │              │  │              │  │  /gemini/*   │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│  └─────────┼──────────────────┼──────────────────┼─────────┘
│            │                  │                  │
│            └────────┬─────────┴────────┬─────────┘
│                     │                  │
│            ┌────────▼────────┐  ┌─────▼──────┐               │
│            │  SQLite数据库   │  │  配置文件  │               │
│            │  (请求历史)     │  │  (规则)    │               │
│            └─────────────────┘  └────────────┘               │
└─────────────────────────────────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────────────┐
│                    CLI工具 (Claude/Codex/Gemini)             │
│  发起请求 → 经过代理 → 规则修改 → 转发上游API                 │
└─────────────────────────────────────────────────────────────┘
```

## 📥 安装方式

### 方式一：npm 全局安装（推荐）

```bash
npm install -g promptxy
```

安装后直接运行：

```bash
promptxy
```

### 方式二：从源码运行

```bash
# 克隆仓库
git clone https://github.com/BeGild/promptxy.git
cd promptxy

# 安装依赖
npm install

# 开发模式
npm run dev

# 生产模式
npm run build && npm start
```

## 🚀 快速开始

### 前置要求

- Node.js 18+
- npm 或 pnpm

### 开发环境

**1. 克隆并安装依赖**

```bash
git clone https://github.com/BeGild/promptxy.git
cd promptxy
npm install
```

**2. 启动开发服务**

```bash
# 方式一：使用脚本（推荐）
chmod +x scripts/*.sh
./scripts/dev.sh

# 方式二：直接运行
npm run dev
```

这将同时启动：

- 后端统一服务器 (自动分配端口，8000-9000范围)
- 前端开发服务器 (端口 5173)

**3. 访问 Web UI**

```
http://localhost:5173
```

### 生产部署

**方式一：使用 npm 包（推荐）**

```bash
# 全局安装
npm install -g promptxy

# 启动服务
promptxy --port 7070
```

**方式二：从源码构建**

```bash
# 构建项目
npm run build

# 启动服务
npm start -- --port 7070
```

访问 Web UI: `http://127.0.0.1:7070/_promptxy/`

### 命令行参数

```bash
promptxy --port 7070          # 指定端口
promptxy --host 0.0.0.0       # 绑定所有网卡
promptxy --debug              # 启用调试模式
```

## 🔧 CLI 配置

使用如下的方式替换原本的 URL配置即可。

### Claude Code

```bash

#例如之前: export ANTHROPIC_BASE_URL="https://xxxxxx/api/anthropic"
export ANTHROPIC_BASE_URL="http://127.0.0.1:PORT/claude"
```

### Codex CLI

```bash
export OPENAI_BASE_URL="http://127.0.0.1:PORT/codex"
```

### OpenAI Chat 客户端

```bash
export OPENAI_BASE_URL="http://127.0.0.1:PORT/chat"
```

### Gemini CLI

```bash
export GOOGLE_GEMINI_BASE_URL="http://127.0.0.1:PORT/gemini"
```
> KEY/TOKEN的配置保持原样即可(透明代理，完美转发)

> 将 `PORT` 替换为实际运行端口。所有 CLI 配置都必须带上路径前缀（`/claude`、`/codex`、`/chat`、`/gemini`）。

## 🧩 按模型粒度映射到供应商 + 模型

当你将 `/claude/*` 路由对接到 OpenAI/Codex 协议供应商时，Claude Code 发送的 `model` 往往是 `*-sonnet-*` / `*-opus-*` / `*-haiku-*`，上游通常无法识别该模型名。

PromptXY 通过"模型映射规则"解决该问题：

1. **路由默认上游**：在「路由配置」中为 `/claude` 路由选择 `defaultSupplierId`（未命中规则时使用）。
2. **规则级选择**：为每条规则配置：`inboundModel` / `targetSupplierId` / `outboundModel?`。
   - `outboundModel` 未填写：透传入站 `model` 到目标供应商。
3. **运行时行为**：
   - 未命中任何规则：走 `defaultSupplierId`，并原样透传 `model`
   - 命中规则：走 `targetSupplierId`；若存在 `outboundModel` 则覆盖 `model`，否则透传

> 提示：若目标供应商配置了 `supportedModels` 且非空，UI 会提供目标模型下拉选择。

> 入口约束：`/codex` 仅允许选择 `protocol=openai-codex` 的供应商，`/chat` 仅允许选择 `protocol=openai-chat` 的供应商，`/gemini` 仅允许选择 `protocol=gemini` 的供应商。

> transformer 不再作为配置字段保存，运行时会根据入口与目标供应商协议自动推断。

### Claude → OpenAI 示例

- `defaultSupplierId=openai-official`
- 规则：`inboundModel=*-sonnet-*` → `targetSupplierId=openai-official` / `outboundModel=gpt-4o-mini`
- 规则：`inboundModel=*-haiku-*` → `targetSupplierId=openai-official` / `outboundModel` 留空（透传入站 model）

> 若你希望 haiku/opus “回落到 sonnet 的目标模型”，请显式把 `outboundModel` 也设置为同一个上游模型。

> 如果你希望不同入站模型落到不同供应商，也可以把 `targetSupplierId` 配成不同供应商 id。

### OpenAI ModelSpec（reasoning effort）

对于 OpenAI/Codex 上游请求，你可以在 `supportedModels` 中使用形如 `<base>-<effort>` 的 modelSpec（例如 `gpt-5.2-codex-high`）：

- 当 `<effort>` 命中内置列表（`low/medium/high/xhigh`）时，PromptXY 会在出站时自动拆解为：
  - `model=<base>`
  - `reasoning.effort=<effort>`
- 未命中时不报错，直接透传 modelSpec（便于未来扩展更多档位）。

## 🛠️ 常见问题排查

### 1) 400: route_invalid / 路由协议不合法

含义：`/codex` 或 `/gemini` 入口选择了不匹配协议的供应商，或某条模型映射规则选择了不匹配协议的 `targetSupplierId`。

解决：
- `/codex` 仅选择 `protocol=openai` 的供应商
- `/gemini` 仅选择 `protocol=gemini` 的供应商

### 2) 400: 模型映射配置无效

常见原因：
- `targetSupplierId` 不存在
- `outboundModel` 提供但不在目标供应商 `supportedModels` 中（当 `supportedModels` 非空时）

解决：
- 检查供应商列表和 `supportedModels`
- 修正规则字段

### 3) 迁移旧配置

执行迁移脚本（会自动备份原文件）：

```bash
tsx scripts/migrate-config.ts ~/.config/promptxy/config.json
```

该脚本会：
- `supplierId` → `defaultSupplierId`
- 移除 `transformer`
- `claudeModelMap` → `modelMapping.rules[]`（补齐 `targetSupplierId`）
- `modelMapping.rules[].target` → `outboundModel`

## 📚 文档

- **[配置参考](docs/configuration.md)** - 完整的配置文件说明，包括所有配置项和环境变量
- **[使用指南](docs/usage.md)** - CLI 配置详解、规则引擎语法和常见用例
- **[架构设计](docs/architecture.md)** - 项目架构、技术栈和数据流设计
- **[项目背景](docs/origin_and_requirements.md)** - 项目初衷、需求溯源和设计决策

## 📝 配置文件

配置文件位置: `~/.config/promptxy/config.json` 或项目根目录 `promptxy.config.json`

> 💡 **详细配置说明请参考** [配置参考文档](docs/configuration.md)

### 版本说明

PromptXY 提供两个版本：

- **简化版**：通过 npm 全局安装，轻量级代理，使用 `upstreams` 配置
- **完整版**：从源码运行，包含 Web UI 管理界面，使用 `suppliers` 配置

### 最小配置示例

**简化版（npm 包）**：

```json
{
  "listen": {
    "host": "127.0.0.1",
    "port": 7070
  },
  "upstreams": {
    "anthropic": "https://api.anthropic.com",
    "openai": "https://api.openai.com",
    "gemini": "https://generativelanguage.googleapis.com"
  },
  "rules": [],
  "debug": false
}
```

**完整版（带 Web UI）**：

```json
{
  "listen": {
    "host": "127.0.0.1",
    "port": 7070
  },
  "suppliers": [
    {
      "id": "claude-anthropic",
      "name": "claude-anthropic",
      "displayName": "Claude (Anthropic)",
      "baseUrl": "https://api.anthropic.com",
      "protocol": "anthropic",
      "enabled": true,
      "auth": { "type": "none" },
      "supportedModels": []
    },
    {
      "id": "openai-official",
      "name": "openai-official",
      "displayName": "OpenAI Official",
      "baseUrl": "https://api.openai.com",
      "protocol": "openai",
      "enabled": true,
      "auth": { "type": "none" },
      "supportedModels": ["gpt-4o-mini"]
    }
  ],
  "routes": [
    {
      "id": "route-claude-default",
      "localService": "claude",
      "defaultSupplierId": "openai-official",
      "modelMapping": {
        "enabled": true,
        "rules": [
          {
            "id": "r1",
            "inboundModel": "*-sonnet-*",
            "targetSupplierId": "openai-official",
            "outboundModel": "gpt-4o-mini"
          }
        ]
      },
      "enabled": true
    }
  ],
  "rules": [],
  "storage": { "maxHistory": 1000 },
  "debug": false
}
```

## 🛠️ 常见问题排查

### 1) 400: route_invalid / 路由协议不合法

含义：`/codex` 或 `/gemini` 入口选择了不匹配协议的供应商，或某条模型映射规则选择了不匹配协议的 `targetSupplierId`。

解决：
- `/codex` 仅选择 `protocol=openai` 的供应商
- `/gemini` 仅选择 `protocol=gemini` 的供应商

### 2) 400: 模型映射配置无效

常见原因：
- `targetSupplierId` 不存在
- `outboundModel` 提供但不在目标供应商 `supportedModels` 中（当 `supportedModels` 非空时）

解决：
- 检查供应商列表和 `supportedModels`
- 修正规则字段

### 3) 迁移旧配置

执行迁移脚本（会自动备份原文件）：

```bash
tsx scripts/migrate-config.ts ~/.config/promptxy/config.json
```

该脚本会：
- `supplierId` → `defaultSupplierId`
- 移除 `transformer`
- `claudeModelMap` → `modelMapping.rules[]`（补齐 `targetSupplierId`）
- `modelMapping.rules[].target` → `outboundModel`

### OpenAI ModelSpec（reasoning effort）

对于 OpenAI/Codex 上游请求，你可以在 `supportedModels` 中使用形如 `<base>-<effort>` 的 modelSpec（例如 `gpt-5.2-codex-high`）：

- 当 `<effort>` 命中内置列表（`low/medium/high/xhigh`）时，PromptXY 会在出站时自动拆解为：
  - `model=<base>`
  - `reasoning.effort=<effort>`
- 未命中时不报错，直接透传 modelSpec（便于未来扩展更多档位）。

## 📚 文档

- **[配置参考](docs/configuration.md)** - 完整的配置文件说明，包括所有配置项和环境变量
- **[使用指南](docs/usage.md)** - CLI 配置详解、规则引擎语法和常见用例
- **[架构设计](docs/architecture.md)** - 项目架构、技术栈和数据流设计
- **[项目背景](docs/origin_and_requirements.md)** - 项目初衷、需求溯源和设计决策

## 📝 配置文件

配置文件位置: `~/.config/promptxy/config.json` 或项目根目录 `promptxy.config.json`

> 💡 **详细配置说明请参考** [配置参考文档](docs/configuration.md)

### 版本说明

PromptXY 提供两个版本：

- **简化版**：通过 npm 全局安装，轻量级代理，使用 `upstreams` 配置
- **完整版**：从源码运行，包含 Web UI 管理界面，使用 `suppliers` 配置

### 最小配置示例

**简化版（npm 包）**：

```json
{
  "listen": {
    "host": "127.0.0.1",
    "port": 7070
  },
  "upstreams": {
    "anthropic": "https://api.anthropic.com",
    "openai": "https://api.openai.com",
    "gemini": "https://generativelanguage.googleapis.com"
  },
  "rules": [],
  "debug": false
}
```

**完整版（带 Web UI）**：

```json
{
  "listen": {
    "host": "127.0.0.1",
    "port": 7070
  }
}
```

## 📚 文档

- **[配置参考](docs/configuration.md)** - 完整的配置文件说明，包括所有配置项和环境变量
- **[使用指南](docs/usage.md)** - CLI 配置详解、规则引擎语法和常见用例
- **[架构设计](docs/architecture.md)** - 项目架构、技术栈和数据流设计
- **[项目背景](docs/origin_and_requirements.md)** - 项目初衷、需求溯源和设计决策

## 📝 配置文件

配置文件位置: `~/.config/promptxy/config.json` 或项目根目录 `promptxy.config.json`

> 💡 **详细配置说明请参考** [配置参考文档](docs/configuration.md)

### 版本说明

PromptXY 提供两个版本：

- **简化版**：通过 npm 全局安装，轻量级代理，使用 `upstreams` 配置
- **完整版**：从源码运行，包含 Web UI 管理界面，使用 `suppliers` 配置

### 最小配置示例

**简化版（npm 包）**：

```json
{
  "listen": {
    "host": "127.0.0.1",
    "port": 7070
  },
  "upstreams": {
    "anthropic": "https://api.anthropic.com",
    "openai": "https://api.openai.com",
    "gemini": "https://generativelanguage.googleapis.com"
  },
  "rules": [],
  "debug": false
}
```

**完整版（带 Web UI）**：

```json
{
  "listen": {
    "host": "127.0.0.1",
    "port": 7070
  },
  "suppliers": [
    {
      "id": "claude-anthropic",
      "name": "Claude (Anthropic)",
      "baseUrl": "https://api.anthropic.com",
      "localPrefix": "/claude",
      "enabled": true
    }
  ],
  "rules": [],
  "storage": {
    "maxHistory": 1000
  },
  "debug": false
}
```

### 规则类型

| 操作类型         | 描述         | 参数                           |
| ---------------- | ------------ | ------------------------------ |
| `set`            | 完全替换     | `text`                         |
| `append`         | 追加到末尾   | `text`                         |
| `prepend`        | 插入到开头   | `text`                         |
| `replace`        | 替换匹配内容 | `match`/`regex`, `replacement` |
| `delete`         | 删除匹配内容 | `match`/`regex`                |
| `insert_before`  | 在匹配前插入 | `regex`, `text`                |
| `insert_after`   | 在匹配后插入 | `regex`, `text`                |

## 📚 API 端点

所有API端点都在统一服务器上，使用 `/_promptxy/` 前缀：

- `GET /_promptxy/health` - 健康检查
- `GET /_promptxy/events` - SSE实时推送
- `GET /_promptxy/requests` - 请求历史列表
- `GET /_promptxy/requests/:id` - 请求详情
- `DELETE /_promptxy/requests/:id` - 删除请求
- `GET /_promptxy/config` - 获取配置
- `POST /_promptxy/config/sync` - 同步配置
- `POST /_promptxy/rules` - 创建规则
- `PUT /_promptxy/rules/:id` - 更新规则
- `DELETE /_promptxy/rules/:id` - 删除规则
- `GET /_promptxy/suppliers` - 获取供应商列表
- `POST /_promptxy/suppliers` - 创建供应商
- `PUT /_promptxy/suppliers/:id` - 更新供应商
- `DELETE /_promptxy/suppliers/:id` - 删除供应商
- `POST /_promptxy/suppliers/:id/toggle` - 切换供应商状态
- `POST /_promptxy/preview` - 预览规则
- `POST /_promptxy/requests/cleanup` - 清理数据
- `GET /_promptxy/settings` - 获取设置
- `POST /_promptxy/settings` - 更新设置
- `GET /_promptxy/stats` - 统计信息
- `GET /_promptxy/database` - 数据库信息

## 🛠️ 开发

### 项目结构

```
promptxy/
├── src/                        # npm 包源代码（简化版）
│   ├── main.ts                # 包入口，创建统一服务器
│   └── promptxy/
│       ├── gateway.ts         # 统一网关核心
│       ├── config.ts          # 配置管理
│       ├── types.ts           # 类型定义
│       ├── cli.ts             # 命令行解析
│       ├── rules/             # 规则引擎
│       │   └── engine.ts      # 规则执行引擎
│       └── adapters/          # AI 服务适配器
│           ├── claude.ts      # Claude 适配器
│           ├── codex.ts       # Codex 适配器
│           └── gemini.ts      # Gemini 适配器
│
├── backend/                    # 完整版（带 Web UI）
│   └── src/
│       ├── main.ts            # 完整服务的入口
│       └── promptxy/
│           ├── gateway.ts     # 统一网关核心
│           ├── config.ts      # 配置管理
│           ├── database.ts    # SQLite 数据库
│           ├── types.ts       # 类型定义
│           ├── api-handlers.ts # API 处理器
│           └── adapters/      # AI 服务适配器
│
├── frontend/                   # 前端应用（React + HeroUI）
│   ├── src/
│   │   ├── main.tsx           # 应用入口
│   │   ├── App.tsx            # 主组件
│   │   ├── components/        # UI 组件
│   │   ├── pages/             # 页面
│   │   ├── hooks/             # React Hooks
│   │   ├── api/               # API 客户端
│   │   ├── store/             # 状态管理
│   │   └── types/             # 类型定义
│   └── package.json
│
├── scripts/                    # 构建和开发脚本
│   ├── dev.sh                 # 开发环境启动
│   ├── build.sh               # 构建
│   └── start.sh               # 启动
│
├── docs/                       # 文档
│   ├── architecture.md        # 架构设计
│   ├── backend_api_extension.md # 后端 API 说明
│   ├── configuration.md       # 配置参考
│   ├── integration_testing.md # 集成测试
│   ├── origin_and_requirements.md # 项目背景
│   └── usage.md               # 使用指南
│
├── openspec/                   # OpenSpec 规范
│   ├── specs/                 # 已实现功能规范
│   └── changes/               # 变更提案
│
├── package.json                # 主包配置
├── tsconfig.json               # TypeScript 配置
└── README.md
```

### 技术栈

**后端**

- Node.js + TypeScript
- SQLite (数据库)
- HTTP Server (原生)

**前端**

- React 18
- HeroUI (组件库)
- Zustand (状态管理)
- TanStack Query (数据获取)
- Vite (构建工具)
- Tailwind CSS

## 🔒 安全性

- **本地运行**: 默认绑定 127.0.0.1
- **敏感信息**: 不存储API密钥
- **数据清理**: 自动清理旧请求
- **CORS**: 开发环境启用，生产环境禁用

## 📊 性能

- **数据库**: SQLite处理1000+请求无压力
- **前端**: 虚拟滚动支持长列表
- **实时**: SSE轻量级推送
- **内存**: 自动清理限制在100条记录

## 📄 许可

MIT License

---

## 🙏 致谢

本项目在设计和实现过程中参考了以下开源项目：

- **[claude-code-router](https://github.com/example/claude-code-router)** - 提供了 Claude Code 本地代理的实现思路，特别是通过 `ANTHROPIC_BASE_URL` 进行请求拦截的方式
- **[claude-relay-service](https://github.com/example/claude-relay-service)** - 展示了多 AI 服务统一接入的完整架构设计，包括请求适配、规则引擎等核心概念

感谢这些优秀的开源项目为 PromptXY 的开发提供了宝贵的参考和启发。

---

**PromptXY** - 让规则管理变得简单而强大
