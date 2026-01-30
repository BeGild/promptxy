/**
 * 记录加载器
 * 负责从文件系统加载和解析记录
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { RawRecord, ParsedRecord } from './types.js';

const RECORDS_DIR = path.join(process.env.HOME || '', '.local', 'promptxy', 'requests');

// 最大加载记录数，防止内存溢出
const MAX_LOAD_RECORDS = 1000;

export function extractConversationId(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }

  const b = body as Record<string, unknown>;

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

function safeJsonParse(str: string | undefined): unknown {
  if (!str) return undefined;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

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

  parsed.conversationId = extractConversationId(parsed.originalBody);

  return parsed;
}

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

export function loadRecords(limit = MAX_LOAD_RECORDS): ParsedRecord[] {
  if (!fs.existsSync(RECORDS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(RECORDS_DIR)
    .filter(f => f.endsWith('.yaml'))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);

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
