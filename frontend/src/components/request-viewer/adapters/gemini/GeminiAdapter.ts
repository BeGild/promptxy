import type { RequestAdapter } from '../../types/adapter';
import {
  NodeType,
  type RequestMetadata,
  type ViewNode,
  type FieldConfig,
  type ViewGroup,
} from '../../types';
import { buildTreeFromPath } from '../utils/treeBuilder';

/**
 * Gemini Parts 容器类型
 */
type GeminiPartsContainer = {
  parts?: Array<{ text?: string; [key: string]: any }>;
  [key: string]: any;
};

/**
 * Gemini API 请求类型
 * 参考 Google Gemini API 格式
 */
export interface GeminiRequest {
  model?: string;
  system_instruction?: string | GeminiPartsContainer;
  systemInstruction?: string | GeminiPartsContainer;
  contents?: Array<any>;
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Gemini API 适配器
 * 支持使用 system_instruction/systemInstruction 字段的 Gemini 格式请求
 */
export class GeminiAdapter implements RequestAdapter<GeminiRequest> {
  readonly name = 'gemini';
  readonly version = '1.0.0';

  private fieldConfigs = new Map<string, FieldConfig>();

  constructor() {
    this.initializeFieldConfigs();
  }

  /**
   * 初始化字段配置
   */
  private initializeFieldConfigs(): void {
    // System Instruction 配置（下划线格式）
    this.fieldConfigs.set('system_instruction', {
      path: 'system_instruction',
      type: NodeType.MARKDOWN,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'System Instruction', icon: '📝' },
    });

    // System Instruction 配置（驼峰格式）
    this.fieldConfigs.set('systemInstruction', {
      path: 'systemInstruction',
      type: NodeType.MARKDOWN,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'System Instruction', icon: '📝' },
    });

    // Contents 配置
    this.fieldConfigs.set('contents', {
      path: 'contents',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'Contents', icon: '💬' },
    });

    // Generation Config 配置
    this.fieldConfigs.set('generationConfig', {
      path: 'generationConfig',
      type: NodeType.JSON,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Generation Config', icon: '⚙️' },
    });

    // ===== 配置 root 前缀版本 =====

    this.fieldConfigs.set('root.system_instruction', {
      path: 'root.system_instruction',
      type: NodeType.MARKDOWN,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'System Instruction', icon: '📝' },
    });

    this.fieldConfigs.set('root.systemInstruction', {
      path: 'root.systemInstruction',
      type: NodeType.MARKDOWN,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'System Instruction', icon: '📝' },
    });

    this.fieldConfigs.set('root.contents', {
      path: 'root.contents',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'Contents', icon: '💬' },
    });

    this.fieldConfigs.set('root.generationConfig', {
      path: 'root.generationConfig',
      type: NodeType.JSON,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Generation Config', icon: '⚙️' },
    });

    // Contents 数组元素标签配置
    this.fieldConfigs.set('root.contents.*', {
      path: 'root.contents.*',
      metadata: {
        labelGenerator: (value: any, path: string) => {
          const parts = path.split('.');
          const index = parts.pop() ?? '?';
          // 尝试从 role 字段获取标签
          if (value?.role && typeof value.role === 'string') {
            return `${index} [${value.role}]`;
          }
          return index;
        },
      },
    });
  }

  /**
   * 判断是否支持该请求格式
   * Gemini 请求特征：
   * - 有 system_instruction 或 systemInstruction 字段
   * - 可选的 contents 数组
   */
  supports(request: any): request is GeminiRequest {
    return (
      request &&
      typeof request === 'object' &&
      (request.system_instruction !== undefined ||
        request.systemInstruction !== undefined)
    );
  }

  /**
   * 提取请求元数据
   */
  extractMetadata(request: GeminiRequest): RequestMetadata {
    const metadata: RequestMetadata = {
      model: request.model,
      messageCount: request.contents?.length ?? 0,
    };

    // 计算 system instruction 长度
    const systemInstruction = request.system_instruction || request.systemInstruction;
    if (systemInstruction) {
      if (typeof systemInstruction === 'string') {
        metadata.systemPromptLength = systemInstruction.length;
      } else if (systemInstruction.parts && Array.isArray(systemInstruction.parts)) {
        // 计算所有 parts 文本长度总和
        const totalLength = systemInstruction.parts.reduce(
          (sum: number, part: any) => sum + (part.text?.length ?? 0),
          0
        );
        metadata.systemPromptLength = totalLength;
      }
    }

    return metadata;
  }

  /**
   * 构建视图树
   */
  buildViewTree(request: GeminiRequest, original?: GeminiRequest): ViewNode {
    return buildTreeFromPath(request, {
      fieldConfigs: this.fieldConfigs,
      original,
    });
  }

  /**
   * 获取字段配置
   */
  getFieldConfig(path: string): FieldConfig | undefined {
    // 精确匹配
    if (this.fieldConfigs.has(path)) {
      return this.fieldConfigs.get(path);
    }

    // 通配符匹配
    for (const [key, config] of this.fieldConfigs.entries()) {
      if (this.matchesWildcard(key, path)) {
        return config;
      }
    }

    return undefined;
  }

  /**
   * 通配符匹配
   */
  private matchesWildcard(pattern: string, path: string): boolean {
    const patternParts = pattern.split('.');
    const pathParts = path.split('.');

    if (patternParts.length !== pathParts.length) {
      return false;
    }

    return patternParts.every((part, index) => {
      return part === '*' || part === pathParts[index];
    });
  }

  /**
   * 获取视图分组
   */
  getGroups(viewTree: ViewNode): ViewGroup[] {
    const groups: ViewGroup[] = [];

    // 基本信息
    const basicPaths = ['model'];
    if (viewTree.children?.some(c => c.path === 'generationConfig')) {
      basicPaths.push('generationConfig.maxOutputTokens', 'generationConfig.temperature', 'generationConfig.topP');
    }

    groups.push({
      id: 'basic',
      label: '基本信息',
      icon: '📋',
      nodePaths: basicPaths,
      description: '请求的基本参数',
    });

    // System Instruction - Gemini 核心字段（支持两种格式）
    if (viewTree.children?.some(child =>
      child.path === 'system_instruction' || child.path === 'systemInstruction'
    )) {
      groups.push({
        id: 'system',
        label: 'System Instruction',
        icon: '📝',
        nodePaths: ['system_instruction', 'systemInstruction'],
        description: 'Gemini 系统指令',
      });
    }

    // Contents
    if (viewTree.children?.some(child => child.path === 'contents')) {
      groups.push({
        id: 'contents',
        label: 'Contents',
        icon: '💬',
        nodePaths: ['contents'],
        description: '对话内容',
      });
    }

    return groups;
  }
}
