import type { RequestMetadata, ViewNode, FieldConfig, ViewGroup } from './index';

/**
 * 请求适配器接口
 * @template T 请求类型
 */
export interface RequestAdapter<T = any> {
  /** 适配器名称 */
  readonly name: string;
  /** 适配器版本 */
  readonly version: string;

  /**
   * 判断是否支持该请求格式
   * @param request 请求对象
   * @returns 是否支持该格式
   */
  supports(request: any): request is T;

  /**
   * 提取请求元数据
   * @param request 请求对象
   * @returns 请求元数据
   */
  extractMetadata(request: T): RequestMetadata;

  /**
   * 构建视图树
   * @param request 请求对象
   * @param original 原始请求对象（用于 diff）
   * @returns 视图树根节点
   */
  buildViewTree(request: T, original?: T): ViewNode;

  /**
   * 获取字段配置
   * @param path 字段路径
   * @returns 字段配置，如果未定义则返回 undefined
   */
  getFieldConfig(path: string): FieldConfig | undefined;

  /**
   * 获取视图分组（可选）
   * @param viewTree 视图树
   * @returns 视图分组数组
   */
  getGroups?(viewTree: ViewNode): ViewGroup[];
}

/**
 * 适配器工厂接口
 */
export interface AdapterFactory {
  /** 适配器名称 */
  readonly name: string;
  /** 创建适配器实例 */
  create(): RequestAdapter;
}

/**
 * 适配器信息接口
 */
export interface AdapterInfo {
  /** 适配器名称 */
  name: string;
  /** 适配器版本 */
  version: string;
}
