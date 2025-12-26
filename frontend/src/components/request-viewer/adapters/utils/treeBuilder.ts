import type { ViewNode, FieldConfig, DiffStatus } from '../../types';
import { NodeType } from '../../types';

/**
 * 树构建选项
 */
export interface TreeBuilderOptions {
  /** 字段配置映射 */
  fieldConfigs?: Map<string, FieldConfig>;
  /** 原始请求对象（用于计算 diff） */
  original?: any;
  /** 当前路径（内部使用） */
  currentPath?: string;
  /** 当前深度（内部使用） */
  depth?: number;
}

/**
 * 从路径构建视图树
 * @param obj 对象
 * @param options 构建选项
 * @returns 视图树根节点
 */
export function buildTreeFromPath(
  obj: any,
  options: TreeBuilderOptions = {}
): ViewNode {
  const {
    fieldConfigs = new Map(),
    original,
    currentPath = 'root',
    depth = 0,
  } = options;

  const nodeType = inferNodeType(obj, currentPath, fieldConfigs);
  const diffStatus = calculateDiffStatus(obj, original, currentPath);

  // 获取字段配置（支持通配符匹配）
  const fieldConfig = getFieldConfigWithWildcard(currentPath, fieldConfigs);
  const summary = generateSummary(obj, nodeType);

  // 生成标签
  const generateLabel = (value: any, path: string): string => {
    // 优先使用 labelGenerator 动态生成
    if (fieldConfig?.metadata?.labelGenerator) {
      try {
        const generatedLabel = fieldConfig.metadata.labelGenerator(value, path);
        if (generatedLabel) {
          return generatedLabel;
        }
      } catch (error) {
        console.warn(`[treeBuilder] labelGenerator 执行失败 (${path}):`, error);
      }
    }

    // 其次使用静态标签
    if (fieldConfig?.metadata?.label) {
      return fieldConfig.metadata.label;
    }

    // 最后降级到路径最后一部分或完整路径
    return path.split('.').pop() ?? path;
  };

  const node: ViewNode = {
    id: currentPath,
    type: fieldConfig?.type ?? nodeType,
    label: generateLabel(obj, currentPath),
    path: currentPath,
    value: obj,
    diffStatus,
    collapsible: fieldConfig?.collapsible ?? shouldCollapse(obj, depth, nodeType),
    defaultCollapsed: fieldConfig?.defaultCollapsed ?? getDefaultCollapsed(obj, depth, nodeType),
    metadata: {
      summary,
      depth,
      ...fieldConfig?.metadata,
    },
    customRenderer: fieldConfig?.customRenderer,
  };

  // 构建子节点
  if (Array.isArray(obj)) {
    node.children = obj.map((item, index) =>
      buildTreeFromPath(item, {
        ...options,
        currentPath: `${currentPath}.${index}`,
        depth: depth + 1,
        original: original?.[index],
      })
    );
  } else if (obj && typeof obj === 'object') {
    node.children = Object.keys(obj).map(key =>
      buildTreeFromPath(obj[key], {
        ...options,
        currentPath: `${currentPath}.${key}`,
        depth: depth + 1,
        original: original?.[key],
      })
    );
  }

  return node;
}

/**
 * 推断节点类型
 * @param value 值
 * @param path 路径
 * @param fieldConfigs 字段配置
 * @returns 节点类型
 */
export function inferNodeType(
  value: any,
  path: string,
  fieldConfigs: Map<string, FieldConfig>
): NodeType {
  // 检查是否有显式配置
  const config = fieldConfigs.get(path);
  if (config?.type) {
    return config.type;
  }

  // 根据值类型推断
  if (value === null || value === undefined) {
    return NodeType.PRIMITIVE;
  }

  if (Array.isArray(value)) {
    return NodeType.ARRAY;
  }

  if (typeof value === 'object') {
    return NodeType.JSON;
  }

  if (typeof value === 'string') {
    // 检查是否为 Markdown 路径
    if (path.includes('system') || path.includes('prompt') || path.includes('text')) {
      return NodeType.MARKDOWN;
    }
    // 长字符串
    if (value.length > 200) {
      return NodeType.STRING_LONG;
    }
    return NodeType.PRIMITIVE;
  }

  return NodeType.PRIMITIVE;
}

