/**
 * 节点类型枚举
 */
import type * as React from 'react';

export enum NodeType {
  PRIMITIVE = 'primitive', // 简单值（string, number, boolean, <200字符）
  STRING_LONG = 'string_long', // 长字符串（>200字符）
  MARKDOWN = 'markdown', // Markdown 格式文本
  JSON = 'json', // JSON 对象
  ARRAY = 'array', // 数组
  CODE = 'code', // 代码块
}

/**
 * 差异状态枚举
 */
export enum DiffStatus {
  SAME = 'same', // 无变化
  ADDED = 'added', // 新增
  REMOVED = 'removed', // 删除
  MODIFIED = 'modified', // 修改
}

/**
 * 渲染模式枚举
 */
export enum RenderMode {
  SUMMARY = 'summary', // 结构概览
  FULL = 'full', // 内容详情
  DIFF = 'diff', // 差异对比
}

/**
 * 视图节点接口
 */
export interface ViewNode {
  /** 唯一标识符，基于路径（如 "messages.0.content.0.text"） */
  id: string;
  /** 节点类型 */
  type: NodeType;
  /** 显示标签 */
  label: string;
  /** 节点路径 */
  path: string;
  /** 节点值 */
  value: any;
  /** 差异状态 */
  diffStatus: DiffStatus;
  /** 是否可折叠 */
  collapsible?: boolean;
  /** 默认折叠状态 */
  defaultCollapsed?: boolean;
  /** 子节点 */
  children?: ViewNode[];
  /** 元数据 */
  metadata?: Record<string, any>;
  /** 自定义渲染器组件 */
  customRenderer?: React.ComponentType<{ node: ViewNode }>;
}

/**
 * 字段配置接口
 */
export interface FieldConfig {
  /** 字段路径 */
  path: string;
  /** 节点类型 */
  type?: NodeType;
  /** 是否可折叠 */
  collapsible?: boolean;
  /** 默认折叠状态 */
  defaultCollapsed?: boolean;
  /** 自定义渲染器 */
  customRenderer?: React.ComponentType<{ node: ViewNode }>;
  /** 额外元数据 */
  metadata?: {
    /** 静态标签（固定文本） */
    label?: string;
    /** 动态标签生成器（根据节点值动态生成） */
    labelGenerator?: (value: any, path: string) => string;
    /** 图标 */
    icon?: string;
    /** 其他元数据 */
    [key: string]: any;
  };
}

/**
 * 请求元数据接口
 */
export interface RequestMetadata {
  /** 模型名称 */
  model?: string;
  /** 消息数量 */
  messageCount?: number;
  /** 工具数量 */
  toolCount?: number;
  /** System prompt 长度 */
  systemPromptLength?: number;
  /** 请求 ID */
  requestId?: string;
  /** 时间戳 */
  timestamp?: string;
  /** 客户端 */
  client?: string;
  /** 响应状态 */
  responseStatus?: number;
  /** 响应耗时（毫秒） */
  responseDuration?: number;
  /** 适配器特定的元数据 */
  [key: string]: any;
}

/**
 * 视图分组接口
 */
export interface ViewGroup {
  /** 分组 ID */
  id: string;
  /** 分组标签 */
  label: string;
  /** 分组图标（emoji 或字符串） */
  icon: string;
  /** 关联的节点路径列表 */
  nodePaths: string[];
  /** 分组描述 */
  description?: string;
}

/**
 * 折叠状态存储接口
 */
export interface CollapseState {
  [nodeId: string]: boolean;
}

// 重新导出适配器类型
export type { RequestAdapter, AdapterFactory, AdapterInfo } from './adapter';
