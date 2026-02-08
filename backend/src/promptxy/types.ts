/**
 * PromptXY v2.0 - TypeScript 类型定义
 *
 * 包含：
 * - 规则相关类型
 * - 请求记录类型
 * - 配置类型
 * - API 类型
 * - SSE 事件类型
 */

// ============================================================================
// 基础类型
// ============================================================================

export type PromptxyClient = 'claude' | 'codex' | 'gemini';

// 供应商侧图标展示用（不等同于入口 client）
export type SupplierClientIcon = PromptxyClient | 'openai-chat';
export type PromptxyField = 'system' | 'instructions';

export type PromptxyOpType =
  | 'set'
  | 'append'
  | 'prepend'
  | 'replace'
  | 'delete'
  | 'insert_before'
  | 'insert_after';

// ============================================================================
// 规则相关类型
// ============================================================================

export type PromptxyOp =
  | { type: 'set'; text: string }
  | { type: 'append'; text: string }
  | { type: 'prepend'; text: string }
  | {
      type: 'replace';
      match?: string;
      regex?: string;
      flags?: string;
      replacement: string;
    }
  | { type: 'delete'; match?: string; regex?: string; flags?: string }
  | { type: 'insert_before'; match?: string; regex?: string; flags?: string; text: string }
  | { type: 'insert_after'; match?: string; regex?: string; flags?: string; text: string };

export type PromptxyRuleWhen = {
  client: PromptxyClient;
  field: PromptxyField;
  method?: string;
  pathRegex?: string;
  modelRegex?: string;
};

