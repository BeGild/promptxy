/**
 * PromptXY 协议转换类型定义
 *
 * 定义协议转换相关的所有类型，包括：
 * - Transformer 配置结构
 * - 转换链定义
 * - 转换结果与 Trace
 * - 认证配置
 */

// ============================================================================
// Transformer 配置类型
// ============================================================================

/**
 * 转换器步骤定义
 * 可以是字符串（转换器名称）或对象（带选项的转换器）
 */
export type TransformerStep =
  | string // 转换器名称，如 "deepseek"
  | {
      name: string; // 转换器名称
      options?: Record<string, unknown>; // 转换器选项
    };

/**
 * 转换链定义（数组形式的转换器步骤序列）
 */
export type TransformerChain = TransformerStep[];

/**
 * Transformer 配置（v1 精确匹配）
 */
export interface TransformerConfig {
  /** 默认转换链 */
  default: TransformerChain;
  /** 模型精确匹配覆盖链 */
  models?: Record<string, TransformerChain>;
}

// ============================================================================
// 认证配置类型
// ============================================================================

/**
 * Supplier 认证配置
 * 用于存储上游供应商的认证信息并注入到请求中
 */
export interface SupplierAuth {
  /** 认证类型 */
  type: 'bearer' | 'header';
  /** Bearer token（当 type=bearer 时必填） */
  token?: string;
  /** 自定义 header 名称（当 type=header 时必填） */
  headerName?: string;
  /** 自定义 header 值（当 type=header 时必填） */
  headerValue?: string;
}

/**
 * 网关入站鉴权配置
 * 用于验证客户端访问 PromptXY 网关的权限
 */
export interface GatewayAuth {
  /** 是否启用入站鉴权 */
  enabled: boolean;
  /** 入站鉴权 token */
  token?: string;
  /** 接受 token 的请求头列表（从客户端原生会发送的鉴权头中读取） */
  acceptedHeaders?: string[];
}

// ============================================================================
// 转换结果与 Trace 类型
// ============================================================================

/**
 * 转换步骤执行结果
 */
export interface TransformStepResult {
  /** 转换器名称 */
  name: string;
  /** 是否成功 */
  success: boolean;
  /** 步骤耗时（毫秒） */
  duration: number;
  /** 错误信息（如果失败） */
  error?: string;
  /** 警告信息 */
  warnings?: string[];
}

/**
 * 转换链执行结果
 */
export interface TransformTrace {
  /** 命中的 supplier ID */
  supplierId: string;
  /** 命中的 supplier 名称 */
  supplierName: string;
  /** 使用的链类型（default 或模型名称） */
  chainType: 'default' | string;
  /** 完整的转换链 */
  chain: TransformerChain;
  /** 步骤执行结果列表 */
  steps: TransformStepResult[];
  /** 总耗时（毫秒） */
  totalDuration: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  errors: string[];
  /** 警告信息 */
  warnings: string[];
}

/**
 * 转换预览结果（脱敏）
 */
export interface TransformPreview {
  /** 原始请求（Anthropic 协议） */
  original: {
    method: string;
    path: string;
    headers: Record<string, string>; // 脱敏后的 headers
    body?: unknown;
  };
  /** 转换后请求（上游协议） */
  transformed: {
    method: string;
    path: string;
    headers: Record<string, string>; // 脱敏后的 headers，包含注入的 auth
    body?: unknown;
  };
  /** 转换 trace */
  trace: TransformTrace;
  /** cURL 命令（脱敏） */
  curlCommand?: string;
}

// ============================================================================
// 转换请求/响应类型
// ============================================================================

/**
 * 协议转换请求
 */
export interface TransformRequest {
  /** Supplier 配置 */
  supplier: {
    id: string;
    name: string;
    baseUrl: string;
    auth?: SupplierAuth;
    transformer?: TransformerConfig;
  };
  /** 原始请求信息 */
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: unknown;
  };
  /** 是否启用流式 */
  stream?: boolean;
}

/**
 * 协议转换响应
 */
export interface TransformResponse {
  /** 转换后的请求 */
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: unknown;
  };
  /** 转换 trace */
  trace: TransformTrace;
  /** 是否需要转换响应 */
  needsResponseTransform: boolean;
}

// ============================================================================
// Transformer 注册表类型
// ============================================================================

/**
 * 转换器元信息
 */
export interface TransformerMetadata {
  /** 转换器名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 支持的供应商列表 */
  supportedSuppliers: string[];
  /** 是否支持流式 */
  supportsStreaming: boolean;
  /** 是否支持工具调用 */
  supportsTools: boolean;
}

/**
 * Transformer 注册表接口
 */
export interface ITransformerRegistry {
  /** 注册转换器 */
  register(name: string, transformer: unknown): void;
  /** 获取转换器 */
  get(name: string): unknown | undefined;
  /** 列出所有可用转换器 */
  list(): string[];
  /** 检查转换器是否可用 */
  has(name: string): boolean;
  /** 获取转换器元信息 */
  getMetadata(name: string): TransformerMetadata | undefined;
}
