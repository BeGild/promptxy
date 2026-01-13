/**
 * Codex Responses API 校验
 *
 * 校验发送到 /v1/responses 的请求是否满足要求
 * 参考: refence/codex/codex-rs/core/tests/common/responses.rs:802
 */

import type {
  CodexResponsesApiRequest,
  CodexResponseItem,
} from './types.js';
import type { FieldAuditCollector } from '../../audit/field-audit.js';

/**
 * 校验错误类型
 */
export type ValidationError = {
  type: 'missing_required' | 'invariant_violation' | 'type_mismatch';
  path: string;
  message: string;
};

/**
 * 校验 Codex 请求
 *
 * 规则：
 * 1. 字段级 required（缺失即 error）
 * 2. call_id 对称性（缺失/孤儿/不对称即 error）
 */
export function validateCodexRequest(
  request: CodexResponsesApiRequest,
  audit: FieldAuditCollector,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. 字段级 required
  const requiredFields: Array<{ path: string; type: string; actual: any }> = [
    { path: '/model', type: 'string', actual: request.model },
    { path: '/instructions', type: 'string', actual: request.instructions },
    { path: '/input', type: 'array', actual: request.input },
    { path: '/tools', type: 'array', actual: request.tools },
    { path: '/tool_choice', type: 'string', actual: request.tool_choice },
    {
      path: '/parallel_tool_calls',
      type: 'boolean',
      actual: request.parallel_tool_calls,
    },
    { path: '/store', type: 'boolean', actual: request.store },
    { path: '/stream', type: 'boolean', actual: request.stream },
    { path: '/include', type: 'array', actual: request.include },
  ];

  for (const field of requiredFields) {
    if (field.actual === undefined || field.actual === null) {
      errors.push({
        type: 'missing_required',
        path: field.path,
        message: `Missing required field: ${field.path} (expected ${field.type})`,
      });
      audit.addMissingRequiredTargetPaths([field.path as any]);
    } else if (field.type === 'array' ? !Array.isArray(field.actual) : typeof field.actual !== field.type) {
      errors.push({
        type: 'type_mismatch',
        path: field.path,
        message: `Type mismatch for ${field.path}: expected ${field.type}, got ${Array.isArray(field.actual) ? 'array' : typeof field.actual}`,
      });
    }
  }

  // 2. item 级 required（防守性：避免漏到上游 400）
  const itemErrors = validateInputItemRequiredFields(request.input, audit);
  errors.push(...itemErrors);

  // 3. call_id 对称性校验
  const callIdErrors = validateCallIdSymmetry(request.input, audit);
  errors.push(...callIdErrors);

  // 记录校验结果到审计
  audit.setMetadata('callIdSymmetryValid', callIdErrors.length === 0);

  return errors;
}

/**
 * 校验 call_id 对称性
 *
 * 规则（参考 refence/codex/codex-rs/core/tests/common/responses.rs:802）：
 * 1. function_call/custom_tool_call 必须有非空 call_id
 * 2. function_call_output/custom_tool_call_output 必须有非空 call_id
 * 3. 每个 output 必须能匹配同一 input 中此前出现的 call
 * 4. 每个 call 必须有对应的 output（对称性）
 * 5. 不允许"孤儿" output（找不到对应 call）
 */
function validateInputItemRequiredFields(
  input: CodexResponseItem[],
  audit: FieldAuditCollector,
): ValidationError[] {
  const errors: ValidationError[] = [];

  input.forEach((item, index) => {
    const path = `/input/${index}`;

    if (item.type === 'function_call') {
      if (!item.name || item.name === '') {
        errors.push({
          type: 'missing_required',
          path,
          message: `function_call at ${path} has missing or empty name`,
        });
        audit.addMissingRequiredTargetPaths([`${path}/name` as any]);
      }
      if (item.arguments === undefined || item.arguments === null || item.arguments === '') {
        errors.push({
          type: 'missing_required',
          path,
          message: `function_call at ${path} has missing or empty arguments`,
        });
        audit.addMissingRequiredTargetPaths([`${path}/arguments` as any]);
      }
    }

    if (item.type === 'function_call_output') {
      const output = (item as any).output;
      if (output === undefined || output === null) {
        errors.push({
          type: 'missing_required',
          path,
          message: `function_call_output at ${path} has missing output (upstream requires input[${index}].output)`,
        });
        audit.addMissingRequiredTargetPaths([`${path}/output` as any]);
      }
    }
  });

  return errors;
}

function validateCallIdSymmetry(
  input: CodexResponseItem[],
  audit: FieldAuditCollector,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 收集所有 call 和 output
  const calls: Array<{ index: number; call_id: string; type: string }> = [];
  const outputs: Array<{ index: number; call_id: string; type: string }> = [];

  input.forEach((item, index) => {
    const path = `/input/${index}`;

    if (item.type === 'function_call' || item.type === 'custom_tool_call') {
      if (!item.call_id || item.call_id === '') {
        errors.push({
          type: 'missing_required',
          path,
          message: `${item.type} at ${path} has missing or empty call_id`,
        });
      } else {
        calls.push({
          index,
          call_id: item.call_id,
          type: item.type,
        });
      }
    } else if (
      item.type === 'function_call_output' ||
      item.type === 'custom_tool_call_output'
    ) {
      if (!item.call_id || item.call_id === '') {
        errors.push({
          type: 'missing_required',
          path,
          message: `${item.type} at ${path} has missing or empty call_id`,
        });
      } else {
        outputs.push({
          index,
          call_id: item.call_id,
          type: item.type,
        });
      }
    }
  });

  // 检查每个 output 是否有对应的 call
  for (const output of outputs) {
    const matchingCall = calls.find(c => c.call_id === output.call_id);
    if (!matchingCall) {
      errors.push({
        type: 'invariant_violation',
        path: `/input/${output.index}`,
        message: `Orphan ${output.type} at index ${output.index}: no matching call found for call_id "${output.call_id}"`,
      });
    }
  }

  // 检查每个 call 是否有对应的 output（对称性）
  for (const call of calls) {
    const matchingOutput = outputs.find(o => o.call_id === call.call_id);
    if (!matchingOutput) {
      errors.push({
        type: 'invariant_violation',
        path: `/input/${call.index}`,
        message: `Unmatched ${call.type} at index ${call.index}: no output found for call_id "${call.call_id}"`,
      });
    }
  }

  // 检查是否有重复的 call_id（不应该有多个 output 对应同一个 call）
  const outputCallIds = outputs.map(o => o.call_id);
  const duplicates = outputCallIds.filter(
    (id, index) => outputCallIds.indexOf(id) !== index,
  );
  for (const dup of duplicates) {
    const duplicateOutputs = outputs.filter(o => o.call_id === dup);
    if (duplicateOutputs.length > 1) {
      errors.push({
        type: 'invariant_violation',
        path: '/input',
        message: `Multiple outputs for call_id "${dup}": at indices ${duplicateOutputs.map(o => o.index).join(', ')}`,
      });
    }
  }

  return errors;
}
