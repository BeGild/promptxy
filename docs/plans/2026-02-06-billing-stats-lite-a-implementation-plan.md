# Billing Stats Lite A 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不引入重型架构的前提下，完成“供应商内模型计费映射 + 请求级计费快照 + 列表总费用 + 详情计费表”的端到端落地。

**Architecture:** 复用现有 `supplier`、`request`、`pricing` 主链路，新增 `modelPricingMappings` 作为供应商级入口，网关在请求结束时优先命中供应商映射并生成 `pricing_snapshot_json`。存储层在 `requests` 表增加轻量计费字段，前端仅在请求列表显示总费用，详细解释集中在请求详情侧栏。

**Tech Stack:** TypeScript, Node.js, SQLite, React, HeroUI, Vitest, Testing Library

---

## Task 1: 扩展供应商计费映射类型与配置校验

**Files:**
- Modify: `backend/src/promptxy/types.ts`
- Modify: `backend/src/promptxy/config.ts`
- Modify: `frontend/src/types/api.ts`
- Test: `backend/tests/unit/config.test.ts`

**Step 1: 先写失败测试（配置层）**

在 `backend/tests/unit/config.test.ts` 新增两个用例：

```ts
it('应支持 supplier.modelPricingMappings 合法配置', async () => {
  const config = await loadConfig({
    suppliers: [{
      id: 's1', name: 's1', displayName: 'S1',
      baseUrl: 'https://api.example.com',
      protocol: 'openai-codex',
      enabled: true,
      auth: { type: 'none' },
      supportedModels: ['gpt-5-mini'],
      modelPricingMappings: [{
        modelName: 'gpt-5-mini',
        billingModel: 'gpt-5-mini',
        priceMode: 'inherit',
      }],
    }],
  } as any);
  expect(config.suppliers[0].modelPricingMappings?.[0].billingModel).toBe('gpt-5-mini');
});

it('应拒绝 modelPricingMappings 中重复 modelName', async () => {
  await expect(loadConfig({
    suppliers: [{
      id: 's1', name: 's1', displayName: 'S1',
      baseUrl: 'https://api.example.com',
      protocol: 'openai-codex',
      enabled: true,
      auth: { type: 'none' },
      supportedModels: [],
      modelPricingMappings: [
        { modelName: 'm1', billingModel: 'bm1', priceMode: 'inherit' },
        { modelName: 'm1', billingModel: 'bm2', priceMode: 'inherit' },
      ],
    }],
  } as any)).rejects.toThrow(/modelPricingMappings/);
});
```

**Step 2: 运行该测试并确认失败**

Run: `npm test -- backend/tests/unit/config.test.ts`
Expected: FAIL（`modelPricingMappings` 字段缺失或未校验）

**Step 3: 补齐后端类型定义**

在 `backend/src/promptxy/types.ts` 增加：

```ts
export interface ModelPricingMapping {
  modelName: string;
  billingModel: string;
  priceMode: 'inherit' | 'custom';
  customPrice?: {
    inputPrice: number;
    outputPrice: number;
  };
  updatedAt?: number;
}
```

并在 `Supplier` 上挂载：

```ts
modelPricingMappings?: ModelPricingMapping[];
```

**Step 4: 实现配置校验与标准化**

在 `backend/src/promptxy/config.ts` 的 `assertSupplier` 中加入：

```ts
if ((supplier as any).modelPricingMappings !== undefined) {
  if (!Array.isArray((supplier as any).modelPricingMappings)) {
    throw new Error(`${label}.modelPricingMappings must be an array`);
  }
  const seen = new Set<string>();
  for (const [index, item] of (supplier as any).modelPricingMappings.entries()) {
    if (!item?.modelName || typeof item.modelName !== 'string') {
      throw new Error(`${label}.modelPricingMappings[${index}].modelName must be non-empty string`);
    }
    if (!item?.billingModel || typeof item.billingModel !== 'string') {
      throw new Error(`${label}.modelPricingMappings[${index}].billingModel must be non-empty string`);
    }
    if (seen.has(item.modelName)) {
      throw new Error(`${label}.modelPricingMappings has duplicate modelName: ${item.modelName}`);
    }
    seen.add(item.modelName);
  }
}
```

