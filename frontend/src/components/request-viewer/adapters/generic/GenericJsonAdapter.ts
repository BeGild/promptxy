import type { RequestAdapter } from '../../types/adapter';
import type { FieldConfig, RequestMetadata, ViewNode } from '../../types';
import { buildTreeFromPath } from '../utils/treeBuilder';

/**
 * 通用 JSON 请求适配器
 * 用于兜底展示暂未提供专用协议适配器的请求体，例如 /chat 透明代理请求。
 */
export class GenericJsonAdapter implements RequestAdapter<Record<string, any>> {
  readonly name = 'generic-json';
  readonly version = '1.0.0';

  private fieldConfigs = new Map<string, FieldConfig>();

  supports(request: any): request is Record<string, any> {
    return Boolean(request) && typeof request === 'object';
  }

  extractMetadata(request: Record<string, any>): RequestMetadata {
    const messageCount = Array.isArray(request.messages) ? request.messages.length : undefined;

    return {
      model: typeof request.model === 'string' ? request.model : undefined,
      messageCount,
      client: Array.isArray(request.messages) ? 'chat' : undefined,
    };
  }

  buildViewTree(request: Record<string, any>, original?: Record<string, any>): ViewNode {
    return buildTreeFromPath(request, {
      fieldConfigs: this.fieldConfigs,
      original,
      hasOriginal: original !== undefined,
    });
  }

  getFieldConfig(path: string): FieldConfig | undefined {
    return this.fieldConfigs.get(path);
  }
}
