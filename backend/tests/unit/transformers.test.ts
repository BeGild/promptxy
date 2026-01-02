/**
 * Protocol Transformers Unit Tests
 *
 * 测试范围：
 * - 链选择（default vs model override）
 * - 配置校验
 * - 脱敏策略
 */

import { describe, it, expect } from 'vitest';
import type { TransformerChain, TransformerConfig, SupplierAuth, GatewayAuth } from '../../src/promptxy/types.js';
import {
  validateTransformerConfig,
  validateSupplierAuth,
  validateGatewayAuth,
} from '../../src/promptxy/transformers/validation.js';
import { getGlobalRegistry } from '../../src/promptxy/transformers/registry.js';
import { sanitizeHeaders } from '../../src/promptxy/transformers/llms-compat.js';
import { selectChain } from '../../src/promptxy/transformers/llms-compat.js';

describe('Transformers - 链选择', () => {
  it('应选择 default 链当模型没有精确匹配时', () => {
    const config: TransformerConfig = {
      default: ['anthropic', 'deepseek'],
    };

    const result = selectChain(config, 'claude-sonnet-4-20250514');
    expect(result.chainType).toBe('default');
    expect(result.chain).toEqual(['anthropic', 'deepseek']);
  });

  it('应选择模型特定覆盖链当精确匹配时', () => {
    const config: TransformerConfig = {
      default: ['deepseek'],
      models: {
        'claude-sonnet-4-20250514': ['anthropic', 'deepseek', 'tooluse'],
      },
    };

    const result = selectChain(config, 'claude-sonnet-4-20250514');
    expect(result.chainType).toBe('claude-sonnet-4-20250514');
    expect(result.chain).toEqual(['anthropic', 'deepseek', 'tooluse']);
  });

  it('应处理大小写敏感的模型名称匹配', () => {
    const config: TransformerConfig = {
      default: ['deepseek'],
      models: {
        'GPT-4': ['deepseek'],
        'gpt-4': ['deepseek'], // 不同的大小写
      },
    };

    const result1 = selectChain(config, 'GPT-4');
    expect(result1.chainType).toBe('GPT-4');

    const result2 = selectChain(config, 'gpt-4');
    expect(result2.chainType).toBe('gpt-4');
  });

  it('当模型为 undefined 时应选择 default 链', () => {
    const config: TransformerConfig = {
      default: ['deepseek'],
      models: {
        'claude-sonnet-4-20250514': ['anthropic', 'deepseek'],
      },
    };

    const result = selectChain(config, undefined);
    expect(result.chainType).toBe('default');
    expect(result.chain).toEqual(['deepseek']);
  });
});

