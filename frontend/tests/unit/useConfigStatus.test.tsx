import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useConfigStatus } from '@/hooks/useConfigStatus';

vi.mock('@/hooks/useSuppliers', () => ({
  useSuppliers: vi.fn(() => ({
    data: {
      suppliers: [
        { id: 'chat-up', name: 'chat-up', displayName: 'OpenAI Chat Upstream' },
      ],
    },
  })),
}));

vi.mock('@/hooks/useRoutes', () => ({
  useRoutes: vi.fn(() => ({
    data: {
      routes: [
        {
          id: 'route-chat',
          localService: 'chat',
          singleSupplierId: 'chat-up',
          enabled: true,
        },
      ],
    },
  })),
}));

describe('useConfigStatus', () => {
  it('返回 /chat 入口对应的供应商名称', () => {
    const { result } = renderHook(() => useConfigStatus());

    expect(result.current['/chat']).toBe('OpenAI Chat Upstream');
  });
});
