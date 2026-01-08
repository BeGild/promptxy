/**
 * Gemini 转换器审计增强
 *
 * 为 Gemini 协议转换提供 FieldAudit 集成
 */

import type { JsonPointer } from '../../audit/json-pointer.js';
import {
  FieldAuditCollector,
  createEmptyFieldAudit,
  type FieldAudit,
  type EvidenceRef,
} from '../../audit/field-audit.js';
import type { SchemaAuditResult } from './request.js';

/**
 * Gemini 转换审计结果
 */
export interface GeminiTransformAudit {
  /** 字段级审计 */
  fieldAudit: FieldAudit;
  /** Schema 审计结果 */
  schemaAudit?: SchemaAuditResult;
  /** URL 构造信息 */
  urlInfo?: {
    baseUrl: string;
    action: string;
    model: string;
    streaming: boolean;
    hasQueryKey: boolean;
  };
  /** 转换统计 */
  stats: {
    sourceMessageCount: number;
    targetContentCount: number;
    toolCount: number;
    toolUseMappingCount: number;
  };
}

/**
 * 创建 Gemini 转换审计收集器
 */
export class GeminiTransformAuditCollector {
  private fieldAudit: FieldAuditCollector;
  private schemaAudit?: SchemaAuditResult;
  private urlInfo?: GeminiTransformAudit['urlInfo'];
  private stats: GeminiTransformAudit['stats'];

  constructor() {
    this.fieldAudit = new FieldAuditCollector();
    this.stats = {
      sourceMessageCount: 0,
      targetContentCount: 0,
      toolCount: 0,
      toolUseMappingCount: 0,
    };
  }

  /**
   * 记录 URL 构造信息
   */
  recordUrlInfo(info: GeminiTransformAudit['urlInfo']): void {
    if (!info) return;

    this.urlInfo = info;

    // 记录到 fieldAudit
    this.fieldAudit.addTargetPaths([
      '/url',
      '/url/action',
      '/url/model',
      '/url/streaming',
    ]);

    this.fieldAudit.setMetadata('gemini_url_action', info.action);
    this.fieldAudit.setMetadata('gemini_url_model', info.model);
    this.fieldAudit.setMetadata('gemini_url_streaming', info.streaming);
    this.fieldAudit.setMetadata('gemini_url_has_query_key', info.hasQueryKey);
  }

  /**
   * 记录 Schema 审计结果
   */
  recordSchemaAudit(audit: SchemaAuditResult): void {
    this.schemaAudit = audit;

    // 记录被移除的字段
    if (audit.removedFields.length > 0) {
      this.fieldAudit.addDiff({
        op: 'remove',
        path: '/tools/*/input_schema',
        valuePreview: `Removed fields: ${audit.removedFields.join(', ')}`,
      });

      this.fieldAudit.setMetadata(
        'schema_removed_fields',
        audit.removedFields
      );
    }

    // 记录警告
    if (audit.warnings.length > 0) {
      this.fieldAudit.setMetadata(
        'schema_warnings',
        audit.warnings
      );
    }
  }

  /**
   * 记录源消息
   */
  recordSourceMessage(count: number): void {
    this.stats.sourceMessageCount = count;
    this.fieldAudit.addSourcePaths([
      '/messages',
      `/messages (count: ${count})`,
    ]);
  }

  /**
   * 记录目标内容
   */
  recordTargetContent(count: number): void {
    this.stats.targetContentCount = count;
    this.fieldAudit.addTargetPaths([
      '/contents',
      `/contents (count: ${count})`,
    ]);
  }

  /**
   * 记录工具定义
   */
  recordTools(count: number): void {
    this.stats.toolCount = count;
    this.fieldAudit.addTargetPaths([
      '/tools',
      '/tools/functionDeclarations',
      `/tools/functionDeclarations (count: ${count})`,
    ]);
  }

  /**
   * 记录 tool_use_id 映射
   */
  recordToolUseMapping(count: number): void {
    this.stats.toolUseMappingCount = count;
    this.fieldAudit.setMetadata(
      'tool_use_id_mappings',
      count
    );
  }

  /**
   * 记录系统指令转换
   */
  recordSystemInstruction(): void {
    this.fieldAudit.addTargetPaths([
      '/systemInstruction',
      '/systemInstruction/role',
      '/systemInstruction/parts',
    ]);

    this.fieldAudit.setMetadata(
      'system_instruction_role',
      'user' // 固定为 user
    );
  }

