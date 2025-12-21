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
