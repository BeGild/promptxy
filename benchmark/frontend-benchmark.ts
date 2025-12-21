/**
 * PromptXY v2.0 前端性能基准测试
 * 包含：渲染性能、状态管理、内存管理、虚拟滚动测试
 */

import { PerformanceTimer, ResourceMonitor, DataGenerator } from './performance-benchmark-framework.js';

// ==================== 前端测试配置 ====================

interface FrontendTestConfig {
  testIterations: number;
  warmupIterations: number;
  dataSizes: number[];
}

const defaultFrontendConfig: FrontendTestConfig = {
  testIterations: 100,
  warmupIterations: 10,
  dataSizes: [10, 100, 1000, 10000],
};

// ==================== React 组件渲染性能测试 ====================

export class ComponentRenderBenchmark {
  private timer: PerformanceTimer;
  private config: FrontendTestConfig;

  constructor(config: FrontendTestConfig = defaultFrontendConfig) {
    this.timer = new PerformanceTimer();
    this.config = config;
  }

  /**
   * 简单组件挂载性能
   */
  async testSimpleComponentMount(iterations: number = this.config.testIterations): Promise<any> {
    console.log(`🎨 测试简单组件挂载: ${iterations} 次`);

    // 模拟 React 组件挂载过程
    const durations: number[] = [];

    // 预热
    for (let i = 0; i < this.config.warmupIterations; i++) {
      this.simulateComponentMount();
    }

    // 正式测试
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      // 模拟组件生命周期
      const props = { id: i, data: `test-${i}` };
      const component = this.simulateComponentMount();
      this.simulateComponentDidMount(component, props);

      const duration = performance.now() - start;
      durations.push(duration);

      // 清理
      this.simulateComponentWillUnmount(component);

      if (i % 20 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return this.calculateRenderStats(durations, '简单组件');
  }

  /**
   * 列表渲染性能 (100项)
   */
  async testListRender(itemCount: number = 100, iterations: number = 20): Promise<any> {
    console.log(`🎨 测试列表渲染: ${itemCount} 项, ${iterations} 次`);

    const durations: number[] = [];

    // 预热
    for (let i = 0; i < 5; i++) {
      const warmupItems = DataGenerator.generateDataset(itemCount, 'items');
      this.simulateListRender(warmupItems);
    }

    // 正式测试
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      const items = DataGenerator.generateDataset(itemCount, 'items');
      const rendered = this.simulateListRender(items);

      const duration = performance.now() - start;
      durations.push(duration);

      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return this.calculateRenderStats(durations, `列表(${itemCount}项)`);
  }

  /**
   * 组件更新性能
   */
  async testComponentUpdate(iterations: number = 50): Promise<any> {
    console.log(`🎨 测试组件更新: ${iterations} 次`);

    const durations: number[] = [];

    // 创建初始组件
    const component = this.simulateComponentMount();
    this.simulateComponentDidMount(component, { id: 0, data: 'initial' });

    // 预热
    for (let i = 0; i < 5; i++) {
      this.simulateComponentUpdate(component, { id: i, data: `update-${i}` });
    }

    // 正式测试
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      this.simulateComponentUpdate(component, { id: i, data: `update-${i}` });

      const duration = performance.now() - start;
      durations.push(duration);

      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // 清理
    this.simulateComponentWillUnmount(component);

    return this.calculateRenderStats(durations, '组件更新');
  }

  /**
   * 批量更新性能 (50→100项)
   */
  async testBatchUpdate(): Promise<any> {
    console.log(`🎨 测试批量更新: 50→100 项`);

    const iterations = 10;
    const durations: number[] = [];

    // 初始状态
    let items = DataGenerator.generateDataset(50, 'items');

    // 预热
    for (let i = 0; i < 3; i++) {
      const newItems = [...items, ...DataGenerator.generateDataset(10, 'items')];
      this.simulateListRender(newItems);
    }

    // 正式测试
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      // 模拟添加 10 项
      const newItems = [...items, ...DataGenerator.generateDataset(10, 'items')];
      this.simulateListRender(newItems);
      items = newItems;

      const duration = performance.now() - start;
      durations.push(duration);

      await new Promise(resolve => setTimeout(resolve, 1));
    }

    return this.calculateRenderStats(durations, '批量更新');
  }

