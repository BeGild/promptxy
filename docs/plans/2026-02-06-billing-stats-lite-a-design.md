# 计费统计系统重构设计（Lite A）

> 日期：2026-02-06  
> 状态：已评审通过（仅 A 方案，无过渡方案）

## 1. 背景与问题

当前计费统计系统存在“表面完整、实则难解释”的问题，主要表现为：

1. 路由统计可读性不足：统计视图依赖内部 `routeId`，业务关联弱。
2. 模型计费映射不完整：上游模型与计费模型不总是同一个，私有模型缺少稳定计费入口。
3. 展示与解释脱节：列表能看部分数字，但“为什么这么算”缺少统一、简洁、可复查的证据结构。

本设计目标是：在不引入企业级复杂系统的前提下，实现“每笔请求可计费、可解释、可展示”。

---

## 2. 设计原则（最终确定）

1. **轻量优先**：单进程 + SQLite，不引入独立计费服务。
2. **真实需要优先**：不做 usage 专表，不做复杂账本分录。
3. **解释能力前置**：每笔请求通过 `pricing_snapshot_json` 保留可解释证据。
4. **灵活性来自规则**：通过 `pricing_rules` 支持私有模型、自定义价格、计费模型覆盖。
5. **列表极简，详情解释**：列表仅显示总费用；详细解释放到请求详情侧栏 Table。

---

## 3. 范围与非范围

### 3.1 本次范围

1. 请求级计费记录与状态落库。
2. 计费规则的命中、版本、生效窗口与价格来源管理。
3. 供应商管理页内完成“模型名 → 计费模型”映射与自定义价格配置。
4. 请求列表展示总费用（`$x.xxxx`）。
5. 请求详情新增计费详情表，展示核心 6 项信息。

### 3.2 明确不做

1. 不做费用排序（列表保持按时间倒序）。
2. 不做 BI 化多维运营面板。
3. 不做独立 usage 事实表。
4. 不做独立计费中心服务。

---

## 4. 数据模型设计

### 4.1 requests（事实 + 快照）

在现有 `requests` 基础上，确保以下字段可用：

1. 路由可读性
   - `route_id`
   - `route_name_snapshot`（请求发生时的路由名快照）
2. 模型链
   - `requested_model`
   - `upstream_model`
   - `billing_model`
3. usage 与 token
   - `usage_source`（`actual | estimated`）
   - `input_tokens`
   - `output_tokens`
   - `cached_input_tokens`
4. 费用
   - `input_cost`
   - `output_cost`
   - `total_cost`
5. 计费结果状态
   - `pricing_status`（见第 6 节）
6. 解释快照
   - `pricing_snapshot_json`

> 说明：不新增 usage 专表；必要复查可利用已有响应内容字段。

### 4.2 pricing_rules（灵活策略）

新增（或完善）计费规则表：

1. 标识与控制
   - `id`
   - `enabled`
   - `priority`
   - `version`
2. 命中条件
   - `provider`
   - `model_pattern`
   - `effective_from`
   - `effective_to`
3. 计费策略
   - `billing_model_override`
   - `input_price`
   - `output_price`
   - `cache_read_price`
   - `cache_write_price`
   - `currency`（默认 USD）
4. 补充说明
   - `note`

### 4.3 供应商模型计费配置（前端主入口）

为满足“在添加/编辑供应商时直接配置模型计费”的需求，供应商配置增加结构：

1. `modelPricingMappings`（数组）
   - `modelName`：供应商实际模型名（必填）
   - `billingModel`：计费模型名（必填）
   - `priceMode`：`inherit | custom`（必填）
   - `customPrice`：仅 `custom` 时必填，包含 `inputPrice`、`outputPrice`
   - `updatedAt`：更新时间
2. 无 `enabled` 字段（按最终决策，不做“模型禁用”逻辑）
3. 同一供应商内 `modelName` 必须唯一

说明：前端在供应商页维护该结构；后端可在内部转换为可执行计费规则，但不要求暴露独立规则页面。

---

## 5. pricing_snapshot_json 规范（固定轻量结构）