并在 normalize 逻辑中默认空数组。

**Step 5: 对齐前端类型**

在 `frontend/src/types/api.ts` 同步 `ModelPricingMapping` 与 `Supplier.modelPricingMappings?: ModelPricingMapping[]`。

**Step 6: 重新运行测试**

Run: `npm test -- backend/tests/unit/config.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add backend/src/promptxy/types.ts backend/src/promptxy/config.ts frontend/src/types/api.ts backend/tests/unit/config.test.ts
git commit -F - <<'MSG'
feat: 增加供应商模型计费映射类型与配置校验

- 在后端/前端 Supplier 类型增加 modelPricingMappings
- 在配置加载阶段校验 modelName/billingModel/priceMode 与重复项
- 补充配置层单测覆盖合法与重复映射场景
MSG
```

---

## Task 2: 打通供应商创建/更新接口的 modelPricingMappings 持久化

**Files:**
- Modify: `backend/src/promptxy/api-handlers.ts`
- Test: `backend/tests/integration/api-server.test.ts`

**Step 1: 写失败集成测试**

在 `backend/tests/integration/api-server.test.ts` 新增：

```ts
it('POST/PUT suppliers 应保存并返回 modelPricingMappings', async () => {
  const createRes = await client.post('/_promptxy/suppliers', {
    supplier: {
      name: 'new-supplier', displayName: 'New Supplier',
      baseUrl: 'https://api.example.com', protocol: 'openai-codex',
      enabled: true, auth: { type: 'none' }, supportedModels: [],
      modelPricingMappings: [{ modelName: 'private-a', billingModel: 'gpt-5-mini', priceMode: 'inherit' }],
    },
  });
  expect(createRes.status).toBe(200);
  expect(createRes.body.supplier.modelPricingMappings).toHaveLength(1);

  const supplierId = createRes.body.supplier.id;
  const updateRes = await client.put(`/_promptxy/suppliers/${supplierId}`, {
    supplier: {
      ...createRes.body.supplier,
      modelPricingMappings: [{ modelName: 'private-a', billingModel: 'private-a', priceMode: 'custom', customPrice: { inputPrice: 0.002, outputPrice: 0.006 } }],
    },
  });
  expect(updateRes.status).toBe(200);
  expect(updateRes.body.supplier.modelPricingMappings[0].priceMode).toBe('custom');
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- backend/tests/integration/api-server.test.ts`
Expected: FAIL（接口未处理/返回 `modelPricingMappings`）

**Step 3: 实现 create/update 的字段归一化**

在 `backend/src/promptxy/api-handlers.ts` 的 `handleCreateSupplier` 与 `handleUpdateSupplier` 中新增：

```ts
const mappings = Array.isArray((supplierData as any).modelPricingMappings)
  ? (supplierData as any).modelPricingMappings.map((item: any) => ({
      ...item,
      updatedAt: item?.updatedAt ?? Date.now(),
    }))
  : [];
```

并赋值给 `newSupplier.modelPricingMappings` / `supplier.modelPricingMappings`。

**Step 4: 运行集成测试**

Run: `npm test -- backend/tests/integration/api-server.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/promptxy/api-handlers.ts backend/tests/integration/api-server.test.ts
git commit -F - <<'MSG'
feat: 供应商接口支持模型计费映射的读写

- 创建/更新供应商时接收并归一化 modelPricingMappings
- 补齐 updatedAt 默认值，保证配置可追踪
- 增加 API 集成测试验证 POST/PUT 回读一致性
MSG
```

---

## Task 3: 新增模型搜索接口（供 Combobox 候选）

**Files:**
- Modify: `backend/src/promptxy/sync/sync-storage.ts`
- Modify: `backend/src/promptxy/api-handlers.ts`
- Modify: `backend/src/promptxy/gateway.ts`
- Test: `backend/tests/integration/api-server.test.ts`

**Step 1: 写失败集成测试**

