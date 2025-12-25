# Design: add-path-autocomplete

## Architecture Overview

本变更在请求监控页面添加路径自动补全功能，涉及前后端协同：

```
┌─────────────────┐     GET /_promptxy/paths     ┌─────────────────┐
│  Frontend       │ ──────────────────────────>  │   Backend       │
│  Autocomplete   │                              │   API Server    │
└────────┬────────┘                              └────────┬────────┘
         │                                                │
         │ load paths on mount                           │
         │                                                │
         │                                          ┌─────▼─────┐
         │                                          │  Database │
         │                                          │           │
         │                                          └───────────┘
         │
         │  local filter
         ▼
┌─────────────────┐
│  Dropdown       │
│  Suggestions    │
└────────┬────────┘
         │
         │ user selects / enters
         ▼
┌─────────────────┐     GET /_promptxy/requests    ┌─────────────────┐
│  Search         │ ──────────────────────────>  │   Backend       │
│  Triggered      │                              │   Smart Filter  │
└─────────────────┘                              └─────────────────┘
```

## Key Design Decisions

### 1. 路径数据源：后端 API

**决策**：新增 `GET /_promptxy/paths` 接口返回唯一路径列表

**权衡**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| 后端 API | 数据准确，支持历史路径 | 新增接口 |
| 前端提取 | 无后端改动 | 只显示当前页路径 |

**选择原因**：用户需要看到所有历史路径，前端提取方式无法满足

### 2. 匹配模式：智能判断

**决策**：根据输入特征自动选择匹配模式

- 以 `/` 开头 → 路径前缀匹配
- 其他 → ID 模糊匹配

**权衡**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| 智能判断 | 自动选择最佳模式 | 规则需文档说明 |
| 固定模式 | 行为可预测 | 不够灵活 |

**选择原因**：用户明确表示需要前缀匹配，智能判断提供更好的默认体验

### 3. 本地过滤 vs 服务端过滤

**决策**：前端本地过滤下拉建议

**权衡**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| 本地过滤 | 无网络延迟，响应快 | 首次需加载全部数据 |
| 服务端过滤 | 数据量小 | 每次输入都请求 |

**选择原因**：路径数量有限（通常几十到几百），本地过滤体验更好

## Component Design

### PathAutocomplete Component

```
PathAutocomplete
├── State
│   ├── paths: string[]           // 全部路径列表
│   ├── loading: boolean          // 加载状态
│   ├── loaded: boolean           // 已加载标记
│   └── filteredPaths: string[]   // 过滤后的路径
├── Effects
│   └── useEffect: 组件挂载时加载路径
├── Handlers
│   └── onInputChange: 委托给父组件
└── Props
    ├── value: string             // 当前值
    ├── onChange: (value) => void // 变化回调
    └── isLoading: boolean        // 外部加载状态
```

### Database Schema Changes

添加路径索引以提升查询性能：

```sql
CREATE INDEX IF NOT EXISTS idx_path ON requests(path);
```

## API Contract

### GET /_promptxy/paths

**请求参数**：
- `prefix` (可选): 前缀过滤

**响应**：
```json
{
  "paths": ["/api/users", "/api/chat", "/v1/completions"],
  "count": 3
}
```

### GET /_promptxy/requests (修改)

**搜索行为变化**：

| search 参数 | 行为 |
|------------|------|
| `/api/users` | `path LIKE '/api/users%'` |
| `req-123` | `id LIKE '%req-123%' OR path LIKE '%req-123%' OR original_body LIKE '%req-123%'` |

## Error Handling

- 路径列表加载失败：降级为普通 Input（允许任意输入）
- API 请求失败：显示错误提示，保留当前结果

## Future Enhancements

- 路径搜索历史记录
- 路径分组（按 API 版本、功能模块）
- 服务端缓存（Redis）
- 路径使用频率排序
