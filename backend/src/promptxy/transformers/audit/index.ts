/**
 * Audit 模块入口
 */

export type { JsonPointer } from './json-pointer.js';
export {
  normalizeJsonPointer,
  joinJsonPointer,
  parseJsonPointer,
  getByJsonPointer,
  setByJsonPointer,
  collectJsonPointers,
} from './json-pointer.js';

export type {
  EvidenceSource,
  EvidenceRef,
  FieldDiff,
  DefaultSource,
  DefaultedField,
  FieldAudit,
} from './field-audit.js';
export {
  createEmptyFieldAudit,
  FieldAuditCollector,
} from './field-audit.js';

export { generateDiff, computeUnmappedPaths, computeExtraPaths } from './diff.js';
