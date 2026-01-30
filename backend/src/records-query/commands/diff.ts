import { loadRecord } from '../loader';
import { compareStructures, getValueByPath } from '../analyzer';
import type { DiffResult } from '../types';

export function diffRequests(
  id1: string,
  id2: string,
  options: { mode?: 'structure' | 'field'; field?: string } = {}
): DiffResult {
  const { mode = 'structure', field } = options;
  const record1 = loadRecord(id1);
  const record2 = loadRecord(id2);

  if (!record1 || !record2) {
    throw new Error('One or both records not found');
  }

  const result: DiffResult = {
    request1: id1,
    request2: id2
  };

  if (mode === 'structure') {
    result.structuralDifferences = {
      originalBody: compareStructures(record1.originalBody, record2.originalBody, 'root'),
      modifiedBody: compareStructures(record1.modifiedBody, record2.modifiedBody, 'root')
    };
    if (record1.transformedBody || record2.transformedBody) {
      result.structuralDifferences.transformedBody = compareStructures(
        record1.transformedBody,
        record2.transformedBody,
        'root'
      );
    }
  }

  if (mode === 'field' && field) {
    const value1 = getValueByPath(record1, field);
    const value2 = getValueByPath(record2, field);
    result.fieldDifferences = {
      [field]: {
        from: value1,
        to: value2,
        different: JSON.stringify(value1) !== JSON.stringify(value2)
      }
    };
  }

  return result;
}
