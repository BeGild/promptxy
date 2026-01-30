import { loadRecord } from '../loader.js';
import { analyzeStructure } from '../analyzer.js';
import type { StructureResult } from '../types.js';

export function getStructure(
  requestId: string,
  options: { part?: 'request' | 'response' | 'transform' } = {}
): StructureResult {
  const { part = 'request' } = options;
  const record = loadRecord(requestId);

  if (!record) {
    throw new Error(`Record not found: ${requestId}`);
  }

  const result: StructureResult = {
    requestId,
    structure: {}
  };

  if (part === 'request' || part === 'transform') {
    result.structure.originalBody = analyzeStructure(record.originalBody);
    result.structure.transformedBody = record.transformedBody
      ? analyzeStructure(record.transformedBody)
      : undefined;
    result.structure.modifiedBody = analyzeStructure(record.modifiedBody);
  }

  if (part === 'response') {
    result.structure.responseBody = record.responseBody
      ? analyzeStructure(record.responseBody)
      : undefined;
  }

  return result;
}