  /**
   * 记录生成配置
   */
  recordGenerationConfig(config: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  }): void {
    const paths: JsonPointer[] = ['/generationConfig'];

    if (config.maxOutputTokens !== undefined) {
      paths.push('/generationConfig/maxOutputTokens');
    }
    if (config.temperature !== undefined) {
      paths.push('/generationConfig/temperature');
    }
    if (config.topP !== undefined) {
      paths.push('/generationConfig/topP');
    }
    if (config.stopSequences) {
      paths.push('/generationConfig/stopSequences');
    }

    this.fieldAudit.addTargetPaths(paths);
  }

  /**
   * 记录 Header 映射
   */
  recordHeaderMapping(headers: Record<string, boolean>): void {
    // headers = { 'anthropic-version': false, 'content-type': true, ... }
    const removedHeaders = Object.entries(headers)
      .filter(([_, kept]) => !kept)
      .map(([name]) => name);

    const keptHeaders = Object.entries(headers)
      .filter(([_, kept]) => kept)
      .map(([name]) => name);

    if (removedHeaders.length > 0) {
      this.fieldAudit.addDiff({
        op: 'remove',
        path: '/headers',
        valuePreview: `Removed headers: ${removedHeaders.join(', ')}`,
      });

      this.fieldAudit.setMetadata(
        'headers_removed',
        removedHeaders
      );
    }

    this.fieldAudit.setMetadata(
      'headers_kept',
      keptHeaders
    );
  }

  /**
   * 记录 finishReason 映射
   */
  recordFinishReasonMapping(geminiReason: string, claudeReason: string): void {
    this.fieldAudit.setMetadata(
      'finish_reason_mapping',
      `${geminiReason} -> ${claudeReason}`
    );
  }

  /**
   * 记录 thought 过滤
   */
  recordThoughtFilter(count: number): void {
    if (count > 0) {
      this.fieldAudit.addDiff({
        op: 'remove',
        path: '/candidates/0/content/parts',
        valuePreview: `Filtered ${count} thought part(s)`,
      });

      this.fieldAudit.setMetadata(
        'thought_parts_filtered',
        count
      );
    }
  }

  /**
   * 记录 parts 合并
   */
  recordPartsConsolidation(before: number, after: number): void {
    if (before > after) {
      this.fieldAudit.setMetadata(
        'parts_consolidated',
        { before, after, merged: before - after }
      );
    }
  }

  /**
   * 记录 usage 转换
   */
  recordUsageMapping(geminiUsage: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  }): void {
    this.fieldAudit.addTargetPaths([
      '/usage',
      '/usage/input_tokens',
      '/usage/output_tokens',
    ]);

    this.fieldAudit.setMetadata(
      'usage_from_gemini',
      geminiUsage
    );
  }

  /**
   * 添加证据引用
   */
  addEvidence(evidence: EvidenceRef): void {
    this.fieldAudit.addEvidence(evidence);
  }

  /**
   * 设置元数据（公共方法）
   */
  setMetadata(key: string, value: unknown): void {
    this.fieldAudit.setMetadata(key, value);
  }

  /**
   * 获取审计结果
   */
  getAudit(): GeminiTransformAudit {
    return {
      fieldAudit: this.fieldAudit.getAudit(),
      schemaAudit: this.schemaAudit,
      urlInfo: this.urlInfo,
      stats: this.stats,
    };
  }

  /**
   * 获取可展示的摘要（用于 Protocol Lab）
   */
  getSummary(): {
    urlInfo: string;
    stats: string;
    warnings: string[];
    schemaChanges: string[];
  } {
    const summary = {
      urlInfo: '',
      stats: '',
      warnings: [] as string[],
      schemaChanges: [] as string[],
    };

    // URL 信息
    if (this.urlInfo) {
      const info = this.urlInfo;
      summary.urlInfo = `${info.action} (model: ${info.model}, streaming: ${info.streaming})`;
    }

    // 统计信息
    summary.stats = `Messages: ${this.stats.sourceMessageCount} → Contents: ${this.stats.targetContentCount}, Tools: ${this.stats.toolCount}, Tool mappings: ${this.stats.toolUseMappingCount}`;

    // Schema 变更
    if (this.schemaAudit) {
      if (this.schemaAudit.removedFields.length > 0) {
        summary.schemaChanges.push(
          `Removed fields: ${this.schemaAudit.removedFields.join(', ')}`
        );
      }
      if (this.schemaAudit.warnings.length > 0) {
        summary.warnings.push(...this.schemaAudit.warnings);
      }
    }

    // 从 metadata 提取警告
    const metadata = this.fieldAudit.getAudit().metadata;
    if (metadata?.schema_warnings) {
      const warnings = metadata.schema_warnings as string[];
      summary.warnings.push(...warnings);
    }

    return summary;
  }
}

/**
 * 创建证据引用（用于 Gemini 转换）
 */
export function createGeminiEvidence(ref?: string): EvidenceRef {
  return {
    source: 'promptxy',
    ref: ref || 'gemini-transform',
  };
}
