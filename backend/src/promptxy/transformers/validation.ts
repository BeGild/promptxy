/**
 * Transformers 校验（兼容层）
 *
 * 仅满足当前测试与配置提示需要：
 * - validateTransformerConfig
 * - validateSupplierAuth
 * - validateGatewayAuth
 */

import type { TransformerConfig, SupplierAuth, GatewayAuth, TransformerStep } from '../types.js';
import { getGlobalRegistry } from './registry.js';

function normalizeStepName(step: TransformerStep): string {
  if (typeof step === 'string') return step;
  if (step && typeof step === 'object' && typeof (step as any).name === 'string') return (step as any).name;
  return '';
}

export function validateTransformerConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['transformer: 配置必须是对象'] };
  }

  const cfg = config as TransformerConfig;
  const def = cfg.default;

  if (!Array.isArray(def) || def.length === 0) {
    errors.push('transformer.default: 转换链不能为空');
    return { valid: false, errors };
  }

  const registry = getGlobalRegistry();
  for (let i = 0; i < def.length; i++) {
    const step = def[i] as any;
    const name = normalizeStepName(step);
    if (!name || typeof name !== 'string' || !name.trim()) {
      errors.push(`transformer.default[${i}]: step.name 不能为空`);
      continue;
    }
    if (!registry.has(name)) {
      errors.push(`transformer.default[${i}]: 未注册的转换器: ${name}`);
    }
  }

  // models（可选）：精确匹配
  if (cfg.models && typeof cfg.models === 'object') {
    for (const [model, chain] of Object.entries(cfg.models)) {
      if (!Array.isArray(chain) || chain.length === 0) {
        errors.push(`transformer.models.${model}: 转换链不能为空`);
        continue;
      }
      for (let i = 0; i < chain.length; i++) {
        const name = normalizeStepName(chain[i] as any);
        if (!name || !name.trim()) {
          errors.push(`transformer.models.${model}[${i}]: step.name 不能为空`);
          continue;
        }
        if (!registry.has(name)) {
          errors.push(`transformer.models.${model}[${i}]: 未注册的转换器: ${name}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateSupplierAuth(auth: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (auth === undefined || auth === null) return { valid: true, errors };
  if (!auth || typeof auth !== 'object') return { valid: false, errors: ['supplier.auth: 配置必须是对象'] };

  const a = auth as SupplierAuth;
  if (a.type === 'none') return { valid: true, errors };

  if (a.type === 'bearer') {
    if (typeof a.token !== 'string' || !a.token.trim()) {
      errors.push('supplier.auth: type=bearer 时必须提供 token（字符串）');
    }
    return { valid: errors.length === 0, errors };
  }

  if (a.type === 'header') {
    if (typeof a.headerName !== 'string' || !a.headerName.trim()) {
      errors.push('supplier.auth: type=header 时必须提供 headerName（字符串）');
    }
    if (typeof a.headerValue !== 'string' || !a.headerValue.trim()) {
      errors.push('supplier.auth: type=header 时必须提供 headerValue（字符串）');
    }
    return { valid: errors.length === 0, errors };
  }

  errors.push(`supplier.auth: 不支持的 type=${(a as any).type}`);
  return { valid: false, errors };
}

export function validateGatewayAuth(auth: unknown): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (auth === undefined || auth === null) return { valid: true, errors, warnings };
  if (!auth || typeof auth !== 'object') return { valid: false, errors: ['gatewayAuth: 配置必须是对象'], warnings };

  const a = auth as GatewayAuth;
  if (!a.enabled) return { valid: true, errors, warnings };

  if (typeof a.token !== 'string' || !a.token.trim()) {
    errors.push('gatewayAuth: enabled=true 时必须提供 token（字符串）');
  }

  if (a.acceptedHeaders !== undefined && !Array.isArray(a.acceptedHeaders)) {
    errors.push('gatewayAuth.acceptedHeaders: 必须是字符串数组');
  }

  return { valid: errors.length === 0, errors, warnings };
}

