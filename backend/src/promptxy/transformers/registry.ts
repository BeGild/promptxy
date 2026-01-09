/**
 * Transformers Registry（兼容层）
 *
 * 说明：
 * - 该 Registry 主要服务于旧的 llms-compat 测试与配置校验。
 * - 运行时网关主流程使用 TransformerEngine（engine/），不依赖这里的实现细节。
 */

export type TransformerMetadata = {
  name: string;
  supportedSuppliers: string[];
  supportsStreaming: boolean;
  supportsTools: boolean;
};

export type TransformerRegistry = {
  list: () => string[];
  has: (name: string) => boolean;
  getMetadata: (name: string) => TransformerMetadata | undefined;
};

const BUILTIN: Record<string, TransformerMetadata> = {
  anthropic: {
    name: 'anthropic',
    supportedSuppliers: ['anthropic'],
    supportsStreaming: true,
    supportsTools: true,
  },
  deepseek: {
    name: 'deepseek',
    supportedSuppliers: ['deepseek'],
    supportsStreaming: true,
    supportsTools: true,
  },
  gemini: {
    name: 'gemini',
    supportedSuppliers: ['gemini'],
    supportsStreaming: true,
    supportsTools: true,
  },
  tooluse: {
    name: 'tooluse',
    supportedSuppliers: ['openai', 'deepseek', 'codex', 'gemini'],
    supportsStreaming: true,
    supportsTools: true,
  },
  maxtoken: {
    name: 'maxtoken',
    supportedSuppliers: ['openai', 'deepseek', 'codex', 'gemini'],
    supportsStreaming: true,
    supportsTools: false,
  },
  codex: {
    name: 'codex',
    supportedSuppliers: ['openai', 'codex'],
    supportsStreaming: true,
    supportsTools: true,
  },
};

const GLOBAL: TransformerRegistry = {
  list: () => Object.keys(BUILTIN),
  has: (name: string) => Boolean(BUILTIN[name]),
  getMetadata: (name: string) => BUILTIN[name],
};

export function getGlobalRegistry(): TransformerRegistry {
  return GLOBAL;
}

