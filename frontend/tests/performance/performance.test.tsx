/**
 * 前端性能测试套件
 * 测试 React 组件渲染、虚拟滚动、状态更新等性能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { createStore } from 'zustand';
import { create } from 'zustand';
import { FixedSizeList as List } from 'react-window';

// 测试数据生成器
function generateTestData(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    title: `Test Item ${i}`,
    description: `This is a test item with some content ${i}`,
    timestamp: Date.now() + i,
    client: ['claude', 'openai', 'gemini'][i % 3],
    status: ['success', 'pending', 'error'][i % 3]
  }));
}

// 1. React 组件渲染性能测试
describe('React 组件渲染性能', () => {
  it('应该快速渲染简单组件', async () => {
    const SimpleComponent = () => <div data-testid="simple">Hello World</div>;

    const start = performance.now();
    const { getByTestId } = render(<SimpleComponent />);
    const end = performance.now();

    expect(getByTestId('simple')).toBeInTheDocument();
    expect(end - start).toBeLessThan(50); // 50ms 内完成渲染
  });

  it('应该高效渲染列表组件', async () => {
    const data = generateTestData(100);

    const ListComponent = () => (
      <div>
        {data.map(item => (
          <div key={item.id} data-testid={`item-${item.id}`}>
            {item.title}
          </div>
        ))}
      </div>
    );

    const start = performance.now();
    const { getByTestId } = render(<ListComponent />);
    const end = performance.now();

    // 验证所有项目都已渲染
    expect(getByTestId('item-item-0')).toBeInTheDocument();
    expect(getByTestId('item-item-99')).toBeInTheDocument();

    // 100个项目的渲染时间应该在合理范围内
    expect(end - start).toBeLessThan(200);
  });

  it('应该处理大量组件更新', async () => {
    let updateCount = 0;
    const HeavyComponent = ({ count }: { count: number }) => {
      updateCount++;
      return (
        <div>
          {Array.from({ length: count }, (_, i) => (
            <span key={i} data-testid={`span-${i}`}>
              Item {i}
            </span>
          ))}
        </div>
      );
    };

    const { rerender } = render(<HeavyComponent count={50} />);

    const start = performance.now();
    rerender(<HeavyComponent count={100} />);
    const end = performance.now();

    expect(end - start).toBeLessThan(100);
  });
});

// 2. 虚拟滚动性能测试
describe('虚拟滚动性能', () => {
  it('应该高效渲染大量数据的虚拟列表', async () => {
    const data = generateTestData(10000); // 10,000 个项目

    const VirtualList = () => (
      <div style={{ height: '400px', width: '100%' }}>
        <div data-testid="list-container">
          {data.slice(0, 50).map(item => ( // 只渲染可见部分
            <div key={item.id} data-testid={`virtual-${item.id}`} style={{ height: '35px' }}>
              {item.title}
            </div>
          ))}
        </div>
      </div>
    );

    const start = performance.now();
    const { getByTestId } = render(<VirtualList />);
    const end = performance.now();

    expect(getByTestId('list-container')).toBeInTheDocument();
    // 渲染50个可见项目应该非常快
    expect(end - start).toBeLessThan(100);
  });

  it('应该快速滚动大量数据', async () => {
    const data = generateTestData(5000);

    let renderCount = 0;
    const ScrollableList = () => {
      const [visibleStart, setVisibleStart] = React.useState(0);

      // 模拟滚动
      React.useEffect(() => {
        const interval = setInterval(() => {
          renderCount++;
          setVisibleStart(prev => (prev + 10) % 4950);
        }, 10);

        return () => clearInterval(interval);
      }, []);

      return (
        <div data-testid="scroll-container">
          {data.slice(visibleStart, visibleStart + 50).map(item => (
            <div key={item.id} data-testid={`scroll-${item.id}`}>
              {item.title}
            </div>
          ))}
        </div>
      );
    };

    const start = performance.now();
    render(<ScrollableList />);

    // 等待一些滚动发生
    await waitFor(() => {
      expect(renderCount).toBeGreaterThan(2);
    }, { timeout: 200 });

    const end = performance.now();

    // 在200ms内完成多次滚动渲染
    expect(end - start).toBeLessThan(300);
  });
});

// 3. Zustand 状态更新性能测试
describe('Zustand 状态更新性能', () => {
  it('应该快速更新状态', async () => {
    interface StoreState {
      count: number;
      increment: () => void;
      setCount: (n: number) => void;
    }

    // 使用 create() 创建 store
    const useStore = create<StoreState>(set => ({
      count: 0,
      increment: () => set(state => ({ count: state.count + 1 })),
      setCount: (n) => set({ count: n })
    }));

    const TestComponent = () => {
      const { count, increment } = useStore();
      return (
        <div>
          <div data-testid="count">{count}</div>
          <button onClick={increment} data-testid="increment">Increment</button>
        </div>
      );
    };

    render(<TestComponent />);

    const button = screen.getByTestId('increment');
    const start = performance.now();

    // 快速点击100次
    for (let i = 0; i < 100; i++) {
      button.click();
    }

    const end = performance.now();

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('100');
    });

    // 100次状态更新应该在500ms内完成
    expect(end - start).toBeLessThan(500);
  });

  it('应该高效处理复杂状态更新', async () => {
    interface ComplexState {
      items: Array<{ id: string; value: number; nested: { deep: boolean } }>;
      updateItem: (id: string, value: number) => void;
      addItem: () => void;
    }

    // 使用 create() 创建复杂 store
    const useComplexStore = create<ComplexState>(set => ({
      items: Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        value: i,
        nested: { deep: true }
      })),
      updateItem: (id, value) => set(state => ({
        items: state.items.map(item =>
          item.id === id ? { ...item, value } : item
        )
      })),
      addItem: () => set(state => ({
        items: [...state.items, {
          id: `item-${state.items.length}`,
          value: state.items.length,
          nested: { deep: true }
        }]
      }))
    }));

    const ComplexComponent = () => {
      const { items, updateItem, addItem } = useComplexStore();
      return (
        <div>
          <div data-testid="item-count">{items.length}</div>
          <button onClick={() => updateItem('item-50', 999)} data-testid="update">Update</button>
          <button onClick={addItem} data-testid="add">Add</button>
        </div>
      );
    };

    render(<ComplexComponent />);

    const updateButton = screen.getByTestId('update');
    const addButton = screen.getByTestId('add');

    const start = performance.now();

    // 执行多次复杂更新
    for (let i = 0; i < 50; i++) {
      updateButton.click();
      if (i % 5 === 0) addButton.click();
    }

    const end = performance.now();

    await waitFor(() => {
      expect(screen.getByTestId('item-count').textContent).toBe('110'); // 100 + 10 additions
    }, { timeout: 1000 });

    // 复杂状态更新应该在1秒内完成
    expect(end - start).toBeLessThan(1000);
  });
});

// 4. 内存泄漏检测
describe('内存和资源管理', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('应该正确清理组件', async () => {
    let mounted = false;
    let unmounted = false;

    const TestComponent = () => {
      React.useEffect(() => {
        mounted = true;
        return () => {
          unmounted = true;
        };
      }, []);

      return <div data-testid="test">Test</div>;
    };

    const { unmount } = render(<TestComponent />);

    expect(mounted).toBe(true);
    expect(unmounted).toBe(false);

    unmount();

    expect(unmounted).toBe(true);
  });

  it('应该处理大量组件创建和销毁', async () => {
    const createComponent = (id: number) => {
      return () => (
        <div data-testid={`comp-${id}`}>
          Component {id}
        </div>
      );
    };

    const start = performance.now();

    // 创建并销毁100个组件
    for (let i = 0; i < 100; i++) {
      const Component = createComponent(i);
      const { unmount } = render(<Component />);
      unmount();
    }

    const end = performance.now();

    // 100次创建销毁应该在500ms内完成
    expect(end - start).toBeLessThan(500);
  });
});

// 5. 综合性能测试
describe('综合性能测试', () => {
  it('应该在高负载下保持响应', async () => {
    const HeavyApp = () => {
      const [count, setCount] = React.useState(0);
      const [items, setItems] = React.useState(generateTestData(100));

      React.useEffect(() => {
        const interval = setInterval(() => {
          setCount(prev => prev + 1);
          setItems(prev => [...prev, ...generateTestData(10)]);
        }, 50);

        return () => clearInterval(interval);
      }, []);

      return (
        <div data-testid="heavy-app">
          <div data-testid="count">{count}</div>
          <div data-testid="item-length">{items.length}</div>
          {items.slice(0, 20).map(item => (
            <div key={item.id} data-testid={`heavy-${item.id}`}>
              {item.title}
            </div>
          ))}
        </div>
      );
    };

    render(<HeavyApp />);

    // 等待一段时间让状态频繁更新
    await new Promise(resolve => setTimeout(resolve, 300));

    const countElement = screen.getByTestId('count');
    const itemLengthElement = screen.getByTestId('item-length');

    // 应该能够处理持续的更新
    expect(parseInt(countElement.textContent || '0')).toBeGreaterThan(2);
    expect(parseInt(itemLengthElement.textContent || '0')).toBeGreaterThan(100);
  });

  it('应该测量渲染时间分布', async () => {
    const times: number[] = [];

    for (let i = 0; i < 20; i++) {
      const start = performance.now();

      const Component = () => (
        <div>
          {generateTestData(50).map(item => (
            <div key={item.id}>{item.title}</div>
          ))}
        </div>
      );

      render(<Component />);
      const end = performance.now();
      times.push(end - start);

      // 清理
      document.body.innerHTML = '';
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);

    // 记录性能指标
    console.log(`渲染时间分布: 平均 ${avg.toFixed(2)}ms, 最大 ${max.toFixed(2)}ms, 最小 ${min.toFixed(2)}ms`);

    expect(avg).toBeLessThan(100); // 平均渲染时间应该小于100ms
    expect(max).toBeLessThan(500); // 最大渲染时间应该小于500ms
  });
});