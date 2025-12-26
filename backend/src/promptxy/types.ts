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
  | { type: 'insert_before'; regex: string; flags?: string; text: string }
  | { type: 'insert_after'; regex: string; flags?: string; text: string };

export type PromptxyRuleWhen = {
  client: PromptxyClient;
  field: PromptxyField;
  method?: string;
  pathRegex?: string;
  modelRegex?: string;
};

export type PromptxyRule = {
  uuid: string;           // 规则唯一标识符（自动生成，不可修改）
  name: string;           // 规则名称（可编辑）
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

/**
 * 供应商配置
 */
export interface Supplier {
  id: string;                  // 唯一标识
  name: string;                // 显示名称
  baseUrl: string;             // 上游地址
  localPrefix: string;         // 本地路径前缀（如 /claude）
  pathMappings?: PathMapping[]; // 路径映射规则
  enabled: boolean;            // 是否启用
}

export type PromptxyConfig = {
  listen: {
    host: string;
    port: number;
  };
  api: {
    host: string;
    port: number;
  };
  suppliers: Supplier[];
  rules: PromptxyRule[];
  storage: {
    maxHistory: number;
    autoCleanup: boolean;
    cleanupInterval: number; // hours
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
  requestSize?: number;
  responseSize?: number;
  matchedRules: Array<{ ruleId: string; opType: PromptxyOpType }>;
  responseStatus?: number;
  durationMs?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  error?: string;
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
