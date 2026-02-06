# Change: 将请求历史存储从 YAML 文件重构为 SQLite

## Why

当前请求历史存储采用「每条请求一个 YAML 文件 + 索引文本文件 + 启动时加载索引/统计缓存」的方式。该方案在人类可读性上有优势，但会带来明显的工程性问题：

- **启动路径不可控**：启动时需要读取/解析多个文本文件（索引、统计缓存），并在某些情况下扫描 `requests/` 目录重建索引，导致启动延迟和波动。
- **小文件 IO + 文本解析开销**：大量 YAML 文件会放大文件系统开销；同时 YAML/JSON 解析会占用 CPU，进一步影响服务启动与响应稳定性。
- **查询能力受限**：当前列表/过滤/统计基于内存索引与自定义缓存，功能扩展（更多维度统计、复杂筛选）会持续增加实现复杂度。

本变更将存储层重构为 SQLite（嵌入式单文件数据库），以提供更稳定的启动时间、可维护的查询能力和更成熟的数据完整性保证。

## What Changes

- 将请求历史主存储从 `~/.local/promptxy/requests/{id}.yaml` 替换为 `~/.local/promptxy/promptxy.db`（SQLite）。
- 将“索引文件（timestamp.idx/paths.idx/stats*.json）+ 启动加载索引/缓存”的机制替换为：
  - 启动时仅打开数据库并确保 schema/索引存在（不扫描历史、不预加载全量数据）。
  - 列表/详情/唯一路径/统计通过 SQL 查询获得结果。
- 保持对外 API 兼容（函数签名与 JSON 返回结构保持一致），前端与上层调用方无需修改。
- 采用“无迁移策略”：现有 YAML 历史记录不再读取；开发阶段允许丢弃历史数据。

## Non-Goals

- 不提供 YAML → SQLite 的迁移工具或自动迁移流程。
- 不新增旁路日志（NDJSON/YAML）用于调试；请求历史仅存 SQLite。
- 不在本次变更中把 `settings.json` 迁移到 SQLite（仍保留现有 settings 文件，降低改动面）。
- 不在本次变更中对统计系统做“物化聚合表/增量聚合”的复杂优化（优先采用 SQL 即时聚合；如后续需要再单独提案）。

## Impact

- Affected specs:
  - `request-viewer`（请求历史的持久化介质、索引/按需加载、原子性与完整性机制、查询方式）
- Affected code (implementation stage):
  - 后端：`backend/src/promptxy/database.ts`（存储实现替换/重构）
  - 可能新增：`backend/src/promptxy/sqlite/*` 或类似模块（SQLite 连接与查询封装）
  - 依赖：新增 `sqlite3`（native 依赖）

## Rollout / Compatibility

- 默认创建新数据库文件（若不存在则自动创建），旧的 `requests/` 与 `indexes/` 内容保留但不再读取。
- 如数据库不可用或写入失败，系统应降级为“请求转发不受影响、历史记录尽力写入”（最佳努力），避免影响网关主功能。

## Risks / Trade-offs

- 引入 `sqlite3` 依赖可能影响安装/发布体验（native 构建/预编译包）。该风险在“长期可维护性优先”的前提下可接受。
- 单文件数据库相对于“每条请求一个文件”的故障隔离不同：SQLite 依赖事务与 WAL 保证一致性，但数据库文件损坏的影响面更集中。

## Open Questions

- 数据库文件路径是否固定为 `~/.local/promptxy/promptxy.db`，还是需要更通用的跨平台目录策略（本提案默认沿用当前 `~/.local/promptxy/` 约定以最小化变更）。

