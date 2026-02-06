# Design: 将请求历史存储从 YAML 文件重构为 SQLite

## 目标与范围

### 目标

- **稳定启动时间**：启动时不再扫描历史目录、不再加载全量索引/统计缓存；只完成 DB open + schema/索引检查。
- **保持 API 兼容**：对外导出函数（以及 `/_promptxy/*` API 返回结构）保持兼容，前端无感。
- **简化实现与运维**：以 SQLite 替代自建索引/缓存文件，减少“索引损坏/重建”等维护逻辑。

### 不在范围内

- YAML → SQLite 迁移（历史数据可丢弃）。
- 将 settings 迁入 SQLite（继续 `settings.json`）。
- 旁路日志与外部导出能力（后续可另提案）。

## 现状简述（用于对齐问题）

当前存储实现为文件系统持久化：

- 请求详情：`~/.local/promptxy/requests/{id}.yaml`
- 索引：`~/.local/promptxy/indexes/timestamp.idx`、`paths.idx`
- 统计缓存：`~/.local/promptxy/indexes/stats*.json`
- 启动流程需要读取索引/统计缓存（并在异常时可能扫描 `requests/` 重建索引）。

该形态的主要性能风险集中在：

- 大量小文件 IO 与 YAML 解析
- 启动阶段“必须完成索引准备”导致的延迟与波动
- 自维护索引/缓存逻辑带来的复杂度与一致性风险

## 总体方案

### 方案概览

- 引入 SQLite 作为请求历史主存储：`~/.local/promptxy/promptxy.db`
- 保留 `settings.json` 与进程锁（`.lock`）机制（尽量少动不相关部分）
- 把“内存索引 + 文本索引文件”的职责替换为“SQLite 索引 + SQL 查询”

### 驱动选择

采用 `sqlite3`（异步 API）以减少 event loop 阻塞风险，适配“几十 QPS 的网关写入 + 频繁读取列表/统计”的使用方式。

## 数据模型与 Schema

### 设计原则

- **轻重分离**：列表/过滤/统计走轻量列，详情大字段按需读取。
- **写入一次，读取多次**：为常用查询建立必要索引，避免未来性能回退。
- **最小 schema 版本化**：使用 `PRAGMA user_version` 或 `meta` 表记录 schema 版本，支持未来小步演进。

### 表设计（建议）

#### 表：`requests`（轻量元数据）

包含列表/过滤/统计需要的字段（示例列）：

- `id TEXT PRIMARY KEY`
- `ts INTEGER NOT NULL`
- `client TEXT NOT NULL`
- `path TEXT NOT NULL`
- `method TEXT NOT NULL`
- `status INTEGER`
- `duration_ms INTEGER`
- `request_size INTEGER`
- `response_size INTEGER`
- `supplier_name TEXT`
- `supplier_client TEXT`
- `route_id TEXT`
- `requested_model TEXT`
- `upstream_model TEXT`
- `billing_model TEXT`
- `cached_input_tokens INTEGER`
- `input_tokens INTEGER`
- `output_tokens INTEGER`
- `total_tokens INTEGER`
- `total_cost REAL`
- `usage_source TEXT`
- `error TEXT`

#### 表：`request_payloads`（详情大字段）

按 `id` 与 `requests` 关联：

- `id TEXT PRIMARY KEY REFERENCES requests(id) ON DELETE CASCADE`
- `original_body TEXT NOT NULL`
- `transformed_body TEXT`
- `modified_body TEXT NOT NULL`
- `request_headers TEXT`
- `original_request_headers TEXT`
- `response_headers TEXT`
- `response_body TEXT`
- `matched_rules TEXT NOT NULL`
- `transform_trace TEXT`
- `supplier_base_url TEXT`
- `transformer_chain TEXT`
- `transformed_path TEXT`

### 索引设计（最小集合）

- `requests(ts DESC)`：支撑默认列表（按时间倒序）与分页
- `requests(client, ts DESC)`：支撑 client 过滤
- `requests(path, ts DESC)`：支撑路径前缀检索与路径维度统计

后续如统计维度扩大，可按 `supplier_name`、`billing_model`、`route_id` 增补索引。

## 查询与 API 映射

### 列表查询（原：内存索引过滤）

映射为 SQL：

- `client`：`WHERE client = ?`
- `startTime/endTime`：`WHERE ts BETWEEN ? AND ?`
- `search`：
  - 若以 `/` 开头：路径前缀 `WHERE path LIKE '/prefix%'`
  - 否则：ID/路径模糊 `WHERE id LIKE '%q%' OR path LIKE '%q%'`（建议使用 `COLLATE NOCASE` 保持大小写不敏感的体验）
- 排序：`ORDER BY ts DESC`
- 分页：`LIMIT ? OFFSET ?`

### 详情查询

- `SELECT ... FROM requests LEFT JOIN request_payloads USING(id) WHERE id = ?`
- 可选：保留一层轻量内存缓存（非必须，优先简化）

### 唯一路径列表

- `SELECT DISTINCT path FROM requests WHERE path LIKE ? ORDER BY path ASC`

### 统计（最小实现）

优先采用 SQL 即时聚合，以降低实现复杂度并保证与清理一致：

- 总数：`COUNT(*)`
- 最近 24 小时：`COUNT(*) WHERE ts > now-24h`
- 按 client：`GROUP BY client`

更细统计（daily/hourly/supplier/model/route）仍可通过 `strftime()` + `GROUP BY` 获得；如后续性能/延迟成为问题，再引入物化聚合表单独演进。

## 写入、清理与一致性

### 写入事务

每条请求写入建议使用单事务：

1. `INSERT INTO requests ...`
2. `INSERT INTO request_payloads ...`

保证元数据与详情同步落库（原子性）。

### 清理（max_history）

保持“只保留最新 N 条”的语义：

- 通过 SQL 找出超出 keep 的最旧记录并删除
- 依赖外键 `ON DELETE CASCADE` 自动删除对应 payload

### 完整性与故障隔离

SQLite 依赖事务、WAL 与原子提交保证一致性。需要额外约束：

- 如果数据库写入失败：记录错误日志，但不影响请求转发响应（最佳努力写入）。
- 启动时数据库不可用：API 仍可启动，但请求历史相关 API 返回错误/空（是否 hard-fail 由实现阶段确认；本提案建议“网关可用优先”）。

## 运维与工程化约束

### PRAGMA 建议

- `journal_mode=WAL`
- `synchronous=NORMAL`
- `foreign_keys=ON`
- `busy_timeout=5000`

### 依赖与发布

新增 `sqlite3`（native 依赖），需要在 CI/发布中确保可构建或使用预编译包。该成本换取更稳定的查询与启动性能。

## 与现有 OpenSpec 的关系

现有 `request-viewer` spec 中包含对“YAML 文件存储、索引文件格式、LRU 缓存”等硬性描述。本变更将通过 spec delta 将其替换为 SQLite 语义，同时保持对外 API 兼容要求不变。

