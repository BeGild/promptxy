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
// 供应商配置类型
// ============================================================================

export interface PathMapping {
  from: string;
  to: string;
  type?: 'exact' | 'prefix' | 'regex';
}

export interface Supplier {
  id: string;
  name: string;
  baseUrl: string;
  localPrefix: string;
  pathMappings?: PathMapping[];
  enabled: boolean;
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
