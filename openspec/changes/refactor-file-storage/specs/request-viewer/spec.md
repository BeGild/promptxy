## ADDED Requirements

### Requirement: 请求记录文件系统持久化

系统 SHALL 使用文件系统存储请求记录，每个请求存储为独立的 YAML 格式文件，并使用人类可读的时间戳作为文件标识。

#### Scenario: 请求文件格式

- **WHEN** 一个请求被持久化到文件系统
- **THEN** 文件存储在 `~/.local/promptxy/requests/` 目录下
- **AND THEN** 文件名为 `{id}.yaml`，其中 ID 格式为 `YYYY-MM-DD_HH-mm-ss-SSS_random`
- **AND THEN** 文件内容为 YAML 格式，包含所有请求字段
- **AND THEN** 大字段（originalBody, modifiedBody, responseBody）使用 YAML 多行字符串语法（`|`）避免转义

#### Scenario: 请求 ID 生成

- **WHEN** 生成新的请求 ID
- **THEN** ID 格式为 `YYYY-MM-DD_HH-mm-ss-SSS_random`
- **EXAMPLE**: `2025-01-15_14-30-25-123_a1b2c3`
- **AND THEN** 日期部分使用本地时区
- **AND THEN** 时间部分使用 `-` 分隔（避免 Windows 文件系统问题）
- **AND THEN** 毫秒部分精确到 3 位
- **AND THEN** 随机部分为 6 位字符

#### Scenario: 请求 ID 解析为时间戳

- **WHEN** 需要从请求 ID 解析时间戳
- **THEN** 系统能够解析 ID 中的日期时间部分
- **AND THEN** 返回对应的 Unix 时间戳（毫秒）

### Requirement: 索引与按需加载

系统 SHALL 在内存中维护轻量级索引，详情文件按需加载，以平衡内存占用和查询性能。

#### Scenario: 启动时只加载索引

- **WHEN** 系统启动
- **THEN** 只加载索引文件到内存（约 60KB，1000 条记录）
- **AND THEN** 不加载请求详情文件
- **AND THEN** 启动时间应 < 1 秒

#### Scenario: 索引结构

- **WHEN** 内存中的索引被构建
- **THEN** 每条索引包含：id, timestamp, client, path, method, requestSize, responseSize, responseStatus, durationMs, error, matchedRulesBrief
- **AND THEN** 索引按时间戳倒序排列
- **AND THEN** 索引只占用约 60 字节/条

#### Scenario: 详情文件按需加载

- **WHEN** 请求详情被查询
- **THEN** 系统首先检查 LRU 缓存
- **AND THEN** 如果缓存命中，直接返回（< 1ms）
- **AND THEN** 如果缓存未命中，从文件系统加载 YAML 文件
- **AND THEN** 加载后更新 LRU 缓存

#### Scenario: LRU 缓存管理

- **WHEN** 详情文件被加载
- **THEN** 文件内容被缓存到 LRU 缓存
- **AND THEN** 缓存大小默认为 50 个文件
- **AND THEN** 缓存满时自动淘汰最久未使用的条目
- **AND THEN** 内存占用约 15MB（50 × 300KB）

### Requirement: 文件格式和目录结构

系统 SHALL 使用标准化的文件格式和目录结构存储请求记录和索引。

#### Scenario: 目录结构

- **WHEN** 文件系统存储被初始化
- **THEN** 创建以下目录结构：
  ```
  ~/.local/promptxy/
  ├── requests/              # 请求详情文件
  │   └── {id}.yaml
  ├── indexes/               # 索引文件
  │   ├── timestamp.idx
  │   ├── paths.idx
  │   └── stats.json
  └── settings.json          # 设置文件
  ```

#### Scenario: 时间索引文件格式

- **WHEN** 时间索引文件被写入
- **THEN** 文件路径为 `indexes/timestamp.idx`
- **AND THEN** 每行格式为：`timestamp|id|client|path|method|reqSize|respSize|status|duration|error|rules`
- **AND THEN** 行按时间戳倒序排列
- **EXAMPLE**: `1736898625123|2025-01-15_14-30-25-123_a1b2c3|claude|/v1/messages|POST|1024|2048|200|1234||["rule-001"]`

#### Scenario: 路径索引文件格式

