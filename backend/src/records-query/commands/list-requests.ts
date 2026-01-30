import { loadRecords } from '../loader';
import type { RequestsListResult, ListRequestsOptions, RequestSummary } from '../types';

export function listRequests(options: ListRequestsOptions): RequestsListResult {
  const { conversationId, limit = 100 } = options;
  const records = loadRecords();

  const filtered = records
    .filter(r => r.conversationId === conversationId || r.id === conversationId)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, limit);

  const requests: RequestSummary[] = filtered.map((r, index) => ({
    id: r.id,
    index,
    timestamp: r.timestamp,
    path: r.path,
    method: r.method,
    client: r.client,
    supplier: r.supplierName,
    model: r.model,
    hasTransformError: !!r.error,
    responseStatus: r.responseStatus,
    durationMs: r.durationMs
  }));

  return {
    conversationId,
    requestCount: requests.length,
    requests
  };
}