为避免快照膨胀，结构固定为短 JSON：

```json
{
  "ruleId": "rule-private-001",
  "ruleVersion": 3,
  "priceSource": "custom",
  "currency": "USD",
  "unitPrice": {"input": 0.002, "output": 0.008, "cacheRead": 0.0002},
  "billableTokens": {"input": 1200, "output": 800, "cachedInput": 500},
  "formula": "(input*in + output*out + cache*cacheRead)/1000"
}
```

约束：

1. 必须可被 JSON.parse 正确解析。
2. 不附带原始响应体、不附带长日志。
3. 保持短结构，满足 hover 快速查看。

---

## 6. 计费状态机

`pricing_status` 仅允许以下 4 个值：

1. `calculated`：计费完成，金额可展示。
2. `skipped_no_usage`：缺少可用 usage，且无法估算。
3. `skipped_no_rule`：有 usage 但未命中计费规则。
4. `error`：计费流程异常（需记录简要错误信息）。

设计要求：

1. 禁止静默归零。
2. 非 `calculated` 不显示 `$0.0000`。

---

## 7. 请求级计费流程

每条请求在响应完成后执行统一流程：

1. 固化 `route_name_snapshot`。
2. 解析 usage（优先真实 usage，缺失时估算）。
3. 提取模型链：`requested_model -> upstream_model -> billing_model`。
4. 先按 `supplierId + modelName` 查找供应商 `modelPricingMappings`。
5. 解析计费模型与价格模式：
   - `inherit`：按 `billingModel` 使用全局价格/同步价格
   - `custom`：使用条目内 `inputPrice/outputPrice`
6. 若未命中供应商映射，再按 `pricing_rules` 的 `enabled + priority + effective_time` 兜底匹配。
7. 计算 `input_cost / output_cost / total_cost`。
8. 生成 `pricing_snapshot_json`。
9. 一次性写回 `requests`（token、费用、状态、快照）。

---

## 8. 前端交互设计（最终版）

### 8.1 请求列表

1. 保持时间倒序，不增加费用排序。
2. 仅新增“总费用”展示，格式固定为 `$0.0123`。
3. `pricing_status != calculated` 显示 `--`。
4. 鼠标 hover 总费用单元格时显示简短 `pricing_snapshot_json`。
5. hover 不做滚动、不做复制增强，仅作快速阅读。

### 8.2 请求详情侧栏

新增一个与“响应详情”等并列的区块：**计费详情（Table）**。

Table 展示 6 项核心信息：

1. 计费模型（`billing_model`）
2. 输入/输出 token（`input_tokens` / `output_tokens`）
3. 缓存 token（`cached_input_tokens`）
4. 总费用（`total_cost`）
5. 计费状态（`pricing_status`）
6. 来源信息（`usage_source + priceSource`）

### 8.3 供应商管理页（模型与计费）

在“添加/编辑供应商”弹窗中新增分区：**模型与计费**。

#### 8.3.1 添加模型交互

1. 点击“添加模型”进入行内编辑。
2. `模型名` 使用可搜索下拉（Combobox），支持自由输入：
   - 命中已有模型：视为标准模型
   - 未命中：视为自定义模型
3. `计费模型` 为必填，同样支持搜索/输入：
   - 标准模型默认 `计费模型 = 模型名`
   - 自定义模型默认 `计费模型 = 模型名`（可手动修改）
4. `价格模式` 显式切换：
   - `继承计费模型价格`
   - `自定义价格`
5. 当选择 `自定义价格` 时，必须填写 `inputPrice` 与 `outputPrice`。

#### 8.3.2 维护能力

1. 支持新增、编辑、删除模型映射条目。
2. 不支持“模型禁用”开关（按最终决策，删除即停用）。
3. 同一供应商下模型名重复时，禁止保存并提示。

#### 8.3.3 典型场景

1. 不同供应商模型名不同，但映射到同一 `billingModel`，实现统一计费。
2. 私有模型使用 `自定义价格` 手工录入输入/输出单价后即可参与计费。

