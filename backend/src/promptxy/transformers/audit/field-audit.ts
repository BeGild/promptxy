/**
 * FieldAudit - 字段级审计数据结构
 *
 * 用于记录转换过程中的字段级证据，支持可审计、可回放、可定位。
 */

import type { JsonPointer } from './json-pointer.js';

/**
 * 证据来源
 */
export type EvidenceSource = 'promptxy' | 'refence' | 'sample' | 'inferred';

/**
 * 证据引用
 */
export type EvidenceRef = {
  /** 证据来自哪里（实现/协议/样本） */
  source: EvidenceSource;
  /** 可选：便于追溯的文件定位（不强制写死行号） */
  ref?: string;
};

/**
 * 字段差异
 */
export type FieldDiff = {
  op: 'add' | 'remove' | 'replace';
  path: JsonPointer;
  /** 允许截断（大对象/大文本） */
  valuePreview?: unknown;
  oldValue?: unknown;
};

/**
 * 默认值来源
 */
export type DefaultSource = 'template' | 'route' | 'supplier' | 'inferred' | 'fallback';

/**
 * 默认值记录
 */
export type DefaultedField = {
  path: JsonPointer;
  source: DefaultSource;
  reason: string;
  value?: unknown;
};

/**
 * 字段级审计结果
 */
export type FieldAudit = {
  /** 解析期：源请求里实际出现过的字段路径（用于 unmapped/coverage） */
  sourcePaths: JsonPointer[];

  /** 渲染期：目标请求里最终发送的字段路径 */
  targetPaths: JsonPointer[];

  /** 多字段 OK：但必须可观测 */
  extraTargetPaths: JsonPointer[];

  /** 少字段必须 error：缺失即阻断 */
  missingRequiredTargetPaths: JsonPointer[];

  /** "源字段未映射"的清单（用于定位语义丢失） */
  unmappedSourcePaths: JsonPointer[];

  /** 字段级 diff（建议 JSON Patch 语义） */
  diffs: FieldDiff[];

  /** 默认值与来源（必须能解释"为什么出现这个字段"） */
  defaulted: DefaultedField[];

  /** 证据引用 */
  evidence?: EvidenceRef[];

  /** 额外的元数据（用于记录特殊状态） */
  metadata?: {
    /** upstream 是否缺失 response.completed */
    missingUpstreamCompleted?: boolean;
    /** tool_result 是否被 stringify */
    outputWasStringified?: boolean;
    /** tool_result.content 缺失时是否进行了兜底填充 */
    toolResultContentMissingFilled?: boolean;
    /** stop_reason 策略 */
    toolStopReasonStrategy?: 'end_turn' | 'tool_use';
    /** custom_tool_call 映射策略 */
    customToolCallStrategy?: 'wrap_object' | 'error';
    /** call_id 对称性校验结果 */
    callIdSymmetryValid?: boolean;
    /** 其他标记 */
    [key: string]: unknown;
  };
};

/**
 * 创建空的审计结果
 */
export function createEmptyFieldAudit(): FieldAudit {
  return {
    sourcePaths: [],
    targetPaths: [],
    extraTargetPaths: [],
    missingRequiredTargetPaths: [],
    unmappedSourcePaths: [],
    diffs: [],
    defaulted: [],
    evidence: [],
    metadata: {},
  };
}

/**
 * 字段审计收集器
 *
 * 用于在转换过程中逐步收集审计信息
 */
export class FieldAuditCollector {
  private audit: FieldAudit;

  constructor() {
    this.audit = createEmptyFieldAudit();
  }

  /**
   * 添加源路径
   */
  addSourcePaths(paths: JsonPointer[]): void {
    for (const path of paths) {
      if (!this.audit.sourcePaths.includes(path)) {
        this.audit.sourcePaths.push(path);
      }
    }
  }

  /**
   * 添加目标路径
   */
  addTargetPaths(paths: JsonPointer[]): void {
    for (const path of paths) {
      if (!this.audit.targetPaths.includes(path)) {
        this.audit.targetPaths.push(path);
      }
    }
  }

  /**
   * 添加额外字段（多字段）
   */
  addExtraTargetPaths(paths: JsonPointer[]): void {
    for (const path of paths) {
      if (!this.audit.extraTargetPaths.includes(path)) {
        this.audit.extraTargetPaths.push(path);
      }
    }
  }

  /**
   * 添加缺失的必填字段（少字段 error）
   */
  addMissingRequiredTargetPaths(paths: JsonPointer[]): void {
    for (const path of paths) {
      if (!this.audit.missingRequiredTargetPaths.includes(path)) {
        this.audit.missingRequiredTargetPaths.push(path);
      }
    }
  }

  /**
   * 添加未映射的源路径
   */
  addUnmappedSourcePaths(paths: JsonPointer[]): void {
    for (const path of paths) {
      if (!this.audit.unmappedSourcePaths.includes(path)) {
        this.audit.unmappedSourcePaths.push(path);
      }
    }
  }

  /**
   * 添加字段差异
   */
  addDiff(diff: FieldDiff): void {
    this.audit.diffs.push(diff);
  }

  /**
   * 添加默认值记录
   */
  addDefaulted(field: DefaultedField): void {
    this.audit.defaulted.push(field);
  }

  /**
   * 添加证据引用
   */
  addEvidence(evidence: EvidenceRef): void {
    if (!this.audit.evidence) {
      this.audit.evidence = [];
    }
    this.audit.evidence.push(evidence);
  }

  /**
   * 设置元数据
   */
  setMetadata(key: string, value: unknown): void {
    if (!this.audit.metadata) {
      this.audit.metadata = {};
    }
    this.audit.metadata[key] = value;
  }

  /**
   * 获取审计结果
   */
  getAudit(): FieldAudit {
    return this.audit;
  }

  /**
   * 检查是否有必填字段缺失
   */
  hasMissingRequired(): boolean {
    return this.audit.missingRequiredTargetPaths.length > 0;
  }

  /**
   * 检查是否有未映射字段
   */
  hasUnmappedFields(): boolean {
    return this.audit.unmappedSourcePaths.length > 0;
  }
}
