# records-query 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 records-query CLI 工具，为 AI 提供渐进式披露的记录查询接口

**Architecture:** 基于项目现有的 records 存储系统（YAML 文件），实现一个 TypeScript CLI 工具，提供分层查询命令。工具位于 backend/src/records-query/，通过 CLI 子命令方式暴露。

**Tech Stack:** TypeScript, Node.js, Vitest (测试), YAML 解析 (js-yaml), yargs (CLI)

---

## 前置准备

### Task 0: 添加依赖

**文件:**
- Modify: `/home/ekko.bao/work/promptxy/package.json`

**步骤 1: 安装 js-yarn 和 @types/js-yaml**

```bash
cd /home/ekko.bao/work/promptxy && npm install js-yaml && npm install --save-dev @types/js-yaml
```

**预期输出:** 安装成功，package.json 中新增依赖

**步骤 2: 提交**

```bash
git add package.json package-lock.json
git commit -m "添加 js-yaml 依赖用于 YAML 解析"
```

---

## 第一阶段：基础架构

### Task 1: 创建类型定义

**文件:**
- Create: `/home/ekko.bao/work/promptxy/backend/src/records-query/types.ts`

**步骤 1: 写入类型定义文件**

```typescript
/**
 * records-query 类型定义
 * 用于渐进式披露的记录查询系统
 */

/**
 * 会话摘要（列表视图）
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

/**
 * 请求摘要（列表视图）
 */
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

/**
 * 字段类型定义
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null' | 'undefined';

/**
 * 字段结构描述
 */
export interface FieldStructure {
  type: FieldType;
  value?: unknown;
  length?: number;
  fields?: Record<string, FieldStructure>;
  itemStructure?: FieldStructure | string;
  hasItems?: boolean;
  note?: string;
}

/**
 * 结构分析结果
 */
export interface StructureResult {
  requestId: string;
  structure: {
    originalBody?: FieldStructure;
    transformedBody?: FieldStructure;
    modifiedBody?: FieldStructure;
    responseBody?: FieldStructure;
  };
}

/**
 * 差异结果
 */
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

/**
 * Get 命令选项
 */
export interface GetOptions {
  path: string;
  truncate?: number;
  arrayLimit?: number;
  format?: 'json' | 'summary';
}

/**
 * List 命令选项
 */
export interface ListSessionsOptions {
  limit?: number;
  filter?: string;
}

export interface ListRequestsOptions {
  conversationId: string;
  limit?: number;
}

/**
 * 转换步骤
 */
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

/**
 * 转换追踪结果
 */
export interface TransformTraceResult {
  requestId: string;
  transformChain: TransformStep[];
}

/**
 * 会话列表结果
 */
export interface SessionsListResult {
  total: number;
  sessions: SessionSummary[];
}

/**
 * 请求列表结果
 */
export interface RequestsListResult {
  conversationId: string;
  requestCount: number;
  requests: RequestSummary[];
}

/**
 * 原始记录（从 YAML 读取）
 */
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

/**
 * 解析后的记录
 */
export interface ParsedRecord extends Omit<RawRecord, 'originalBody' | 'transformedBody' | 'modifiedBody' | 'responseBody' | 'matchedRules'> {
  originalBody: unknown;
  transformedBody?: unknown;
  modifiedBody: unknown;
  responseBody?: unknown;
  matchedRules: Array<{ ruleId: string; opType: string }>;
  conversationId?: string;
}

```

**步骤 2: 提交**

```bash
git add backend/src/records-query/types.ts
git commit -m "添加 records-query 类型定义"
```

---

### Task 2: 实现记录加载器

**文件:**
- Create: `/home/ekko.bao/work/promptxy/backend/src/records-query/loader.ts`
- Test: `/home/ekko.bao/work/promptxy/backend/tests/records-query/loader.test.ts`

**步骤 1: 编写测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadRecords, loadRecord, parseRecord, extractConversationId } from '../../src/records-query/loader';
import type { RawRecord } from '../../src/records-query/types';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('fs');
vi.mock('path');