- **WHEN** 路径索引文件被写入
- **THEN** 文件路径为 `indexes/paths.idx`
- **AND THEN** 每行一个唯一的路径
- **AND THEN** 路径按字母顺序排列

#### Scenario: 统计缓存文件格式

- **WHEN** 统计缓存文件被写入
- **THEN** 文件路径为 `indexes/stats.json`
- **AND THEN** 内容为 JSON 格式，包含 byClient, lastCleanup 等字段

### Requirement: 原子写入和数据完整性

系统 SHALL 使用原子写入操作确保数据完整性，单个文件损坏不应影响其他数据。

#### Scenario: 请求文件原子写入

- **WHEN** 写入请求文件
- **THEN** 首先写入临时文件 `{id}.yaml.tmp`
- **AND THEN** 然后使用 `rename()` 原子性地替换目标文件
- **AND THEN** 如果写入失败，临时文件被清理

#### Scenario: 索引文件更新

- **WHEN** 新请求被插入
- **THEN** 请求文件首先被写入
- **AND THEN** 然后更新内存索引
- **AND THEN** 最后异步持久化索引文件
- **AND THEN** 如果索引损坏，可以从 requests/ 目录重建

#### Scenario: 单点故障隔离

- **WHEN** 单个请求文件损坏
- **THEN** 其他请求文件不受影响
- **AND THEN** 系统可以继续正常工作
- **AND THEN** 损坏的文件被记录到日志

### Requirement: 查询性能和内存效率

系统 SHALL 在有限的内存占用下提供快速的查询响应。

#### Scenario: 列表查询纯内存操作

- **WHEN** 请求列表被查询
- **THEN** 查询完全在内存中进行（索引过滤）
- **AND THEN** 响应时间应 < 100ms
- **AND THEN** 不需要读取任何详情文件

#### Scenario: 过滤和排序

- **WHEN** 列表查询包含过滤条件（client, 时间范围, 搜索）
- **THEN** 过滤在内存索引上进行
- **AND THEN** 结果保持按时间戳倒序
- **AND THEN** 支持分页（limit/offset）

#### Scenario: 内存占用限制

- **WHEN** 系统运行时
- **THEN** 总内存占用应 < 100MB
- **AND THEN** 包含索引（60KB）+ LRU 缓存（约 15MB）+ 其他开销

#### Scenario: 路径查询缓存

- **WHEN** 唯一路径列表被查询
- **THEN** 从内存中的 Set 直接返回
- **AND THEN** 响应时间 < 10ms
- **AND THEN** 支持前缀过滤

### Requirement: 自动清理和容量管理

系统 SHALL 自动清理旧记录，保持存储在配置的限制范围内。

#### Scenario: 插入时自动清理

- **WHEN** 新请求被插入
- **AND THEN** 总记录数超过 maxHistory（默认 1000）
- **THEN** 自动删除最旧的记录
- **AND THEN** 同时删除请求文件、从索引移除、从缓存移除

#### Scenario: 手动清理

- **WHEN** 用户触发手动清理
- **THEN** 保留最新的 N 条记录（参数指定）
- **AND THEN** 删除多余的请求文件
- **AND THEN** 更新索引和缓存

### Requirement: 兼容性保证

系统 SHALL 保持 API 接口兼容，现有的 API 调用者无需修改代码。

#### Scenario: 导出函数签名不变

- **WHEN** 现有代码调用数据库函数
- **THEN** 所有导出函数的签名保持不变
- **AND THEN** 包括：`initializeDatabase()`, `insertRequestRecord()`, `getRequestList()`, `getRequestDetail()`, `getUniquePaths()`, `cleanupOldRequests()`, `deleteRequest()`, `getRequestStats()`, `getSetting()`, `updateSetting()`, 等

#### Scenario: 返回值格式兼容

- **WHEN** API 函数被调用
- **THEN** 返回值格式与之前完全一致
- **AND THEN** 包括 `RequestListResponse`, `PathsResponse`, `RequestRecord` 等

## REMOVED Requirements

### Requirement: SQLite 数据库持久化

**Reason**: sql.js 内存数据库存在严重的损坏风险，每次写入需要 export 整个数据库，程序异常退出时容易导致数据丢失。文件系统存储提供更好的数据可靠性和原子写入保证。

**Migration**: 无迁移。代码层面彻底移除 SQLite，旧的 `promptxy.db` 文件自然保留，不做任何处理。