### 8.4 线框级草图（最终版）

#### 8.4.1 请求列表（仅新增总费用列）

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ 时间                客户端   方法   路径                     状态   总费用    │
├──────────────────────────────────────────────────────────────────────────────┤
│ 10:23:45.123       claude   POST   /v1/messages              200   $0.0123  │
│ 10:23:44.221       codex    POST   /v1/responses             200   --       │
│ 10:23:40.019       claude   POST   /v1/messages              500   $0.0048  │
└──────────────────────────────────────────────────────────────────────────────┘

hover($0.0123) -> 简短 snapshot 浮层
{
  "ruleId": "rule-private-001",
  "ruleVersion": 3,
  "priceSource": "custom",
  "currency": "USD",
  "unitPrice": {"input": 0.002, "output": 0.008, "cacheRead": 0.0002},
  "billableTokens": {"input": 1200, "output": 800, "cachedInput": 500},
  "formula": "(input*in + output*out + cache*cacheRead)/1000"
}
```

#### 8.4.2 请求详情侧栏（新增计费详情 Table，并列展示）

```text
┌──────────────────────────── 请求详情侧栏 ────────────────────────────┐
│ [基础信息] [请求体] [响应详情] [转换详情] [计费详情]                  │
├───────────────────────────────────────────────────────────────────────┤
│ 计费详情（Table）                                                     │
│ ┌───────────────┬───────────────────────────────────────────────────┐ │
│ │ 字段          │ 值                                                │ │
│ ├───────────────┼───────────────────────────────────────────────────┤ │
│ │ 计费模型      │ gpt-4o                                           │ │
│ │ 输入/输出Token│ 1200 / 800                                       │ │
│ │ 缓存Token     │ 500                                              │ │
│ │ 总费用        │ $0.0123                                          │ │
│ │ 计费状态      │ calculated                                       │ │
│ │ 来源信息      │ usage:actual, price:custom                      │ │
│ └───────────────┴───────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

#### 8.4.3 供应商弹窗（模型与计费分区）

```text
┌──────────────────────── 编辑供应商 ────────────────────────┐
│ [基础连接]                                                   │
│  - 名称 / BaseURL / 协议 / 认证 ...                          │
│                                                             │
│ [模型与计费]                                                 │
│  [添加模型]                                                  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 模型名            计费模型         价格模式    操作      │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ my-model-a        gpt-4o          继承       编辑 删除   │ │
│  │ private-foo-v1    private-foo-v1  自定义      编辑 删除   │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

添加模型（行内编辑态）：

```text
模型名:      [ Combobox(可搜索/可输入)                ]
计费模型:    [ Combobox(可搜索/可输入，默认=模型名)     ]
价格模式:    (•) 继承计费模型价格   ( ) 自定义价格
输入单价:    [            ]  （仅自定义模式显示）
输出单价:    [            ]  （仅自定义模式显示）
按钮:        [保存] [取消]
```

### 8.5 字段状态图与反馈规范

#### 8.5.1 供应商弹窗「添加模型」状态机

```text
idle
  -> 点击[添加模型]
editing
  -> 点击[保存]
validating
  -> 校验失败 -> error
  -> 校验通过 -> saving
saving
  -> 保存成功 -> saved(2s) -> idle
  -> 保存失败 -> error
error
  -> 用户继续编辑 -> editing
  -> 点击[取消] -> idle