describe('Transformers - 配置校验', () => {
  describe('validateTransformerConfig', () => {
    it('应通过有效的 default 链配置', () => {
      const config: TransformerConfig = {
        default: ['deepseek'],
      };

      const result = validateTransformerConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应通过有效的 default + models 配置', () => {
      const config: TransformerConfig = {
        default: ['deepseek'],
        models: {
          'claude-sonnet-4': ['deepseek', 'tooluse'],
          'gpt-4': ['deepseek'],
        },
      };

      const result = validateTransformerConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应拒绝空 default 链', () => {
      const config: TransformerConfig = {
        default: [],
      };

      const result = validateTransformerConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('transformer.default: 转换链不能为空');
    });

    it('应拒绝未注册的转换器', () => {
      const registry = getGlobalRegistry();

      // 使用一个肯定不存在的转换器名称
      const fakeTransformer = '__nonexistent_transformer__' + Date.now();

      const config: TransformerConfig = {
        default: [fakeTransformer],
      };

      const result = validateTransformerConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes(fakeTransformer))).toBe(true);
    });

    it('应通过对象形式的转换器步骤', () => {
      const config: TransformerConfig = {
        default: [
          { name: 'deepseek' },
          { name: 'tooluse', options: { strict: true } },
        ],
      };

      const result = validateTransformerConfig(config);
      expect(result.valid).toBe(true);
    });

    it('应拒绝对象形式的转换器缺少 name', () => {
      const config: TransformerConfig = {
        default: [{ name: '' } as any],
      };

      const result = validateTransformerConfig(config);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSupplierAuth', () => {
    it('应通过有效的 bearer 认证配置', () => {
      const auth: SupplierAuth = {
        type: 'bearer',
        token: 'sk-test-token-12345',
      };

      const result = validateSupplierAuth(auth);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应拒绝 bearer 类型缺少 token', () => {
      const auth: SupplierAuth = {
        type: 'bearer',
      };

      const result = validateSupplierAuth(auth);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('supplier.auth: type=bearer 时必须提供 token（字符串）');
    });

    it('应通过有效的 header 认证配置', () => {
      const auth: SupplierAuth = {
        type: 'header',
        headerName: 'x-api-key',
        headerValue: 'my-api-key-12345',
      };

      const result = validateSupplierAuth(auth);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应拒绝 header 类型缺少 headerName', () => {
      const auth: SupplierAuth = {
        type: 'header',
        headerValue: 'my-api-key-12345',
      };

      const result = validateSupplierAuth(auth);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('supplier.auth: type=header 时必须提供 headerName（字符串）');
    });

    it('应拒绝 header 类型缺少 headerValue', () => {
      const auth: SupplierAuth = {
        type: 'header',
        headerName: 'x-api-key',
      };

      const result = validateSupplierAuth(auth);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('supplier.auth: type=header 时必须提供 headerValue（字符串）');
    });
  });

  describe('validateGatewayAuth', () => {
    it('应通过未启用的 gatewayAuth 配置', () => {
      const auth: GatewayAuth = {
        enabled: false,
      };

      const result = validateGatewayAuth(auth);
      expect(result.valid).toBe(true);
    });

    it('应拒绝启用但缺少 token 的配置', () => {
      const auth: GatewayAuth = {
        enabled: true,
      };

      const result = validateGatewayAuth(auth);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('gatewayAuth: enabled=true 时必须提供 token（字符串）');
    });

    it('应通过启用且包含 token 和 acceptedHeaders 的配置', () => {
      const auth: GatewayAuth = {
        enabled: true,
        token: 'secret-gateway-token',
        acceptedHeaders: ['authorization', 'x-api-key'],
      };

      const result = validateGatewayAuth(auth);
      expect(result.valid).toBe(true);
    });

    it('应允许空的 acceptedHeaders 数组', () => {
      const auth: GatewayAuth = {
        enabled: true,
        token: 'secret-gateway-token',
        acceptedHeaders: [],
      };

      const result = validateGatewayAuth(auth);
      // 空数组是被允许的（使用默认的鉴权头列表）
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('Transformers - 脱敏策略', () => {
  describe('sanitizeHeaders', () => {
    it('应脱敏 authorization header (保留 Bearer 前缀)', () => {
      const headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer sk-ant-api03-abc123def456',
      };

      const result = sanitizeHeaders(headers);
      expect(result['authorization']).toBe('Bearer ***REDACTED***');
    });

    it('应保留非敏感 headers', () => {
      const headers = {
        'content-type': 'application/json',
        'accept': 'application/json',
        'user-agent': 'TestClient/1.0',
      };

      const result = sanitizeHeaders(headers);
      expect(result['content-type']).toBe('application/json');
      expect(result['accept']).toBe('application/json');
      expect(result['user-agent']).toBe('TestClient/1.0');
    });

    it('应脱敏 x-api-key header', () => {
      const headers = {
        'x-api-key': 'sk-1234567890abcdef',
      };

      const result = sanitizeHeaders(headers);
      expect(result['x-api-key']).toBe('***REDACTED***');
    });

    it('应脱敏多种敏感 header（不区分大小写）', () => {
      const headers = {
        'Authorization': 'Bearer token123',
        'X-API-KEY': 'key123',
        'x-goog-api-key': 'google-key-123',
        'cookie': 'session=abc123',
      };

      const result = sanitizeHeaders(headers);
      expect(result['Authorization']).toBe('Bearer ***REDACTED***');
      expect(result['X-API-KEY']).toBe('***REDACTED***');
      expect(result['x-goog-api-key']).toBe('***REDACTED***');
      expect(result['cookie']).toBe('***REDACTED***');
    });

    it('应处理空对象', () => {
      const result = sanitizeHeaders({});
      expect(result).toEqual({});
    });

    it('应保留空字符串值的非敏感 headers', () => {
      const headers = {
        'content-type': '',
        'authorization': 'Bearer token123',
      };

      const result = sanitizeHeaders(headers);
      expect(result['content-type']).toBe('');
      expect(result['authorization']).toBe('Bearer ***REDACTED***');
    });
  });
});

describe('Transformers - 注册表', () => {
  it('应包含所有预期的内置转换器', () => {
    const registry = getGlobalRegistry();
    const transformers = registry.list();

    // 验证核心转换器存在
    const expected = ['anthropic', 'deepseek', 'gemini', 'tooluse', 'maxtoken'];
    for (const name of expected) {
      expect(transformers).toContain(name);
    }
  });

  it('应能获取转换器元信息', () => {
    const registry = getGlobalRegistry();
    const meta = registry.getMetadata('deepseek');

    expect(meta).toBeDefined();
    expect(meta?.name).toBe('deepseek');
    expect(meta?.supportedSuppliers).toContain('deepseek');
    expect(meta?.supportsStreaming).toBe(true);
    expect(meta?.supportsTools).toBe(true);
  });

  it('应能检查转换器是否存在', () => {
    const registry = getGlobalRegistry();

    expect(registry.has('deepseek')).toBe(true);
    expect(registry.has('anthropic')).toBe(true);
    expect(registry.has('gemini')).toBe(true);
    expect(registry.has('nonexistent')).toBe(false);
  });
});
