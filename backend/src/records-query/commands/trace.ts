import { loadRecord } from '../loader';
import type { TransformTraceResult } from '../types';

export function getTrace(requestId: string): TransformTraceResult {
  const record = loadRecord(requestId);

  if (!record) {
    throw new Error('Record not found: ' + requestId);
  }

  const transformChain: TransformTraceResult['transformChain'] = [];

  if (record.transformerChain) {
    const steps = record.transformerChain.split(',').map(s => s.trim());
    for (const step of steps) {
      if (step) {
        transformChain.push({
          step,
          changes: { addedFields: [], removedFields: [], renamedFields: {}, typeChanges: {} }
        });
      }
    }
  }

  if (record.transformTrace) {
    try {
      const trace = JSON.parse(record.transformTrace);
      if (Array.isArray(trace)) {
        for (const t of trace) {
          transformChain.push({
            step: t.step || t.name || 'unknown',
            fromProtocol: t.fromProtocol,
            toProtocol: t.toProtocol,
            changes: t.changes || { addedFields: [], removedFields: [], renamedFields: {}, typeChanges: {} }
          });
        }
      }
    } catch {
      // ignore parse error
    }
  }

  return {
    requestId,
    transformChain
  };
}
