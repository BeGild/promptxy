/**
 * 页面级集成测试
 * 覆盖 RulesPage, RequestsPage, PreviewPage, SettingsPage 的完整流程
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 页面组件
import { RulesPage } from '@/pages/RulesPage';
import { RequestsPage } from '@/pages/RequestsPage';
import { PreviewPage } from '@/pages/PreviewPage';
import { SettingsPage } from '@/pages/SettingsPage';

// 类型
import type { PromptxyRule, RequestListItem, RequestRecord } from '@/types';

// 模拟 API 客户端
vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  checkHealth: vi.fn().mockResolvedValue(true),
}));

// 模拟 SSE
vi.mock('@/api/sse', () => ({
  SSEClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
  })),
}));

// 模拟 HeroUI 组件
vi.mock('@heroui/react', () => ({
  Button: ({ children, onPress, isDisabled, isLoading }: any) => (
    <button onClick={onPress} disabled={isDisabled} data-testid="button" data-loading={isLoading}>
      {children}
    </button>
  ),
  Input: ({ value, onChange, placeholder, label, ...props }: any) => (
    <input
      data-testid="input"
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={label}
      {...props}
    />
  ),
  Textarea: ({ value, onChange, placeholder, label, ...props }: any) => (
    <textarea
      data-testid="textarea"
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={label}
      {...props}
    />
  ),
  Select: ({ children, selectedKeys, onChange, label, ...props }: any) => (
    <select
      data-testid="select"
      value={selectedKeys?.[0] || ''}
      onChange={e => onChange({ target: { value: e.target.value } })}
      aria-label={label}
      {...props}
    >
      {children}
    </select>
  ),
  SelectItem: ({ children, key: keyProp }: any) => <option value={keyProp}>{children}</option>,
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardBody: ({ children }: any) => <div data-testid="card-body">{children}</div>,
  Chip: ({ children, color, variant }: any) => (
    <span data-testid="chip" data-color={color} data-variant={variant}>
      {children}
    </span>
  ),
  Spinner: ({ children }: any) => <div data-testid="spinner">{children}</div>,
  Pagination: ({ total, page, onChange }: any) => (
    <div data-testid="pagination" data-total={total} data-page={page}>
      {Array.from({ length: total }).map((_, i) => (
        <button key={i} onClick={() => onChange(i + 1)} data-testid={`page-${i + 1}`}>
          {i + 1}
        </button>
      ))}
    </div>
  ),
  Modal: ({ isOpen, children }: any) => (isOpen ? <div data-testid="modal">{children}</div> : null),
  ModalContent: ({ children }: any) => <div data-testid="modal-content">{children}</div>,
  ModalHeader: ({ children }: any) => <div data-testid="modal-header">{children}</div>,
  ModalBody: ({ children }: any) => <div data-testid="modal-body">{children}</div>,
  ModalFooter: ({ children }: any) => <div data-testid="modal-footer">{children}</div>,
  useDisclosure: () => {
    const [isOpen, setIsOpen] = React.useState(false);
    return {
      isOpen,
      onOpen: () => setIsOpen(true),
      onClose: () => setIsOpen(false),
    };
  },
  Table: ({ children, onRowAction }: any) => (
    <table
      data-testid="table"
      onClick={e => {
        const row = e.target.closest('tr');
        if (row && row.dataset.id) {
          onRowAction?.(row.dataset.id);
        }
      }}
    >
      {children}
    </table>
  ),
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableColumn: ({ children }: any) => <th>{children}</th>,
  TableBody: ({ children, items }: any) => (
    <tbody>
      {items?.map((item: any, i: number) => (
        <tr key={item.id} data-id={item.id} data-testid="table-row">
          {children(item)}
        </tr>
      ))}
    </tbody>
  ),
  TableRow: ({ children }: any) => <>{children}</>,
  TableCell: ({ children }: any) => <td>{children}</td>,
  Badge: ({ children, color }: any) => (
    <span data-testid="badge" data-color={color}>
      {children}
    </span>
  ),
  Divider: () => <hr data-testid="divider" />,
}));

// 模拟组件
vi.mock('@/components/rules', () => ({
  RuleList: ({ rules, isLoading, onEdit, onDelete, onToggle, onNewRule }: any) => (
    <div data-testid="rule-list">
      {isLoading ? (
        <div data-testid="loading">加载中...</div>
      ) : rules.length === 0 ? (
        <div data-testid="empty">暂无规则</div>
      ) : (
        rules.map((rule: any) => (
          <div key={rule.id} data-testid="rule-card" data-id={rule.id}>
            <span>{rule.id}</span>
            <button onClick={() => onEdit(rule.id)} data-testid="edit-btn">
              编辑
            </button>
            <button onClick={() => onDelete(rule.id)} data-testid="delete-btn">
              删除
            </button>
            <button onClick={() => onToggle(rule)} data-testid="toggle-btn">
              切换
            </button>
          </div>
        ))
      )}
      <button onClick={onNewRule} data-testid="new-rule-btn">
        新建规则
      </button>
    </div>
  ),
  RuleEditor: ({ rule, onSave, onCancel }: any) => (
    <div data-testid="rule-editor">
      <input
        data-testid="rule-id-input"
        value={rule?.id || ''}
        onChange={e => {}}
        aria-label="规则ID"
      />
      <button
        onClick={() => onSave({ ...rule, id: rule?.id || 'new-rule' })}
        data-testid="save-btn"
      >
        保存
      </button>
      <button onClick={onCancel} data-testid="cancel-btn">
        取消
      </button>
    </div>
  ),
}));

vi.mock('@/components/requests', () => ({
  RequestList: ({
    requests,
    filters,
    onFiltersChange,
    isLoading,
    total,
    page,
    onPageChange,
    onRowClick,
    onRefresh,
    onDelete,
  }: any) => (
    <div data-testid="request-list">
      <input
        data-testid="search-input"
        value={filters.search || ''}
        onChange={e => onFiltersChange({ ...filters, search: e.target.value })}
        placeholder="搜索..."
      />
      <select
        data-testid="client-filter"
        value={filters.client || 'all'}
        onChange={e => {
          const val = e.target.value;
          const newFilters = { ...filters };
          if (val === 'all') delete newFilters.client;
          else newFilters.client = val;
          onFiltersChange(newFilters);
        }}
      >
        <option value="all">所有</option>
        <option value="claude">Claude</option>
      </select>
      <button onClick={onRefresh} data-testid="refresh-btn">
        刷新
      </button>
      {requests.map((req: any) => (
        <div key={req.id} data-testid="request-item" data-id={req.id}>
          <span>{req.id}</span>
          <button onClick={() => onRowClick(req.id)} data-testid="view-btn">
            查看
          </button>
          <button onClick={() => onDelete(req.id)} data-testid="delete-btn">
            删除
          </button>
        </div>
      ))}
      {Array.from({ length: Math.ceil(total / 50) }).map((_, i) => (
        <button key={i} onClick={() => onPageChange(i + 1)} data-testid={`page-${i + 1}`}>
          {i + 1}
        </button>
      ))}
    </div>
  ),
  RequestDetail: ({ request, isLoading, onClose }: any) => (
    <div data-testid="request-detail">
      {isLoading ? (
        <div data-testid="loading">加载中...</div>
      ) : (
        <>
          <div data-testid="detail-id">{request?.id}</div>
          <button onClick={onClose} data-testid="close-btn">
            关闭
          </button>
        </>
      )}
    </div>
  ),
}));

vi.mock('@/components/preview', () => ({
  PreviewPanel: () => (
    <div data-testid="preview-panel">
      <input data-testid="preview-input" placeholder="输入文本" />
      <select data-testid="preview-client">
        <option value="claude">Claude</option>
      </select>
      <select data-testid="preview-field">
        <option value="system">System</option>
      </select>
      <button data-testid="preview-btn">预览</button>
      <div data-testid="preview-result"></div>
    </div>
  ),
}));

vi.mock('@/components/settings', () => ({
  SettingsPanel: () => (
    <div data-testid="settings-panel">
      <div data-testid="stats">统计信息</div>
      <button data-testid="export-btn">导出</button>
      <button data-testid="import-btn">导入</button>
      <button data-testid="cleanup-btn">清理</button>
    </div>
  ),
}));

vi.mock('@/components/common', () => ({
  Modal: ({ isOpen, children, title }: any) =>
    isOpen ? (
      <div data-testid="modal">
        <div data-testid="modal-title">{title}</div>
        {children}
      </div>
    ) : null,
  EmptyState: ({ title, description, actionText, onAction }: any) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {actionText && <button onClick={onAction}>{actionText}</button>}
    </div>
  ),
}));

// 测试工具函数
const createWrapper = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>;
};

describe('页面级集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RulesPage - 规则管理流程', () => {
    const mockRules: PromptxyRule[] = [
      {
        id: 'rule-1',
        description: '测试规则1',
        when: { client: 'claude', field: 'system' },
        ops: [{ type: 'append', text: 'test' }],
        enabled: true,
      },
      {
        id: 'rule-2',
        description: '测试规则2',
        when: { client: 'codex', field: 'instructions', method: 'POST' },
        ops: [{ type: 'replace', replacement: 'new' }],
        enabled: false,
      },
    ];

    it('应该完整显示规则管理页面', async () => {
      const api = await import('@/api/client');
      (api.apiClient.get as any).mockResolvedValue({ data: { rules: mockRules } });

      render(createWrapper(<RulesPage />));

      await waitFor(() => {
        expect(screen.getByTestId('rule-list')).toBeInTheDocument();
      });

      // 验证统计卡片
      expect(screen.getByText('规则管理')).toBeInTheDocument();
    });

    it('应该处理创建新规则的完整流程', async () => {
      const user = userEvent.setup();
      const api = await import('@/api/client');
      (api.apiClient.get as any).mockResolvedValue({ data: { rules: [] } });
      (api.apiClient.post as any).mockResolvedValue({ data: { success: true } });

      render(createWrapper(<RulesPage />));

      await waitFor(() => {
        expect(screen.getByTestId('rule-list')).toBeInTheDocument();
      });

      // 点击新建规则
      const newRuleBtn = screen.getByTestId('new-rule-btn');
      await user.click(newRuleBtn);

      // 应该打开模态框
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      // 填写规则
      const idInput = screen.getByTestId('rule-id-input');
      await user.clear(idInput);
      await user.type(idInput, 'new-rule-1');

      // 保存
      const saveBtn = screen.getByTestId('save-btn');
      await user.click(saveBtn);

      // 验证 API 调用
      await waitFor(() => {
        expect(api.apiClient.post).toHaveBeenCalled();
      });
    });

    it('应该处理编辑规则流程', async () => {
      const user = userEvent.setup();
      const api = await import('@/api/client');
      (api.apiClient.get as any).mockResolvedValue({ data: { rules: mockRules } });
      (api.apiClient.put as any).mockResolvedValue({ data: { success: true } });

      render(createWrapper(<RulesPage />));

      await waitFor(() => {
        expect(screen.getByTestId('rule-card')).toBeInTheDocument();
      });

      // 点击编辑
      const editBtns = screen.getAllByTestId('edit-btn');
      await user.click(editBtns[0]);

      // 验证模态框打开
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument();
      });

      // 保存编辑
      const saveBtn = screen.getByTestId('save-btn');
      await user.click(saveBtn);

      await waitFor(() => {
        expect(api.apiClient.put).toHaveBeenCalled();
      });
    });

    it('应该处理删除规则流程', async () => {
      const user = userEvent.setup();
      const api = await import('@/api/client');
      (api.apiClient.get as any).mockResolvedValue({ data: { rules: mockRules } });
      (api.apiClient.delete as any).mockResolvedValue({ data: { success: true } });

      // 模拟 confirm 返回 true
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(createWrapper(<RulesPage />));

      await waitFor(() => {
        expect(screen.getByTestId('rule-card')).toBeInTheDocument();
      });

      // 点击删除
      const deleteBtns = screen.getAllByTestId('delete-btn');
      await user.click(deleteBtns[0]);

      await waitFor(() => {
        expect(api.apiClient.delete).toHaveBeenCalledWith('/_promptxy/rules/rule-1');
      });
    });

    it('应该处理启用/禁用规则切换', async () => {
      const user = userEvent.setup();
      const api = await import('@/api/client');
      (api.apiClient.get as any).mockResolvedValue({ data: { rules: mockRules } });
      (api.apiClient.post as any).mockResolvedValue({ data: { success: true } });

      render(createWrapper(<RulesPage />));

      await waitFor(() => {
        expect(screen.getByTestId('rule-card')).toBeInTheDocument();
      });

      // 点击切换
      const toggleBtns = screen.getAllByTestId('toggle-btn');
      await user.click(toggleBtns[0]);

      await waitFor(() => {
        expect(api.apiClient.post).toHaveBeenCalled();
      });
    });
  });

  describe('RequestsPage - 请求历史流程', () => {
    const mockRequests: RequestListItem[] = [
      {
        id: 'req-1',
        timestamp: Date.now(),
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        matchedRules: ['rule-1'],
        responseStatus: 200,
        durationMs: 150,
      },
      {
        id: 'req-2',
        timestamp: Date.now() - 10000,
        client: 'codex',
        path: '/api/generate',
        method: 'POST',
        matchedRules: [],
        responseStatus: 500,
        durationMs: 300,
      },
    ];

    const mockDetail: RequestRecord = {
      id: 'req-1',
      timestamp: Date.now(),
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      originalBody: { system: 'original' },
      modifiedBody: { system: 'modified' },
      matchedRules: [{ ruleId: 'rule-1', opType: 'append' }],
      responseStatus: 200,
      durationMs: 150,
    };

    it('应该完整显示请求监控页面', async () => {
      const api = await import('@/api/client');
      (api.apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/requests?')) {
          return Promise.resolve({ data: { total: 2, items: mockRequests } });
        }
        return Promise.resolve({ data: {} });
      });

      render(createWrapper(<RequestsPage />));

      await waitFor(() => {
        expect(screen.getByTestId('request-list')).toBeInTheDocument();
      });

      expect(screen.getByText('请求监控')).toBeInTheDocument();
    });

    it('应该处理搜索和过滤流程', async () => {
      const user = userEvent.setup();
      const api = await import('@/api/client');
      const mockGet = vi.fn().mockResolvedValue({ data: { total: 1, items: [mockRequests[0]] } });
      (api.apiClient.get as any).mockImplementation(mockGet);

      render(createWrapper(<RequestsPage />));

      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument();
      });

      // 输入搜索
      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'test');

      // 等待防抖后验证 API 调用
      await waitFor(() => {
        expect(mockGet).toHaveBeenCalled();
      });
    });

    it('应该处理查看请求详情流程', async () => {
      const user = userEvent.setup();
      const api = await import('@/api/client');
      (api.apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/requests?')) {
          return Promise.resolve({ data: { total: 1, items: [mockRequests[0]] } });
        }
        if (url.includes('/requests/req-1')) {
          return Promise.resolve({ data: mockDetail });
        }
        return Promise.resolve({ data: {} });
      });

      render(createWrapper(<RequestsPage />));

      await waitFor(() => {
        expect(screen.getByTestId('request-item')).toBeInTheDocument();
      });

      // 点击查看
      const viewBtn = screen.getByTestId('view-btn');
      await user.click(viewBtn);

      // 验证详情模态框
      await waitFor(() => {
        expect(screen.getByTestId('request-detail')).toBeInTheDocument();
      });

      // 关闭详情
      const closeBtn = screen.getByTestId('close-btn');
      await user.click(closeBtn);
    });

    it('应该处理删除请求流程', async () => {
      const user = userEvent.setup();
      const api = await import('@/api/client');
      (api.apiClient.get as any).mockResolvedValue({
        data: { total: 1, items: [mockRequests[0]] },
      });
      (api.apiClient.delete as any).mockResolvedValue({ data: { success: true } });

      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(createWrapper(<RequestsPage />));

      await waitFor(() => {
        expect(screen.getByTestId('request-item')).toBeInTheDocument();
      });

      // 点击删除
      const deleteBtn = screen.getByTestId('delete-btn');
      await user.click(deleteBtn);

      await waitFor(() => {
        expect(api.apiClient.delete).toHaveBeenCalledWith('/_promptxy/requests/req-1');
      });
    });

    it('应该处理分页流程', async () => {
      const api = await import('@/api/client');
      const mockGet = vi.fn().mockResolvedValue({ data: { total: 100, items: mockRequests } });
      (api.apiClient.get as any).mockImplementation(mockGet);

      render(createWrapper(<RequestsPage />));

      await waitFor(() => {
        expect(screen.getByTestId('page-2')).toBeInTheDocument();
      });

      // 点击第二页
      const page2Btn = screen.getByTestId('page-2');
      fireEvent.click(page2Btn);

      await waitFor(() => {
        expect(mockGet).toHaveBeenCalledWith('/_promptxy/requests?limit=50&offset=50');
      });
    });
  });

  describe('PreviewPage - 规则预览流程', () => {
    it('应该完整显示预览页面', () => {
      render(createWrapper(<PreviewPage />));

      expect(screen.getByText('实时预览')).toBeInTheDocument();
      expect(screen.getByTestId('preview-panel')).toBeInTheDocument();
    });

    it('应该显示预览面板组件', () => {
      render(createWrapper(<PreviewPage />));

      expect(screen.getByTestId('preview-input')).toBeInTheDocument();
      expect(screen.getByTestId('preview-client')).toBeInTheDocument();
      expect(screen.getByTestId('preview-field')).toBeInTheDocument();
      expect(screen.getByTestId('preview-btn')).toBeInTheDocument();
    });
  });

  describe('SettingsPage - 设置管理流程', () => {
    it('应该完整显示设置页面', () => {
      render(createWrapper(<SettingsPage />));

      expect(screen.getByText('系统设置')).toBeInTheDocument();
      expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
    });

    it('应该显示设置面板组件', () => {
      render(createWrapper(<SettingsPage />));

      expect(screen.getByTestId('stats')).toBeInTheDocument();
      expect(screen.getByTestId('export-btn')).toBeInTheDocument();
      expect(screen.getByTestId('import-btn')).toBeInTheDocument();
      expect(screen.getByTestId('cleanup-btn')).toBeInTheDocument();
    });
  });
});
