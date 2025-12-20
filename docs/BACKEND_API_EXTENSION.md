# PromptXY 后端API扩展设计

> **目标**：为Web UI提供完整的API支持
> **存储**：SQLite + SSE实时推送
> **路径**：`~/.local/promptxy/`

---

## 📋 API端点清单

### 1. SSE实时推送
```
GET /_promptxy/events
```

**描述**：服务器推送新请求事件到Web UI

**响应头**：
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**事件格式**：
```text
event: request
data: {
  "id": "req-20251220-143215-abc123",
  "timestamp": 1734705135000,
  "client": "codex",
  "path": "/v1/chat/completions",
  "method": "POST"
}
```

**实现逻辑**：
```typescript
// 在gateway.ts的createGateway中
const sseConnections: Set<http.ServerResponse> = new Set();

// 当捕获到请求时
function broadcastRequest(data: RequestData) {
  for (const res of sseConnections) {
    res.write(`event: request\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

// SSE端点处理
if (req.method === "GET" && url.pathname === "/_promptxy/events") {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  sseConnections.add(res);

  req.on('close', () => {
    sseConnections.delete(res);
  });

  return;
}
```

---

### 2. 请求历史列表
```
GET /_promptxy/requests
```

**查询参数**：
- `limit` (可选, 默认50, 最大100) - 返回数量
- `offset` (可选, 默认0) - 偏移量
- `client` (可选) - 按客户端筛选 (claude/codex/gemini)
- `startTime` (可选) - 开始时间戳
- `endTime` (可选) - 结束时间戳

**响应示例**：
```json
{
  "total": 150,
  "limit": 50,
  "offset": 0,
  "items": [
    {
      "id": "req-20251220-143215-abc123",
      "timestamp": 1734705135000,
      "client": "codex",
      "path": "/v1/chat/completions",
      "method": "POST",
      "matchedRules": ["rule-001", "rule-002"],
      "responseStatus": 200,
      "durationMs": 234,
      "error": null
    },
    // ... 更多项
  ]
}
```

**SQL查询**：
```sql
SELECT
  id, timestamp, client, path, method,
  matched_rules, response_status, duration_ms, error
FROM requests
WHERE
  (client = ? OR ? IS NULL)
  AND (timestamp >= ? OR ? IS NULL)
  AND (timestamp <= ? OR ? IS NULL)
ORDER BY timestamp DESC
LIMIT ? OFFSET ?;
```

---

### 3. 请求详情
```
GET /_promptxy/requests/:id
```

**响应示例**：
```json
{
  "id": "req-20251220-143215-abc123",
  "timestamp": 1734705135000,
  "client": "codex",
  "path": "/v1/chat/completions",
  "method": "POST",

  "originalBody": {
    "model": "gpt-4",
    "messages": [
      {"role": "system", "content": "You are helpful"}
    ]
  },

  "modifiedBody": {
    "model": "gpt-4",
    "messages": [
      {"role": "system", "content": "You are helpful\n\n## Custom Rules\n- Minimal"}
    ]
  },

  "matchedRules": [
    {"ruleId": "rule-001", "opType": "append"},
    {"ruleId": "rule-002", "opType": "replace"}
  ],

  "responseStatus": 200,
  "durationMs": 234,
  "responseHeaders": {
    "content-type": "application/json"
  },
  "error": null
}
```

**SQL查询**：
```sql
SELECT * FROM requests WHERE id = ?;
```

---

### 4. 配置读取
```
GET /_promptxy/config
```

**响应示例**：
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
  "rules": [
    {
      "id": "rule-001",
      "when": {
        "client": "codex",
        "field": "instructions"
      },
      "ops": [
        {
          "type": "append",
          "text": "\n\n## Custom Rules\n- Minimal"
        }
      ]
    }
  ],
  "debug": false
}
```

**实现**：
```typescript
// 从config.json读取并返回
const configPath = path.join(homeDir, '.local', 'promptxy', 'config.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
return config;
```

---

### 5. 配置同步
```
POST /_promptxy/config/sync
```

**请求体**：
```json
{
  "rules": [
    {
      "id": "rule-001",
      "when": {
        "client": "codex",
        "field": "instructions"
      },
      "ops": [
        {"type": "append", "text": "\n\n## Custom Rules\n- Minimal"}
      ]
    }
  ]
}
```

**响应**：
```json
{
  "success": true,
  "message": "配置已更新并生效",
  "appliedRules": 1
}
```

