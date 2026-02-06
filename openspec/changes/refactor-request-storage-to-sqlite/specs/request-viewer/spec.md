## ADDED Requirements

### Requirement: 请求历史使用 SQLite 持久化

系统 SHALL 使用 SQLite（嵌入式单文件数据库）持久化请求历史，以提供稳定启动时间与可扩展的查询能力。

#### Scenario: SQLite 数据库文件位置

- **WHEN** 请求历史存储被初始化
- **THEN** 系统在用户主目录下创建/打开数据库文件 `~/.local/promptxy/promptxy.db`
- **AND THEN** 如果数据库文件不存在，系统自动创建

#### Scenario: 启动时不扫描历史数据

- **WHEN** 系统启动
- **THEN** 系统仅打开 SQLite 并确保 schema/索引存在
- **AND THEN** 系统不扫描历史目录、不解析 YAML 文件
- **AND THEN** 启动时间应保持稳定（目标 < 1 秒）

### Requirement: 存储失败不影响网关转发

系统 SHALL 将请求历史写入失败视为非致命错误，避免影响网关代理的主路径。

#### Scenario: 数据库写入失败时的降级

- **GIVEN** 数据库不可写（例如权限不足或磁盘满）
- **WHEN** 系统尝试记录请求历史
- **THEN** 系统记录错误日志用于排查
- **AND THEN** 请求转发响应仍按正常流程返回给客户端

---

## MODIFIED Requirements

### Requirement: 请求记录文件系统持久化

系统 SHALL 使用 SQLite 存储请求记录。请求 ID 生成规则保持不变，但请求详情不再以独立 YAML 文件形式存储。

#### Scenario: 请求持久化格式（MODIFIED）

- **WHEN** 一个请求被持久化
- **THEN** 该请求的元数据写入 SQLite 表（用于列表/过滤/统计）
- **AND THEN** 该请求的详情字段写入 SQLite 表（用于详情查询）

### Requirement: 索引与按需加载

系统 SHALL 依赖 SQLite 的索引能力支持按需查询，避免启动时构建/加载全量内存索引；请求详情按需读取。

#### Scenario: 列表查询通过 SQL（MODIFIED）

- **WHEN** 请求列表被查询
- **THEN** 系统通过 SQL 查询返回按时间戳倒序的结果
- **AND THEN** 支持分页（limit/offset）与过滤（client/时间范围/search）

#### Scenario: 详情按需读取（MODIFIED）

- **WHEN** 请求详情被查询
- **THEN** 系统通过 SQL 按 id 查询并返回完整记录
- **AND THEN** 系统不要求在启动时预加载任何详情数据

### Requirement: 文件格式和目录结构

系统 SHALL 使用标准化的本地目录结构存放请求历史数据库与设置文件。

#### Scenario: 存储目录结构（MODIFIED）

- **WHEN** 本地存储被初始化
- **THEN** 创建/使用以下结构：
  ```
  ~/.local/promptxy/
  ├── promptxy.db            # SQLite 请求历史数据库
  ├── settings.json          # 设置文件（保持现状）
  └── .lock                  # 进程互斥锁（保持现状）
  ```

### Requirement: 原子写入和数据完整性

系统 SHALL 使用 SQLite 事务确保写入的原子性与一致性。

#### Scenario: 单条请求写入原子性（MODIFIED）

- **WHEN** 系统写入一条请求历史
- **THEN** 元数据与详情字段在同一事务中提交
- **AND THEN** 事务失败时不产生部分写入的数据

### Requirement: 查询性能和内存效率

系统 SHALL 使用数据库索引提供快速查询，并避免通过加载全量索引占用内存。

#### Scenario: 启动时不加载内存索引（MODIFIED）

- **WHEN** 系统运行
- **THEN** 不要求在内存中维护全量请求索引
- **AND THEN** 列表/过滤/统计通过 SQL 查询完成

### Requirement: 自动清理和容量管理

系统 SHALL 通过数据库删除语义实现容量管理。

#### Scenario: 插入时自动清理（MODIFIED）

- **WHEN** 新请求被插入且总记录数超过 maxHistory
- **THEN** 系统删除最旧记录直至满足保留数量
- **AND THEN** 请求详情与元数据同步删除

---

## REMOVED Requirements

### Requirement: 请求记录文件系统持久化（YAML 细节）

移除对“每条请求一个 YAML 文件、YAML 多行字符串语法、索引文本文件格式（timestamp.idx/paths.idx/stats.json）”的强制要求，改由 SQLite schema 与索引实现对应能力。
