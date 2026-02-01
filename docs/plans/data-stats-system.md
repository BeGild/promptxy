# PromptXY 数据统计系统实现方案

## 概述

为 PromptXY 添加参考 Octopus 项目的数据统计系统，支持多维度统计、费用计算、性能分析等功能。

**排除范围**：不包含重试机制相关功能（Attempts、TotalAttempts、SuccessfulRound 等字段）

---

## 一、数据结构设计

### 1.1 核心指标类型

```typescript
// backend/src/promptxy/types.ts

export interface StatsMetrics {
  // Token 相关
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;

  // 费用相关（美元，保留 6 位小数）
  inputCost: number;
  outputCost: number;
  totalCost: number;

  // 时间相关（毫秒）
  waitTime: number;           // 首字时间
  durationTime: number;       // 总响应时间

  // 请求计数
  requestSuccess: number;
  requestFailed: number;
  requestTotal: number;

  // FTUT（First Token Usage Time）
  ftutCount: number;
  ftutSum: number;
  ftutAvg: number;
}
```

### 1.2 统计维度类型

| 类型 | 说明 | 主键 |
|------|------|------|
| `StatsTotal` | 总览统计 | 单例 |
| `StatsDaily` | 每日统计 | `date: YYYY-MM-DD` |
| `StatsHourly` | 小时统计 | `dateHour: YYYY-MM-DD:HH` |
| `StatsSupplier` | 供应商统计 | `supplierId` |
| `StatsModel` | 模型统计 | `model` |
| `StatsRoute` | 路由统计 | `routeId` |
| `StatsToday` | 今日统计（内存） | 单例 |

### 1.3 扩展 RequestRecord

```typescript
// 新增字段
model?: string;
inputTokens?: number;
outputTokens?: number;
totalTokens?: number;
inputCost?: number;
outputCost?: number;
totalCost?: number;
waitTime?: number;    // 首字时间
ftut?: number;        // First Token Usage Time
```

---

## 二、后端实现

### 2.1 内存缓存机制

**文件**：`backend/src/promptxy/database.ts`

**设计要点**：
- 扩展现有 `StatsCache` 结构，添加多维度缓存
- 30 秒定时刷新到磁盘（`stats-detailed.json`）
- 启动时从磁盘加载缓存
- 请求完成后立即更新内存缓存

**核心方法**：
```typescript
// 提取指标
private extractMetrics(record: RequestRecord): StatsMetrics

// 合并指标（累加）
private mergeMetrics(target: StatsMetrics, source: StatsMetrics): void

// 更新统计缓存（在 insertRequestRecord 时调用）
private updateStatsCache(record: RequestRecord): void

// 刷新统计到磁盘
private async flushStats(): Promise<void>

// 加载统计缓存
private async loadStatsCache(): Promise<void>
```

### 2.2 费用计算服务

**新文件**：`backend/src/promptxy/pricing.ts`

**内置价格数据**（部分）：
```typescript
const BUILT_IN_PRICES: ModelPrice[] = [
  // Claude
  { model: 'claude-3-5-sonnet-20241022', inputPrice: 3.0, outputPrice: 15.0 },
  { model: 'claude-3-5-haiku-20241022', inputPrice: 0.8, outputPrice: 4.0 },

  // OpenAI
  { model: 'gpt-4o', inputPrice: 2.5, outputPrice: 10.0 },
  { model: 'gpt-4o-mini', inputPrice: 0.15, outputPrice: 0.6 },

  // Gemini
  { model: 'gemini-2.0-flash-exp', inputPrice: 0.075, outputPrice: 0.3 },
];
```

**核心方法**：
```typescript
class PricingService {
  calculateCost(model, inputTokens, outputTokens): { inputCost, outputCost, totalCost }
  findPrice(model): ModelPrice | undefined  // 支持通配符匹配
}
```

### 2.3 新增 API Endpoints

**文件**：`backend/src/promptxy/api-handlers.ts`

| 接口 | 方法 | 说明 |
|------|------|------|
| `/_promptxy/stats/data` | GET | 获取完整统计数据 |
| `/_promptxy/stats/total` | GET | 获取总览统计 |
| `/_promptxy/stats/daily` | GET | 获取每日统计（limit=30） |
| `/_promptxy/stats/hourly` | GET | 获取当日小时统计 |
| `/_promptxy/stats/supplier` | GET | 获取供应商统计 |
| `/_promptxy/stats/model` | GET | 获取模型统计（limit, sortBy） |
| `/_promptxy/stats/route` | GET | 获取路由统计 |
| `/_promptxy/stats/today` | GET | 获取今日统计 |

---

## 三、前端实现

### 3.1 目录结构

```
frontend/src/
├── types/
│   └── stats.ts              # 统计类型定义（新建）
├── api/
│   └── stats.ts              # 统计 API 客户端（新建）
├── pages/
│   └── DashboardPage.tsx     # 统计仪表板页面（新建）
├── components/
│   └── stats/                # 统计组件目录（新建）
│       ├── StatsTotalCard.tsx      # 总览卡片
│       ├── StatsActivityHeatmap.tsx # 活动热力图
│       ├── StatsChart.tsx          # 统计图表
│       └── StatsRankBoard.tsx      # 排行榜
└── store/
    └── app-store.ts          # 扩展状态管理
```