**实现逻辑**：
```typescript
// 在gateway.ts中添加
if (req.method === "POST" && url.pathname === "/_promptxy/config/sync") {
  const body = await readRequestBody(req);
  const newConfig = JSON.parse(body.toString());

  // 1. 验证规则格式
  validateRules(newConfig.rules);

  // 2. 更新内存配置（立即生效）
  config.rules = newConfig.rules;

  // 3. 写入配置文件
  const configPath = path.join(homeDir, '.local', 'promptxy', 'config.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  // 4. 返回成功
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({
    success: true,
    message: "配置已更新并生效",
    appliedRules: newConfig.rules.length
  }));

  return;
}
```

---

### 6. 清理旧数据
```
POST /_promptxy/requests/cleanup
```

**描述**：手动触发数据清理

**查询参数**：
- `keep` (可选, 默认100) - 保留最近N条

**响应**：
```json
{
  "deleted": 50,
  "remaining": 100,
  "success": true
}
```

**实现**：
```sql
-- 删除除最近N条之外的所有记录
DELETE FROM requests
WHERE id NOT IN (
  SELECT id FROM requests
  ORDER BY timestamp DESC
  LIMIT ?
);
```

---

## 🗄️ 数据库设计

### SQLite Schema

**数据库位置**：`~/.local/promptxy/promptxy.db`

```sql
-- 请求历史表
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  client TEXT NOT NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL,

  -- 请求体（JSON字符串）
  original_body TEXT NOT NULL,
  modified_body TEXT NOT NULL,

  -- 匹配规则（JSON数组字符串）
  matched_rules TEXT NOT NULL,

  -- 响应信息
  response_status INTEGER,
  duration_ms INTEGER,
  response_headers TEXT,  -- JSON字符串
  error TEXT,

  -- 索引
  INDEX idx_timestamp (timestamp DESC),
  INDEX idx_client (client),
  INDEX idx_client_timestamp (client, timestamp DESC)
);

-- 设置表
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 插入默认设置
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('max_history', '100'),
  ('auto_cleanup', 'true'),
  ('cleanup_interval_hours', '1');
```

---

## 🔄 后端修改点

### 1. 修改 gateway.ts

**新增导入**：
```typescript
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import os from 'os';
```

**在createGateway中初始化数据库**：
```typescript
export async function initializeDatabase() {
  const homeDir = os.homedir();
  const dataDir = path.join(homeDir, '.local', 'promptxy');

  // 确保目录存在
  await fs.mkdir(dataDir, { recursive: true });

  // 打开数据库
  const db = await open({
    filename: path.join(dataDir, 'promptxy.db'),
    driver: sqlite3.Database
  });

  // 初始化表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      client TEXT NOT NULL,
      path TEXT NOT NULL,
      method TEXT NOT NULL,
      original_body TEXT NOT NULL,
      modified_body TEXT NOT NULL,
      matched_rules TEXT NOT NULL,
      response_status INTEGER,
      duration_ms INTEGER,
      response_headers TEXT,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_timestamp ON requests(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_client ON requests(client);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return db;
}
```

**在请求处理中记录数据**：
```typescript
// 在gateway.ts的请求处理中
const startTime = Date.now();

// ... 处理请求 ...

const duration = Date.now() - startTime;

// 保存到数据库
const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

await db.run(
  `INSERT INTO requests VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    requestId,
    Date.now(),
    route.client,
    upstreamPath,
    req.method,
    JSON.stringify(originalBody),  // 原始请求
    JSON.stringify(jsonBody),      // 修改后
    JSON.stringify(matches),       // 匹配规则
    upstreamResponse.status,
    duration,
    JSON.stringify(Object.fromEntries(upstreamResponse.headers.entries())),
    null
  ]
);

// SSE推送
broadcastRequest({
  id: requestId,
  timestamp: Date.now(),
  client: route.client,
  path: upstreamPath,
  method: req.method
});
```

### 2. 新增 API 处理模块

**创建文件**：`src/promptxy/api-server.ts`

```typescript
import http from 'node:http';
import { Database } from 'sqlite';
import { PromptxyConfig } from './types.js';