```ts
it('GET /_promptxy/models/search 应按协议和关键词返回模型候选', async () => {
  const res = await client.get('/_promptxy/models/search?protocol=openai-codex&q=gpt&limit=5');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.items)).toBe(true);
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- backend/tests/integration/api-server.test.ts`
Expected: FAIL（404 endpoint not found）

**Step 3: 在 sync storage 增加查询方法**

在 `backend/src/promptxy/sync/sync-storage.ts` 增加：

```ts
searchModels(options: { protocol?: string; q?: string; limit?: number }): Array<{ modelName: string; source: string }> {
  const { protocol, q, limit = 20 } = options;
  let items = this.getAllLists();
  if (protocol) items = items.filter(i => i.protocol === protocol);
  if (q) {
    const query = q.toLowerCase();
    items = items.filter(i => i.modelName.toLowerCase().includes(query));
  }
  return items.slice(0, limit).map(i => ({ modelName: i.modelName, source: i.source }));
}
```

**Step 4: 新增 API handler 并接入网关路由**

- 在 `backend/src/promptxy/api-handlers.ts` 增加 `handleSearchModels`
- 在 `backend/src/promptxy/gateway.ts` 增加：

```ts
if (method === 'GET' && url.pathname === '/_promptxy/models/search') {
  await handleSearchModels(req, res, url);
  return;
}
```

**Step 5: 运行测试**

Run: `npm test -- backend/tests/integration/api-server.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/src/promptxy/sync/sync-storage.ts backend/src/promptxy/api-handlers.ts backend/src/promptxy/gateway.ts backend/tests/integration/api-server.test.ts
git commit -F - <<'MSG'
feat: 增加模型搜索接口支持供应商模型下拉候选

- 在同步存储增加按协议/关键词过滤的模型查询方法
- 暴露 GET /_promptxy/models/search 接口
- 网关路由接入并补充集成测试
MSG
```

---

## Task 4: 扩展 requests 存储字段（路由名快照 + 计费状态 + 计费快照）

**Files:**
- Modify: `backend/src/promptxy/types.ts`
- Modify: `backend/src/promptxy/storage/sqlite-storage.ts`
- Test: `backend/tests/unit/request-storage-backend.test.ts`

**Step 1: 写失败单测（存储读写新字段）**

在 `backend/tests/unit/request-storage-backend.test.ts` 增加断言：

```ts
expect(detail.routeNameSnapshot).toBe('Claude 默认路由');
expect(detail.pricingStatus).toBe('calculated');
expect(detail.pricingSnapshot).toContain('rule-private-001');
```

**Step 2: 运行测试确认失败**

Run: `npm test -- backend/tests/unit/request-storage-backend.test.ts`
Expected: FAIL（字段不存在或未落库）

**Step 3: 扩展请求记录类型**

在 `backend/src/promptxy/types.ts` 扩展 `RequestRecord` / `RequestRecordResponse`：

```ts
routeNameSnapshot?: string;
pricingStatus?: 'calculated' | 'skipped_no_usage' | 'skipped_no_rule' | 'error';
pricingSnapshot?: string;
```

**Step 4: 修改 SQLite 表与读写 SQL**

在 `backend/src/promptxy/storage/sqlite-storage.ts`：

1. `CREATE TABLE IF NOT EXISTS requests` 增加列：
   - `route_name_snapshot TEXT`
   - `pricing_status TEXT`
   - `pricing_snapshot_json TEXT`
2. `INSERT INTO requests` 增加对应占位符。
3. `query/getDetail` 的 SELECT 和映射中带出对应字段。

**Step 5: 为存量数据库加轻量迁移**

在 initialize 后追加 `ALTER TABLE`（幂等执行，捕获 duplicate column 错误）：

```ts
await this.safeAddColumn('requests', 'route_name_snapshot', 'TEXT');
await this.safeAddColumn('requests', 'pricing_status', 'TEXT');
await this.safeAddColumn('requests', 'pricing_snapshot_json', 'TEXT');
```

**Step 6: 运行测试**