### 3.2 Dashboard 页面设计

**布局结构**：
1. **页面标题** - "数据统计"
2. **Total 卡片**（4 个）- 总请求数、总 Token、总费用、成功率
3. **Activity 热力图** - GitHub 风格，显示最近 84 天活动
4. **统计图表**（2x2 网格）- Token 趋势、费用趋势、请求量趋势、响应时间
5. **排行榜**（3 个）- 模型排名、供应商排名、路由排名

### 3.3 UI 组件说明

| 组件 | 功能 | 依赖 |
|------|------|------|
| `StatsTotalCard` | 显示 4 个总览指标 | HeroUI Card |
| `StatsActivityHeatmap` | GitHub 风格热力图 | 7xN 网格 + 颜色等级 |
| `StatsChart` | 趋势图表 | recharts 或类似 |
| `StatsRankBoard` | Top 10 排行 | 列表 + 排序 |

---

## 四、关键文件列表

### 后端文件（需修改）

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/src/promptxy/types.ts` | 修改 | 添加统计相关类型定义 |
| `backend/src/promptxy/database.ts` | 修改 | 实现统计缓存和聚合逻辑 |
| `backend/src/promptxy/api-handlers.ts` | 修改 | 添加统计 API handlers |
| `backend/src/promptxy/pricing.ts` | **新建** | 价格计算服务 |
| `backend/src/promptxy/migration.ts` | **新建** | 数据迁移脚本 |

### 前端文件（需修改/新建）

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/types/stats.ts` | **新建** | 统计类型定义 |
| `frontend/src/api/stats.ts` | **新建** | 统计 API 客户端 |
| `frontend/src/pages/DashboardPage.tsx` | **新建** | 统计仪表板页面 |
| `frontend/src/components/stats/` | **新建** | 统计组件目录 |
| `frontend/src/store/app-store.ts` | 修改 | 添加统计数据状态 |
| `frontend/src/router/index.tsx` | 修改 | 添加 Dashboard 路由 |

---

## 五、实施步骤

### 第一阶段：后端基础设施（1-2 天）

1. [ ] 扩展 `types.ts` 添加统计类型定义
2. [ ] 创建 `pricing.ts` 实现价格计算服务
3. [ ] 扩展 `database.ts` 实现统计缓存机制
4. [ ] 实现统计数据收集和聚合逻辑
5. [ ] 添加 30 秒定时刷新任务

### 第二阶段：API 开发（1 天）

1. [ ] 实现统计 API handlers（8 个接口）
2. [ ] 在 `gateway.ts` 中注册路由
3. [ ] 编写单元测试（可选）

### 第三阶段：前端开发（2-3 天）

1. [ ] 创建 `types/stats.ts` 类型定义
2. [ ] 创建 `api/stats.ts` API 客户端
3. [ ] 实现 `DashboardPage.tsx` 页面布局
4. [ ] 开发 4 个统计 UI 组件
5. [ ] 扩展 `app-store.ts` 状态管理
6. [ ] 添加路由配置

### 第四阶段：数据迁移和测试（1 天）

1. [ ] 编写数据迁移脚本
2. [ ] 执行存量数据迁移
3. [ ] 端到端功能测试
4. [ ] 性能优化（如需要）

### 第五阶段：文档和发布（0.5 天）

1. [ ] 更新用户文档
2. [ ] 编写更新日志
3. [ ] 发布新版本

---

## 六、兼容性考虑

### 6.1 数据迁移

**迁移内容**：
- 从响应 `usage` 中提取 `input_tokens`、`output_tokens`
- 从请求体中提取 `model`
- 根据模型和 token 计算费用

**迁移策略**：
- 启动时检测并自动迁移
- 只迁移缺失字段的记录
- 支持增量迁移

### 6.2 向后兼容

**索引文件格式**：
- 扩展 `timestamp.idx` 添加新字段（可选）
- 旧版本字段保持不变
- 解析时兼容 11 字段和 15+ 字段格式

---

## 七、验证方式

### 功能验证

1. **统计准确性**：发送测试请求，验证各维度统计数据正确累加
2. **费用计算**：使用已知模型和 token 数验证费用计算
3. **实时更新**：通过 SSE 验证新请求立即反映到统计中
4. **持久化**：重启服务验证统计数据正确恢复

### 性能验证

1. **内存占用**：监控统计缓存内存使用
2. **刷新性能**：验证 30 秒刷新不影响请求处理
3. **API 响应**：统计接口响应时间 < 100ms

---

## 八、参考

- Octopus 项目：`refence/octopus/`
- 现有代码结构：
  - `backend/src/promptxy/database.ts`
  - `backend/src/promptxy/types.ts`
  - `frontend/src/pages/RequestsPage.tsx`
  - `frontend/src/store/app-store.ts`
