import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
 * 使用 useCallback 优化事件处理器和控制函数
 */
export function useSSE() {
  const sseClientRef = useRef<SSEClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const setSSEStatus = useAppStore(state => state.setSSEStatus);
  const addNewRequest = useAppStore(state => state.addNewRequest);

  // 使用 useCallback 优化事件处理器，避免每次渲染都创建新函数
  const handleEvent = useCallback(
    (event: SSERequestEvent) => {
      // 添加新请求到列表
      addNewRequest({
        id: event.id,
        timestamp: event.timestamp,
        client: event.client,
        path: event.path,
        method: event.method,
        matchedRules: event.matchedRules || [],
      });
    },
    [addNewRequest],
  );

  const handleStatusChange = useCallback(
    (status: SSEConnectionStatus) => {
      setIsConnected(status.connected);
      setSSEStatus(status);
    },
    [setSSEStatus],
  );

  useEffect(() => {
    // 创建 SSE 客户端
    const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
    const url = baseUrl ? joinBaseUrl(baseUrl, '/_promptxy/events') : '/_promptxy/events';
    sseClientRef.current = new SSEClient(url, handleEvent, handleStatusChange);

    // 自动连接
    sseClientRef.current.connect();

    // 清理函数
    return () => {
      if (sseClientRef.current) {
        sseClientRef.current.disconnect();
        sseClientRef.current = null;
      }
    };
  }, [handleEvent, handleStatusChange]); // 依赖优化后的回调函数

  // 使用 useCallback 优化控制函数
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

  // 使用 useMemo 优化返回值
  return useMemo(
    () => ({
      isConnected,
      reconnect,
      disconnect,
    }),
    [isConnected, reconnect, disconnect],
  );
}
