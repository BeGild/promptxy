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
 * Codex API 请求类型
 * 参考 OpenAI Completions API 格式
 */
export interface CodexRequest {
  model: string;
  instructions: string;
  prompt?: string;
  input?: string | Array<any>;
  tools?: Array<any>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  [key: string]: any;
}

/**
 * Codex API 适配器
 * 支持使用 instructions 字段的 Codex/OpenAI 格式请求
 */
export class CodexAdapter implements RequestAdapter<CodexRequest> {
  readonly name = 'codex';
  readonly version = '1.0.1';

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

    // Instructions 配置 - Codex 的核心字段
    this.fieldConfigs.set('instructions', {
      path: 'instructions',
      type: NodeType.MARKDOWN,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'Instructions', icon: '📝' },
    });

    // Prompt 配置
    this.fieldConfigs.set('prompt', {
      path: 'prompt',
      type: NodeType.MARKDOWN,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'Prompt', icon: '💬' },
    });

    // Input 配置 - 可能是字符串或数组
    this.fieldConfigs.set('input', {
      path: 'input',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'Input', icon: '⌨️' },
    });

    // Tools 配置
    this.fieldConfigs.set('tools', {
      path: 'tools',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Tools', icon: '🔧' },
    });

    // ========================================
    // root 前缀版本（树路径需要）
    // ========================================

    this.fieldConfigs.set('root.instructions', {
      path: 'root.instructions',
      type: NodeType.MARKDOWN,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'Instructions', icon: '📝' },
    });

    this.fieldConfigs.set('root.prompt', {
      path: 'root.prompt',
      type: NodeType.MARKDOWN,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'Prompt', icon: '💬' },
    });

    this.fieldConfigs.set('root.input', {
      path: 'root.input',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'Input', icon: '⌨️' },
    });

    this.fieldConfigs.set('root.tools', {
      path: 'root.tools',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Tools', icon: '🔧' },
    });

    // ========================================
    // 数组元素标签生成器
    // ========================================

    // Tools 数组元素 - 使用 name 字段
    this.fieldConfigs.set('root.tools.*', {
      path: 'root.tools.*',
      metadata: {
        labelGenerator: (value: any, path: string) => {
          const parts = path.split('.');
          const index = parts.pop() ?? '?';
          // 优先使用 name 字段
          if (value?.name && typeof value.name === 'string' && value.name.trim()) {
            return `${index} [${value.name.trim()}]`;
          }
          // 其次使用 type 字段
          if (value?.type && typeof value.type === 'string' && value.type.trim()) {
            return `${index} [${value.type.trim()}]`;
          }
          return index;
        },
      },
    });

    // Tool 的 parameters 字段配置为 JSON
    this.fieldConfigs.set('root.tools.*.parameters', {
      path: 'root.tools.*.parameters',
      type: NodeType.JSON,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Parameters' },
    });

    // Tool 的 format 字段配置为 JSON（针对 custom 类型工具）
    this.fieldConfigs.set('root.tools.*.format', {
      path: 'root.tools.*.format',
      type: NodeType.JSON,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Format' },
    });

    // Input 数组元素 - 使用 role 和 type 字段
    this.fieldConfigs.set('root.input.*', {
      path: 'root.input.*',
      metadata: {
        labelGenerator: (value: any, path: string) => {
          const parts = path.split('.');
          const index = parts.pop() ?? '?';
          let label = index;

          // 优先显示 role
          if (value?.role && typeof value.role === 'string' && value.role.trim()) {
            label = `${index} [${value.role.trim()}]`;
          }
          // 如果没有 role，显示 type
          else if (value?.type && typeof value.type === 'string' && value.type.trim()) {
            label = `${index} [${value.type.trim()}]`;
          }

          return label;
        },
      },
    });

    // Input 元素的 content 数组配置
    this.fieldConfigs.set('root.input.*.content', {
      path: 'root.input.*.content',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Content' },
    });

    // Input content 数组元素 - 使用 type 字段
    this.fieldConfigs.set('root.input.*.content.*', {
      path: 'root.input.*.content.*',
      metadata: {
        labelGenerator: (value: any, path: string) => {
          const parts = path.split('.');
          const index = parts.pop() ?? '?';
          let label = index;

          if (value?.type && typeof value.type === 'string' && value.type.trim()) {
            label = `${index} [${value.type.trim()}]`;
          }

          return label;
        },
      },
    });

    // Input content 元素的 text 字段
    this.fieldConfigs.set('root.input.*.content.*.text', {
      path: 'root.input.*.content.*.text',
      type: NodeType.STRING_LONG,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'Text' },
    });
  }

  /**
   * 判断是否支持该请求格式
   * Codex 请求特征：
   * - 有 instructions 字段（字符串）
   * - 可选的 model 字段
   */
  supports(request: any): request is CodexRequest {
    return (
      request &&
      typeof request === 'object' &&
      typeof request.instructions === 'string'
    );
  }

  /**
   * 提取请求元数据
   */
  extractMetadata(request: CodexRequest): RequestMetadata {
    const metadata: RequestMetadata = {
      model: request.model,
      toolCount: Array.isArray(request.tools) ? request.tools.length : 0,
      client: 'codex',
    };

    // 计算 instructions 长度
    if (request.instructions && typeof request.instructions === 'string') {
      metadata.systemPromptLength = request.instructions.length;
    }

    // 计算 input 消息数量
    if (Array.isArray(request.input)) {
      metadata.messageCount = request.input.length;
    }

    return metadata;
  }

  /**
   * 构建视图树
   */
  buildViewTree(request: CodexRequest, original?: CodexRequest): ViewNode {
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
    const basicPaths = ['model', 'max_tokens', 'temperature', 'top_p'];
    groups.push({
      id: 'basic',
      label: '基本信息',
      icon: '📋',
      nodePaths: basicPaths,
      description: '请求的基本参数',
    });

    // Instructions - Codex 核心字段
    if (viewTree.children?.some(child => child.path === 'instructions')) {
      groups.push({
        id: 'instructions',
        label: 'Instructions',
        icon: '📝',
        nodePaths: ['instructions'],
        description: 'Codex 指令文本',
      });
    }

    // Prompt
    if (viewTree.children?.some(child => child.path === 'prompt')) {
      groups.push({
        id: 'prompt',
        label: 'Prompt',
        icon: '💬',
        nodePaths: ['prompt'],
        description: '用户提示',
      });
    }

    // Input
    if (viewTree.children?.some(child => child.path === 'input')) {
      groups.push({
        id: 'input',
        label: 'Input',
        icon: '⌨️',
        nodePaths: ['input'],
        description: '输入消息列表',
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

    return groups;
  }
}