Run: `npm test -- backend/tests/unit/request-storage-backend.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add backend/src/promptxy/types.ts backend/src/promptxy/storage/sqlite-storage.ts backend/tests/unit/request-storage-backend.test.ts
git commit -F - <<'MSG'
feat: requests 存储增加计费状态与快照字段

- 扩展 RequestRecord 类型支持 routeNameSnapshot/pricingStatus/pricingSnapshot
- SQLite requests 表新增计费相关列并完成查询映射
- 增加幂等列迁移逻辑与存储层单测覆盖
MSG
```

---

## Task 5: 实现网关计费决策（优先供应商映射）

**Files:**
- Modify: `backend/src/promptxy/pricing.ts`
- Modify: `backend/src/promptxy/gateway.ts`
- Test: `backend/tests/promptxy/pricing.test.ts`

**Step 1: 写失败单测（价格模式解析）**

在 `backend/tests/promptxy/pricing.test.ts` 增加：

```ts
it('应优先命中 supplier modelPricingMappings 的 custom 价格', () => {
  const svc = new PricingService();
  const resolved = svc.resolvePricingRule({
    supplier: {
      id: 's1',
      modelPricingMappings: [
        { modelName: 'private-a', billingModel: 'private-a', priceMode: 'custom', customPrice: { inputPrice: 0.002, outputPrice: 0.008 } },
      ],
    } as any,
    modelName: 'private-a',
  });
  expect(resolved?.priceSource).toBe('custom');
  expect(resolved?.unitPrice.input).toBe(0.002);
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- backend/tests/promptxy/pricing.test.ts`
Expected: FAIL（`resolvePricingRule` 不存在）

**Step 3: 在 PricingService 增加解析方法**

在 `backend/src/promptxy/pricing.ts` 增加：

```ts
resolvePricingRule(input: { supplier: any; modelName?: string }) {
  const mapping = input.supplier?.modelPricingMappings?.find((m: any) => m.modelName === input.modelName);
  if (!mapping) return null;
  if (mapping.priceMode === 'custom' && mapping.customPrice) {
    return {
      billingModel: mapping.billingModel,
      priceSource: 'custom' as const,
      unitPrice: { input: mapping.customPrice.inputPrice, output: mapping.customPrice.outputPrice },
      ruleId: `supplier:${input.supplier.id}:${mapping.modelName}`,
      ruleVersion: 1,
      formula: '(input*in + output*out)/1000',
    };
  }
  const inherited = this.getModelPrice(mapping.billingModel);
  if (!inherited) return null;
  return {
    billingModel: mapping.billingModel,
    priceSource: 'models.dev' as const,
    unitPrice: { input: inherited.inputPrice, output: inherited.outputPrice },
    ruleId: `supplier:${input.supplier.id}:${mapping.modelName}`,
    ruleVersion: 1,
    formula: '(input*in + output*out)/1000',
  };
}
```

**Step 4: 在网关落库前接入该决策**

在 `backend/src/promptxy/gateway.ts` 计费计算段优先调用 `resolvePricingRule`，并生成 `pricingSnapshot`：

```ts
const resolved = pricingService.resolvePricingRule({ supplier: matchedRoute.supplier, modelName: upstreamModel || requestedModel });
if (resolved) {
  model = resolved.billingModel;
  const costData = pricingService.calculateCostByUnitPrice(resolved.unitPrice, inputTokens, outputTokens);
  inputCost = costData.inputCost;
  outputCost = costData.outputCost;
  pricingStatus = 'calculated';
  pricingSnapshot = JSON.stringify({
    ruleId: resolved.ruleId,
    ruleVersion: resolved.ruleVersion,
    priceSource: resolved.priceSource,
    currency: 'USD',
    unitPrice: resolved.unitPrice,
    billableTokens: { input: inputTokens, output: outputTokens, cachedInput: cachedInputTokens ?? 0 },
    formula: resolved.formula,
  });
}
```

**Step 5: 运行测试**

Run: `npm test -- backend/tests/promptxy/pricing.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/src/promptxy/pricing.ts backend/src/promptxy/gateway.ts backend/tests/promptxy/pricing.test.ts
git commit -F - <<'MSG'
feat: 网关优先按供应商模型映射执行计费并生成快照

- PricingService 新增 supplier 级模型计费映射解析方法
- 网关计费链路优先命中 modelPricingMappings
- 落库时输出 pricingStatus 与短结构 pricingSnapshot
MSG
```

