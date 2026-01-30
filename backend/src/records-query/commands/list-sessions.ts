import { loadRecords } from '../loader.js';
import type { SessionsListResult, ListSessionsOptions, ParsedRecord, SessionSummary } from '../types.js';

function parseFilter(filterStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!filterStr) return result;
  const pairs = filterStr.split(',');
  for (const pair of pairs) {
    const [key, value] = pair.split('=').map((s: string) => s.trim());
    if (key && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

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
    }
  }
  return true;
}

export function listSessions(options: ListSessionsOptions = {}): SessionsListResult {
  const { limit = 20, filter } = options;
  const records = loadRecords();
  const filters = parseFilter(filter || '');
  const filteredRecords = records.filter(r => matchesFilter(r, filters));

  const sessionsMap = new Map<string, { records: ParsedRecord[]; conversationId: string }>();

  for (const record of filteredRecords) {
    const convId = record.conversationId || record.id;
    if (!sessionsMap.has(convId)) {
      sessionsMap.set(convId, { records: [], conversationId: convId });
    }
    sessionsMap.get(convId)!.records.push(record);
  }

  const sessions: SessionSummary[] = Array.from(sessionsMap.values())
    .map(({ records, conversationId }) => {
      const sorted = records.sort((a, b) => a.timestamp - b.timestamp);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const models = [...new Set(records.map((r: ParsedRecord) => r.model).filter(Boolean))];
      const hasError = records.some(r => !!r.error || (r.responseStatus && r.responseStatus >= 400));

      return {
        conversationId,
        requestCount: records.length,
        timeRange: { start: first.timestamp, end: last.timestamp },
        client: first.client,
        supplier: first.supplierName || 'unknown',
        hasError,
        models: models as string[]
      };
    })
    .sort((a, b) => b.timeRange.end - a.timeRange.end)
    .slice(0, limit);

  return { total: sessionsMap.size, sessions };
}
