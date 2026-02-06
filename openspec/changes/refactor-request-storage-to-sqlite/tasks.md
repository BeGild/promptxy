# Tasks: 将请求历史存储从 YAML 文件重构为 SQLite

## 0. 基线确认

- [ ] 0.1 梳理当前请求历史 API 的调用链与返回结构（list/detail/paths/stats/cleanup/delete）
- [ ] 0.2 记录当前 `search` 语义（以 `/` 开头为路径前缀，否则为 id/path 模糊匹配）
- [ ] 0.3 确认前端未依赖 `requests/*.yaml` 或索引文件的存在（仅依赖 `/_promptxy/*` API）

## 1. 引入 SQLite 存储层（最小可用）

- [ ] 1.1 新增 SQLite 连接封装（`sqlite3` + Promise 化 `run/get/all`）
- [ ] 1.2 启动时初始化数据库文件与 schema（建表、建索引、PRAGMA）
- [ ] 1.3 实现插入请求：`requests` + `request_payloads` 同事务写入

## 2. 查询与 API 兼容层

- [ ] 2.1 实现列表查询（limit/offset/client/time-range/search/排序）并保持返回结构一致
- [ ] 2.2 实现详情查询（按 id join payload）
- [ ] 2.3 实现唯一路径查询（支持 prefix）
- [ ] 2.4 实现统计查询（total/byClient/recent 24h），并确保与现有字段兼容

## 3. 清理与删除

- [ ] 3.1 实现 `max_history` 超限自动清理（删除最旧记录）
- [ ] 3.2 实现手动清理（保留最新 N 条）
- [ ] 3.3 实现单条删除（并联动删除 payload）

## 4. 兼容性与降级策略

- [ ] 4.1 保持导出函数签名不变（`database.ts` 对外 API 不改）
- [ ] 4.2 数据库写入失败时仅记录错误，不影响请求转发响应（最佳努力）
- [ ] 4.3 处理 `rebuild-index` API：在 SQLite 模式下返回“无需重建/已完成检查”（保持接口可用但不再扫描 YAML）

## 5. 测试与验证

- [ ] 5.1 单测：插入一条请求后，list/detail/paths/stats 返回符合预期
- [ ] 5.2 单测：`search` 语义（路径前缀 vs 模糊匹配）与时间范围过滤
- [ ] 5.3 单测：cleanup/delete 的行为与计数一致
- [ ] 5.4 本地验证：`./scripts/dev.sh &` 启动后打开页面，确认启动延迟显著降低且功能可用

## 6. 文档

- [ ] 6.1 更新 `openspec/specs/request-viewer/spec.md`（在归档阶段完成 specs 真值更新）
- [ ] 6.2 更新 README/排障文档：说明请求历史存储位置变更为 SQLite（开发阶段不迁移旧数据）

