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
 * Claude Messages API 请求类型
 */
export interface ClaudeMessagesRequest {
  model: string;
  messages: Array<{
    role: string;
    content: Array<{ type: string; text?: string; [key: string]: any }>;
  }>;
  system?: Array<{ type: string; text?: string; [key: string]: any }>;
  tools?: Array<any>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  [key: string]: any;
}

/**
 * Claude Messages API 适配器
 */
export class ClaudeMessagesAdapter implements RequestAdapter<ClaudeMessagesRequest> {
  readonly name = 'claude-messages';
  readonly version = '1.0.0';

  private fieldConfigs = new Map<string, FieldConfig>();

  constructor() {
    this.initializeFieldConfigs();
  }

  /**
   * 初始化字段配置
   */
  private initializeFieldConfigs(): void {
    // System prompt 配置
    this.fieldConfigs.set('system', {
      path: 'system',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: false, // 默认展开，因为是关注重点
      metadata: { label: 'System Prompt', icon: '📝' },
    });

    // System 数组中的文本配置
    this.fieldConfigs.set('system.*.text', {
      path: 'system.*.text',
      type: NodeType.MARKDOWN,
      collapsible: true,
      defaultCollapsed: false, // 默认展开，便于阅读
    });

    // Messages 配置
    this.fieldConfigs.set('messages', {
      path: 'messages',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: false, // 默认展开前几条
      metadata: { label: 'Messages', icon: '💬' },
    });

    // Messages 中的文本内容配置
    this.fieldConfigs.set('messages.*.content.*.text', {
      path: 'messages.*.content.*.text',
      type: NodeType.STRING_LONG,
      collapsible: true,
      defaultCollapsed: true, // 用户消息默认折叠
    });

    // Tools 配置
    this.fieldConfigs.set('tools', {
      path: 'tools',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: true, // 默认折叠
      metadata: { label: 'Tools', icon: '🔧' },
    });

    // ===== 数组元素标签优化配置 =====
    // 注意：树路径以 "root" 开头，所以配置需要包含 root 前缀

    // 1. Tools 数组元素 - 使用 name 属性 + 索引
    this.fieldConfigs.set('root.tools.*', {
      path: 'root.tools.*',
      metadata: {
        labelGenerator: (value: any, path: string) => {
          const parts = path.split('.');
          const index = parts.pop() ?? '?';
          let label = index;
          if (value?.name && typeof value.name === 'string' && value.name.trim()) {
            label = `${index} [${value.name.trim()}]`;
          }
          return label;
        },
      },
    });

    // 2. Messages 数组元素 - 使用 role 属性 + 索引
    this.fieldConfigs.set('root.messages.*', {
      path: 'root.messages.*',
      metadata: {
        labelGenerator: (value: any, path: string) => {
          const parts = path.split('.');
          const index = parts.pop() ?? '?';
          let label = index;
          if (value?.role && typeof value.role === 'string' && value.role.trim()) {
            label = `${index} [${value.role.trim()}]`;
          }
          return label;
        },
      },
    });

    // 3. Messages.Content 数组元素 - 使用 type 属性 + 索引
    this.fieldConfigs.set('root.messages.*.content.*', {
      path: 'root.messages.*.content.*',
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

    // 4. System 数组元素 - 使用 type 属性 + 索引
    this.fieldConfigs.set('root.system.*', {
      path: 'root.system.*',
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

    // Tool input_schema 配置
    this.fieldConfigs.set('root.tools.*.input_schema', {
      path: 'root.tools.*.input_schema',
      type: NodeType.JSON,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Input Schema' },
    });

    // 同样需要更新其他顶层配置
    this.fieldConfigs.set('root.system', {
      path: 'root.system',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'System Prompt', icon: '📝' },
    });

    this.fieldConfigs.set('root.system.*.text', {
      path: 'root.system.*.text',
      type: NodeType.MARKDOWN,
      collapsible: true,
      defaultCollapsed: false,
    });

    this.fieldConfigs.set('root.messages', {
      path: 'root.messages',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: false,
      metadata: { label: 'Messages', icon: '💬' },
    });

    this.fieldConfigs.set('root.messages.*.content.*.text', {
      path: 'root.messages.*.content.*.text',
      type: NodeType.STRING_LONG,
      collapsible: true,
      defaultCollapsed: true,
    });

    this.fieldConfigs.set('root.tools', {
      path: 'root.tools',
      type: NodeType.ARRAY,
      collapsible: true,
      defaultCollapsed: true,
      metadata: { label: 'Tools', icon: '🔧' },
    });
  }

  /**
   * 判断是否支持该请求格式
   */
  supports(request: any): request is ClaudeMessagesRequest {
    return (
      request &&
      typeof request === 'object' &&
      typeof request.model === 'string' &&
      Array.isArray(request.messages)
    );
  }

  /**
   * 提取请求元数据
   */
  extractMetadata(request: ClaudeMessagesRequest): RequestMetadata {
    const metadata: RequestMetadata = {
      model: request.model,
      messageCount: request.messages?.length ?? 0,
      toolCount: request.tools?.length ?? 0,
      client: 'claude',
    };

    // 计算 system prompt 长度
    if (request.system && Array.isArray(request.system)) {
      metadata.systemPromptLength = request.system.reduce(
        (sum, item) => sum + (item.text?.length ?? 0),
        0,
      );
    }

    return metadata;
  }

  /**
   * 构建视图树
   */
  buildViewTree(request: ClaudeMessagesRequest, original?: ClaudeMessagesRequest): ViewNode {
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

    // 通配符匹配（如 "messages.*.content.*.text"）
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
    groups.push({
      id: 'basic',
      label: '基本信息',
      icon: '📋',
      nodePaths: ['model', 'max_tokens', 'temperature', 'top_p'],
      description: '请求的基本参数',
    });

    // System Prompt
    if (viewTree.children?.some(child => child.path === 'system')) {
      groups.push({
        id: 'system',
        label: 'System Prompt',
        icon: '📝',
        nodePaths: ['system'],
        description: '系统提示词，定义 AI 的行为和角色',
      });
    }

    // Messages
    if (viewTree.children?.some(child => child.path === 'messages')) {
      groups.push({
        id: 'messages',
        label: 'Messages',
        icon: '💬',
        nodePaths: ['messages'],
        description: '用户和助手之间的对话历史',
      });
    }

    // Tools
    if (viewTree.children?.some(child => child.path === 'tools')) {
      groups.push({
        id: 'tools',
        label: 'Tools',
        icon: '🔧',
        nodePaths: ['tools'],
        description: '可用的工具和函数',
      });
    }

    return groups;
  }
}
