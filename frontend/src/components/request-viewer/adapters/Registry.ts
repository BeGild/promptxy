import type { RequestAdapter, AdapterInfo } from '../types/adapter';

/**
 * 适配器注册表
 * 单例模式，用于管理和发现请求适配器
 */
class AdapterRegistryClass {
  private adapters: RequestAdapter[] = [];

  /**
   * 注册适配器
   * @param adapter 适配器实例
   */
  register(adapter: RequestAdapter): void {
    // 检查是否已存在同名适配器
    const existingIndex = this.adapters.findIndex(a => a.name === adapter.name);
    if (existingIndex >= 0) {
      // 替换现有适配器
      this.adapters[existingIndex] = adapter;
    } else {
      // 添加新适配器
      this.adapters.push(adapter);
    }
  }

  /**
   * 查找支持该请求的适配器
   * @param request 请求对象
   * @returns 找到的适配器，如果未找到则返回 undefined
   */
  findAdapter(request: any): RequestAdapter | undefined {
    return this.adapters.find(adapter => adapter.supports(request));
  }

  /**
   * 列出所有已注册的适配器
   * @returns 适配器信息数组
   */
  listAdapters(): AdapterInfo[] {
    return this.adapters.map(adapter => ({
      name: adapter.name,
      version: adapter.version,
    }));
  }

  /**
   * 清除所有适配器（主要用于测试）
   */
  clear(): void {
    this.adapters = [];
  }

  /**
   * 获取适配器数量
   */
  get size(): number {
    return this.adapters.length;
  }
}

// 导出单例实例
export const AdapterRegistry = new AdapterRegistryClass();