---

## Task 6: 请求列表/详情 API 返回 pricingStatus 与 pricingSnapshot

**Files:**
- Modify: `backend/src/promptxy/storage/sqlite-storage.ts`
- Modify: `backend/src/promptxy/api-handlers.ts`
- Modify: `frontend/src/types/request.ts`
- Test: `backend/tests/integration/api-server.test.ts`

**Step 1: 写失败集成测试**

```ts
it('GET /_promptxy/requests 与 /_promptxy/requests/:id 应返回 pricingStatus/pricingSnapshot', async () => {
  const list = await client.get('/_promptxy/requests');
  expect(list.status).toBe(200);
  expect(list.body.items[0]).toHaveProperty('pricingStatus');

  const id = list.body.items[0].id;
  const detail = await client.get(`/_promptxy/requests/${id}`);
  expect(detail.status).toBe(200);
  expect(detail.body).toHaveProperty('pricingSnapshot');
});
```

**Step 2: 运行测试确认失败**

Run: `npm test -- backend/tests/integration/api-server.test.ts`
Expected: FAIL（字段缺失）

**Step 3: 扩展 query/detail 映射字段**

在 `backend/src/promptxy/storage/sqlite-storage.ts`：

- list query SELECT 增加 `pricing_status`、`pricing_snapshot_json`
- detail query SELECT 增加 `route_name_snapshot`、`pricing_status`、`pricing_snapshot_json`

并映射到返回对象：

```ts
pricingStatus: r.pricing_status ?? undefined,
pricingSnapshot: r.pricing_snapshot_json ?? undefined,
```

**Step 4: 扩展请求详情 handler 响应字段**

在 `backend/src/promptxy/api-handlers.ts` 的 `handleGetRequest` 响应里增加：

```ts
routeNameSnapshot: (record as any).routeNameSnapshot,
pricingStatus: (record as any).pricingStatus,
pricingSnapshot: (record as any).pricingSnapshot,
```

**Step 5: 同步前端类型**

在 `frontend/src/types/request.ts` 的 `RequestListItem`/`RequestRecord` 增加：

```ts
pricingStatus?: 'calculated' | 'skipped_no_usage' | 'skipped_no_rule' | 'error';
pricingSnapshot?: {
  ruleId: string;
  ruleVersion: number;
  priceSource: 'models.dev' | 'custom' | 'fallback';
  currency: 'USD';
  unitPrice: { input: number; output: number; cacheRead?: number };
  billableTokens: { input: number; output: number; cachedInput?: number };
  formula: string;
} | string;
```

**Step 6: 运行测试**

Run: `npm test -- backend/tests/integration/api-server.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add backend/src/promptxy/storage/sqlite-storage.ts backend/src/promptxy/api-handlers.ts frontend/src/types/request.ts backend/tests/integration/api-server.test.ts
git commit -F - <<'MSG'
feat: 请求列表与详情接口返回计费状态与快照字段

- 请求查询/详情增加 pricingStatus/pricingSnapshot 映射
- 详情返回 routeNameSnapshot 便于路由可读展示
- 前端请求类型同步新增计费扩展字段
MSG
```

---

## Task 7: 前端 API 扩展（模型搜索 + supplier 映射字段）

**Files:**
- Modify: `frontend/src/api/config.ts`
- Modify: `frontend/src/types/api.ts`
- Test: `frontend/tests/unit/api.test.ts`

**Step 1: 写失败测试**

在 `frontend/tests/unit/api.test.ts` 增加：

```ts
it('searchModels 应调用 /_promptxy/models/search', async () => {
  // mock apiClient.get
  await searchModels({ protocol: 'openai-codex', q: 'gpt', limit: 10 });
  expect(apiClient.get).toHaveBeenCalledWith('/_promptxy/models/search?protocol=openai-codex&q=gpt&limit=10');
});
```

**Step 2: 运行测试确认失败**

Run: `npm run test:frontend -- frontend/tests/unit/api.test.ts`
Expected: FAIL（`searchModels` 未定义）

**Step 3: 实现 API 函数与类型**

