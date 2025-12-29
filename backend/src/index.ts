/**
 * PromptXY - HTTP 请求代理网关
 *
 * 这是一个用于拦截和修改 AI 服务提供商 HTTP 请求的代理网关
 */

// 核心网关
export { createGateway } from './promptxy/gateway.js';

// 规则引擎
export { applyPromptRules } from './promptxy/rules/engine.js';

// 类型
export type {
  // 基础类型
  PromptxyClient,
  PromptxyField,
  PromptxyOpType,
  PromptxyOp,
  // 规则相关类型
  PromptxyRule,
  PromptxyRuleWhen,
  PromptxyRuleMatch,
  PromptxyRuleApplyResult,
  PromptxyRequestContext,
  // 配置类型
  PromptxyConfig,
  Supplier,
  PathMapping,
  // 请求记录类型
  RequestRecord,
  RequestRecordResponse,
  RequestListResponse,
  // API 类型
  ConfigSyncRequest,
  ConfigSyncResponse,
  RuleOperationRequest,
  RuleOperationResponse,
  PreviewRequest,
  PreviewResponse,
  CleanupResponse,
  // SSE 事件类型
  SSERequestEvent,
  SSEConfigUpdatedEvent,
  // 供应商配置类型
  SuppliersFetchResponse,
  SupplierCreateRequest,
  SupplierCreateResponse,
  SupplierUpdateRequest,
  SupplierUpdateResponse,
  SupplierDeleteResponse,
  SupplierToggleRequest,
  SupplierToggleResponse,
  PathsResponse,
  // 规则验证类型
  RuleValidationResult,
} from './promptxy/types.js';
