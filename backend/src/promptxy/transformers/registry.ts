/**
 * PromptXY Transformer 注册表
 *
 * 管理所有可用的协议转换器，提供：
 * - 转换器注册与获取
 * - 可用性检查
 * - 元信息查询
 */

import type {
  ITransformerRegistry,
  TransformerMetadata,
  TransformerChain,
} from './types.js';
import { createLogger } from '../logger.js';

const logger = createLogger({ debug: false });

/**
 * 内置转换器元信息映射
 * 基于 @musistudio/llms 的可用转换器
 */
const BUILTIN_TRANSFORMERS: Record<string, TransformerMetadata> = {
  codex: {
    name: 'codex',
    description: 'Codex（OpenAI Responses）格式转换',
    supportedSuppliers: ['openai', 'api.openai.com', 'codex'],
    supportsStreaming: true,
    supportsTools: true,
  },
  openai: {
    name: 'openai',
    description: 'OpenAI 兼容协议（Chat Completions）格式转换',
    supportedSuppliers: ['openai', 'api.openai.com'],
    supportsStreaming: true,
    supportsTools: true,
  },
  anthropic: {
    name: 'anthropic',
    description: 'Anthropic 原始协议（透传）',
    supportedSuppliers: ['anthropic', 'api.anthropic.com'],
    supportsStreaming: true,
    supportsTools: true,
  },
  deepseek: {
    name: 'deepseek',
    description: 'DeepSeek API 格式转换',
    supportedSuppliers: ['deepseek', 'api.deepseek.com'],
    supportsStreaming: true,
    supportsTools: true,
  },
  gemini: {
    name: 'gemini',
    description: 'Gemini API 格式转换',
    supportedSuppliers: ['gemini', 'generativelanguage.googleapis.com'],
    supportsStreaming: true,
    supportsTools: true,
  },
  'gemini-cli': {
    name: 'gemini-cli',
    description: 'Gemini CLI 特殊格式',
    supportedSuppliers: ['gemini-cli'],
    supportsStreaming: true,
    supportsTools: true,
  },
  openrouter: {
    name: 'openrouter',
    description: 'OpenRouter API（含 provider 路由）',
    supportedSuppliers: ['openrouter', 'openrouter.ai'],
    supportsStreaming: true,
    supportsTools: true,
  },
  groq: {
    name: 'groq',
    description: 'Groq API 格式转换',
    supportedSuppliers: ['groq', 'api.groq.com'],
    supportsStreaming: true,
    supportsTools: true,
  },
  tooluse: {
    name: 'tooluse',
    description: '优化工具调用',
    supportedSuppliers: ['*'], // 通用增强器
    supportsStreaming: true,
    supportsTools: true,
  },
  maxtoken: {
    name: 'maxtoken',
    description: '设置 max_tokens 值',
    supportedSuppliers: ['*'], // 通用增强器
    supportsStreaming: true,
    supportsTools: false,
  },
  reasoning: {
    name: 'reasoning',
    description: '处理推理内容',
    supportedSuppliers: ['*'], // 通用增强器
    supportsStreaming: true,
    supportsTools: false,
  },
  sampling: {
    name: 'sampling',
    description: '处理采样参数',
    supportedSuppliers: ['*'], // 通用增强器
    supportsStreaming: true,
    supportsTools: false,
  },
  enhancetool: {
    name: 'enhancetool',
    description: '工具调用错误容忍',
    supportedSuppliers: ['*'], // 通用增强器
    supportsStreaming: true,
    supportsTools: true,
  },
  cleancache: {
    name: 'cleancache',
    description: '清除 cache_control 字段',
    supportedSuppliers: ['*'], // 通用增强器
    supportsStreaming: true,
    supportsTools: false,
  },
  'vertex-gemini': {
    name: 'vertex-gemini',
    description: 'Vertex AI Gemini',
    supportedSuppliers: ['vertex', 'googleapis.com'],
    supportsStreaming: true,
    supportsTools: true,
  },
  'chutes-glm': {
    name: 'chutes-glm',
    description: 'GLM 4.5 支持',
    supportedSuppliers: ['glm', 'bigmodel.cn'],
    supportsStreaming: true,
    supportsTools: true,
  },
  'qwen-cli': {
    name: 'qwen-cli',
    description: 'Qwen CLI 支持',
    supportedSuppliers: ['qwen-cli'],
    supportsStreaming: true,
    supportsTools: true,
  },
  'rovo-cli': {
    name: 'rovo-cli',
    description: 'Rovo Dev CLI 支持',
    supportedSuppliers: ['rovo-cli'],
    supportsStreaming: true,
    supportsTools: true,
  },
};

/**
 * TransformerRegistry 实现
 *
 * 管理转换器的注册表，基于 @musistudio/llms 提供转换能力
 */
export class TransformerRegistry implements ITransformerRegistry {
  private transformers: Map<string, unknown> = new Map();

  /**
   * 构造函数
   * 自动注册所有内置转换器
   */
  constructor() {
    // 注册内置转换器（通过 @musistudio/llms）
    // 这里暂时只注册元信息，实际转换器在 llms-compat 中延迟加载
    for (const name of Object.keys(BUILTIN_TRANSFORMERS)) {
      this.transformers.set(name, { name, builtin: true });
    }

    if (logger.debugEnabled) {
      logger.debug(
        `[TransformerRegistry] 已注册 ${this.transformers.size} 个内置转换器`,
      );
    }
  }

  /**
   * 注册转换器
   */
  register(name: string, transformer: unknown): void {
    this.transformers.set(name, transformer);
    logger.debug(`[TransformerRegistry] 注册转换器: ${name}`);
  }

  /**
   * 获取转换器
   */
  get(name: string): unknown | undefined {
    return this.transformers.get(name);
  }

  /**
   * 列出所有可用转换器
   */
  list(): string[] {
    return Array.from(this.transformers.keys());
  }

  /**
   * 检查转换器是否可用
   */
  has(name: string): boolean {
    return this.transformers.has(name);
  }

  /**
   * 获取转换器元信息
   */
  getMetadata(name: string): TransformerMetadata | undefined {
    return BUILTIN_TRANSFORMERS[name];
  }

  /**
   * 验证转换链是否有效
   */
  validateChain(chain: TransformerChain): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(chain) || chain.length === 0) {
      errors.push('转换链必须是非空数组');
      return { valid: false, errors, warnings };
    }

    for (let i = 0; i < chain.length; i++) {
      const step = chain[i];
      const stepLabel = `chain[${i}]`;

      if (typeof step === 'string') {
        // 字符串形式的转换器名称
        if (!this.has(step)) {
          errors.push(`${stepLabel}: 未知的转换器 "${step}"`);
        }
      } else if (step && typeof step === 'object') {
        // 对象形式的转换器配置
        if (!('name' in step) || typeof step.name !== 'string') {
          errors.push(`${stepLabel}: 缺少 name 字段`);
        } else if (!this.has(step.name)) {
          errors.push(`${stepLabel}: 未知的转换器 "${step.name}"`);
        }
      } else {
        errors.push(`${stepLabel}: 无效的步骤格式`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 获取所有内置转换器元信息
   */
  getAllMetadata(): Record<string, TransformerMetadata> {
    return { ...BUILTIN_TRANSFORMERS };
  }
}

// 创建全局单例
let globalRegistry: TransformerRegistry | undefined;

export function getGlobalRegistry(): TransformerRegistry {
  if (!globalRegistry) {
    globalRegistry = new TransformerRegistry();
  }
  return globalRegistry;
}