在 `frontend/src/api/config.ts` 增加：

```ts
export async function searchModels(params: { protocol?: string; q?: string; limit?: number }) {
  const query = new URLSearchParams();
  if (params.protocol) query.set('protocol', params.protocol);
  if (params.q) query.set('q', params.q);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  const qs = query.toString();
  const response = await apiClient.get(`/_promptxy/models/search${qs ? `?${qs}` : ''}`);
  return response.data as { items: Array<{ modelName: string; source: string }> };
}
```

并在 `frontend/src/types/api.ts` 补齐 `ModelPricingMapping`。

**Step 4: 运行测试**

Run: `npm run test:frontend -- frontend/tests/unit/api.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/api/config.ts frontend/src/types/api.ts frontend/tests/unit/api.test.ts
git commit -F - <<'MSG'
feat: 前端配置 API 增加模型搜索与计费映射类型

- 新增 searchModels 接口用于供应商模型下拉候选
- 扩展 Supplier 类型包含 modelPricingMappings
- 增加 API 单测覆盖查询参数拼接逻辑
MSG
```

---

## Task 8: 抽离供应商模型计费编辑器（含校验函数）

**Files:**
- Create: `frontend/src/components/settings/model-pricing-validation.ts`
- Create: `frontend/src/components/settings/ModelPricingEditor.tsx`
- Modify: `frontend/src/components/settings/index.ts`
- Test: `frontend/tests/unit/model-pricing-validation.test.ts`

**Step 1: 写失败测试（纯函数）**

创建 `frontend/tests/unit/model-pricing-validation.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { validateModelPricingItem } from '@/components/settings/model-pricing-validation';

describe('validateModelPricingItem', () => {
  it('应拒绝空模型名', () => {
    const result = validateModelPricingItem({ modelName: '', billingModel: 'bm', priceMode: 'inherit' } as any, []);
    expect(result.valid).toBe(false);
    expect(result.message).toBe('请输入模型名');
  });

  it('应拒绝重复模型名', () => {
    const result = validateModelPricingItem({ modelName: 'm1', billingModel: 'bm', priceMode: 'inherit' } as any, [{ modelName: 'm1' } as any]);
    expect(result.valid).toBe(false);
    expect(result.message).toBe('该模型已存在，请勿重复添加');
  });
});
```

**Step 2: 运行测试确认失败**

Run: `npm run test:frontend -- frontend/tests/unit/model-pricing-validation.test.ts`
Expected: FAIL（文件/函数不存在）

**Step 3: 实现校验函数**

创建 `frontend/src/components/settings/model-pricing-validation.ts`：

```ts
import type { ModelPricingMapping } from '@/types/api';

export function validateModelPricingItem(
  item: ModelPricingMapping,
  existing: ModelPricingMapping[],
): { valid: boolean; message?: string } {
  if (!item.modelName?.trim()) return { valid: false, message: '请输入模型名' };
  if (!item.billingModel?.trim()) return { valid: false, message: '请输入计费模型' };
  if (existing.some(it => it.modelName === item.modelName)) return { valid: false, message: '该模型已存在，请勿重复添加' };
  if (item.priceMode === 'custom') {
    if (item.customPrice?.inputPrice === undefined) return { valid: false, message: '请输入输入单价' };
    if (item.customPrice?.outputPrice === undefined) return { valid: false, message: '请输入输出单价' };
    if (item.customPrice.inputPrice < 0 || item.customPrice.outputPrice < 0) return { valid: false, message: '价格不能小于 0' };
  }
  return { valid: true };
}
```

**Step 4: 创建编辑器组件骨架**

创建 `frontend/src/components/settings/ModelPricingEditor.tsx`，先提供可复用 props：

```tsx
interface ModelPricingEditorProps {
  protocol: string;
  value: ModelPricingMapping[];
  onChange: (next: ModelPricingMapping[]) => void;
}
```

并渲染「添加模型 + 列表 + 行内编辑态」基础结构。

**Step 5: 运行单测**

Run: `npm run test:frontend -- frontend/tests/unit/model-pricing-validation.test.ts`
Expected: PASS

**Step 6: 导出组件**

