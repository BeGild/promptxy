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
 * 供应商配置
 * 只管理上游 API 信息，不绑定本地路径
 */
export interface Supplier {
  id: string; // 唯一标识
  name: string; // 唯一名称标识符（用于内部引用）
  displayName: string; // 显示名称
  baseUrl: string; // 上游地址
  protocol: 'anthropic' | 'openai' | 'gemini'; // 上游协议类型
  enabled: boolean; // 是否启用
  auth?: SupplierAuth; // 上游认证配置（支持 none/bearer/header）
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
  modifiedBody: string;

  // 请求头（JSON 字符串，包含原始请求头和协议转换后的请求头）
  requestHeaders?: string; // JSON 字符串
  originalRequestHeaders?: string; // JSON 字符串（原始请求头）

  // 请求/响应大小（字节）
  requestSize?: number;
  responseSize?: number;

  // 匹配规则
  matchedRules: string; // JSON 数组字符串

  // 响应信息
  responseStatus?: number;
  durationMs?: number;
  responseHeaders?: string; // JSON 字符串
  responseBody?: string; // JSON 字符串
  error?: string;

  // 供应商和转换信息（新增）
  supplierId?: string; // 供应商 ID
  supplierName?: string; // 供应商名称
  transformerChain?: string; // JSON 字符串，转换链数组
  transformTrace?: string; // JSON 字符串，转换追踪信息
}

// API 返回的请求记录（解析后的）
export interface RequestRecordResponse {
  id: string;
  timestamp: number;
  client: string;
  path: string;
  method: string;
  originalBody: any;
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
  supplierId?: string; // 供应商 ID
  supplierName?: string; // 供应商名称
  transformerChain?: string[]; // 转换链数组
  transformTrace?: any; // 转换追踪信息
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
export type TransformerType = 'anthropic' | 'openai' | 'gemini' | 'none';

/**
 * 路由配置
 * 将本地服务路径映射到供应商，支持协议转换
 */
export interface Route {
  id: string; // 路由唯一标识
  localService: LocalService; // 本地服务（/claude, /codex, /gemini）
  supplierId: string; // 关联的供应商ID
  transformer: TransformerType; // 转换器类型（自动选择）
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