```

字段级校验与提示文案（固定）：

1. `模型名` 为空：`请输入模型名`
2. `计费模型` 为空：`请输入计费模型`
3. 同供应商模型名重复：`该模型已存在，请勿重复添加`
4. 自定义模式下 `inputPrice` 为空：`请输入输入单价`
5. 自定义模式下 `outputPrice` 为空：`请输入输出单价`
6. 自定义价格小于 0：`价格不能小于 0`

#### 8.5.2 价格模式联动规则

1. 默认模式：`继承计费模型价格`
2. 切换为 `自定义价格`：展示并启用 `inputPrice/outputPrice` 输入框
3. 切回 `继承`：隐藏单价输入框，不提交 `customPrice`
4. `保存` 时按模式构造 payload：
   - `inherit`：不带 `customPrice`
   - `custom`：必须带 `customPrice.inputPrice/outputPrice`

#### 8.5.3 请求列表「总费用」单元格状态

1. `pricing_status=calculated`：显示 `$x.xxxx`
2. 其他状态：显示 `--`
3. hover 行为：
   - 有 `pricing_snapshot_json`：显示简短 JSON
   - 无 `pricing_snapshot_json`：显示 `暂无计费快照`

#### 8.5.4 请求详情「计费详情 Table」状态

1. `loading`：显示骨架屏（2 行）
2. `calculated`：展示完整 6 项字段
3. `skipped_no_usage`：字段可为空，状态行显示 `无可用 usage，未计费`
4. `skipped_no_rule`：状态行显示 `未命中计费规则`
5. `error`：状态行显示 `计费处理异常`
6. 历史数据缺字段：显示 `历史记录无计费快照`

#### 8.5.5 保存成功/失败反馈

1. 保存成功 toast：`模型计费配置已保存`
2. 保存失败 toast：`保存失败：{后端错误消息}`
3. 删除成功 toast：`模型计费配置已删除`
4. 删除失败 toast：`删除失败：{后端错误消息}`

---

## 9. 验收标准

### 9.1 后端

1. 新请求均有明确 `pricing_status`。
2. `calculated` 请求可得到正确金额与快照。
3. snapshot 结构稳定，满足短 JSON 规范。

### 9.2 前端

1. 列表仅新增总费用显示，无额外排序能力。
2. 总费用 hover 可读到简短 snapshot。
3. 详情新增计费详情 Table，并与现有详情并列。
4. 供应商弹窗支持“模型名 + 计费模型 + 价格模式 + 自定义价格”完整配置流程。
5. 校验失败与状态提示文案符合第 8.5 节定义。

### 9.3 一致性

1. 列表金额、详情金额、统计聚合口径一致。
2. 非 `calculated` 请求不误显示为 0 成本。

---

## 10. 里程碑

### M1：后端能力

1. `requests` 字段补充与迁移。
2. 供应商 `modelPricingMappings` 存储与校验。
3. `pricing_rules` 能力落地。
4. 请求后计费流程打通。

### M2：前端展示

1. 供应商弹窗新增“模型与计费”分区。
2. 列表新增总费用与 hover snapshot。
3. 详情侧栏新增计费详情 Table。

### M3：稳定性

1. 状态与金额一致性测试。
2. 规则冲突与异常处理测试。

---

## 11. 风险与对策

1. 历史数据无 snapshot
   - 对策：前端明确显示“历史记录无计费快照”。
2. 规则冲突
   - 对策：保存规则时做冲突校验与优先级约束。
3. 协议变更导致 usage 解析漂移
   - 对策：按协议建立回归样例，持续补充。
4. 快照变长
   - 对策：强约束 snapshot 字段白名单。

---

## 12. 最终结论

本方案以“**请求级快照解释** + **规则级灵活策略**”为核心，满足：

1. 每笔请求有清晰计费结论。
2. 每笔费用可追溯“按哪条规则、按什么单价、怎么算”。
3. 产品复杂度保持在工具型软件可维护范围内。

---

## 13. 接口契约草案（v0.1）

本草案遵循“最小增量、复用现有接口”的原则，优先在现有供应商、请求列表、请求详情接口上扩展字段。

### 13.1 核心类型（新增）

```ts
type PriceMode = 'inherit' | 'custom';
type PricingStatus = 'calculated' | 'skipped_no_usage' | 'skipped_no_rule' | 'error';

interface ModelPricingMapping {
  modelName: string;
  billingModel: string;
  priceMode: PriceMode;
  customPrice?: {
    inputPrice: number;
    outputPrice: number;
  };
  updatedAt: number;
}

