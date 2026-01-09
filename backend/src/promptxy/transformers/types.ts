/**
 * Transformers Types（兼容层）
 *
 * 说明：
 * - 测试中有一部分仍以 `transformers/types` 作为统一类型入口。
 * - 运行时主流程建议直接使用 `transformers/index` 或 `types.ts` 中的结构。
 */

import type { SupplierAuth, TransformerConfig } from '../types.js';

export type TransformRequest = {
  supplier: {
    id: string;
    name: string;
    baseUrl: string;
    auth?: SupplierAuth;
    transformer?: TransformerConfig;
  };
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body: unknown;
  };
  stream?: boolean;
};

