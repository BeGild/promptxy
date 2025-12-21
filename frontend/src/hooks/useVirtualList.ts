import React, { useCallback, useRef, useState } from 'react';

/**
 * 虚拟列表 Hook 的配置选项
 */
export interface VirtualListOptions {
  /** 是否启用滚动状态检测 */
  enableScrollingState?: boolean;
  /** 滚动防抖延迟（毫秒） */
  scrollDebounceMs?: number;
  /** 是否启用动态高度 */
  enableDynamicHeight?: boolean;
}

/**
 * 虚拟列表 Hook 的返回值
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface VirtualListReturn<TItem> {
  /** 列表容器引用 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listRef: React.MutableRefObject<any>;
  /** 是否正在滚动 */
  isScrolling: boolean;
  /** 滚动事件处理器 */
  handleScroll: (props: { scrollOffset: number; scrollUpdateWasRequested: boolean }) => void;
  /** 滚动到顶部 */
  scrollToTop: () => void;
  /** 滚动到指定索引 */
  scrollToIndex: (index: number) => void;
  /** 动态高度缓存 */
  itemHeightCache: Map<number, number>;
  /** 设置动态高度 */
  setItemHeight: (index: number, height: number) => void;
  /** 获取动态高度 */
  getItemHeight: (index: number) => number;
}

/**
 * 虚拟列表 Hook - 提供统一的虚拟滚动逻辑
 * 封装 react-window 的常用功能
 */
export function useVirtualList<TItem>(
  items: TItem[],
  itemHeight: number,
  options: VirtualListOptions = {},
): VirtualListReturn<TItem> {
  const {
    enableScrollingState = true,
    scrollDebounceMs = 150,
    enableDynamicHeight = false,
  } = options;

  // 列表引用
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRef = useRef<any>(null);

  // 滚动状态
  const [isScrolling, setIsScrolling] = useState(false);

  // 动态高度缓存
  const [itemHeightCache, setItemHeightCache] = useState<Map<number, number>>(new Map());

  // 滚动防抖定时器
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 处理滚动事件
   */
  const handleScroll = useCallback(
    (props: { scrollOffset: number; scrollUpdateWasRequested: boolean }) => {
      if (!enableScrollingState) return;

      const { scrollUpdateWasRequested } = props;

      // 只处理用户滚动，不处理程序触发的滚动
      if (!scrollUpdateWasRequested) {
        setIsScrolling(true);

        // 清除之前的定时器
        if (scrollTimerRef.current) {
          clearTimeout(scrollTimerRef.current);
        }

        // 设置新的防抖定时器
        scrollTimerRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, scrollDebounceMs);
      }
    },
    [enableScrollingState, scrollDebounceMs],
  );

  /**
   * 滚动到顶部
   */
  const scrollToTop = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollTo(0);
    }
    setIsScrolling(false);
  }, []);

  /**
   * 滚动到指定索引
   */
  const scrollToIndex = useCallback((index: number) => {
    if (listRef.current) {
      listRef.current.scrollToRow({ index, align: 'start' });
    }
  }, []);

  /**
   * 设置动态高度
   */
  const setItemHeight = useCallback(
    (index: number, height: number) => {
      if (!enableDynamicHeight) return;

      setItemHeightCache(prev => {
        const newCache = new Map(prev);
        newCache.set(index, height);
        return newCache;
      });
    },
    [enableDynamicHeight],
  );

  /**
   * 获取动态高度
   */
  const getItemHeight = useCallback(
    (index: number) => {
      if (!enableDynamicHeight) {
        return itemHeight;
      }
      return itemHeightCache.get(index) || itemHeight;
    },
    [enableDynamicHeight, itemHeight, itemHeightCache],
  );

  /**
   * 清理定时器
   */
  const cleanup = () => {
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }
  };

  // 组件卸载时清理

  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;

  return {
    listRef,
    isScrolling,
    handleScroll,
    scrollToTop,
    scrollToIndex,
    itemHeightCache,
    setItemHeight,
    getItemHeight,
  };
}

/**
 * 优化的列表项高度计算 Hook
 * 用于动态高度场景下的性能优化
 */
export function useItemHeightEstimator(baseHeight: number, variance: number = 0.2) {
  const estimateHeight = useCallback(
    (contentLength: number, hasExtra: boolean = false): number => {
      // 基础高度
      let height = baseHeight;

      // 根据内容长度调整
      if (contentLength > 100) {
        height += baseHeight * 0.3;
      }
      if (contentLength > 200) {
        height += baseHeight * 0.5;
      }

      // 如果有额外内容（如多行标签），增加高度
      if (hasExtra) {
        height += baseHeight * 0.4;
      }

      // 添加随机变化，避免视觉上的重复感
      const randomVariance = (Math.random() - 0.5) * variance * baseHeight;

      return Math.max(baseHeight * 0.8, height + randomVariance);
    },
    [baseHeight, variance],
  );

  return { estimateHeight };
}

/**
 * 虚拟列表性能监控 Hook
 */
export function useVirtualListPerf() {
  const [metrics, setMetrics] = useState({
    renderCount: 0,
    lastRenderTime: 0,
    avgRenderTime: 0,
  });

  const recordRender = useCallback((renderTime: number) => {
    setMetrics(prev => {
      const newRenderCount = prev.renderCount + 1;
      const newTotalTime = prev.avgRenderTime * prev.renderCount + renderTime;
      const newAvgRenderTime = newTotalTime / newRenderCount;

      return {
        renderCount: newRenderCount,
        lastRenderTime: renderTime,
        avgRenderTime: newAvgRenderTime,
      };
    });
  }, []);

  const resetMetrics = useCallback(() => {
    setMetrics({
      renderCount: 0,
      lastRenderTime: 0,
      avgRenderTime: 0,
    });
  }, []);

  return {
    metrics,
    recordRender,
    resetMetrics,
  };
}
