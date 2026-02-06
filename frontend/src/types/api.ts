/**
 * API 相关类型定义
 */

export interface ConfigSyncRequest {
  rules: import('./rule').PromptxyRule[];
}

export interface ConfigSyncResponse {
  success: boolean;
  message: string;
  appliedRules: number;
  warnings?: string[];
}

export interface PreviewRequest {
  body: any;
  client: import('./rule').PromptxyClient;
  field: import('./rule').PromptxyField;
  method?: string;
  path?: string;
  model?: string;
  // 可选：传入要测试的单个规则，如果提供则只测试该规则
  testRule?: import('./rule').PromptxyRule;
}

export interface PreviewResponse {
  original: any;
  modified: any;
  matches: Array<{ ruleId: string; opType: string }>;
}

export interface CleanupResponse {
  deleted: number;
  remaining: number;
  success: boolean;
}

export interface DatabaseInfo {
  path: string;
  size: number;
  recordCount: number;
}

export interface RequestStats {
  total: number;
  byClient: Record<string, number>;
  recent: number;
  database: DatabaseInfo;
}

export interface SSEConnectionStatus {
  connected: boolean;
  lastEvent: number | null;
  error: string | null;
}

export interface SSERequestEvent {
  id: string;
  timestamp: number;
  client: string;
  path: string;
  method: string;
  matchedRules: string[];
}

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  service: string;
  timestamp: number;
}

export interface ErrorResponse {
  error: string;
  message?: string;
}

// 规则操作相关类型
export interface RuleOperationRequest {
  rule: import('./rule').PromptxyRule;
}

export interface RuleOperationResponse {
  success: boolean;
  message: string;
  rule?: import('./rule').PromptxyRule;
  errors?: string[];
  warnings?: string[];
}

// ============================================================================
// 供应商配置类型（解耦版本）
// ============================================================================

/**
 * 供应商协议类型
 */
export type SupplierProtocol = 'anthropic' | 'openai-codex' | 'openai-chat' | 'gemini';

/**
 * 供应商认证配置
 */
export interface SupplierAuth {
  type: 'bearer' | 'header' | 'none';
  token?: string;
  headerName?: string;
  headerValue?: string;
}

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

/**
 * 供应商配置（只管理上游供应商，不绑定本地路径）
 */
export interface Supplier {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string;
  protocol: SupplierProtocol; // 上游协议类型
  enabled: boolean;
  auth?: SupplierAuth;
  supportedModels: string[]; // 供应商支持的上游模型列表
  modelPricingMappings?: ModelPricingMapping[];
  reasoningEfforts?: string[]; // 可选：用于解析 modelSpec 的 effort 列表（UI 不暴露）
  description?: string;
}

export interface SuppliersFetchResponse {
  success: boolean;
  suppliers: Supplier[];
}

export interface SupplierCreateRequest {
  supplier: Omit<Supplier, 'id'>;
}

export interface SupplierCreateResponse {
  success: boolean;
  message: string;
  supplier: Supplier;
}

export interface SupplierUpdateRequest {
  supplier: Supplier;
}

export interface SupplierUpdateResponse {
  success: boolean;
  message: string;
  supplier: Supplier;
}

export interface SupplierDeleteResponse {
  success: boolean;
  message: string;
}

export interface SupplierToggleRequest {
  enabled: boolean;
}

export interface SupplierToggleResponse {
  success: boolean;
  message: string;
  supplier: Supplier;
}

export interface ModelSearchItem {
  modelName: string;
  source: string;
}

export interface ModelSearchResponse {
  items: ModelSearchItem[];
}

// ============================================================================
// 路由配置类型（独立管理）
// ============================================================================

/**
 * 本地服务类型
 */
export type LocalService = 'claude' | 'codex' | 'gemini';

/**
 * 转换器类型
 */
export type TransformerType = 'anthropic' | 'openai' | 'codex' | 'gemini' | 'none';

/**
 * 模型映射规则
 */
export interface ModelMappingRule {
  /** 规则唯一ID */
  id: string;
  /** 入站模型通配符模式，如 "claude-*-sonnet-*" */
  inboundModel: string;
  /** 目标供应商ID */
  targetSupplierId: string;
  /**
   * 可选的出站模型；缺失时透传入站 model
   */
  outboundModel?: string;
  /**
   * 转换器类型（可选）；未指定时由系统自动推导
   */
  transformer?: TransformerType;
  /** 可选描述 */
  description?: string;
  /** 是否启用该规则 */
  enabled?: boolean;
}

/**
 * 路由配置
 */
export interface Route {
  id: string;
  localService: LocalService; // 本地服务（/claude, /codex, /gemini）
  /**
   * 模型映射规则列表（仅 claude 路由使用）
   * 按顺序匹配，第一个命中的生效
   */
  modelMappings?: ModelMappingRule[];
  /**
   * 单一供应商ID（codex/gemini 路由使用，简化配置）
   */
  singleSupplierId?: string;
  enabled: boolean;
}

export interface RoutesFetchResponse {
  success: boolean;
  routes: Route[];
}

export interface RouteCreateRequest {
  route: Omit<Route, 'id'>;
}

export interface RouteCreateResponse {
  success: boolean;
  message: string;
  route: Route;
}

export interface RouteUpdateRequest {
  routeId: string;
  route: Partial<Route>;
}

export interface RouteUpdateResponse {
  success: boolean;
  message: string;
  route: Route;
}

export interface RouteDeleteResponse {
  success: boolean;
  message: string;
}

export interface RouteToggleRequest {
  enabled: boolean;
}

export interface RouteToggleResponse {
  success: boolean;
  message: string;
  route: Route;
}

// ============================================================================
// 协议转换类型（保留兼容性）
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

// ============================================================================
// 路径映射类型（保留兼容性）
// ============================================================================

export interface PathMapping {
  from: string;
  to: string;
  type?: 'exact' | 'prefix' | 'regex';
}

export interface CommonPrefix {
  prefix: string;
  suppliers: Supplier[];
  color: string;
}

export interface CommonPrefixOption {
  prefix: string;
  label: string;
  description: string;
  color: string;
}

// 路径列表响应
export interface PathsResponse {
  paths: string[];
  count: number;
}