在 `frontend/src/components/settings/index.ts` 导出 `ModelPricingEditor`。

**Step 7: Commit**

```bash
git add frontend/src/components/settings/model-pricing-validation.ts frontend/src/components/settings/ModelPricingEditor.tsx frontend/src/components/settings/index.ts frontend/tests/unit/model-pricing-validation.test.ts
git commit -F - <<'MSG'
feat: 抽离供应商模型计费编辑器与字段校验函数

- 新增模型计费条目校验函数并覆盖中文错误文案
- 创建 ModelPricingEditor 组件骨架承载新增/编辑/删除交互
- 在 settings 组件导出中接入新编辑器
MSG
```

---

## Task 9: 接入 SettingsPanel 供应商弹窗“模型与计费”分区

**Files:**
- Modify: `frontend/src/components/settings/SettingsPanel.tsx`
- Test: `frontend/tests/components/settings.test.tsx`

**Step 1: 写失败组件测试**

在 `frontend/tests/components/settings.test.tsx` 增加：

```tsx
it('供应商弹窗应显示模型与计费分区标题', async () => {
  render(<SettingsPanel />);
  // 打开供应商弹窗（按现有按钮文案/测试ID）
  await userEvent.click(screen.getByText('添加供应商'));
  expect(await screen.findByText('模型与计费')).toBeInTheDocument();
});
```

**Step 2: 运行测试确认失败**

Run: `npm run test:frontend -- frontend/tests/components/settings.test.tsx`
Expected: FAIL（无“模型与计费”区）

**Step 3: 在供应商弹窗接入编辑器**

在 `frontend/src/components/settings/SettingsPanel.tsx` 的供应商弹窗中新增：

```tsx
<ModelPricingEditor
  protocol={supplierForm.protocol}
  value={supplierForm.modelPricingMappings || []}
  onChange={(next) => setSupplierForm(prev => ({ ...prev, modelPricingMappings: next }))}
/>
```

并确保保存供应商时提交 `modelPricingMappings`。

**Step 4: 运行组件测试**

Run: `npm run test:frontend -- frontend/tests/components/settings.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/settings/SettingsPanel.tsx frontend/tests/components/settings.test.tsx
 git commit -F - <<'MSG'
feat: 在设置页供应商弹窗接入模型与计费配置分区

- 在供应商新增/编辑弹窗加入 ModelPricingEditor
- 保存供应商时提交 modelPricingMappings 配置
- 增加组件测试覆盖分区展示与交互入口
MSG
```

---

## Task 10: 请求列表总费用列 + hover 快照展示

**Files:**
- Modify: `frontend/src/components/requests/RequestList.tsx`
- Test: `frontend/tests/components/requests.test.tsx`

**Step 1: 写失败组件测试**

```tsx
it('应在请求列表显示总费用列', () => {
  render(<RequestList {...propsWithCost} />);
  expect(screen.getByText('总费用')).toBeInTheDocument();
  expect(screen.getByText('$0.0123')).toBeInTheDocument();
});
```

**Step 2: 运行测试确认失败**

Run: `npm run test:frontend -- frontend/tests/components/requests.test.tsx`
Expected: FAIL（无总费用列）

**Step 3: 实现列表列与格式化逻辑**

在 `frontend/src/components/requests/RequestList.tsx`：

```tsx
const renderCost = (item: RequestListItem) => {
  if (item.pricingStatus !== 'calculated' || typeof item.totalCost !== 'number') return '--';
  return `$${item.totalCost.toFixed(4)}`;
};
```

并在 cell hover 时显示简短 `pricingSnapshot`。

**Step 4: 运行组件测试**

Run: `npm run test:frontend -- frontend/tests/components/requests.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/requests/RequestList.tsx frontend/tests/components/requests.test.tsx
git commit -F - <<'MSG'
feat: 请求列表增加总费用列与计费快照悬停展示

- 列表保持时间排序，仅新增总费用展示
- 非 calculated 状态统一显示 -- 避免误导为 0 成本
- hover 显示短结构 pricingSnapshot 便于快速排查
MSG
```

---

## Task 11: 请求详情侧栏新增“计费详情 Table”