export function createApiServer(db: Database, config: PromptxyConfig) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    // SSE端点
    if (url.pathname === '/_promptxy/events') {
      handleSSE(req, res);
      return;
    }

    // 请求历史
    if (url.pathname === '/_promptxy/requests') {
      await handleGetRequests(req, res, db, url);
      return;
    }

    // 请求详情
    if (url.pathname.startsWith('/_promptxy/requests/')) {
      const id = url.pathname.split('/').pop();
      await handleGetRequest(req, res, db, id!);
      return;
    }

    // 配置读取
    if (url.pathname === '/_promptxy/config' && req.method === 'GET') {
      await handleGetConfig(req, res, config);
      return;
    }

    // 配置同步
    if (url.pathname === '/_promptxy/config/sync' && req.method === 'POST') {
      await handleConfigSync(req, res, config);
      return;
    }

    // 清理数据
    if (url.pathname === '/_promptxy/requests/cleanup' && req.method === 'POST') {
      await handleCleanup(req, res, db, url);
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });
}

// SSE处理
const sseConnections = new Set<http.ServerResponse>();

function handleSSE(req: http.IncomingMessage, res: http.ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  sseConnections.add(res);

  req.on('close', () => {
    sseConnections.delete(res);
  });
}

// 广播请求事件
export function broadcastRequest(data: any) {
  for (const res of sseConnections) {
    res.write(`event: request\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

// 其他处理函数...
```

### 3. 修改 main.ts

```typescript
import { loadConfig } from "./promptxy/config.js";
import { createGateway } from "./promptxy/gateway.js";
import { initializeDatabase } from "./promptxy/database.js";
import { createApiServer } from "./promptxy/api-server.js";

async function main() {
  const config = await loadConfig();

  // 初始化数据库
  const db = await initializeDatabase();

  // 创建主代理服务器
  const gatewayServer = createGateway(config, db);

  // 创建API服务器（可选：可以合并到同一个端口）
  const apiServer = createApiServer(db, config);

  const { host, port } = config.listen;

  gatewayServer.listen(port, host, () => {
    console.log(`PromptXY Gateway on http://${host}:${port}`);
  });

  // API在port+1端口，或合并到同一端口
  apiServer.listen(port + 1, host, () => {
    console.log(`PromptXY API on http://${host}:${port + 1}`);
  });
}
```

---

## 🎯 数据清理策略

### 自动清理（后端定时任务）

```typescript
// 在main.ts启动定时任务
import { setInterval } from 'timers';

function startAutoCleanup(db: Database) {
  // 每小时检查一次
  setInterval(async () => {
    try {
      const maxHistory = 100;

      // 删除旧数据
      await db.run(`
        DELETE FROM requests
        WHERE id NOT IN (
          SELECT id FROM requests
          ORDER BY timestamp DESC
          LIMIT ?
        )
      `, [maxHistory]);

      console.log(`[Cleanup] 保留最近 ${maxHistory} 条请求`);
    } catch (error) {
      console.error('[Cleanup] 失败:', error);
    }
  }, 60 * 60 * 1000); // 每小时
}
```

---

## 📝 后端实现清单

### 需要创建的文件
- [ ] `src/promptxy/database.ts` - 数据库初始化与操作
- [ ] `src/promptxy/api-server.ts` - API服务器
- [ ] 修改 `src/promptxy/gateway.ts` - 添加请求记录与SSE推送
- [ ] 修改 `src/main.ts` - 启动API服务器

### 需要安装的依赖
```bash
npm install sqlite3
npm install sqlite  # TypeScript封装
```

### 需要修改的配置
- package.json: 添加依赖
- tsconfig.json: 确认类型支持

---

## ✅ 验证清单

### API测试
```
1. GET /_promptxy/config
   ✓ 返回当前配置

2. POST /_promptxy/config/sync
   ✓ 更新规则并立即生效

3. GET /_promptxy/events
   ✓ 连接SSE，等待新请求

4. CLI发起请求
   ✓ 后端记录到SQLite
   ✓ SSE推送事件
   ✓ GET /_promptxy/requests 能看到记录

5. GET /_promptxy/requests/:id
   ✓ 返回完整详情，包含原始和修改后请求

6. POST /_promptxy/requests/cleanup
   ✓ 删除旧数据，保留最近100条
```

### 数据验证
```
✓ SQLite数据库在 ~/.local/promptxy/promptxy.db
✓ config.json在 ~/.local/promptxy/config.json
✓ 请求记录包含原始和修改后数据
✓ matched_rules正确记录
✓ SSE实时推送正常工作
```

---

**文档版本**: v1.0
**创建日期**: 2025-12-20
**状态**: 待实现
