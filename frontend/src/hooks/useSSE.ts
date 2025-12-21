import { useEffect, useRef, useState } from 'react';
import { SSEClient } from '@/api/sse';
import { useAppStore } from '@/store';
import { SSERequestEvent, SSEConnectionStatus } from '@/types';

function joinBaseUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

/**
 * SSE 连接 Hook
 */
export function useSSE() {
  const sseClientRef = useRef<SSEClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const setSSEStatus = useAppStore(state => state.setSSEStatus);
  const addNewRequest = useAppStore(state => state.addNewRequest);

  useEffect(() => {
    const handleEvent = (event: SSERequestEvent) => {
      // 添加新请求到列表
      addNewRequest({
        id: event.id,
        timestamp: event.timestamp,
        client: event.client,
        path: event.path,
        method: event.method,
        matchedRules: event.matchedRules || [],
      });
    };

    const handleStatusChange = (status: SSEConnectionStatus) => {
      setIsConnected(status.connected);
      setSSEStatus(status);
    };

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
  }, [setSSEStatus, addNewRequest]);

  const reconnect = () => {
    if (sseClientRef.current) {
      sseClientRef.current.disconnect();
      sseClientRef.current.connect();
    }
  };

  const disconnect = () => {
    if (sseClientRef.current) {
      sseClientRef.current.disconnect();
    }
  };

  return {
    isConnected,
    reconnect,
    disconnect,
  };
}