**Files:**
- Modify: `frontend/src/components/requests/RequestDetailInSidebar.tsx`
- Test: `frontend/tests/components/requests.test.tsx`

**Step 1: 写失败组件测试**

```tsx
it('请求详情侧栏应显示计费详情表', async () => {
  render(<RequestDetailInSidebar request={mockRequestWithPricing} onClose={vi.fn()} /> as any);
  expect(screen.getByText('计费详情')).toBeInTheDocument();
  expect(screen.getByText('计费模型')).toBeInTheDocument();
  expect(screen.getByText('$0.0123')).toBeInTheDocument();
});
```

**Step 2: 运行测试确认失败**

Run: `npm run test:frontend -- frontend/tests/components/requests.test.tsx`
Expected: FAIL（无独立计费表格）

**Step 3: 实现并列计费详情区块**

在 `frontend/src/components/requests/RequestDetailInSidebar.tsx` 增加 Table，字段固定 6 项：

```tsx
const rows = [
  ['计费模型', request.model || '--'],
  ['输入/输出Token', `${request.inputTokens ?? '--'} / ${request.outputTokens ?? '--'}`],
  ['缓存Token', request.cachedInputTokens ?? '--'],
  ['总费用', request.pricingStatus === 'calculated' && typeof request.totalCost === 'number' ? `$${request.totalCost.toFixed(4)}` : '--'],
  ['计费状态', request.pricingStatus || '--'],
  ['来源信息', `usage:${request.usageSource || '--'}, price:${(request as any)?.pricingSnapshot?.priceSource ?? '--'}`],
];
```

**Step 4: 运行测试**

Run: `npm run test:frontend -- frontend/tests/components/requests.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/requests/RequestDetailInSidebar.tsx frontend/tests/components/requests.test.tsx
git commit -F - <<'MSG'
feat: 请求详情侧栏新增计费详情表并列展示

- 增加计费详情 Table，固定展示 6 项核心计费信息
- 对不同 pricingStatus 显示一致的降级文案
- 补充请求详情组件测试覆盖计费字段渲染
MSG
```

---

## Task 12: 端到端回归、文档同步与手工验证

**Files:**
- Modify: `docs/plans/2026-02-06-billing-stats-lite-a-design.md`
- Modify: `docs/usage.md`（若有相关配置说明段）

**Step 1: 运行后端测试回归**

Run: `npm test`
Expected: PASS

**Step 2: 运行前端测试回归**

Run: `npm run test:frontend`
Expected: PASS

**Step 3: 启动开发环境做手工验证**

Run: `./scripts/dev.sh &`
Expected: 后台成功启动（记录 PID）

手工检查：

1. 打开设置页，新增供应商并配置 `modelPricingMappings`。
2. 请求列表显示总费用，hover 可见短 JSON 快照。
3. 请求详情侧栏出现计费详情 Table。

**Step 4: 停止后台进程**

Run: `pkill -f "scripts/dev.sh|backend/src/main.ts|vite"`
Expected: 开发进程全部退出

**Step 5: 更新文档说明（仅必要增量）**

在 `docs/usage.md` 增加“供应商模型计费映射”配置说明与最小示例。

**Step 6: Commit**

```bash
git add docs/plans/2026-02-06-billing-stats-lite-a-design.md docs/usage.md
git commit -F - <<'MSG'
docs: 同步计费映射能力与请求侧展示使用说明

- 更新设计文档中的实现完成状态与关键接口字段
- 在使用文档增加 modelPricingMappings 最小配置示例
- 补充手工验证步骤，便于后续回归执行
MSG
```

---

## 执行顺序建议

1. Task 1 → Task 2 → Task 3（先打通配置入口与接口）
2. Task 4 → Task 5 → Task 6（打通计费落库与请求查询）
3. Task 7 → Task 8 → Task 9 → Task 11（前端类型/API/UI 分层接入）
4. Task 12（回归与文档）

## 技术边界提醒（YAGNI）

1. 不做模型级启用开关（删除即停用）。
2. 不做请求列表费用排序。
3. 不做 usage 独立事实表。
4. 不做独立计费服务。

