/**
 * Pipeline Runner
 *
 * 统一的 stage 执行与错误包装
 */

import type { FieldAudit } from '../audit/field-audit.js';
import { FieldAuditCollector } from '../audit/field-audit.js';
import { TransformError } from './errors.js';

/**
 * Pipeline Stage 结果
 */
export type StageResult<T> = {
  data: T;
  audit: FieldAudit;
  errors?: TransformError[];
};

/**
 * Pipeline Stage 函数类型
 */
export type StageFunction<Input, Output> = (
  input: Input,
  audit: FieldAuditCollector,
) => StageResult<Output> | Promise<StageResult<Output>>;

/**
 * 执行单个 Stage
 */
async function executeStage<Input, Output>(
  stageFn: StageFunction<Input, Output>,
  input: Input,
  stageName: string,
  audit: FieldAuditCollector,
): Promise<StageResult<Output>> {
  try {
    const result = await stageFn(input, audit);

    // 如果 stage 返回了错误，仍然继续执行
    // 但需要在最终结果中合并这些错误
    return result;
  } catch (error) {
    // 捕获未预期的错误并包装
    if (error instanceof TransformError) {
      return {
        data: null as unknown as Output,
        audit: audit.getAudit(),
        errors: [error],
      };
    }

    // 未知错误类型
    return {
      data: null as unknown as Output,
      audit: audit.getAudit(),
      errors: [
        new TransformError(
          'mapping_error',
          stageName,
          error instanceof Error ? error.message : String(error),
        ),
      ],
    };
  }
}

/**
 * Pipeline 配置
 */
export type PipelineConfig = {
  /** 遇到错误时是否继续执行 */
  continueOnError?: boolean;
  /** 是否收集详细审计 */
  verboseAudit?: boolean;
};

/**
 * Pipeline 结果
 */
export type PipelineResult<Output> = {
  data: Output | null;
  audit: FieldAudit;
  errors: TransformError[];
  success: boolean;
};

/**
 * 创建并执行 Pipeline
 *
 * @param stages Stage 函数数组
 * @param initialInput 初始输入
 * @param config Pipeline 配置
 */
export async function executePipeline<Input, Output>(
  stages: Array<{
    name: string;
    fn: StageFunction<any, any>;
  }>,
  initialInput: Input,
  config: PipelineConfig = {},
): Promise<PipelineResult<Output>> {
  const auditCollector = new FieldAuditCollector();
  const allErrors: TransformError[] = [];
  let currentData: any = initialInput;
  let success = true;

  for (const stage of stages) {
    // 创建当前 stage 的审计收集器
    const stageAudit = new FieldAuditCollector();

    const result = await executeStage(stage.fn, currentData, stage.name, stageAudit);

    // 合并审计
    const stageAuditResult = stageAudit.getAudit();
    auditCollector.addSourcePaths(stageAuditResult.sourcePaths);
    auditCollector.addTargetPaths(stageAuditResult.targetPaths);
    auditCollector.addExtraTargetPaths(stageAuditResult.extraTargetPaths);
    auditCollector.addMissingRequiredTargetPaths(stageAuditResult.missingRequiredTargetPaths);
    auditCollector.addUnmappedSourcePaths(stageAuditResult.unmappedSourcePaths);
    for (const diff of stageAuditResult.diffs) {
      auditCollector.addDiff(diff);
    }
    for (const defaulted of stageAuditResult.defaulted) {
      auditCollector.addDefaulted(defaulted);
    }
    if (stageAuditResult.evidence) {
      for (const ev of stageAuditResult.evidence) {
        auditCollector.addEvidence(ev);
      }
    }
    if (stageAuditResult.metadata) {
      for (const [key, value] of Object.entries(stageAuditResult.metadata)) {
        auditCollector.setMetadata(key, value);
      }
    }

    // 处理错误
    if (result.errors && result.errors.length > 0) {
      allErrors.push(...result.errors);

      // 检查是否有必填字段缺失（严重错误）
      const hasMissingRequired = result.errors.some(
        e => e.type === 'validation_error' && e.details.missingPaths?.length
      );

      if (hasMissingRequired && !config.continueOnError) {
        success = false;
        return {
          data: null,
          audit: auditCollector.getAudit(),
          errors: allErrors,
          success: false,
        };
      }
    }

    // 更新当前数据
    if (result.data !== null) {
      currentData = result.data;
    }
  }

  return {
    data: currentData as Output,
    audit: auditCollector.getAudit(),
    errors: allErrors,
    success: allErrors.length === 0,
  };
}

/**
 * 创建 Stage 的辅助函数
 */
export function createStage<Input, Output>(
  name: string,
  fn: StageFunction<Input, Output>,
): { name: string; fn: StageFunction<Input, Output> } {
  return { name, fn };
}