interface PricingSnapshot {
  ruleId: string;
  ruleVersion: number;
  priceSource: 'models.dev' | 'custom' | 'fallback';
  currency: 'USD';
  unitPrice: { input: number; output: number; cacheRead?: number };
  billableTokens: { input: number; output: number; cachedInput?: number };
  formula: string;
}
```

### 13.2 供应商接口（扩展）

#### 13.2.1 GET /_promptxy/suppliers

返回的每个 supplier 新增 `modelPricingMappings`（可为空数组）。

```json
{
  "success": true,
  "suppliers": [
    {
      "id": "openai-codex-official",
      "name": "OpenAI Codex",
      "protocol": "openai-codex",
      "enabled": true,
      "supportedModels": ["gpt-5", "gpt-5-mini"],
      "modelPricingMappings": [
        {
          "modelName": "gpt-5-mini",
          "billingModel": "gpt-5-mini",
          "priceMode": "inherit",
          "updatedAt": 1760000000000
        },
        {
          "modelName": "private-foo-v1",
          "billingModel": "private-foo-v1",
          "priceMode": "custom",
          "customPrice": { "inputPrice": 0.002, "outputPrice": 0.008 },
          "updatedAt": 1760000001000
        }
      ]
    }
  ]
}
```

#### 13.2.2 POST /_promptxy/suppliers

创建供应商时允许携带 `modelPricingMappings`。

#### 13.2.3 PUT /_promptxy/suppliers/:supplierId

更新供应商时支持全量提交 `modelPricingMappings`。前端在弹窗内增删改后，以一次 `PUT` 提交完整结果。

### 13.3 模型搜索接口（新增建议）

#### GET /_promptxy/models/search?protocol=openai-codex&q=gpt&limit=20

```json
{
  "items": [
    { "modelName": "gpt-5", "source": "models.dev" },
    { "modelName": "gpt-5-mini", "source": "models.dev" }
  ]
}
```

说明：

1. Combobox 候选来源于同步模型库。
2. 若用户输入值未命中候选，前端按“自定义模型”处理。

### 13.4 请求列表接口（扩展）

#### GET /_promptxy/requests

`items[]` 建议确保以下字段：

1. `totalCost`
2. `pricingStatus`
3. `pricingSnapshot`（短 JSON，用于 hover）

```json
{
  "total": 123,
  "limit": 50,
  "offset": 0,
  "items": [
    {
      "id": "req_xxx",
      "timestamp": 1760001234567,
      "path": "/v1/messages",
      "responseStatus": 200,
      "totalCost": 0.0123,
      "pricingStatus": "calculated",
      "pricingSnapshot": {
        "ruleId": "rule-private-001",
        "ruleVersion": 3,
        "priceSource": "custom",
        "currency": "USD",
        "unitPrice": { "input": 0.002, "output": 0.008, "cacheRead": 0.0002 },
        "billableTokens": { "input": 1200, "output": 800, "cachedInput": 500 },
        "formula": "(input*in + output*out + cache*cacheRead)/1000"
      }
    }
  ]
}
```

### 13.5 请求详情接口（扩展）

#### GET /_promptxy/requests/:id

为“计费详情 Table”提供以下字段：

1. 模型链：`requestedModel`、`upstreamModel`、`model`（计费模型）
2. token：`inputTokens`、`outputTokens`、`cachedInputTokens`
3. 费用：`inputCost`、`outputCost`、`totalCost`
4. 来源与状态：`usageSource`、`pricingStatus`
5. 快照：`pricingSnapshot`

### 13.6 统一校验错误格式（建议）

```json
{
  "success": false,
  "code": "MODEL_PRICING_VALIDATION_FAILED",
  "message": "该模型已存在，请勿重复添加",
  "details": {
    "field": "modelPricingMappings[1].modelName",
    "reason": "duplicate_model_name"
  }
}
```

建议错误码：

1. `MODEL_NAME_REQUIRED`
2. `BILLING_MODEL_REQUIRED`
3. `DUPLICATE_MODEL_NAME`
4. `INPUT_PRICE_REQUIRED`
5. `OUTPUT_PRICE_REQUIRED`
6. `PRICE_NEGATIVE_NOT_ALLOWED`