export type PromptxyRule = {
  uuid: string; // 规则唯一标识符（自动生成，不可修改）
  name: string; // 规则名称（可编辑）
  description?: string;
  when: PromptxyRuleWhen;
  ops: PromptxyOp[];
  stop?: boolean;
  enabled?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

// 旧格式规则类型（用于兼容性检查）
export type LegacyPromptxyRule = {
  id: string;
  description?: string;
  when: PromptxyRuleWhen;
  ops: PromptxyOp[];
  stop?: boolean;
  enabled?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

// ============================================================================
// 配置类型
// ============================================================================

/**
 * 路径映射规则
 */
export interface PathMapping {
  from: string;
  to: string;
  type?: 'exact' | 'prefix' | 'regex';
}

// ============================================================================
// 协议转换类型
// ============================================================================

/**
 * 转换器步骤定义
 */
export type TransformerStep =
  | string // 转换器名称
  | {
      name: string;
      options?: Record<string, unknown>;
    };

/**
 * 转换链定义
 */
export type TransformerChain = TransformerStep[];

/**
 * Transformer 配置（v1 精确匹配）
 */
export interface TransformerConfig {
  /** 默认转换链 */
  default: TransformerChain;
  /** 模型精确匹配覆盖链 */
  models?: Record<string, TransformerChain>;
}

/**
 * Supplier 认证配置
 */
export interface SupplierAuth {
  type: 'none' | 'bearer' | 'header';
  token?: string;
  headerName?: string;
  headerValue?: string;
}

/**
 * 网关入站鉴权配置
 */
export interface GatewayAuth {
  enabled: boolean;
  token?: string;
  acceptedHeaders?: string[];
}

/**
 * 供应商模型计费映射
 */
export interface ModelPricingMapping {
  modelName: string;
  billingModel: string;
  priceMode: 'inherit' | 'custom';
  customPrice?: {
    inputPrice: number;
    outputPrice: number;
    cacheReadPrice?: number;
    cacheWritePrice?: number;
  };
  updatedAt?: number;
}

/**
 * 供应商配置
 * 只管理上游 API 信息，不绑定本地路径
 */
export interface Supplier {
  id: string; // 唯一标识
  name: string; // 唯一名称标识符（用于内部引用）
  displayName: string; // 显示名称
  baseUrl: string; // 上游地址
  protocol: 'anthropic' | 'openai-codex' | 'openai-chat' | 'gemini'; // 上游协议类型
  enabled: boolean; // 是否启用
  auth?: SupplierAuth; // 上游认证配置（支持 none/bearer/header）
  supportedModels: string[]; // 供应商支持的上游模型列表（用于路由映射与校验）
  modelPricingMappings?: ModelPricingMapping[]; // 供应商内模型计费映射
  /**
   * 可识别的 reasoning effort 列表。
   * 用于将 modelSpec "<base>-<effort>" 解析为 `model=<base>` + `reasoning.effort=<effort>`。
   * - UI 不暴露（选项 A）
   * - 未命中时不报错，直接透传 modelSpec
   */
  reasoningEfforts?: string[];
  description?: string; // 供应商描述
}

export type PromptxyConfig = {
  listen: {
    host: string;
    port: number;
  };
  gatewayAuth?: GatewayAuth; // 网关入站鉴权配置
  suppliers: Supplier[];
  routes: Route[]; // 路由配置（支持协议转换）
  rules: PromptxyRule[];
  storage: {
    maxHistory: number;
    // autoCleanup 和 cleanupInterval 已废弃，清理现在在 insertRequestRecord 中自动触发
  };
  debug: boolean;
  sync?: SyncConfig; // 同步配置
};

// ============================================================================
// 请求记录类型
// ============================================================================

export interface RequestRecord {
  id: string;
  timestamp: number;

  // 请求信息
  client: string;
  path: string;
  method: string;

  // 请求体（JSON 字符串）
  originalBody: string;
  transformedBody?: string; // 转换器处理后的请求体（可选）
  modifiedBody: string;

  // 请求头（对象或 JSON 字符串，兼容旧格式）
  requestHeaders?: Record<string, string> | string;
  originalRequestHeaders?: Record<string, string> | string;

  // 请求/响应大小（字节）
  requestSize?: number;
  responseSize?: number;

  // 匹配规则
  matchedRules: string; // JSON 数组字符串

  // 响应信息
  responseStatus?: number;
  durationMs?: number;
  responseHeaders?: Record<string, string> | string;
  responseBody?: string | ParsedSSEEvent[];
  error?: string;

  // 供应商和转换信息
  routeId?: string;
  routeNameSnapshot?: string;
  supplierId?: string;
  supplierName?: string;
  supplierBaseUrl?: string;
  supplierClient?: string;
  transformerChain?: string;
  transformTrace?: string;
  transformedPath?: string;

  // 统计相关字段（可选，用于向后兼容）
  // originalRequestModel: 客户端原始请求的模型
  // requestedModel: 发送给供应商的模型（转换后）
  // upstreamModel: 上游实际返回/使用的模型（若能解析到）
  originalRequestModel?: string;
  requestedModel?: string;
  upstreamModel?: string;
  // cachedInputTokens: 上游返回的缓存命中 token 数（如 OpenAI/Codex cached_tokens / Claude cache_read_input_tokens）
  cachedInputTokens?: number;

  model?: string;              // 计费模型（优先 upstreamModel，其次 requestedModel）
  inputTokens?: number;        // 输入 Token 数
  outputTokens?: number;       // 输出 Token 数
  totalTokens?: number;        // 总 Token 数
  inputCost?: number;          // 输入费用
  outputCost?: number;         // 输出费用
  totalCost?: number;          // 总费用
  waitTime?: number;           // 等待时间（首字时间）
  ftut?: number;               // First Token Usage Time

  // usage 来源（真实/估算）
  usageSource?: 'actual' | 'estimated';

  // 计费状态与快照
  pricingStatus?: 'calculated' | 'skipped_no_usage' | 'skipped_no_rule' | 'error';
  pricingSnapshot?: string;
}

// API 返回的请求记录（解析后的）
export interface RequestRecordResponse {
  id: string;
  timestamp: number;
  client: string;
  path: string;
  method: string;
  originalBody: any;
  transformedBody?: any; // 转换器处理后的请求体（可选）
  modifiedBody: any;
  requestHeaders?: Record<string, string>; // 协议转换后的请求头
  originalRequestHeaders?: Record<string, string>; // 原始请求头
  requestSize?: number;
  responseSize?: number;
  matchedRules: Array<{ ruleId: string; opType: PromptxyOpType }>;
  responseStatus?: number;
  durationMs?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  error?: string;

  // 供应商和转换信息（新增）
  routeId?: string; // 命中的路由 ID
  routeNameSnapshot?: string; // 路由名称快照
  supplierId?: string; // 供应商 ID
  supplierName?: string; // 供应商名称
  supplierBaseUrl?: string; // 供应商上游地址
  transformerChain?: string[]; // 转换链数组
  transformTrace?: any; // 转换追踪信息

  // 模型与计费口径（新增）
  originalRequestModel?: string;
  requestedModel?: string;
  upstreamModel?: string;
  cachedInputTokens?: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  inputCost?: number;
  outputCost?: number;
  totalCost?: number;
  usageSource?: 'actual' | 'estimated';
  pricingStatus?: 'calculated' | 'skipped_no_usage' | 'skipped_no_rule' | 'error';
  pricingSnapshot?: string;
}

// 请求列表响应
export interface RequestListResponse {
  total: number;
  limit: number;
  offset: number;
  items: Array<{
    id: string;
    timestamp: number;
    client: string;
    path: string;
    method: string;
    matchedRules: string[];
    requestSize?: number;
    responseSize?: number;
    responseStatus?: number;
    durationMs?: number;
    error?: string;

    // 供应商和转换信息（兼容前端列表展示）
    supplierName?: string;
    supplierClient?: string;
    transformerChain?: string[];
    transformedPath?: string;

    // 模型与计费口径（列表只带轻量字段）
    originalRequestModel?: string;
    requestedModel?: string;
    upstreamModel?: string;
    model?: string;
    cachedInputTokens?: number;
    routeNameSnapshot?: string;
    pricingStatus?: 'calculated' | 'skipped_no_usage' | 'skipped_no_rule' | 'error';
    pricingSnapshot?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    totalCost?: number;
  }>;
}

// ============================================================================
// 规则引擎类型
// ============================================================================

export type PromptxyRequestContext = {
  client: PromptxyClient;
  field: PromptxyField;
  method: string;
  path: string;
  model?: string;
};

export type PromptxyRuleMatch = {
  ruleId: string;
  opType: PromptxyOpType;
};

export type PromptxyRuleApplyResult = {
  text: string;
  matches: PromptxyRuleMatch[];
};

// ============================================================================
// API 类型
// ============================================================================

// 配置同步请求
export interface ConfigSyncRequest {
  rules: PromptxyRule[];
}

// 配置同步响应
export interface ConfigSyncResponse {
  success: boolean;
  message: string;
  appliedRules: number;
}

// 规则操作请求
export interface RuleOperationRequest {
  rule: PromptxyRule;
}

// 规则操作响应
export interface RuleOperationResponse {
  success: boolean;
  message: string;
  rule?: PromptxyRule;
  errors?: string[];
  warnings?: string[];
}

// 预览请求
export interface PreviewRequest {
  body: any;
  client: PromptxyClient;
  field: PromptxyField;
  method?: string;
  path?: string;
  model?: string;
  // 可选：传入要测试的单个规则，如果提供则只测试该规则
  testRule?: PromptxyRule;
}

// 预览响应
export interface PreviewResponse {
  original: any;
  modified: any;
  matches: Array<{ ruleId: string; opType: PromptxyOpType }>;
}

// 清理响应
export interface CleanupResponse {
  deleted: number;
  remaining: number;
  success: boolean;
}

// ============================================================================
// SSE 事件类型
// ============================================================================

/**
 * 解析后的 SSE 事件结构
 * 用于存储 SSE 响应体
 */
export interface ParsedSSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

export interface SSERequestEvent {
  id: string;
  timestamp: number;
  client: string;
  path: string;
  method: string;
  matchedRules: string[];
}

export interface SSEConfigUpdatedEvent {
  timestamp: number;
  ruleCount: number;
}

// ============================================================================
// 规则验证类型
// ============================================================================

export interface RuleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// 供应商配置类型
// ============================================================================

// 供应商获取响应
export interface SuppliersFetchResponse {
  success: boolean;
  suppliers: Supplier[];
}

// 供应商创建请求
export interface SupplierCreateRequest {
  supplier: Omit<Supplier, 'id'>;
}

// 供应商创建响应
export interface SupplierCreateResponse {
  success: boolean;
  message: string;
  supplier: Supplier;
}

// 供应商更新请求
export interface SupplierUpdateRequest {
  supplier: Supplier;
}

// 供应商更新响应
export interface SupplierUpdateResponse {
  success: boolean;
  message: string;
  supplier: Supplier;
}

// 供应商删除响应
export interface SupplierDeleteResponse {
  success: boolean;
  message: string;
}

// 供应商切换请求
export interface SupplierToggleRequest {
  enabled: boolean;
}

// 供应商切换响应
export interface SupplierToggleResponse {
  success: boolean;
  message: string;
  supplier: Supplier;
}

// 路径列表响应
export interface PathsResponse {
  paths: string[];
  count: number;
}

// ============================================================================
// 路由配置类型
// ============================================================================

/**
 * 本地服务类型（对应路径前缀）
 */
export type LocalService = 'claude' | 'codex' | 'gemini';

/**
 * 转换器类型
 */
export type TransformerType = 'anthropic' | 'openai' | 'codex' | 'openai-chat' | 'gemini' | 'none';

/**
 * 模型映射规则
 * 将入站模型映射到指定供应商和可选的出站模型
 */
export interface ModelMappingRule {
  /** 规则唯一ID */
  id: string;
  /** 入站模型通配符模式，如 "claude-*-sonnet-*" */
  inboundModel: string;
  /** 目标供应商ID */
  targetSupplierId: string;
  /**
   * 可选的出站模型；缺失时透传入站 model。
   * 若目标 supplier 配置了 supportedModels 且非空，前端应优先提供下拉选择。
   */
  outboundModel?: string;
  /**
   * 转换器类型（可选）；未指定时由系统根据入站协议和供应商协议自动推导
   */
  transformer?: TransformerType;
  /** 可选描述 */
  description?: string;
  /** 是否启用该规则 */
  enabled?: boolean;
}

/**
 * 路由配置
 * 将本地服务路径映射到供应商，支持协议转换和模型级映射
 */
export interface Route {
  id: string; // 路由唯一标识
  localService: LocalService; // 本地服务（/claude, /codex, /gemini）
  /**
   * 模型映射规则列表（仅 claude 路由使用）
   * 按顺序匹配，第一个命中的生效
   */
  modelMappings?: ModelMappingRule[];
  /**
   * 单一供应商ID（codex/gemini 路由使用，简化配置）
   * 这些路由不支持协议转换，只需指定一个同协议的供应商
   */
  singleSupplierId?: string;
  enabled: boolean; // 是否启用
}

// 路由获取响应
export interface RoutesFetchResponse {
  success: boolean;
  routes: Route[];
}

// 路由创建请求
export interface RouteCreateRequest {
  route: Omit<Route, 'id'>;
}

// 路由创建响应
export interface RouteCreateResponse {
  success: boolean;
  message: string;
  route: Route;
}

// 路由更新请求
export interface RouteUpdateRequest {
  routeId: string;
  route: Partial<Route>;
}

// 路由更新响应
export interface RouteUpdateResponse {
  success: boolean;
  message: string;
  route: Route;
}

// 路由删除响应
export interface RouteDeleteResponse {
  success: boolean;
  message: string;
}

// 路由切换请求
export interface RouteToggleRequest {
  enabled: boolean;
}

// 路由切换响应
export interface RouteToggleResponse {
  success: boolean;
  message: string;
  route: Route;
}

// 索引重建响应
export interface RebuildIndexResponse {
  success: boolean;
  message: string;
  count: number;
}

// ============================================================================
// 统计系统类型
// ============================================================================

/**
 * 统计指标集合
 * 所有指标均为累加值，便于聚合计算
 */
export interface StatsMetrics {
  // Token 相关
  inputTokens: number;        // 输入 Token 总数
  outputTokens: number;       // 输出 Token 总数
  totalTokens: number;        // 总 Token 数（计算字段）

  // 费用相关（美元，保留 6 位小数）
  inputCost: number;          // 输入费用
  outputCost: number;         // 输出费用
  totalCost: number;          // 总费用（计算字段）

  // 时间相关（毫秒）
  waitTime: number;           // 等待时间总和（首字时间）
  durationTime: number;       // 总响应时间总和

  // 请求计数
  requestSuccess: number;     // 成功请求数
  requestFailed: number;      // 失败请求数
  requestTotal: number;       // 总请求数（计算字段）

  // FTUT（First Token Usage Time）
  ftutCount: number;          // 记录 FTUT 的请求数
  ftutSum: number;            // FTUT 总和（毫秒）
  ftutAvg: number;            // FTUT 平均值（计算字段）
}

/**
 * 空指标初始化
 */
export function emptyStatsMetrics(): StatsMetrics {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    inputCost: 0,
    outputCost: 0,
    totalCost: 0,
    waitTime: 0,
    durationTime: 0,
    requestSuccess: 0,
    requestFailed: 0,
    requestTotal: 0,
    ftutCount: 0,
    ftutSum: 0,
    ftutAvg: 0,
  };
}

/**
 * 总览统计（所有时间）
 */
export interface StatsTotal extends StatsMetrics {
  updatedAt: number;          // 最后更新时间
}

/**
 * 每日统计
 */
export interface StatsDaily extends StatsMetrics {
  date: string;               // YYYY-MM-DD 格式
  dateKey: number;            // 时间戳（便于排序）
}

/**
 * 小时统计（仅当日）
 */
export interface StatsHourly extends StatsMetrics {
  date: string;               // YYYY-MM-DD
  hour: number;               // 0-23
  dateHour: string;           // YYYY-MM-DD:HH 格式
}

/**
 * 供应商统计
 */
export interface StatsSupplier extends StatsMetrics {
  supplierId: string;
  supplierName: string;
}

/**
 * 模型统计
 */
export interface StatsModel extends StatsMetrics {
  model: string;              // 模型名称
  supplierName?: string;      // 所属供应商（可选）
}

/**
 * 路由统计
 */
export interface StatsRoute extends StatsMetrics {
  routeId: string;
  localService: string;       // claude | codex | gemini
}

/**
 * 今日统计（内存缓存）
 */
export interface StatsToday extends StatsMetrics {
  date: string;
  hourly: Record<number, StatsMetrics>;  // 按小时（0-23）分组
}

/**
 * 统计缓存结构
 */
export interface StatsCache {
  // 现有字段
  byClient: Record<string, number>;
  lastCleanup: number;

  // 新增统计字段
  total: StatsTotal;
  daily: Record<string, StatsDaily>;
  hourly: Record<string, StatsHourly>;
  supplier: Record<string, StatsSupplier>;
  model: Record<string, StatsModel>;
  route: Record<string, StatsRoute>;
  today: StatsToday;

  // 缓存元数据
  lastFlush: number;
  dirty: boolean;
}

/**
 * 模型价格配置
 * 价格单位：美元/1K tokens
 */
export interface ModelPrice {
  model: string;              // 模型名称（支持通配符，如 claude-*）
  inputPrice: number;         // 输入价格
  outputPrice: number;        // 输出价格
  provider?: string;          // 供应商标识（可选）
}

/**
 * 价格配置文件
 */
export interface PriceConfig {
  prices: ModelPrice[];
  updatedAt: number;
}

// ============================================================================
// 扩展 RequestRecord 添加统计字段
// ============================================================================

/**
 * 扩展 RequestRecord 接口，添加统计相关字段
 * 这些字段是可选的，用于向后兼容
 */
export interface RequestRecordStats {
  // 使用的模型
  model?: string;

  // Token 统计
  inputTokens?: number;       // 输入 Token 数
  outputTokens?: number;      // 输出 Token 数
  totalTokens?: number;       // 总 Token 数

  // 费用统计
  inputCost?: number;         // 输入费用
  outputCost?: number;        // 输出费用
  totalCost?: number;         // 总费用

  // 时间统计
  waitTime?: number;          // 等待时间（首字时间）
  ftut?: number;              // First Token Usage Time（首字时间）

  // 计费状态与快照
  pricingStatus?: 'calculated' | 'skipped_no_usage' | 'skipped_no_rule' | 'error';
  pricingSnapshot?: string;
}

// ============================================================================
// 统计 API 类型
// ============================================================================

/**
 * 统计数据响应
 */
export interface StatsDataResponse {
  total: StatsTotal;
  daily: StatsDaily[];
  hourly: StatsHourly[];
  supplier: StatsSupplier[];
  model: StatsModel[];
  route: StatsRoute[];
  today: StatsToday;
}

/**
 * 每日统计列表响应
 */
export interface StatsDailyListResponse {
  items: StatsDaily[];
}

/**
 * 小时统计列表响应
 */
export interface StatsHourlyListResponse {
  items: StatsHourly[];
}

/**
 * 供应商统计列表响应
 */
export interface StatsSupplierListResponse {
  items: StatsSupplier[];
}

/**
 * 模型统计列表响应
 */
export interface StatsModelListResponse {
  items: StatsModel[];
}

/**
 * 路由统计列表响应
 */
export interface StatsRouteListResponse {
  items: StatsRoute[];
}

// ============================================================================
// 同步服务类型
// ============================================================================

/**
 * 同步配置
 */
export interface SyncConfig {
  /** 是否启用定时同步 */
  enabled: boolean;
  /** 同步间隔（小时） */
  intervalHours: number;
  /** 具体同步时间（HH:mm 格式，可选） */
  syncTime?: string;
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟（毫秒） */
  retryDelayMs: number;
  /** 是否使用代理 */
  useProxy: boolean;
  /** 数据源配置 */
  sources: {
    /** 价格数据源 */
    prices: 'models.dev' | 'custom';
    /** 模型列表数据源 */
    models: 'models.dev' | 'custom';
  };
}

/**
 * 同步结果
 */
export interface SyncResult {
  /** 同步类型 */
  type: 'price' | 'model';
  /** 同步状态 */
  status: 'success' | 'failed' | 'partial';
  /** 同步记录数 */
  recordsCount: number;
  /** 错误信息 */
  error?: string;
  /** 耗时（毫秒） */
  duration: number;
  /** 开始时间戳 */
  startedAt: number;
  /** 完成时间戳 */
  finishedAt: number;
}

/**
 * 同步状态
 */
export interface SyncStatus {
  /** 是否正在同步 */
  syncing: boolean;
  /** 当前同步类型 */
  currentType?: 'price' | 'model' | 'all';
  /** 上次同步时间 */
  lastSyncTime?: number;
  /** 上次同步结果 */
  lastSyncResult?: SyncResult;
  /** 下次同步时间 */
  nextSyncTime?: number;
}

/**
 * 模型价格数据（来自 models.dev）
 */
export interface ModelPriceData {
  /** 模型名称 */
  id: string;
  /** 价格信息 */
  cost: {
    /** 输入价格（美元/1M tokens） */
    input: number;
    /** 输出价格（美元/1M tokens） */
    output: number;
    /** 缓存读取价格 */
    cache_read?: number;
    /** 缓存写入价格 */
    cache_write?: number;
  };
}

/**
 * models.dev API 响应格式
 */
export interface ModelsDevResponse {
  [provider: string]: {
    models: {
      [modelName: string]: ModelPriceData;
    };
  };
}

/**
 * 同步日志记录
 */
export interface SyncLog {
  /** 日志 ID */
  id: string;
  /** 同步类型 */
  type: 'price' | 'model';
  /** 同步状态 */
  status: 'success' | 'failed' | 'partial';
  /** 记录数 */
  recordsCount: number;
  /** 错误信息 */
  errorMessage?: string;
  /** 开始时间戳 */
  startedAt: number;
  /** 完成时间戳 */
  finishedAt?: number;
  /** 创建时间戳 */
  createdAt: number;
}

/**
 * 存储的模型价格数据
 */
export interface StoredModelPrice {
  /** 模型名称 */
  modelName: string;
  /** 供应商 */
  provider: string;
  /** 输入价格（美元/1K tokens） */
  inputPrice: number;
  /** 输出价格（美元/1K tokens） */
  outputPrice: number;
  /** 缓存读取价格 */
  cacheReadPrice: number;
  /** 缓存写入价格 */
  cacheWritePrice: number;
  /** 数据来源 */
  source: string;
  /** 同步时间戳 */
  syncedAt: number;
  /** 创建时间戳 */
  createdAt: number;
  /** 更新时间戳 */
  updatedAt: number;
}

/**
 * 存储的模型列表数据
 */
export interface StoredModelList {
  /** 模型名称 */
  modelName: string;
  /** 供应商 */
  provider: string;
  /** 协议类型 */
  protocol: 'anthropic' | 'openai-codex' | 'openai-chat' | 'gemini';
  /** 数据来源 */
  source: string;
  /** 同步时间戳 */
  syncedAt: number;
  /** 创建时间戳 */
  createdAt: number;
}