describe('loader', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('extractConversationId', () => {
    it('应该从 body 中提取 conversation_id', () => {
      const body = {
        conversation_id: 'conv_123',
        messages: []
      };
      expect(extractConversationId(body)).toBe('conv_123');
    });

    it('应该从 body 中提取 id 作为回退', () => {
      const body = {
        id: 'msg_456',
        messages: []
      };
      expect(extractConversationId(body)).toBe('msg_456');
    });

    it('应该返回 undefined 如果没有可识别的字段', () => {
      const body = { messages: [] };
      expect(extractConversationId(body)).toBeUndefined();
    });
  });

  describe('parseRecord', () => {
    it('应该正确解析原始记录', () => {
      const raw: RawRecord = {
        id: 'test-123',
        timestamp: 1737312568000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: '{"model":"claude-3-5-sonnet","messages":[{"role":"user","content":"hello"}]}',
        modifiedBody: '{"model":"claude-3-5-sonnet","messages":[{"role":"user","content":"hello"}]}',
        matchedRules: '[]'
      };

      const parsed = parseRecord(raw);

      expect(parsed.id).toBe('test-123');
      expect(parsed.originalBody).toEqual({
        model: 'claude-3-5-sonnet',
        messages: [{ role: 'user', content: 'hello' }]
      });
      expect(parsed.conversationId).toBeUndefined(); // originalBody 没有 conversation_id
    });

    it('应该正确解析带有 conversation_id 的记录', () => {
      const raw: RawRecord = {
        id: 'test-456',
        timestamp: 1737312568000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: '{"model":"claude-3-5-sonnet","conversation_id":"conv_abc","messages":[]}',
        modifiedBody: '{"model":"claude-3-5-sonnet","conversation_id":"conv_abc","messages":[]}',
        matchedRules: '[]'
      };

      const parsed = parseRecord(raw);
      expect(parsed.conversationId).toBe('conv_abc');
    });
  });
});
```

**步骤 2: 运行测试，确保它失败**

```bash
cd /home/ekko.bao/work/promptxy && npm run test -- backend/tests/records-query/loader.test.ts
```

**预期输出:** 失败，提示模块未找到或函数未导出

**步骤 3: 实现 loader.ts**

```typescript
/**
 * 记录加载器
 * 负责从文件系统加载和解析记录
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { RawRecord, ParsedRecord } from './types';

const RECORDS_DIR = path.join(process.env.HOME || '', '.local', 'promptxy', 'requests');

/**
 * 从请求体中提取会话 ID
 * 尝试多个字段，按优先级获取
 */