/**
 * 计算差异状态
 * @param current 当前值
 * @param original 原始值
 * @param path 路径
 * @returns 差异状态
 */
export function calculateDiffStatus(
  current: any,
  original: any,
  path: string
): DiffStatus {
  if (original === undefined) {
    return 'same' as DiffStatus;
  }

  if (current === undefined) {
    return 'removed' as DiffStatus;
  }

  if (original === undefined && current !== undefined) {
    return 'added' as DiffStatus;
  }

  // 深度比较
  const currentStr = JSON.stringify(current);
  const originalStr = JSON.stringify(original);

  if (currentStr === originalStr) {
    return 'same' as DiffStatus;
  }

  return 'modified' as DiffStatus;
}

/**
 * 判断是否应该可折叠
 * @param value 值
 * @param depth 深度
 * @param type 节点类型
 * @returns 是否可折叠
 */
export function shouldCollapse(value: any, depth: number, type: NodeType): boolean {
  // 深度 > 4 的节点自动可折叠
  if (depth > 4) {
    return true;
  }

  // 长字符串可折叠
  if (type === NodeType.STRING_LONG || type === NodeType.MARKDOWN) {
    return true;
  }

  // 大数组可折叠
  if (Array.isArray(value) && value.length > 10) {
    return true;
  }

  // 对象类型可折叠
  if (type === NodeType.JSON) {
    return true;
  }

  return false;
}

/**
 * 获取默认折叠状态
 * @param value 值
 * @param depth 深度
 * @param type 节点类型
 * @returns 默认折叠状态
 */
export function getDefaultCollapsed(value: any, depth: number, type: NodeType): boolean {
  // 深度 > 4 默认折叠
  if (depth > 4) {
    return true;
  }

  // 数组 > 10 项默认折叠
  if (Array.isArray(value) && value.length > 10) {
    return true;
  }

  // 长字符串默认展开（用于阅读）
  if (type === NodeType.STRING_LONG || type === NodeType.MARKDOWN) {
    return false;
  }

  return false;
}

/**
 * 生成节点摘要
 * @param value 值
 * @param type 节点类型
 * @returns 摘要文本
 */
export function generateSummary(value: any, type: NodeType): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `${value.length} 项`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    return `${keys.length} 个字段`;
  }

  if (typeof value === 'string') {
    if (value.length > 100) {
      return `${value.length} 字符: "${value.slice(0, 50)}..."`;
    }
    return `"${value}"`;
  }

  return String(value);
}

/**
 * 获取字段配置（支持通配符匹配）
 * @param path 当前节点路径
 * @param fieldConfigs 字段配置映射
 * @returns 字段配置或 undefined
 */
function getFieldConfigWithWildcard(
  path: string,
  fieldConfigs: Map<string, FieldConfig>
): FieldConfig | undefined {
  // 精确匹配
  if (fieldConfigs.has(path)) {
    return fieldConfigs.get(path);
  }

  // 通配符匹配（如 "tools.*", "messages.*"）
  for (const [key, config] of fieldConfigs.entries()) {
    if (matchesWildcard(key, path)) {
      return config;
    }
  }

  return undefined;
}

/**
 * 通配符匹配
 * @param pattern 配置模式（如 "tools.*"）
 * @param path 实际路径（如 "tools.0"）
 * @returns 是否匹配
 */
function matchesWildcard(pattern: string, path: string): boolean {
  const patternParts = pattern.split('.');
  const pathParts = path.split('.');

  if (patternParts.length !== pathParts.length) {
    return false;
  }

  return patternParts.every((part, index) => {
    return part === '*' || part === pathParts[index];
  });
}
