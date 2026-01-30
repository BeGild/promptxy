/**
 * records-query 类型定义
 * 用于渐进式披露的记录查询系统
 */

export interface SessionSummary {
  conversationId: string;
  requestCount: number;
  timeRange: {
    start: number;
    end: number;
  };
  client: string;
  supplier: string;
  hasError: boolean;
  models: string[];
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

export type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null' | 'undefined';

export interface FieldStructure {
  type: FieldType;
  value?: unknown;
  length?: number;
  fields?: Record<string, FieldStructure>;
  itemStructure?: FieldStructure | string;
  hasItems?: boolean;
  note?: string;
}

export interface StructureResult {
  requestId: string;
  structure: {
    originalBody?: FieldStructure;
    transformedBody?: FieldStructure;
    modifiedBody?: FieldStructure;
    responseBody?: FieldStructure;
  };
}

export interface DiffResult {
  request1: string;
  request2: string;
  structuralDifferences?: Record<string, {
    addedFields: string[];
    removedFields: string[];
    typeChanges: Record<string, { from: FieldType; to: FieldType }>;
    arrayLengthChanges: Record<string, { from: number; to: number }>;
  }>;
  fieldDifferences?: Record<string, {
    from: unknown;
    to: unknown;
    different: boolean;
  }>;
}

export interface GetOptions {
  path: string;
  truncate?: number;
  arrayLimit?: number;
  format?: 'json' | 'summary';
}

export interface ListSessionsOptions {
  limit?: number;
  filter?: string;
}

export interface ListRequestsOptions {
  conversationId: string;
  limit?: number;
}

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

export interface SessionsListResult {
  total: number;
  sessions: SessionSummary[];
}

export interface RequestsListResult {
  conversationId: string;
  requestCount: number;
  requests: RequestSummary[];
}

export interface RawRecord {
  id: string;
  timestamp: number;
  client: string;
  path: string;
  method: string;
  originalBody: string;
  transformedBody?: string;
  modifiedBody: string;
  requestHeaders?: Record<string, string> | string;
  originalRequestHeaders?: Record<string, string> | string;
  requestSize?: number;
  responseSize?: number;
  matchedRules: string;
  responseStatus?: number;
  durationMs?: number;
  responseHeaders?: Record<string, string> | string;
  responseBody?: string | unknown[];
  error?: string;
  routeId?: string;
  supplierId?: string;
  supplierName?: string;
  supplierBaseUrl?: string;
  supplierClient?: string;
  transformerChain?: string;
  transformTrace?: string;
  transformedPath?: string;
}

export interface ParsedRecord extends Omit<RawRecord, 'originalBody' | 'transformedBody' | 'modifiedBody' | 'responseBody' | 'matchedRules'> {
  originalBody: unknown;
  transformedBody?: unknown;
  modifiedBody: unknown;
  responseBody?: unknown;
  matchedRules: Array<{ ruleId: string; opType: string }>;
  conversationId?: string;
}