export function extractConversationId(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }

  const b = body as Record<string, unknown>;

  // 按优先级尝试多个字段
  const idFields = [
    'conversation_id',
    'conversationId',
    'session_id',
    'sessionId',
    'id'
  ];

  for (const field of idFields) {
    const value = b[field];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

/**
 * 安全地解析 JSON 字符串
 */
function safeJsonParse(str: string | undefined): unknown {
  if (!str) return undefined;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * 解析原始记录
 */
export function parseRecord(raw: RawRecord): ParsedRecord {
  const parsed: ParsedRecord = {
    ...raw,
    originalBody: safeJsonParse(raw.originalBody),
    modifiedBody: safeJsonParse(raw.modifiedBody),
    matchedRules: []
  };

  if (raw.transformedBody) {
    parsed.transformedBody = safeJsonParse(raw.transformedBody);
  }

  if (raw.responseBody && typeof raw.responseBody === 'string') {
    parsed.responseBody = safeJsonParse(raw.responseBody);
  }

  if (raw.matchedRules) {
    try {
      parsed.matchedRules = JSON.parse(raw.matchedRules);
    } catch {
      parsed.matchedRules = [];
    }
  }

  // 从 originalBody 提取 conversationId
  parsed.conversationId = extractConversationId(parsed.originalBody);

  return parsed;
}

/**
 * 加载单个记录文件
 */
export function loadRecord(recordId: string): ParsedRecord | null {
  const filePath = path.join(RECORDS_DIR, `${recordId}.yaml`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const raw = yaml.load(content) as RawRecord;
    return parseRecord(raw);
  } catch (error) {
    console.error(`Error loading record ${recordId}:`, error);
    return null;
  }
}

/**
 * 加载所有记录
 */
export function loadRecords(): ParsedRecord[] {
  if (!fs.existsSync(RECORDS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(RECORDS_DIR)
    .filter(f => f.endsWith('.yaml'))
    .sort((a, b) => b.localeCompare(a)); // 按文件名倒序（时间倒序）

  const records: ParsedRecord[] = [];

  for (const file of files) {
    try {
      const filePath = path.join(RECORDS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const raw = yaml.load(content) as RawRecord;
      records.push(parseRecord(raw));
    } catch (error) {
      console.error(`Error loading record ${file}:`, error);
    }
  }

  return records;
}
```

**步骤 4: 运行测试，确保通过**

```bash
cd /home/ekko.bao/work/promptxy && npm run test -- backend/tests/records-query/loader.test.ts
```

**预期输出:** PASS

**步骤 5: 提交**

```bash
git add backend/src/records-query/loader.ts backend/tests/records-query/loader.test.ts
git commit -m "实现 records-query 记录加载器"
```

---

### Task 3: 实现结构分析器

**文件:**
- Create: `/home/ekko.bao/work/promptxy/backend/src/records-query/analyzer.ts`
- Test: `/home/ekko.bao/work/promptxy/backend/tests/records-query/analyzer.test.ts`

**步骤 1: 编写测试**

```typescript
import { describe, it, expect } from 'vitest';
import { analyzeStructure, getFieldType, getValueByPath, compareStructures } from '../../src/records-query/analyzer';
import type { FieldStructure, DiffResult } from '../../src/records-query/types';

describe('analyzer', () => {
  describe('getFieldType', () => {
    it('应该正确识别基本类型', () => {
      expect(getFieldType('hello')).toBe('string');
      expect(getFieldType(123)).toBe('number');
      expect(getFieldType(true)).toBe('boolean');
      expect(getFieldType(null)).toBe('null');
      expect(getFieldType(undefined)).toBe('undefined');
      expect(getFieldType([1, 2, 3])).toBe('array');
      expect(getFieldType({ a: 1 })).toBe('object');
    });
  });

  describe('analyzeStructure', () => {
    it('应该分析简单对象结构', () => {
      const obj = {
        name: 'test',
        count: 5,
        active: true
      };

      const structure = analyzeStructure(obj);

      expect(structure.type).toBe('object');
      expect(structure.fields?.name.type).toBe('string');
      expect(structure.fields?.name.value).toBe('test');
      expect(structure.fields?.count.value).toBe(5);
      expect(structure.fields?.active.value).toBe(true);
    });

    it('应该分析数组结构', () => {
      const obj = {
        items: [1, 2, 3, 4, 5]
      };

      const structure = analyzeStructure(obj);

      expect(structure.fields?.items.type).toBe('array');
      expect(structure.fields?.items.length).toBe(5);
      expect(structure.fields?.items.hasItems).toBe(true);
    });

    it('应该截断长字符串', () => {
      const longStr = 'a'.repeat(1000);
      const obj = { content: longStr };

      const structure = analyzeStructure(obj);

      expect(structure.fields?.content.type).toBe('string');
      expect((structure.fields?.content.value as string).length).toBeLessThan(100);
    });
  });

  describe('getValueByPath', () => {
    it('应该通过路径获取值', () => {
      const obj = {
        level1: {
          level2: {
            value: 'deep'
          }
        },
        array: [
          { id: 1 },
          { id: 2 }
        ]
      };

      expect(getValueByPath(obj, 'level1.level2.value')).toBe('deep');
      expect(getValueByPath(obj, 'array[0].id')).toBe(1);
      expect(getValueByPath(obj, 'array[1].id')).toBe(2);
    });

    it('应该处理不存在的路径', () => {
      const obj = { a: 1 };
      expect(getValueByPath(obj, 'a.b.c')).toBeUndefined();
    });
  });

  describe('compareStructures', () => {
    it('应该检测结构差异', () => {
      const obj1 = { a: 1, b: [1, 2] };
      const obj2 = { a: 1, c: 'new', b: [1, 2, 3] };

      const diff = compareStructures(obj1, obj2, 'root');

      expect(diff.addedFields).toContain('c');
      expect(diff.removedFields).toContain('b');
      expect(diff.arrayLengthChanges['b']).toEqual({ from: 2, to: 3 });
    });
  });
});
```

**步骤 2: 运行测试，确保失败**

```bash
cd /home/ekko.bao/work/promptxy && npm run test -- backend/tests/records-query/analyzer.test.ts
```

**步骤 3: 实现 analyzer.ts**

```typescript
/**
 * 结构分析器
 * 分析记录结构，支持路径查询和差异对比
 */

import type { FieldStructure, FieldType, DiffResult } from './types';

const MAX_STRING_PREVIEW = 100;

/**
 * 获取值的类型
 */
export function getFieldType(value: unknown): FieldType {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value as FieldType;
}

/**
 * 截断长字符串用于预览
 */
function truncateString(str: string, maxLength = MAX_STRING_PREVIEW): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + `...(${str.length} chars)`;
}

/**
 * 分析单个值的结构
 */
export function analyzeStructure(value: unknown, depth = 0): FieldStructure {
  const type = getFieldType(value);

  // 基本类型：返回实际值
  if (type === 'string') {
    return { type, value: truncateString(value as string) };
  }
  if (type === 'number' || type === 'boolean' || type === 'null') {
    return { type, value };
  }
  if (type === 'undefined') {
    return { type };
  }

  // 数组类型：只返回长度和结构描述
  if (type === 'array') {
    const arr = value as unknown[];
    const result: FieldStructure = {
      type,
      length: arr.length,
      hasItems: arr.length > 0
    };

    if (arr.length > 0 && depth < 2) {
      // 分析第一个元素作为代表
      result.itemStructure = analyzeStructure(arr[0], depth + 1);
    } else if (arr.length > 0) {
      result.itemStructure = '/* complex */';
    }

    return result;
  }

  // 对象类型：递归分析字段
  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    const fields: Record<string, FieldStructure> = {};

    for (const [key, val] of Object.entries(obj)) {
      fields[key] = analyzeStructure(val, depth + 1);
    }

    return { type, fields };
  }

  return { type };
}

/**
 * 通过路径获取值
 * 支持点号路径和数组索引，如 "messages[0].content"
 */
export function getValueByPath(obj: unknown, path: string): unknown {
  if (!path || typeof obj !== 'object' || obj === null) {
    return undefined;
  }

  // 解析路径，支持 "a[0].b" 和 "a.b" 格式
  const parts: (string | number)[] = [];
  const regex = /([^[\].]+)|\[(\d+)\]/g;
  let match;

  while ((match = regex.exec(path)) !== null) {
    if (match[1]) {
      parts.push(match[1]);
    } else if (match[2]) {
      parts.push(parseInt(match[2], 10));
    }
  }

  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof part === 'number') {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[part];
    } else {
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

/**
 * 设置路径的值（用于构建差异对象）
 */
function setValueByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * 比较两个结构
 */
export function compareStructures(
  obj1: unknown,
  obj2: unknown,
  path: string,
  result: {
    addedFields: string[];
    removedFields: string[];
    typeChanges: Record<string, { from: FieldType; to: FieldType }>;
    arrayLengthChanges: Record<string, { from: number; to: number }>;
  } = { addedFields: [], removedFields: [], typeChanges: {}, arrayLengthChanges: {} }
): typeof result {
  const type1 = getFieldType(obj1);
  const type2 = getFieldType(obj2);

  // 类型变化
  if (type1 !== type2) {
    result.typeChanges[path] = { from: type1, to: type2 };
    return result;
  }

  // 数组长度变化
  if (type1 === 'array' && type2 === 'array') {
    const arr1 = obj1 as unknown[];
    const arr2 = obj2 as unknown[];
    if (arr1.length !== arr2.length) {
      result.arrayLengthChanges[path] = { from: arr1.length, to: arr2.length };
    }
  }

  // 对象字段变化
  if (type1 === 'object' && type2 === 'object') {
    const o1 = obj1 as Record<string, unknown>;
    const o2 = obj2 as Record<string, unknown>;

    const keys1 = Object.keys(o1);
    const keys2 = Object.keys(o2);

    // 新增的字段
    for (const key of keys2) {
      if (!(key in o1)) {
        result.addedFields.push(path === 'root' ? key : `${path}.${key}`);
      }
    }

    // 删除的字段
    for (const key of keys1) {
      if (!(key in o2)) {
        result.removedFields.push(path === 'root' ? key : `${path}.${key}`);
      }
    }

    // 递归比较共同字段
    for (const key of keys1) {
      if (key in o2) {
        compareStructures(o1[key], o2[key], path === 'root' ? key : `${path}.${key}`, result);
      }
    }
  }

  return result;
}

/**
 * 获取指定路径的完整值（带截断控制）
 */
export function getValueWithOptions(
  value: unknown,
  options: {
    truncate?: number;
    arrayLimit?: number;
    format?: 'json' | 'summary';
  } = {}
): unknown {
  const { truncate = 500, arrayLimit = 10, format = 'json' } = options;

  if (format === 'summary') {
    return getSummary(value);
  }

  return processValue(value, truncate, arrayLimit, 0);
}

/**
 * 处理值（递归截断）
 */
function processValue(
  value: unknown,
  truncate: number,
  arrayLimit: number,
  depth: number
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  const type = getFieldType(value);

  if (type === 'string') {
    const str = value as string;
    if (str.length <= truncate) return str;
    return str.substring(0, truncate) + `...(${str.length - truncate} more chars)`;
  }

  if (type === 'array') {
    const arr = value as unknown[];
    if (arr.length === 0) return [];

    const limited = arr.slice(0, arrayLimit);
    const processed = limited.map(item =>
      depth < 3 ? processValue(item, truncate, arrayLimit, depth + 1) : '/* ... */'
    );

    if (arr.length > arrayLimit) {
      return {
        items: processed,
        totalCount: arr.length,
        truncated: true
      };
    }

    return processed;
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(obj)) {
      result[key] = depth < 3
        ? processValue(val, truncate, arrayLimit, depth + 1)
        : '/* ... */';
    }

    return result;
  }

  // 基本类型直接返回
  return value;
}

/**
 * 获取值的摘要信息
 */
function getSummary(value: unknown): unknown {
  const type = getFieldType(value);

  if (type === 'array') {
    const arr = value as unknown[];
    const summary: Record<string, unknown> = { count: arr.length };

    if (arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
      // 尝试提取关键字段（如 name, id, type）
      const first = arr[0] as Record<string, unknown>;
      const keyFields = ['name', 'id', 'type', 'function', 'role'];

      for (const field of keyFields) {
        if (field in first) {
          const names = arr
            .map(item => (item as Record<string, unknown>)?.[field])
            .filter(Boolean)
            .slice(0, 5);
          if (names.length > 0) {
            summary[field === 'function' ? 'functions' : `${field}s`] = names;
            break;
          }
        }
      }
    }

    return summary;
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    return {
      keys: Object.keys(obj).slice(0, 10),
      keyCount: Object.keys(obj).length
    };
  }

  return { type, value };
}
```

**步骤 4: 运行测试，确保通过**

```bash
cd /home/ekko.bao/work/promptxy && npm run test -- backend/tests/records-query/analyzer.test.ts
```

**预期输出:** PASS

**步骤 5: 提交**

```bash
git add backend/src/records-query/analyzer.ts backend/tests/records-query/analyzer.test.ts
git commit -m "实现 records-query 结构分析器"
```

---

## 第二阶段：命令实现

### Task 4: 实现 list sessions 命令

**文件:**
- Create: `/home/ekko.bao/work/promptxy/backend/src/records-query/commands/list-sessions.ts`
- Test: `/home/ekko.bao/work/promptxy/backend/tests/records-query/commands/list-sessions.test.ts`

**步骤 1: 编写测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listSessions } from '../../../src/records-query/commands/list-sessions';
import type { ParsedRecord } from '../../../src/records-query/types';

vi.mock('../../../src/records-query/loader', () => ({
  loadRecords: vi.fn()
}));

import { loadRecords } from '../../../src/records-query/loader';

describe('listSessions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('应该按 conversationId 分组', () => {
    const mockRecords: ParsedRecord[] = [
      {
        id: 'req-1',
        timestamp: 1000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: {},
        modifiedBody: {},
        matchedRules: [],
        conversationId: 'conv-1',
        supplierName: 'openai',
        model: 'claude-3-5-sonnet',
        responseStatus: 200
      },
      {
        id: 'req-2',
        timestamp: 2000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: {},
        modifiedBody: {},
        matchedRules: [],
        conversationId: 'conv-1',
        supplierName: 'openai',
        model: 'claude-3-5-sonnet',
        responseStatus: 200
      },
      {
        id: 'req-3',
        timestamp: 3000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: {},
        modifiedBody: {},
        matchedRules: [],
        conversationId: 'conv-2',
        supplierName: 'anthropic',
        model: 'claude-3-opus',
        responseStatus: 500,
        error: 'error'
      }
    ];

    vi.mocked(loadRecords).mockReturnValue(mockRecords);

    const result = listSessions({ limit: 10 });

    expect(result.total).toBe(2);
    expect(result.sessions[0].requestCount).toBe(2);
    expect(result.sessions[0].hasError).toBe(false);
    expect(result.sessions[1].hasError).toBe(true);
  });

  it('应该支持过滤', () => {
    const mockRecords: ParsedRecord[] = [
      {
        id: 'req-1',
        timestamp: 1000,
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        originalBody: {},
        modifiedBody: {},
        matchedRules: [],
        conversationId: 'conv-1',
        supplierName: 'openai',
        responseStatus: 200
      },
      {
        id: 'req-2',
        timestamp: 2000,
        client: 'codex',
        path: '/v1/completions',
        method: 'POST',
        originalBody: {},
        modifiedBody: {},
        matchedRules: [],
        conversationId: 'conv-2',
        supplierName: 'anthropic',
        responseStatus: 200
      }
    ];

    vi.mocked(loadRecords).mockReturnValue(mockRecords);

    const result = listSessions({ limit: 10, filter: 'client=claude' });

    expect(result.total).toBe(1);
    expect(result.sessions[0].client).toBe('claude');
  });
});
```

**步骤 2: 运行测试，确保失败**

**步骤 3: 实现 list-sessions.ts**

```typescript
/**
 * list sessions 命令
 * 列出所有会话及其概要信息
 */

import { loadRecords } from '../loader';
import type { SessionsListResult, ListSessionsOptions, ParsedRecord, SessionSummary } from '../types';

/**
 * 解析过滤条件
 */
function parseFilter(filterStr: string): Record<string, string> {
  const result: Record<string, string> = {};

  if (!filterStr) return result;

  const pairs = filterStr.split(',');
  for (const pair of pairs) {
    const [key, value] = pair.split('=').map(s => s.trim());
    if (key && value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * 检查记录是否匹配过滤条件
 */
function matchesFilter(record: ParsedRecord, filters: Record<string, string>): boolean {
  for (const [key, value] of Object.entries(filters)) {
    switch (key) {
      case 'client':
        if (record.client !== value) return false;
        break;
      case 'supplier':
        if (record.supplierName !== value) return false;
        break;
      case 'hasError':
        const hasError = !!record.error || (record.responseStatus && record.responseStatus >= 400);
        if (hasError !== (value === 'true')) return false;
        break;
      case 'supplierId':
        if (record.supplierId !== value) return false;
        break;
      default:
        // 未知过滤条件，忽略
        break;
    }
  }

  return true;
}

/**
 * 列出会话
 */
export function listSessions(options: ListSessionsOptions = {}): SessionsListResult {
  const { limit = 20, filter } = options;
  const records = loadRecords();
  const filters = parseFilter(filter || '');

  // 过滤记录
  const filteredRecords = records.filter(r => matchesFilter(r, filters));

  // 按 conversationId 分组
  const sessionsMap = new Map<string, {
    records: ParsedRecord[];
    conversationId: string;
  }>();

  for (const record of filteredRecords) {
    const convId = record.conversationId || record.id;

    if (!sessionsMap.has(convId)) {
      sessionsMap.set(convId, {
        records: [],
        conversationId: convId
      });
    }

    sessionsMap.get(convId)!.records.push(record);
  }

  // 构建会话摘要
  const sessions: SessionSummary[] = Array.from(sessionsMap.values())
    .map(({ records, conversationId }) => {
      const sorted = records.sort((a, b) => a.timestamp - b.timestamp);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      const models = [...new Set(records.map(r => r.model).filter(Boolean))];
      const hasError = records.some(r =>
        !!r.error || (r.responseStatus && r.responseStatus >= 400)
      );

      return {
        conversationId,
        requestCount: records.length,
        timeRange: {
          start: first.timestamp,
          end: last.timestamp
        },
        client: first.client,
        supplier: first.supplierName || 'unknown',
        hasError,
        models: models as string[]
      };
    })
    .sort((a, b) => b.timeRange.end - a.timeRange.end) // 按时间倒序
    .slice(0, limit);

  return {
    total: sessionsMap.size,
    sessions
  };
}
```

**步骤 4: 运行测试，确保通过**

**步骤 5: 提交**

```bash
git add backend/src/records-query/commands/list-sessions.ts backend/tests/records-query/commands/list-sessions.test.ts
git commit -m "实现 records-query list sessions 命令"
```

---

### Task 5-8: 继续实现其他命令

按照相同模式实现：

**Task 5: list requests 命令**
- Create: `backend/src/records-query/commands/list-requests.ts`
- Test: `backend/tests/records-query/commands/list-requests.test.ts`

**Task 6: structure 命令**
- Create: `backend/src/records-query/commands/structure.ts`
- Test: `backend/tests/records-query/commands/structure.test.ts`

**Task 7: diff 命令**
- Create: `backend/src/records-query/commands/diff.ts`
- Test: `backend/tests/records-query/commands/diff.test.ts`

**Task 8: get 命令**
- Create: `backend/src/records-query/commands/get.ts`
- Test: `backend/tests/records-query/commands/get.test.ts`

**Task 9: trace 命令**
- Create: `backend/src/records-query/commands/trace.ts`
- Test: `backend/tests/records-query/commands/trace.test.ts`

---

## 第三阶段：CLI 集成

### Task 10: 创建主 CLI 入口

**文件:**
- Create: `/home/ekko.bao/work/promptxy/backend/src/records-query/cli.ts`
- Create: `/home/ekko.bao/work/promptxy/backend/src/records-query/index.ts`

**步骤 1: 实现 index.ts (导出)**

```typescript
/**
 * records-query 模块导出
 */

export * from './types';
export * from './loader';
export * from './analyzer';
export * from './commands/list-sessions';
export * from './commands/list-requests';
export * from './commands/structure';
export * from './commands/diff';
export * from './commands/get';
export * from './commands/trace';
```

**步骤 2: 实现 cli.ts (CLI 入口)**

```typescript
#!/usr/bin/env node
/**
 * records-query CLI 入口
 * 渐进式披露的记录查询工具
 */

import { listSessions } from './commands/list-sessions';
import { listRequests } from './commands/list-requests';
import { getStructure } from './commands/structure';
import { diffRequests } from './commands/diff';
import { getValue } from './commands/get';
import { getTrace } from './commands/trace';

function printUsage() {
  console.log(`
records-query - 渐进式披露的记录查询工具

用法:
  records-query <command> [options]

命令:
  list sessions              列出会话
    --limit N               限制返回数量 (默认: 20)
    --filter "key=value"    过滤条件，如 "client=claude,hasError=true"

  list requests              列出请求
    --conversation <id>     会话 ID (必需)
    --limit N               限制返回数量

  structure <request-id>     获取请求结构
    --part request|response|transform  分析哪个部分

  diff <id1> <id2>          对比两个请求
    --mode structure|field  对比模式
    --field <path>         指定字段 (mode=field 时必需)

  get <request-id>          获取指定字段内容
    --path <json-path>     JSON 路径，如 "originalBody.model"
    --truncate N           字符串截断长度 (默认: 500)
    --array-limit N        数组最大返回数量 (默认: 10)
    --format json|summary  返回格式

  trace <request-id>        获取转换链追踪

示例:
  records-query list sessions --filter "client=claude,hasError=true"
  records-query list requests --conversation msg_abc123
  records-query structure 2026-01-29_10-30-15-234_xxx
  records-query get 2026-01-29_10-30-15-234_xxx --path originalBody.model
`);
}

function printJson(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const [command, subcommand, ...rest] = args;

  try {
    switch (command) {
      case 'list': {
        if (subcommand === 'sessions') {
          const limit = parseInt(getArgValue(rest, '--limit') || '20', 10);
          const filter = getArgValue(rest, '--filter');
          const result = listSessions({ limit, filter });
          printJson(result);
        } else if (subcommand === 'requests') {
          const conversationId = getArgValue(rest, '--conversation');
          if (!conversationId) {
            console.error('Error: --conversation is required');
            process.exit(1);
          }
          const limit = parseInt(getArgValue(rest, '--limit') || '100', 10);
          const result = listRequests({ conversationId, limit });
          printJson(result);
        } else {
          console.error('Error: Unknown list subcommand');
          printUsage();
          process.exit(1);
        }
        break;
      }

      case 'structure': {
        const requestId = subcommand;
        if (!requestId) {
          console.error('Error: request-id is required');
          process.exit(1);
        }
        const part = (getArgValue(rest, '--part') || 'request') as 'request' | 'response' | 'transform';
        const result = getStructure(requestId, { part });
        printJson(result);
        break;
      }

      case 'diff': {
        const id1 = subcommand;
        const id2 = rest[0];
        if (!id1 || !id2) {
          console.error('Error: Two request IDs are required');
          process.exit(1);
        }
        const mode = (getArgValue(rest.slice(1), '--mode') || 'structure') as 'structure' | 'field';
        const field = getArgValue(rest.slice(1), '--field');
        const result = diffRequests(id1, id2, { mode, field });
        printJson(result);
        break;
      }

      case 'get': {
        const requestId = subcommand;
        if (!requestId) {
          console.error('Error: request-id is required');
          process.exit(1);
        }
        const path = getArgValue(rest, '--path');
        if (!path) {
          console.error('Error: --path is required');
          process.exit(1);
        }
        const truncate = parseInt(getArgValue(rest, '--truncate') || '500', 10);
        const arrayLimit = parseInt(getArgValue(rest, '--array-limit') || '10', 10);
        const format = (getArgValue(rest, '--format') || 'json') as 'json' | 'summary';
        const result = getValue(requestId, { path, truncate, arrayLimit, format });
        printJson(result);
        break;
      }

      case 'trace': {
        const requestId = subcommand;
        if (!requestId) {
          console.error('Error: request-id is required');
          process.exit(1);
        }
        const result = getTrace(requestId);
        printJson(result);
        break;
      }

      default: {
        console.error(`Error: Unknown command "${command}"`);
        printUsage();
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return undefined;
}

main();
```

**步骤 3: 提交**

```bash
git add backend/src/records-query/index.ts backend/src/records-query/cli.ts
git commit -m "添加 records-query CLI 入口和模块导出"
```

---

### Task 11: 集成到主 CLI

**文件:**
- Modify: `/home/ekko.bao/work/promptxy/backend/src/cli-entry.ts`

**步骤 1: 添加 records-query 子命令**

在 `cli-entry.ts` 中添加：

```typescript
// 添加新的 case 到命令处理中
case 'records-query':
  // 转发到 records-query CLI
  const { execSync } = require('child_process');
  const rqArgs = process.argv.slice(3);
  execSync(`node ${path.join(__dirname, 'records-query', 'cli.js')} ${rqArgs.join(' ')}`, {
    stdio: 'inherit'
  });
  break;
```

**步骤 2: 提交**

```bash
git add backend/src/cli-entry.ts
git commit -m "集成 records-query 到主 CLI"
```

---

### Task 12: 编译和验证

**步骤 1: 编译项目**

```bash
cd /home/ekko.bao/work/promptxy && npm run build
```

**预期输出:** 编译成功，无错误

**步骤 2: 测试 CLI**

```bash
./dist/cli-entry.js records-query list sessions --limit 5
```

**预期输出:** 返回 JSON 格式的会话列表（如果目录中有记录文件）

**步骤 3: 提交**

```bash
git commit -m "编译并验证 records-query 功能"
```

---

## 第四阶段：完善和文档

### Task 13: 更新根 package.json 脚本

**文件:**
- Modify: `/home/ekko.bao/work/promptxy/package.json`

**步骤 1: 添加 records-query 快捷命令**

在 scripts 中添加：

```json
{
  "records": "node dist/records-query/cli.js",
  "records:build": "tsc -p backend/tsconfig.json"
}
```

**步骤 2: 提交**

```bash
git add package.json
git commit -m "添加 records-query npm 脚本"
```

---

## 实施检查清单

- [ ] Task 0: 添加 js-yaml 依赖
- [ ] Task 1: 创建类型定义
- [ ] Task 2: 实现记录加载器
- [ ] Task 3: 实现结构分析器
- [ ] Task 4: 实现 list sessions 命令
- [ ] Task 5: 实现 list requests 命令
- [ ] Task 6: 实现 structure 命令
- [ ] Task 7: 实现 diff 命令
- [ ] Task 8: 实现 get 命令
- [ ] Task 9: 实现 trace 命令
- [ ] Task 10: 创建主 CLI 入口
- [ ] Task 11: 集成到主 CLI
- [ ] Task 12: 编译和验证
- [ ] Task 13: 更新 package.json 脚本
