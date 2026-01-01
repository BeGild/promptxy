/**
 * PromptXY Transformer 配置验证
 *
 * 提供：
 * - Transformer 配置验证
 * - Supplier Auth 验证
 * - Gateway Auth 验证
 */

import type {
  TransformerConfig,
  SupplierAuth,
  GatewayAuth,
  TransformerChain,
} from '../types.js';
import { getGlobalRegistry } from './registry.js';

/**
 * 验证转换器步骤
 */
function validateStep(
  step: unknown,
  stepLabel: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof step === 'string') {
    if (!step.trim()) {
      errors.push(`${stepLabel}: 转换器名称不能为空`);
    }
  } else if (step && typeof step === 'object') {
    if (!('name' in step) || typeof step.name !== 'string') {
      errors.push(`${stepLabel}: 必须包含 name 字段（字符串）`);
    } else if (!step.name.trim()) {
      errors.push(`${stepLabel}: name 不能为空`);
    }
  } else {
    errors.push(`${stepLabel}: 无效的步骤格式`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证转换链
 */
function validateTransformerChain(
  chain: unknown,
  chainLabel: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(chain)) {
    errors.push(`${chainLabel}: 必须是数组`);
    return { valid: false, errors };
  }

  if (chain.length === 0) {
    errors.push(`${chainLabel}: 转换链不能为空`);
    return { valid: false, errors };
  }

  const registry = getGlobalRegistry();

  for (let i = 0; i < chain.length; i++) {
    const step = chain[i];
    const stepLabel = `${chainLabel}[${i}]`;

    // 基本格式验证
    const stepValid = validateStep(step, stepLabel);
    if (!stepValid.valid) {
      errors.push(...stepValid.errors);
      continue;
    }

    // 提取转换器名称
    const stepName = typeof step === 'string' ? step : step.name;

    // 检查转换器是否存在
    if (!registry.has(stepName)) {
      errors.push(
        `${stepLabel}: 未知的转换器 "${stepName}"，可用转换器: ${registry
          .list()
          .join(', ')}`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证 Transformer 配置
 */
export function validateTransformerConfig(
  config: TransformerConfig,
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 验证 default 链
  if (!config.default) {
    errors.push('transformer.default: 必须配置默认转换链');
  } else {
    const defaultValid = validateTransformerChain(
      config.default,
      'transformer.default',
    );
    if (!defaultValid.valid) {
      errors.push(...defaultValid.errors);
    }
  }

  // 验证 models 覆盖链
  if (config.models) {
    if (typeof config.models !== 'object' || Array.isArray(config.models)) {
      errors.push('transformer.models: 必须是对象（模型名 -> 转换链）');
    } else {
      for (const [model, chain] of Object.entries(config.models)) {
        const modelValid = validateTransformerChain(
          chain,
          `transformer.models["${model}"]`,
        );
        if (!modelValid.valid) {
          errors.push(...modelValid.errors);
        } else {
          // 检查是否与 default 相同（可选警告）
          if (JSON.stringify(chain) === JSON.stringify(config.default)) {
            warnings.push(
              `transformer.models["${model}"]: 与 default 链相同，可能不需要单独配置`,
            );
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证 Supplier Auth 配置
 */
export function validateSupplierAuth(
  auth: SupplierAuth,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (auth.type === 'bearer') {
    if (!auth.token || typeof auth.token !== 'string') {
      errors.push('supplier.auth: type=bearer 时必须提供 token（字符串）');
    }
  } else if (auth.type === 'header') {
    if (!auth.headerName || typeof auth.headerName !== 'string') {
      errors.push('supplier.auth: type=header 时必须提供 headerName（字符串）');
    }
    if (!auth.headerValue || typeof auth.headerValue !== 'string') {
      errors.push('supplier.auth: type=header 时必须提供 headerValue（字符串）');
    }
  } else {
    errors.push(`supplier.auth.type: 必须是 'bearer' 或 'header'`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证 Gateway Auth 配置
 */
export function validateGatewayAuth(
  gatewayAuth: GatewayAuth,
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (gatewayAuth.enabled) {
    if (!gatewayAuth.token || typeof gatewayAuth.token !== 'string') {
      errors.push('gatewayAuth: enabled=true 时必须提供 token（字符串）');
    }

    if (gatewayAuth.acceptedHeaders) {
      if (!Array.isArray(gatewayAuth.acceptedHeaders)) {
        errors.push('gatewayAuth.acceptedHeaders: 必须是数组');
      } else {
        const validHeaders = [
          'authorization',
          'x-api-key',
          'x-goog-api-key',
        ];
        for (const header of gatewayAuth.acceptedHeaders) {
          if (typeof header !== 'string') {
            errors.push(`gatewayAuth.acceptedHeaders: 包含非字符串值`);
          } else {
            const lowerHeader = header.toLowerCase();
            if (!validHeaders.includes(lowerHeader)) {
              warnings.push(
                `gatewayAuth.acceptedHeaders: "${header}" 可能不是 Claude Code 原生发送的鉴权头`,
              );
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
