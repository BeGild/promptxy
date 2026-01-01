# Change: 将请求存储从 SQLite 重构为文件系统

## Why

当前使用 sql.js (SQLite) 存储请求记录存在严重的数据库损坏问题。由于 sql.js 是内存数据库，每次写入需要 export 整个数据库到文件，这个过程容易因程序异常退出导致数据损坏。改为文件系统存储后，每个请求作为独立文件存储，具有以下优势：
1. 单个文件损坏不影响其他数据
2. 写入原子性更好（写临时文件后 rename）
3. 便于调试和手动检查
4. 避免数据库锁和并发问题

## What Changes

- **移除 sql.js 依赖**，使用纯文件系统存储
- 请求记录存储为 YAML 格式文件，减少 JSON 转义问题
- 采用**索引 + 按需加载**架构：内存中只保留轻量级索引，详情文件按需读取
- 请求 ID 使用人类可读时间格式：`YYYY-MM-DD_HH-mm-ss-SSS_random`（与前端显示格式一致）
- 新增 LRU 缓存机制，缓存最近访问的详情文件（默认 50 条）
- 自动清理逻辑保留最新的 N 条记录（默认 1000 条）

### 数据目录结构
```
~/.local/promptxy/
├── requests/                    # 请求详情文件（YAML格式）
│   └── {id}.yaml               # 如: 2025-01-15_14-30-25-123_a1b2c3.yaml
├── indexes/                     # 索引文件
│   ├── timestamp.idx           # 时间排序索引
│   ├── paths.idx               # 路径列表索引
│   └── stats.json              # 统计缓存
└── settings.json                # 设置文件
```

### 性能指标
- 启动加载：只加载索引，约 200KB（1000条记录）
- 内存占用：约 50MB 峰值（索引 + 50个缓存详情文件）
- 查询响应：毫秒级（纯内存操作）
- 单请求大小：支持 300KB+

## Impact

### 受影响的规范
- `specs/request-viewer/spec.md` - 修改请求持久化相关需求

### 受影响的代码
- `backend/src/promptxy/database.ts` - **完全重写**，核心改造
- `backend/package.json` - 移除 `sql.js`，添加 `js-yaml`
- `backend/src/promptxy/api-handlers.ts` - 接口保持不变，但内部调用变化
- `backend/src/promptxy/gateway.ts` - 调用方式不变
- `backend/src/main.ts`, `backend/src/cli-entry.ts` - 初始化调用不变

### 破坏性变更
- **代码层面彻底移除 SQLite**：所有 sql.js 相关代码将被删除
- **无需迁移旧数据**：直接废弃 SQLite 存储，首次启动创建新结构
- **无回退计划**：开发阶段，简化代码库为目标
- 旧的 `promptxy.db` 文件将自然保留，不做任何处理
