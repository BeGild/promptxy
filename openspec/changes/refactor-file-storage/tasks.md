## 1. 依赖和环境准备

- [x] 1.1 移除 sql.js 依赖 (`npm uninstall sql.js`)
- [x] 1.2 安装 js-yaml (`npm install js-yaml`)
- [x] 1.3 安装 js-yaml 类型定义 (`npm install -D @types/js-yaml`)

## 2. 核心存储实现

- [x] 2.1 创建 `FileSystemStorage` 类骨架
- [x] 2.2 实现 ID 生成函数 `generateRequestId()`
- [x] 2.3 实现 ID 与时间戳互转函数
- [x] 2.4 实现 `initialize()` - 加载索引到内存
- [x] 2.5 实现 `atomicWrite()` - 原子写入文件
- [x] 2.6 实现 `insert()` - 写入请求文件 + 更新索引 + 自动清理
- [x] 2.7 实现 `query()` - 内存过滤 + 分页
- [x] 2.8 实现 `getDetail()` - LRU 缓存 + 按需加载
- [x] 2.9 实现 `getUniquePaths()` - 从路径缓存读取
- [x] 2.10 实现 `cleanupOld()` - 清理旧记录
- [x] 2.11 实现 `delete()` - 删除单个请求
- [x] 2.12 实现 `getStats()` - 统计信息

## 3. 设置和元数据

- [x] 3.1 实现 `getSetting()` / `getAllSettings()` / `updateSetting()`
- [x] 3.2 实现 `getFilteredPaths()` / `shouldFilterPath()`
- [x] 3.3 实现统计缓存更新
- [x] 3.4 实现索引文件持久化

## 4. 索引管理

- [x] 4.1 实现索引文件加载 (`loadIndex`)
- [x] 4.2 实现路径索引加载 (`loadPathIndex`)
- [x] 4.3 实现索引更新 (`updateIndex`)
- [x] 4.4 实现索引重建功能 (`rebuildIndex`)
- [x] 4.5 实现索引持久化 (`flushIndex`)

## 5. LRU 缓存实现

- [x] 5.1 实现 `LRUCache` 类
- [x] 5.2 集成 LRU 缓存到 `getDetail()`
- [x] 5.3 集成 LRU 缓存到 `insert()`

## 6. YAML 序列化

- [x] 6.1 实现 `writeRequestFile()` - YAML 写入
- [x] 6.2 实现 `loadRequestFile()` - YAML 读取
- [x] 6.3 处理大字段的多行字符串格式

## 7. API 兼容层

- [x] 7.1 实现 `initializeDatabase()` - 新存储的初始化入口
- [x] 7.2 实现 `saveDatabase()` - 空操作（文件系统自动持久化）
- [x] 7.3 实现 `getDatabase()` - 返回存储实例（保持兼容）
- [x] 7.4 导出所有现有函数签名

## 8. 类型兼容

- [x] 8.1 更新 api-handlers.ts 中的 Database 类型为 FileSystemStorage
- [x] 8.2 更新 gateway.ts 中的 Database 类型为 FileSystemStorage
- [x] 8.3 验证 TypeScript 编译通过

## 9. 测试

- [ ] 9.1 单元测试：ID 生成和解析
- [ ] 9.2 单元测试：LRU 缓存
- [ ] 9.3 单元测试：索引加载和更新
- [ ] 9.4 单元测试：查询和过滤
- [ ] 9.5 单元测试：YAML 序列化/反序列化
- [ ] 9.6 集成测试：插入和查询流程
- [ ] 9.7 集成测试：自动清理
- [ ] 9.8 集成测试：API 端点

## 10. 验证和调优

- [ ] 10.1 验证启动时间（加载 1000 条索引）
- [ ] 10.2 验证内存占用（应 < 100MB）
- [ ] 10.3 验证查询响应时间（应 < 100ms）
- [ ] 10.4 验证大请求处理（300KB+）
- [ ] 10.5 验证文件格式可读性
- [ ] 10.6 验证并发写入稳定性
