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
