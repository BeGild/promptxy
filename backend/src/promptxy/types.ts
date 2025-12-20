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

export type PromptxyClient = "claude" | "codex" | "gemini";
export type PromptxyField = "system" | "instructions";

export type PromptxyOpType =
  | "set"
  | "append"
  | "prepend"
  | "replace"
  | "delete"
  | "insert_before"
  | "insert_after";

// ============================================================================
// 规则相关类型
// ============================================================================

export type PromptxyOp =
  | { type: "set"; text: string }
  | { type: "append"; text: string }
  | { type: "prepend"; text: string }
  | {
      type: "replace";
      match?: string;
      regex?: string;
      flags?: string;
      replacement: string;
    }
  | { type: "delete"; match?: string; regex?: string; flags?: string }
  | { type: "insert_before"; regex: string; flags?: string; text: string }
  | { type: "insert_after"; regex: string; flags?: string; text: string };

export type PromptxyRuleWhen = {
  client: PromptxyClient;
  field: PromptxyField;
  method?: string;
  pathRegex?: string;
  modelRegex?: string;
};

export type PromptxyRule = {
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

export type PromptxyConfig = {
  listen: {
    host: string;
    port: number;
  };
  api: {
    host: string;
    port: number;
  };
  upstreams: {
    anthropic: string;
    openai: string;
    gemini: string;
  };
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

  // 匹配规则
  matchedRules: string; // JSON 数组字符串

  // 响应信息
  responseStatus?: number;
  durationMs?: number;
  responseHeaders?: string; // JSON 字符串
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
  matchedRules: Array<{ ruleId: string; opType: PromptxyOpType }>;
  responseStatus?: number;
  durationMs?: number;
  responseHeaders?: Record<string, string>;
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
