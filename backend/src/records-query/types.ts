/**
 * records-query 模块类型定义
 */

export type FieldType = 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'array' | 'object';

export interface FieldStructure {
  type: FieldType;
  value?: unknown;
  length?: number;
  hasItems?: boolean;
  itemStructure?: FieldStructure | string;
  fields?: Record<string, FieldStructure>;
}

// 原始记录类型（从 YAML 加载）
export interface RawRecord {
  id: string;
  timestamp: number;
  client: string;
  path: string;
  method: string;
  originalBody: string;
  modifiedBody: string;
  transformedBody?: string;
  responseBody?: string;
  responseStatus?: number;
  durationMs?: number;
  supplierName?: string;
  supplierId?: string;
  error?: string;
  matchedRules?: string;
  transformerChain?: string;
  transformTrace?: string;
  model?: string;
}

// 解析后的记录类型
export interface ParsedRecord extends Omit<RawRecord, 'originalBody' | 'modifiedBody' | 'transformedBody' | 'responseBody'> {
  originalBody: unknown;
  modifiedBody: unknown;
  transformedBody?: unknown;
  responseBody?: unknown;
  matchedRules: string[];
  conversationId?: string;
}

// ===== List Sessions 命令类型 =====
export interface ListSessionsOptions {
  limit?: number;
  filter?: string;
}

export interface SessionSummary {
  conversationId: string;
  requestCount: number;
  timeRange: { start: number; end: number };
  client: string;
  supplier: string;
  hasError: boolean;
  models: string[];
}

export interface SessionsListResult {
  total: number;
  sessions: SessionSummary[];
}

// ===== List Requests 命令类型 =====
export interface ListRequestsOptions {
  conversationId: string;
  limit?: number;
}

export interface RequestSummary {
  id: string;
  index: number;
  timestamp: number;
  path: string;
  method: string;
  client: string;
  supplier?: string;
  model?: string;
  hasTransformError: boolean;
  responseStatus?: number;
  durationMs?: number;
}

export interface RequestsListResult {
  conversationId: string;
  requestCount: number;
  requests: RequestSummary[];
}

// ===== Structure 命令类型 =====
export interface StructureResult {
  requestId: string;
  structure: {
    originalBody?: FieldStructure;
    transformedBody?: FieldStructure;
    modifiedBody?: FieldStructure;
    responseBody?: FieldStructure;
  };
}

// ===== Diff 命令类型 =====
export interface DiffResult {
  request1: string;
  request2: string;
  structuralDifferences?: {
    originalBody?: ReturnType<typeof import('./analyzer').compareStructures>;
    modifiedBody?: ReturnType<typeof import('./analyzer').compareStructures>;
    transformedBody?: ReturnType<typeof import('./analyzer').compareStructures>;
  };
  fieldDifferences?: Record<string, {
    from: unknown;
    to: unknown;
    different: boolean;
  }>;
}

// ===== Get 命令类型 =====
export interface GetOptions {
  path: string;
  truncate?: number;
  arrayLimit?: number;
  format?: 'json' | 'summary';
}

// ===== Trace 命令类型 =====
export interface TransformStep {
  step: string;
  fromProtocol?: string;
  toProtocol?: string;
  changes: {
    addedFields: string[];
    removedFields: string[];
    renamedFields: Record<string, string>;
    typeChanges: Record<string, { from: string; to: string }>;
  };
}

export interface TransformTraceResult {
  requestId: string;
  transformChain: TransformStep[];
}
