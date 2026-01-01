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
  role?: string;
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
  tools?: Array<any>;
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    thinkingConfig?: any;
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
  readonly version = '1.0.2';

  private fieldConfigs = new Map<string, FieldConfig>();

  constructor() {
    this.initializeFieldConfigs();
  }

  /**
   * 初始化字段配置
   */
  private initializeFieldConfigs(): void {
    // ========================================
    // 顶层字段配置
    // ========================================

    // System Instruction 配置（下划线格式）
    this.fieldConfigs.set('system_instruction', {
      path: 'system_instruction',
      type: NodeType.JSON,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'System Instruction', icon: '📝' },
    });

    // System Instruction 配置（驼峰格式）
    this.fieldConfigs.set('systemInstruction', {
      path: 'systemInstruction',
      type: NodeType.JSON,
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

    // Tools 配置
    this.fieldConfigs.set('tools', {
      path: 'tools',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Tools', icon: '🔧' },
    });

    // Generation Config 配置
    this.fieldConfigs.set('generationConfig', {
      path: 'generationConfig',
      type: NodeType.JSON,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Generation Config', icon: '⚙️' },
    });

    // ========================================
    // root 前缀版本（树路径需要）
    // ========================================

    this.fieldConfigs.set('root.system_instruction', {
      path: 'root.system_instruction',
      type: NodeType.JSON,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'System Instruction', icon: '📝' },
    });

    this.fieldConfigs.set('root.systemInstruction', {
      path: 'root.systemInstruction',
      type: NodeType.JSON,
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

    this.fieldConfigs.set('root.tools', {
      path: 'root.tools',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Tools', icon: '🔧' },
    });

    this.fieldConfigs.set('root.generationConfig', {
      path: 'root.generationConfig',
      type: NodeType.JSON,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Generation Config', icon: '⚙️' },
    });

    // ========================================
    // SystemInstruction 的 parts 数组配置
    // ========================================

    this.fieldConfigs.set('root.systemInstruction.parts', {
      path: 'root.systemInstruction.parts',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'Parts' },
    });

    this.fieldConfigs.set('root.systemInstruction.parts.*.text', {
      path: 'root.systemInstruction.parts.*.text',
      type: NodeType.MARKDOWN,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'Text' },
    });

    // 同样支持下划线格式
    this.fieldConfigs.set('root.system_instruction.parts', {
      path: 'root.system_instruction.parts',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'Parts' },
    });

    this.fieldConfigs.set('root.system_instruction.parts.*.text', {
      path: 'root.system_instruction.parts.*.text',
      type: NodeType.MARKDOWN,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'Text' },
    });

    // ========================================
    // Contents 数组元素标签配置
    // ========================================

    this.fieldConfigs.set('root.contents.*', {
      path: 'root.contents.*',
      metadata: {
        labelGenerator: (value: any, path: string) => {
          const parts = path.split('.');
          const index = parts.pop() ?? '?';
          // 优先从 role 字段获取标签
          if (value?.role && typeof value.role === 'string' && value.role.trim()) {
            return `${index} [${value.role.trim()}]`;
          }
          return index;
        },
      },
    });

    // Contents 元素的 parts 数组配置
    this.fieldConfigs.set('root.contents.*.parts', {
      path: 'root.contents.*.parts',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Parts' },
    });

    // Contents parts 数组元素标签配置
    this.fieldConfigs.set('root.contents.*.parts.*', {
      path: 'root.contents.*.parts.*',
      metadata: {
        labelGenerator: (value: any, path: string) => {
          const parts = path.split('.');
          const index = parts.pop() ?? '?';
          // 如果有 text 字段，显示部分内容
          if (value?.text && typeof value.text === 'string') {
            const text = value.text.trim();
            const preview = text.length > 30 ? text.slice(0, 30) + '...' : text;
            return `${index} [text: "${preview}"]`;
          }
          // 如果有 inline_data 字段
          if (value?.inline_data) {
            return `${index} [inline_data]`;
          }
          return index;
        },
      },
    });

    // Contents parts 元素的 text 字段
    this.fieldConfigs.set('root.contents.*.parts.*.text', {
      path: 'root.contents.*.parts.*.text',
      type: NodeType.STRING_LONG,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'Text' },
    });

    // ========================================
    // Tools 数组配置
    // ========================================

    // Tools 数组元素标签配置
    this.fieldConfigs.set('root.tools.*', {
      path: 'root.tools.*',
      metadata: {
        labelGenerator: (value: any, path: string) => {
          const parts = path.split('.');
          const index = parts.pop() ?? '?';
          // 检查是否有 functionDeclarations
          if (value?.functionDeclarations && Array.isArray(value.functionDeclarations)) {
            const count = value.functionDeclarations.length;
            return `${index} [${count} function declarations]`;
          }
          return index;
        },
      },
    });

    // Tools 的 functionDeclarations 数组配置
    this.fieldConfigs.set('root.tools.*.functionDeclarations', {
      path: 'root.tools.*.functionDeclarations',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Function Declarations' },
    });

    // FunctionDeclarations 数组元素标签配置 - 使用 name 字段
    this.fieldConfigs.set('root.tools.*.functionDeclarations.*', {
      path: 'root.tools.*.functionDeclarations.*',
      metadata: {
        labelGenerator: (value: any, path: string) => {
          const parts = path.split('.');
          const index = parts.pop() ?? '?';
          // 优先使用 name 字段
          if (value?.name && typeof value.name === 'string' && value.name.trim()) {
            return `${index} [${value.name.trim()}]`;
          }
          return index;
        },
      },
    });

    // Function 的 parametersJsonSchema 配置为 JSON
    this.fieldConfigs.set('root.tools.*.functionDeclarations.*.parametersJsonSchema', {
      path: 'root.tools.*.functionDeclarations.*.parametersJsonSchema',
      type: NodeType.JSON,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Parameters Schema' },
    });

    // Function 的 description 字段
    this.fieldConfigs.set('root.tools.*.functionDeclarations.*.description', {
      path: 'root.tools.*.functionDeclarations.*.description',
      type: NodeType.STRING_LONG,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Description' },
    });

    // ========================================
    // GenerationConfig 子字段配置
    // ========================================

    this.fieldConfigs.set('root.generationConfig.thinkingConfig', {
      path: 'root.generationConfig.thinkingConfig',
      type: NodeType.JSON,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Thinking Config' },
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
      toolCount: 0,
      client: 'gemini',
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

    // 计算 tools 数量
    if (request.tools && Array.isArray(request.tools)) {
      for (const tool of request.tools) {
        if (tool.functionDeclarations && Array.isArray(tool.functionDeclarations)) {
          metadata.toolCount += tool.functionDeclarations.length;
        }
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
      basicPaths.push('generationConfig.temperature', 'generationConfig.topP', 'generationConfig.topK');
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

    // Tools
    if (viewTree.children?.some(child => child.path === 'tools')) {
      groups.push({
        id: 'tools',
        label: 'Tools',
        icon: '🔧',
        nodePaths: ['tools'],
        description: '可用工具列表',
      });
    }

    // Generation Config
    if (viewTree.children?.some(child => child.path === 'generationConfig')) {
      groups.push({
        id: 'generationConfig',
        label: 'Generation Config',
        icon: '⚙️',
        nodePaths: ['generationConfig'],
        description: '生成配置参数',
      });
    }

    return groups;
  }
}
