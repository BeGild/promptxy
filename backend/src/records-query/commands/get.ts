import { loadRecord } from '../loader';
import { getValueByPath, getFieldType } from '../analyzer';
import type { GetOptions } from '../types';

function truncateValue(value: unknown, options: GetOptions): unknown {
  const { truncate = 500, arrayLimit = 10, format = 'json' } = options;

  if (format === 'summary') {
    return getSummary(value);
  }

  return processValue(value, truncate, arrayLimit, 0);
}

function processValue(value: unknown, truncate: number, arrayLimit: number, depth: number): unknown {
  if (value === null || value === undefined) return value;

  const type = getFieldType(value);

  if (type === 'string') {
    const str = value as string;
    if (str.length <= truncate) return str;
    return str.substring(0, truncate) + '...(' + (str.length - truncate) + ' more chars)';
  }

  if (type === 'array') {
    const arr = value as unknown[];
    if (arr.length === 0) return [];

    const limited = arr.slice(0, arrayLimit);
    const processed = limited.map(item =>
      depth < 3 ? processValue(item, truncate, arrayLimit, depth + 1) : '/* ... */'
    );

    if (arr.length > arrayLimit) {
      return { items: processed, totalCount: arr.length, truncated: true };
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

  return value;
}

function getSummary(value: unknown): unknown {
  const type = getFieldType(value);

  if (type === 'array') {
    const arr = value as unknown[];
    const summary: Record<string, unknown> = { count: arr.length };
    if (arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
      const first = arr[0] as Record<string, unknown>;
      const keyFields = ['name', 'id', 'type', 'function', 'role'];
      for (const field of keyFields) {
        if (field in first) {
          const names = arr
            .map(item => (item as Record<string, unknown>)?.[field])
            .filter(Boolean)
            .slice(0, 5);
          if (names.length > 0) {
            summary[field === 'function' ? 'functions' : field + 's'] = names;
            break;
          }
        }
      }
    }
    return summary;
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    return { keys: Object.keys(obj).slice(0, 10), keyCount: Object.keys(obj).length };
  }

  return { type, value };
}

export function getValue(requestId: string, options: GetOptions): unknown {
  const record = loadRecord(requestId);
  if (!record) {
    throw new Error('Record not found: ' + requestId);
  }

  const value = getValueByPath(record, options.path);
  return truncateValue(value, options);
}
