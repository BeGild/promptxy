/**
 * Tool Schema 策略
 *
 * 管理 tool schema 裁剪/strict 策略
 */

/**
 * Tool Schema 策略配置
 */
export type ToolSchemaPolicy = {
  /** 是否移除 format 字段 */
  removeFormat?: boolean;
  /** 是否移除 $schema 字段 */
  removeSchema?: boolean;
  /** 是否移除 title 字段 */
  removeTitle?: boolean;
  /** 是否移除 examples 字段 */
  removeExamples?: boolean;
  /** 是否移除 default 字段 */
  removeDefault?: boolean;
  /** 是否添加 additionalProperties=false */
  strictMode?: boolean;
  /** strict 模式值 */
  strict?: boolean;
};

/**
 * 默认策略（强剪裁，通过上游严格校验）
 */
export const DEFAULT_TOOL_SCHEMA_POLICY: ToolSchemaPolicy = {
  removeFormat: true,
  removeSchema: true,
  removeTitle: true,
  removeExamples: true,
  removeDefault: true,
  strictMode: true,
  strict: true,
};

/**
 * 应用 tool schema 策略
 */
export function applyToolSchemaPolicy(
  schema: Record<string, unknown>,
  policy: ToolSchemaPolicy = DEFAULT_TOOL_SCHEMA_POLICY,
): Record<string, unknown> {
  const result = { ...schema };

  // 移除指定字段
  const fieldsToRemove: string[] = [];

  if (policy.removeFormat && 'format' in result) {
    fieldsToRemove.push('format');
  }

  if (policy.removeSchema && '$schema' in result) {
    fieldsToRemove.push('$schema');
  }

  if (policy.removeTitle && 'title' in result) {
    fieldsToRemove.push('title');
  }

  if (policy.removeExamples && 'examples' in result) {
    fieldsToRemove.push('examples');
  }

  if (policy.removeDefault && 'default' in result) {
    fieldsToRemove.push('default');
  }

  for (const field of fieldsToRemove) {
    delete result[field];
  }

  // 添加 strict 模式
  if (policy.strictMode && !('additionalProperties' in result)) {
    result.additionalProperties = false;
  }

  if (policy.strict !== undefined && !('strict' in result)) {
    result.strict = policy.strict;
  }

  return result;
}
