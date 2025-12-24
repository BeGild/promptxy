## ADDED Requirements

### Requirement: 供应商配置模型

配置文件 SHALL 使用供应商数组模型，每个供应商包含唯一标识、名称、上游地址、本地路径前缀、路径映射规则和启用状态。

#### Scenario: 基本供应商配置

- **GIVEN** 配置文件包含 suppliers 数组
- **WHEN** 服务启动
- **THEN** 配置加载成功，供应商初始化完成

#### Scenario: 多个供应商配置

- **GIVEN** 配置文件包含 3 个供应商
- **WHEN** 配置加载
- **THEN** 3 个供应商全部加载到内存

### Requirement: 本地路径前缀路由

网关 SHALL 根据请求路径匹配已启用供应商的 `localPrefix`，提取 innerPath 后进行路径映射与转发。

#### Scenario: Claude 请求路由

- **GIVEN** 启用供应商 `{ localPrefix: "/claude", baseUrl: "https://api.anthropic.com", enabled: true }`
- **WHEN** 请求路径为 `/claude/v1/messages`
- **THEN** 匹配该供应商，innerPath 为 `/v1/messages`

#### Scenario: 测试供应商路由

- **GIVEN** 启用供应商 `{ localPrefix: "/test", baseUrl: "https://test.com", enabled: true }`
- **WHEN** 请求路径为 `/test/v1/chat`
- **THEN** 匹配该供应商，innerPath 为 `/v1/chat`

#### Scenario: 未匹配路径返回 404

- **GIVEN** 所有启用的供应商 localPrefix 都不匹配
- **WHEN** 请求路径为 `/unknown/path`
- **THEN** 返回 404 错误

### Requirement: 供应商启用状态管理

供应商 SHALL 支持 `enabled` 字段控制启用状态，只有 `enabled = true` 的供应商参与路由匹配。

#### Scenario: 禁用供应商不参与路由

- **GIVEN** 供应商 A `{ localPrefix: "/claude", enabled: false }`
- **AND** 供应商 B `{ localPrefix: "/claude", enabled: true }`
- **WHEN** 请求 `/claude/v1/messages`
- **THEN** 匹配供应商 B，而非 A

#### Scenario: 动态切换供应商

- **GIVEN** 供应商 A 原本启用
- **WHEN** 用户禁用 A，启用 B（相同 localPrefix）
- **THEN** 后续请求路由到 B

### Requirement: 路径冲突检测

配置验证时 SHALL 检测启用的供应商是否有相同的 `localPrefix`，如有冲突则拒绝配置。

#### Scenario: 允许相同前缀但不同时启用

- **GIVEN** 供应商 A `{ localPrefix: "/claude", enabled: true }`
- **AND** 供应商 B `{ localPrefix: "/claude", enabled: false }`
- **WHEN** 配置验证
- **THEN** 验证通过

#### Scenario: 拒绝同时启用相同前缀

- **GIVEN** 供应商 A `{ localPrefix: "/claude", enabled: true }`
- **AND** 供应商 B `{ localPrefix: "/claude", enabled: true }`
- **WHEN** 配置验证
- **THEN** 验证失败，返回冲突错误

### Requirement: 路径映射

网关 SHALL 支持配置路径映射规则，将 innerPath 转换为上游实际请求路径。

#### Scenario: 精确匹配映射

- **GIVEN** 配置 `{ "from": "/v1/messages", "to": "/v1/messages", "type": "exact" }`
- **WHEN** innerPath 为 `/v1/messages`
- **THEN** 映射后路径为 `/v1/messages`

#### Scenario: 前缀匹配映射

- **GIVEN** 配置 `{ "from": "/v1/", "to": "/api/v1/", "type": "prefix" }`
- **WHEN** innerPath 为 `/v1/messages`
- **THEN** 映射后路径为 `/api/v1/messages`

#### Scenario: 正则替换映射

- **GIVEN** 配置 `{ "from": "^/v1/([^/]+)$", "to": "/api/$1", "type": "regex" }`
- **WHEN** innerPath 为 `/v1/messages`
- **THEN** 映射后路径为 `/api/messages`

#### Scenario: 无映射时使用原路径

- **GIVEN** pathMappings 为空数组或不匹配
- **WHEN** innerPath 为 `/v1/messages`
- **THEN** 映射后路径为 `/v1/messages`

### Requirement: 路径映射顺序匹配

当配置多个路径映射规则时，网关 SHALL 按配置顺序遍历，使用第一个匹配的规则。

#### Scenario: 第一个匹配生效

- **GIVEN** pathMappings 包含多个规则
- **WHEN** innerPath 匹配第一个规则
- **THEN** 使用第一个规则的映射结果，忽略后续规则

### Requirement: 供应商管理 API

API SHALL 提供供应商的增删改查接口，支持启用/禁用操作。

#### Scenario: 获取所有供应商

