/**
 * 记录查询模块类型定义
 */

/** 原始记录（从 YAML 文件加载） */
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
  matchedRules: string;
}

/** 解析后的记录 */
export interface ParsedRecord {
  id: string;
  timestamp: number;
  client: string;
  path: string;
  method: string;
  originalBody: unknown;
  modifiedBody: unknown;
  transformedBody?: unknown;
  responseBody?: unknown;
  matchedRules: unknown[];
  conversationId?: string;
}
