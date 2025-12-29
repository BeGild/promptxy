import { useEffect, useRef, useState, useCallback } from 'react';
import { SSEClient } from '@/api/sse';
import { useAppStore } from '@/store';
import { SSERequestEvent, SSEConnectionStatus } from '@/types';

function joinBaseUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

/**
 * SSE 连接 Hook - 优化版本
 *
 * 优化点：
 * 1. Zustand store 方法引用是稳定的，不需要担心依赖变化导致重连
 * 2. 移除不必要的 useMemo，直接返回对象
 * 3. 使用 useCallback 优化事件处理器和控制函数
 */
export function useSSE() {
  const sseClientRef = useRef<SSEClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // 直接订阅 store 方法，Zustand 保证引用稳定
  const setSSEStatus = useAppStore(state => state.setSSEStatus);
  const addNewRequest = useAppStore(state => state.addNewRequest);

  // 事件处理器 - 使用 useCallback 避免每次渲染创建新函数
  const handleEvent = useCallback(
    (event: SSERequestEvent) => {
      addNewRequest({
        id: event.id,
        timestamp: event.timestamp,
        client: event.client,
        path: event.path,
        method: event.method,
        matchedRules: event.matchedRules || [],
      });
    },
    [addNewRequest], // Zustand 方法引用稳定，依赖是安全的
  );

  // 状态变化处理器 - 使用 useCallback 避免每次渲染创建新函数
  const handleStatusChange = useCallback(
    (status: SSEConnectionStatus) => {
      setIsConnected(status.connected);
      setSSEStatus(status);
    },
    [setSSEStatus], // Zustand 方法引用稳定，依赖是安全的
  );

  // 初始化 SSE 连接
  useEffect(() => {
    const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
    const url = baseUrl ? joinBaseUrl(baseUrl, '/_promptxy/events') : '/_promptxy/events';

    sseClientRef.current = new SSEClient(url, handleEvent, handleStatusChange);
    sseClientRef.current.connect();

    return () => {
      if (sseClientRef.current) {
        sseClientRef.current.disconnect();
        sseClientRef.current = null;
      }
    };
    // Zustand 的 store 方法引用是稳定的，依赖不会导致无限循环
  }, [handleEvent, handleStatusChange]);

  // 控制函数 - 使用 useCallback 保持引用稳定
  const reconnect = useCallback(() => {
    if (sseClientRef.current) {
      sseClientRef.current.disconnect();
      sseClientRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (sseClientRef.current) {
      sseClientRef.current.disconnect();
    }
  }, []);

  // 直接返回对象，不需要 useMemo
  // reconnect 和 disconnect 已经被 useCallback 包裹，引用稳定
  return {
    isConnected,
    reconnect,
    disconnect,
  };
}