- **WHEN** GET `/_promptxy/suppliers`
- **THEN** 返回所有供应商列表

#### Scenario: 添加新供应商

- **WHEN** POST `/_promptxy/suppliers` 带供应商数据
- **THEN** 创建供应商并返回

#### Scenario: 更新供应商

- **WHEN** PUT `/_promptxy/suppliers/:id` 带更新数据
- **THEN** 更新供应商并返回

#### Scenario: 删除供应商

- **WHEN** DELETE `/_promptxy/suppliers/:id`
- **THEN** 删除该供应商

#### Scenario: 切换启用状态

- **WHEN** POST `/_promptxy/suppliers/:id/toggle`
- **THEN** 切换供应商的 enabled 状态

### Requirement: UI 供应商管理界面

前端 SHALL 提供供应商管理界面，支持列表展示、添加、编辑、删除、启用/禁用操作。

#### Scenario: 供应商列表展示

- **WHEN** 用户访问供应商管理页面
- **THEN** 显示所有供应商，包括名称、localPrefix、baseUrl、enabled 状态

#### Scenario: 相同前缀用相同颜色标识

- **GIVEN** 有多个供应商使用相同 localPrefix
- **WHEN** 渲染供应商列表
- **THEN** 相同 localPrefix 的供应商显示相同颜色的角标

#### Scenario: 快速添加供应商

- **WHEN** 用户点击"添加供应商"
- **THEN** 显示表单，包含常用 localPrefix 快速选择

#### Scenario: 编辑供应商

- **WHEN** 用户点击供应商的编辑按钮
- **THEN** 显示编辑表单，预填充当前值

#### Scenario: 启用/禁用供应商

- **WHEN** 用户切换供应商的启用开关
- **THEN** 状态立即更新，路由配置同步生效

## MODIFIED Requirements

### Requirement: 配置文件结构

配置文件 SHALL 使用 `suppliers` 数组替代 `upstreams` 对象，每个供应商包含完整配置信息。

#### Scenario: 配置文件加载

- **GIVEN** 配置文件包含 `suppliers` 数组
- **WHEN** 服务启动加载配置
- **THEN** 所有供应商加载成功

#### Scenario: 配置文件保存

- **GIVEN** 用户修改供应商配置并保存
- **WHEN** 保存操作执行
- **THEN** 配置写入文件，立即生效

### Requirement: 路由识别

网关 SHALL 根据已启用供应商的 `localPrefix` 识别请求来源，而非固定的客户端类型。

#### Scenario: 按前缀长度优先匹配

- **GIVEN** 启用供应商 A `{ localPrefix: "/api/v1/claude" }`
- **AND** 启用供应商 B `{ localPrefix: "/api" }`
- **WHEN** 请求 `/api/v1/claude/messages`
- **THEN** 优先匹配供应商 A（前缀更长）

#### Scenario: 动态路由表

- **GIVEN** 有 5 个启用的供应商
- **WHEN** 配置更新（启用/禁用供应商）
- **THEN** 路由表立即重新构建

## REMOVED Requirements

### Requirement: 旧版 upstreams 配置

**Reason**: 配置结构从 `upstreams: { anthropic, openai, gemini }` 改为 `suppliers: Supplier[]`。

**Migration**: 将旧配置迁移到新格式：

```json
// 旧格式
{
  "upstreams": {
    "anthropic": "https://api.anthropic.com",
    "openai": "https://api.openai.com",
    "gemini": "https://generativelanguage.googleapis.com"
  }
}

// 新格式
{
  "suppliers": [
    {
      "id": "claude-anthropic",
      "name": "Claude (Anthropic)",
      "baseUrl": "https://api.anthropic.com",
      "localPrefix": "/claude",
      "pathMappings": [],
      "enabled": true
    },
    {
      "id": "openai-official",
      "name": "OpenAI Official",
      "baseUrl": "https://api.openai.com",
      "localPrefix": "/openai",
      "pathMappings": [],
      "enabled": true
    },
    {
      "id": "gemini-google",
      "name": "Gemini (Google)",
      "baseUrl": "https://generativelanguage.googleapis.com",
      "localPrefix": "/gemini",
      "pathMappings": [],
      "enabled": true
    }
  ]
}
```

### Requirement: 固定客户端类型路由

**Reason**: 不再使用固定的 claude/openai/gemini 客户端类型，改为基于供应商的 localPrefix 动态路由。

**Migration**: CLI 配置中显式指定 localPrefix 作为 base_url 的一部分：

```bash
# 旧：可能根据路径自动识别客户端
export ANTHROPIC_BASE_URL="http://127.0.0.1:7070"

# 新：显式指定 localPrefix
export ANTHROPIC_BASE_URL="http://127.0.0.1:7070/claude"
export OPENAI_BASE_URL="http://127.0.0.1:7070/openai"
export GOOGLE_GEMINI_BASE_URL="http://127.0.0.1:7070/gemini"
```