  /**
   * 组件挂载/卸载内存泄漏测试
   */
  async testComponentMemoryLeak(iterations: number = 100): Promise<any> {
    console.log(`🎨 测试组件内存泄漏: ${iterations} 次生命周期`);

    const monitor = new ResourceMonitor();
    monitor.reset();
    monitor.setBaseline();

    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      // 挂载
      const component = this.simulateComponentMount();
      this.simulateComponentDidMount(component, { id: i, data: `test-${i}` });

      // 短暂停留
      await new Promise(resolve => setTimeout(resolve, 1));

      // 卸载
      this.simulateComponentWillUnmount(component);

      const duration = performance.now() - start;
      durations.push(duration);

      // 每 20 次记录内存
      if (i % 20 === 0) {
        await monitor.snapshot();
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    const memoryStats = monitor.getStats();
    const memoryDelta = monitor.getMemoryDelta();
    const leakRate = monitor.getMemoryLeakRate();

    return {
      iterations,
      lifecycle: this.calculateRenderStats(durations, '生命周期'),
      memory: {
        initial: memoryStats.avgMemory - memoryDelta,
        peak: memoryStats.peakMemory,
        final: memoryStats.avgMemory,
        delta: memoryDelta,
        leakRate,
        hasLeak: leakRate > 0.1, // 每分钟超过 0.1MB 视为泄漏
      },
    };
  }

  /**
   * 长时间运行内存稳定性测试
   */
  async testLongRunStability(duration: number = 60000): Promise<any> {
    console.log(`🎨 测试长时间运行稳定性: ${duration}ms`);

    const monitor = new ResourceMonitor();
    monitor.reset();
    monitor.setBaseline();

    const startTime = Date.now();
    let operationCount = 0;

    // 持续进行组件操作
    while (Date.now() - startTime < duration) {
      // 模拟各种操作
      const component = this.simulateComponentMount();
      this.simulateComponentDidMount(component, { id: operationCount, data: `test-${operationCount}` });

      // 短暂停留
      await new Promise(resolve => setTimeout(resolve, 5));

      // 更新
      this.simulateComponentUpdate(component, { id: operationCount, data: `updated-${operationCount}` });

      // 卸载
      this.simulateComponentWillUnmount(component);

      operationCount++;

      // 每 50 次操作记录内存
      if (operationCount % 50 === 0) {
        await monitor.snapshot();
      }

      if (operationCount % 20 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    const stats = monitor.getStats();
    const delta = monitor.getMemoryDelta();
    const leakRate = monitor.getMemoryLeakRate();

    return {
      duration,
      operationCount,
      opsPerSecond: (operationCount / (duration / 1000)),
      memory: {
        initial: stats.avgMemory - delta,
        peak: stats.peakMemory,
        final: stats.avgMemory,
        delta,
        leakRate,
      },
      cpu: {
        avg: stats.avgCpu,
        peak: stats.peakCpu,
      },
      stability: leakRate < 0.5, // 稳定性标准
    };
  }

  // 模拟 React 组件生命周期
  private simulateComponentMount(): any {
    return {
      _internal: {
        hooks: [],
        props: {},
        state: {},
        effectQueue: [],
      },
      mounted: false,
    };
  }

  private simulateComponentDidMount(component: any, props: any): void {
    component._internal.props = props;
    component._internal.state = { ...props };
    component.mounted = true;

    // 模拟 useEffect
    if (component._internal.effectQueue) {
      component._internal.effectQueue.push(() => {
        // 副作用
      });
    }
  }

  private simulateComponentUpdate(component: any, newProps: any): void {
    if (!component.mounted) return;

    // 模拟 props 更新
    component._internal.props = newProps;

    // 模拟状态更新
    component._internal.state = { ...component._internal.state, ...newProps };

    // 模拟重新渲染
    this.simulateReRender(component);
  }

  private simulateComponentWillUnmount(component: any): void {
    component.mounted = false;
    component._internal.hooks = [];
    component._internal.effectQueue = [];
  }

  private simulateReRender(component: any): void {
    // 模拟虚拟 DOM 比较和更新
    const oldState = component._internal.state;
    const newState = { ...oldState };
    component._internal.state = newState;
  }

  private simulateListRender(items: any[]): any[] {
    // 模拟列表渲染
    return items.map((item, index) => ({
      key: item.id || index,
      data: item,
      rendered: true,
      timestamp: Date.now(),
    }));
  }

  private calculateRenderStats(durations: number[], label: string): any {
    if (durations.length === 0) {
      return { label, iterations: 0, latency: { min: 0, max: 0, avg: 0, p95: 0, p99: 0 } };
    }

    const sorted = durations.sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      label,
      iterations: durations.length,
      latency: { min, max, avg, p95, p99 },
    };
  }
}

// ==================== Zustand 状态管理性能测试 ====================

export class StateManagementBenchmark {
  private timer: PerformanceTimer;

  constructor() {
    this.timer = new PerformanceTimer();
  }

  /**
   * 简单状态更新性能
   */
  async testSimpleUpdate(iterations: number = 100): Promise<any> {
    console.log(`🔄 测试 Zustand 简单状态更新: ${iterations} 次`);

    // 模拟 Zustand store
    const store = this.createMockStore({ count: 0, text: '' });

    // 预热
    for (let i = 0; i < 10; i++) {
      store.setState({ count: i });
    }

    const durations: number[] = [];

    // 正式测试
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      store.setState({ count: i, text: `update-${i}` });

      const duration = performance.now() - start;
      durations.push(duration);

      if (i % 20 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return this.calculateStateStats(durations, '简单更新');
  }

  /**
   * 批量更新性能
   */
  async testBatchUpdate(): Promise<any> {
    console.log(`🔄 测试 Zustand 批量更新`);

    const store = this.createMockStore({ items: [] });

    // 预热
    for (let i = 0; i < 5; i++) {
      store.setState({ items: [{ id: i, value: `item-${i}` }] });
    }

    const iterations = 10;
    const durations: number[] = [];

    // 测试：添加 10 个项目，然后更新 5 次
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      // 批量添加
      const newItems = Array.from({ length: 10 }, (_, j) => ({
        id: i * 10 + j,
        value: `item-${i * 10 + j}`,
      }));
      store.setState({ items: [...store.getState().items, ...newItems] });

      // 批量更新
      const updatedItems = store.getState().items.map((item: any) => ({
        ...item,
        updated: true,
        timestamp: Date.now(),
      }));
      store.setState({ items: updatedItems });

      const duration = performance.now() - start;
      durations.push(duration);

      await new Promise(resolve => setTimeout(resolve, 1));
    }

    return this.calculateStateStats(durations, '批量更新');
  }

  /**
   * 订阅通知效率测试
   */
  async testSubscriptionEfficiency(subscribers: number = 10, updates: number = 50): Promise<any> {
    console.log(`🔄 测试订阅效率: ${subscribers} 订阅者, ${updates} 更新`);

    const store = this.createMockStore({ count: 0 });

    // 创建多个订阅者
    const subscriptionCounts: number[] = new Array(subscribers).fill(0);
    const unsubscribeFns: (() => void)[] = [];

    for (let i = 0; i < subscribers; i++) {
      const fn = (state: any) => {
        subscriptionCounts[i]++;
        return state.count;
      };
      const unsubscribe = store.subscribe(fn);
      unsubscribeFns.push(unsubscribe);
    }

    // 预热
    for (let i = 0; i < 5; i++) {
      store.setState({ count: i });
    }

    // 测试更新
    const start = performance.now();
    for (let i = 0; i < updates; i++) {
      store.setState({ count: i });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const duration = performance.now() - start;

    // 清理
    unsubscribeFns.forEach(unsubscribe => unsubscribe());

    const totalNotifications = subscriptionCounts.reduce((a, b) => a + b, 0);
    const avgPerSubscriber = totalNotifications / subscribers;

    return {
      subscribers,
      updates,
      totalNotifications,
      avgPerSubscriber,
      duration,
      notificationsPerSecond: (totalNotifications / (duration / 1000)),
      efficiency: avgPerSubscriber === updates, // 每个订阅者应该收到所有更新
    };
  }

  /**
   * 复杂状态更新性能
   */
  async testComplexUpdate(iterations: number = 50): Promise<any> {
    console.log(`🔄 测试复杂状态更新: ${iterations} 次`);

    const store = this.createMockStore({
      user: { id: 1, name: 'test', profile: {} },
      data: [],
      settings: { theme: 'light', notifications: true },
    });

    const durations: number[] = [];

    // 预热
    for (let i = 0; i < 5; i++) {
      store.setState({
        user: { id: i, name: `user-${i}`, profile: { age: i } },
        data: [{ id: i, value: `data-${i}` }],
        settings: { theme: i % 2 === 0 ? 'dark' : 'light', notifications: i % 2 === 0 },
      });
    }

    // 正式测试
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      store.setState({
        user: {
          id: i,
          name: `user-${i}`,
          profile: {
            age: 20 + i,
            email: `user${i}@test.com`,
            tags: Array.from({ length: 5 }, (_, j) => `tag-${j}`),
          },
        },
        data: Array.from({ length: 10 }, (_, j) => ({
          id: i * 10 + j,
          value: `complex-${i}-${j}`,
          nested: { deep: { value: i * j } },
        })),
        settings: {
          theme: i % 2 === 0 ? 'dark' : 'light',
          notifications: i % 2 === 0,
          language: i % 3 === 0 ? 'en' : i % 3 === 1 ? 'zh' : 'ja',
        },
      });

      const duration = performance.now() - start;
      durations.push(duration);

      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return this.calculateStateStats(durations, '复杂更新');
  }

  private createMockStore(initialState: any): any {
    let state = initialState;
    const listeners = new Set<(state: any) => void>();

    return {
      getState: () => state,
      setState: (newState: any) => {
        state = { ...state, ...newState };
        // 通知所有订阅者
        listeners.forEach(listener => listener(state));
      },
      subscribe: (listener: (state: any) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }

  private calculateStateStats(durations: number[], label: string): any {
    if (durations.length === 0) {
      return { label, iterations: 0, latency: { min: 0, max: 0, avg: 0 } };
    }

    const sorted = durations.sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    return {
      label,
      iterations: durations.length,
      latency: { min, max, avg },
    };
  }
}

// ==================== 虚拟滚动性能测试 ====================

export class VirtualScrollBenchmark {
  private timer: PerformanceTimer;

  constructor() {
    this.timer = new PerformanceTimer();
  }

  /**
   * 虚拟列表初始渲染性能
   */
  async testInitialRender(dataSize: number = 10000, visibleCount: number = 50): Promise<any> {
    console.log(`📜 测试虚拟滚动初始渲染: ${dataSize} 项数据, ${visibleCount} 可见`);

    const items = DataGenerator.generateDataset(dataSize, 'items');

    // 预热
    for (let i = 0; i < 3; i++) {
      this.simulateVirtualRender(items, visibleCount, 0);
    }

    const iterations = 10;
    const durations: number[] = [];

    // 正式测试
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      const rendered = this.simulateVirtualRender(items, visibleCount, 0);

      const duration = performance.now() - start;
      durations.push(duration);

      await new Promise(resolve => setTimeout(resolve, 1));
    }

    return {
      ...this.calculateRenderStats(durations, `初始渲染(${dataSize}项)`),
      dataSize,
      visibleCount,
      renderRatio: (visibleCount / dataSize) * 100,
    };
  }

  /**
   * 滚动性能测试
   */
  async testScrollPerformance(dataSize: number = 5000, scrollSteps: number = 20): Promise<any> {
    console.log(`📜 测试滚动性能: ${dataSize} 项数据, ${scrollSteps} 滚动步`);

    const items = DataGenerator.generateDataset(dataSize, 'items');
    const visibleCount = 50;

    // 预热
    for (let i = 0; i < 3; i++) {
      this.simulateVirtualRender(items, visibleCount, i * 10);
    }

    const durations: number[] = [];

    // 模拟滚动
    for (let i = 0; i < scrollSteps; i++) {
      const start = performance.now();

      const scrollOffset = i * 10; // 每次滚动 10 个位置
      const rendered = this.simulateVirtualRender(items, visibleCount, scrollOffset);

      const duration = performance.now() - start;
      durations.push(duration);

      await new Promise(resolve => setTimeout(resolve, 2));
    }

    return {
      ...this.calculateRenderStats(durations, `滚动性能(${dataSize}项)`),
      dataSize,
      scrollSteps,
      avgScrollTime: durations.reduce((a, b) => a + b, 0) / durations.length,
    };
  }

  /**
   * 大数据集内存测试
   */
  async testLargeDatasetMemory(dataSize: number = 10000): Promise<any> {
    console.log(`📜 测试大数据集内存: ${dataSize} 项`);

    const monitor = new ResourceMonitor();
    monitor.reset();
    monitor.setBaseline();

    // 创建数据
    const items = DataGenerator.generateDataset(dataSize, 'items');

    // 记录初始内存
    await monitor.snapshot();

    // 模拟渲染
    const renderCount = 10;
    for (let i = 0; i < renderCount; i++) {
      this.simulateVirtualRender(items, 50, i * 10);
      if (i % 3 === 0) {
        await monitor.snapshot();
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // 清理
    // @ts-ignore
    items = null;

    // 记录清理后内存
    await new Promise(resolve => setTimeout(resolve, 100));
    await monitor.snapshot();

    const stats = monitor.getStats();
    const delta = monitor.getMemoryDelta();

    return {
      dataSize,
      renderCount,
      memory: {
        initial: stats.avgMemory - delta,
        peak: stats.peakMemory,
        final: stats.avgMemory,
        delta,
      },
      memoryPerItem: delta / dataSize,
    };
  }

  /**
   * 动态高度虚拟滚动
   */
  async testDynamicHeight(dataSize: number = 1000): Promise<any> {
    console.log(`📜 测试动态高度虚拟滚动: ${dataSize} 项`);

    const items = DataGenerator.generateDataset(dataSize, 'items');

    // 预热
    for (let i = 0; i < 5; i++) {
      this.simulateDynamicHeightRender(items, 50, 0);
    }

    const iterations = 20;
    const durations: number[] = [];

    // 正式测试
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      const rendered = this.simulateDynamicHeightRender(items, 50, i * 5);

      const duration = performance.now() - start;
      durations.push(duration);

      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return {
      ...this.calculateRenderStats(durations, `动态高度(${dataSize}项)`),
      dataSize,
    };
  }

  private simulateVirtualRender(items: any[], visibleCount: number, startIndex: number): any[] {
    // 模拟虚拟滚动渲染
    const endIndex = Math.min(startIndex + visibleCount, items.length);
    const visibleItems = items.slice(startIndex, endIndex);

    return visibleItems.map((item, index) => ({
      key: item.id,
      index: startIndex + index,
      data: item,
      style: {
        position: 'absolute',
        top: (startIndex + index) * 35, // 假设每项高度 35px
        height: 35,
      },
    }));
  }

  private simulateDynamicHeightRender(items: any[], visibleCount: number, startIndex: number): any[] {
    // 模拟动态高度渲染
    const endIndex = Math.min(startIndex + visibleCount, items.length);
    const visibleItems = items.slice(startIndex, endIndex);

    return visibleItems.map((item, index) => {
      // 根据内容长度计算动态高度
      const contentLength = item.content?.length || 0;
      const baseHeight = 35;
      const height = baseHeight + (contentLength > 100 ? 15 : 0) + (contentLength > 200 ? 20 : 0);

      return {
        key: item.id,
        index: startIndex + index,
        data: item,
        style: {
          position: 'absolute',
          top: startIndex + index, // 动态高度需要累加
          height,
        },
      };
    });
  }

  private calculateRenderStats(durations: number[], label: string): any {
    if (durations.length === 0) {
      return { label, iterations: 0, latency: { min: 0, max: 0, avg: 0, p95: 0 } };
    }

    const sorted = durations.sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    return {
      label,
      iterations: durations.length,
      latency: { min, max, avg, p95 },
    };
  }
}

// ==================== 内存管理测试 ====================

export class MemoryManagementBenchmark {
  private monitor: ResourceMonitor;

  constructor() {
    this.monitor = new ResourceMonitor();
  }

  /**
   * 组件挂载/卸载泄漏测试
   */
  async testComponentLifecycleLeak(iterations: number = 1000): Promise<any> {
    console.log(`🧠 测试组件生命周期内存泄漏: ${iterations} 次`);

    this.monitor.reset();
    this.monitor.setBaseline();

    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      // 模拟组件挂载
      const component = this.createMockComponent();
      this.mountComponent(component);

      // 短暂停留
      await new Promise(resolve => setTimeout(resolve, 1));

      // 模拟组件更新
      this.updateComponent(component, { data: `update-${i}` });

      // 模拟组件卸载
      this.unmountComponent(component);

      const duration = performance.now() - start;
      durations.push(duration);

      // 每 100 次记录内存
      if (i % 100 === 0) {
        await this.monitor.snapshot();
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    const stats = this.monitor.getStats();
    const delta = this.monitor.getMemoryDelta();
    const leakRate = this.monitor.getMemoryLeakRate();

    return {
      iterations,
      avgLifecycleTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      memory: {
        initial: stats.avgMemory - delta,
        peak: stats.peakMemory,
        final: stats.avgMemory,
        delta,
        leakRate,
      },
      hasLeak: leakRate > 0.1,
    };
  }

  /**
   * 长时间运行内存稳定性
   */
  async testLongRunMemoryStability(duration: number = 120000): Promise<any> {
    console.log(`🧠 测试长时间内存稳定性: ${duration}ms (2分钟)`);

    this.monitor.reset();
    this.monitor.setBaseline();

    const startTime = Date.now();
    let operationCount = 0;
    const memorySnapshots: Array<{ time: number; memory: number }> = [];

    while (Date.now() - startTime < duration) {
      // 模拟各种操作
      const component = this.createMockComponent();
      this.mountComponent(component);

      // 随机操作
      if (operationCount % 3 === 0) {
        this.updateComponent(component, { data: `op-${operationCount}` });
      }

      // 添加一些数据
      if (operationCount % 5 === 0) {
        this.addData(component, operationCount);
      }

      this.unmountComponent(component);

      operationCount++;

      // 每 10 秒记录一次内存
      if (operationCount % 50 === 0) {
        await this.monitor.snapshot();
        const snapshot = await this.monitor.snapshot();
        memorySnapshots.push({
          time: Date.now() - startTime,
          memory: snapshot.memory,
        });
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      if (operationCount % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    const stats = this.monitor.getStats();
    const delta = this.monitor.getMemoryDelta();
    const leakRate = this.monitor.getMemoryLeakRate();

    // 分析内存趋势
    const trend = this.analyzeMemoryTrend(memorySnapshots);

    return {
      duration,
      operationCount,
      opsPerSecond: operationCount / (duration / 1000),
      memory: {
        initial: stats.avgMemory - delta,
        peak: stats.peakMemory,
        final: stats.avgMemory,
        delta,
        leakRate,
        trend,
      },
      stability: leakRate < 0.5, // 每分钟小于 0.5MB 增长
    };
  }

  /**
   * 大数据集内存占用
   */
  async testLargeDatasetMemory(): Promise<any> {
    console.log(`🧠 测试大数据集内存占用`);

    this.monitor.reset();
    this.monitor.setBaseline();

    const dataSizes = [100, 1000, 5000, 10000];
    const results: any[] = [];

    for (const size of dataSizes) {
      // 记录初始内存
      const before = await this.monitor.snapshot();

      // 创建大数据集
      const dataset = DataGenerator.generateDataset(size, 'items');

      // 模拟渲染
      const rendered = dataset.map(item => ({
        ...item,
        rendered: true,
        timestamp: Date.now(),
      }));

      // 记录内存
      const after = await this.monitor.snapshot();

      // 清理
      // @ts-ignore
      dataset.length = 0;
      // @ts-ignore
      rendered.length = 0;

      await new Promise(resolve => setTimeout(resolve, 10));

      results.push({
        size,
        memoryIncrease: after.memory - before.memory,
        memoryPerItem: (after.memory - before.memory) / size,
      });
    }

    return results;
  }

  /**
   * 内存泄漏压力测试
   */
  async testMemoryLeakPressure(): Promise<any> {
    console.log(`🧠 内存泄漏压力测试`);

    this.monitor.reset();
    this.monitor.setBaseline();

    const iterations = 5000;
    const leaks: any[] = [];

    for (let i = 0; i < iterations; i++) {
      // 创建组件但不清理（模拟泄漏）
      const component = this.createMockComponent();
      this.mountComponent(component);
      this.addData(component, i);

      // 每 500 次检查内存
      if (i % 500 === 0) {
        const snapshot = await this.monitor.snapshot();
        leaks.push({
          iteration: i,
          memory: snapshot.memory,
          delta: this.monitor.getMemoryDelta(),
        });
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    // 最后清理所有
    // @ts-ignore
    leaks.length = 0;

    const stats = this.monitor.getStats();
    const delta = this.monitor.getMemoryDelta();
    const leakRate = this.monitor.getMemoryLeakRate();

    return {
      iterations,
      memory: {
        peak: stats.peakMemory,
        final: stats.avgMemory,
        delta,
        leakRate,
      },
      leakTimeline: leaks,
      hasLeak: leakRate > 1.0, // 压力测试标准更宽松
    };
  }

  private createMockComponent(): any {
    return {
      _internal: {
        props: {},
        state: {},
        hooks: [],
        context: {},
        refs: {},
      },
      lifecycle: {
        mounted: false,
        unmounted: false,
      },
      data: [],
    };
  }

  private mountComponent(component: any): void {
    component.lifecycle.mounted = true;
    component._internal.hooks = [];
    component._internal.state = { ...component._internal.props };
  }

  private updateComponent(component: any, newProps: any): void {
    if (!component.lifecycle.mounted) return;
    component._internal.props = newProps;
    component._internal.state = { ...component._internal.state, ...newProps };
  }

  private addData(component: any, value: any): void {
    component.data.push({
      id: value,
      value: `data-${value}`,
      timestamp: Date.now(),
      nested: {
        deep: {
          value: value * 2,
          metadata: Array.from({ length: 10 }, (_, i) => `meta-${i}`),
        },
      },
    });
  }

  private unmountComponent(component: any): void {
    component.lifecycle.unmounted = true;
    component.lifecycle.mounted = false;
    component._internal.hooks = null;
    component._internal.state = null;
    component.data = null;
  }

  private analyzeMemoryTrend(snapshots: Array<{ time: number; memory: number }>): string {
    if (snapshots.length < 3) return 'insufficient_data';

    const first = snapshots[0].memory;
    const last = snapshots[snapshots.length - 1].memory;
    const delta = last - first;

    if (delta < 5) return 'stable';
    if (delta < 20) return 'gradual_increase';
    return 'rapid_growth';
  }
}

// ==================== 前端基准测试主类 ====================

export class FrontendBenchmarkSuite {
  private render: ComponentRenderBenchmark;
  private state: StateManagementBenchmark;
  private virtualScroll: VirtualScrollBenchmark;
  private memory: MemoryManagementBenchmark;

  constructor(config: FrontendTestConfig = defaultFrontendConfig) {
    this.render = new ComponentRenderBenchmark(config);
    this.state = new StateManagementBenchmark();
    this.virtualScroll = new VirtualScrollBenchmark();
    this.memory = new MemoryManagementBenchmark();
  }

  /**
   * 运行完整前端基准测试
   */
  async runCompleteSuite(): Promise<any> {
    console.log('🎨 开始完整前端基准测试\n');

    const results: any = {};

    // 1. React 组件渲染性能
    console.log('=== 1. React 组件渲染性能 ===');
    results.rendering = {
      simple: await this.render.testSimpleComponentMount(),
      list100: await this.render.testListRender(100),
      list1000: await this.render.testListRender(1000),
      update: await this.render.testComponentUpdate(),
      batch: await this.render.testBatchUpdate(),
    };

    // 2. 内存管理测试
    console.log('\n=== 2. 内存管理测试 ===');
    results.memory = {
      lifecycle: await this.render.testComponentMemoryLeak(100),
      longRun: await this.render.testLongRunStability(60000),
      dedicated: await this.memory.testComponentLifecycleLeak(1000),
      stability: await this.memory.testLongRunMemoryStability(120000),
      largeDataset: await this.memory.testLargeDatasetMemory(),
    };

    // 3. Zustand 状态管理
    console.log('\n=== 3. Zustand 状态管理 ===');
    results.state = {
      simple: await this.state.testSimpleUpdate(),
      batch: await this.state.testBatchUpdate(),
      subscription: await this.state.testSubscriptionEfficiency(10, 50),
      complex: await this.state.testComplexUpdate(),
    };

    // 4. 虚拟滚动性能
    console.log('\n=== 4. 虚拟滚动性能 ===');
    results.virtualScroll = {
      initial1000: await this.virtualScroll.testInitialRender(1000, 50),
      initial10000: await this.virtualScroll.testInitialRender(10000, 50),
      scroll5000: await this.virtualScroll.testScrollPerformance(5000, 20),
      memory10000: await this.virtualScroll.testLargeDatasetMemory(10000),
      dynamic: await this.virtualScroll.testDynamicHeight(1000),
    };

    // 5. 内存泄漏压力测试
    console.log('\n=== 5. 内存泄漏压力测试 ===');
    results.leakPressure = await this.memory.testMemoryLeakPressure();

    console.log('\n✅ 所有前端基准测试完成\n');
    return results;
  }

  /**
   * 生成简化的测试报告
   */
  generateSummary(results: any): string {
    let report = '# 前端性能基准测试总结\n\n';

    // 渲染性能
    report += '## 渲染性能\n';
    if (results.rendering) {
      const r = results.rendering;
      if (r.simple) {
        report += `- 简单组件: ${r.simple.latency.avg.toFixed(2)}ms (avg), ${r.simple.latency.max.toFixed(2)}ms (max)\n`;
      }
      if (r.list100) {
        report += `- 列表(100项): ${r.list100.latency.avg.toFixed(2)}ms (avg)\n`;
      }
      if (r.update) {
        report += `- 组件更新: ${r.update.latency.avg.toFixed(2)}ms (avg)\n`;
      }
      if (r.batch) {
        report += `- 批量更新: ${r.batch.latency.avg.toFixed(2)}ms (avg)\n`;
      }
    }

    // 内存管理
    report += '\n## 内存管理\n';
    if (results.memory) {
      if (results.memory.lifecycle) {
        const m = results.memory.lifecycle.memory;
        report += `- 生命周期: 峰值 ${m.peak.toFixed(2)}MB, 增长 ${m.delta.toFixed(2)}MB, 泄漏率 ${m.leakRate.toFixed(3)} MB/min\n`;
      }
      if (results.memory.longRun) {
        const m = results.memory.longRun.memory;
        report += `- 长时间运行: ${results.memory.longRun.operationCount} 操作, ${m.leakRate.toFixed(3)} MB/min\n`;
      }
      if (results.memory.largeDataset) {
        results.memory.largeDataset.forEach((d: any) => {
          report += `- ${d.size}项数据: ${d.memoryPerItem.toFixed(4)} MB/项\n`;
        });
      }
    }

    // 状态管理
    report += '\n## 状态管理\n';
    if (results.state) {
      if (results.state.simple) {
        report += `- 简单更新: ${results.state.simple.latency.avg.toFixed(3)}ms (avg)\n`;
      }
      if (results.state.batch) {
        report += `- 批量更新: ${results.state.batch.latency.avg.toFixed(2)}ms (avg)\n`;
      }
      if (results.state.subscription) {
        const s = results.state.subscription;
        report += `- 订阅效率: ${s.notificationsPerSecond.toFixed(0)} 通知/秒, ${s.avgPerSubscriber.toFixed(1)}/订阅者\n`;
      }
    }

    // 虚拟滚动
    report += '\n## 虚拟滚动\n';
    if (results.virtualScroll) {
      if (results.virtualScroll.initial10000) {
        const v = results.virtualScroll.initial10000;
        report += `- 10k数据初始: ${v.latency.avg.toFixed(2)}ms (avg), 渲染比 ${v.renderRatio.toFixed(1)}%\n`;
      }
      if (results.virtualScroll.scroll5000) {
        const s = results.virtualScroll.scroll5000;
        report += `- 5k数据滚动: ${s.avgScrollTime.toFixed(2)}ms/次\n`;
      }
      if (results.virtualScroll.memory10000) {
        const m = results.virtualScroll.memory10000;
        report += `- 10k数据内存: ${m.memory.delta.toFixed(2)}MB\n`;
      }
    }

    // 压力测试
    report += '\n## 压力测试\n';
    if (results.leakPressure) {
      const p = results.leakPressure;
      report += `- 泄漏压力: ${p.iterations} 次, 泄漏率 ${p.memory.leakRate.toFixed(3)} MB/min\n`;
      report += `- 稳定性: ${p.hasLeak ? '❌ 不稳定' : '✅ 稳定'}\n`;
    }

    return report;
  }
}

// ==================== 主程序入口 ====================


// ==================== 主程序入口 ====================

async function main() {
	console.log('PromptXY v2.0 前端性能基准测试\\n');

	const suite = new FrontendBenchmarkSuite();
	const results = await suite.runCompleteSuite();
	const summary = suite.generateSummary(results);

	console.log('\\n' + summary);

	// 保存结果到文件
	const fs = await import('fs/promises');
	const path = await import('path');

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const resultFile = path.join(process.cwd(), 'benchmark', `frontend-results-${timestamp}.json`);
	const summaryFile = path.join(process.cwd(), 'benchmark', `frontend-summary-${timestamp}.md`);

	await fs.mkdir(path.dirname(resultFile), { recursive: true });
	await fs.writeFile(resultFile, JSON.stringify(results, null, 2));
	await fs.writeFile(summaryFile, summary);

	console.log(`\\n📁 结果已保存:`);
	console.log(`  - 详细数据: ${resultFile}`);
	console.log(`  - 总结报告: ${summaryFile}`);
}

main().catch(console.error);
