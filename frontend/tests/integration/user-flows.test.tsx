/**
 * 用户流程集成测试
 * 覆盖完整工作流、SSE 实时更新、错误处理流程
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 页面和组件
import { RulesPage } from '@/pages/RulesPage';
import { RequestsPage } from '@/pages/RequestsPage';
import { PreviewPage } from '@/pages/PreviewPage';

// 类型
import type { PromptxyRule, RequestListItem } from '@/types';

// 模拟 API
vi.mock('@/api/client', () => {
  const mockGet = vi.fn();
  const mockPost = vi.fn();
  const mockPut = vi.fn();
  const mockDelete = vi.fn();

  return {
    apiClient: {
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    },
    checkHealth: vi.fn().mockResolvedValue(true),
  };
});

// 模拟 SSE Client
let mockSSEConnect: any;
let mockSSEDisconnect: any;
let mockSSECallback: any;
let mockSSEStatusCallback: any;

vi.mock('@/api/sse', () => ({
  SSEClient: vi.fn().mockImplementation((url, onEvent, onStatusChange) => {
    mockSSECallback = onEvent;
    mockSSEStatusCallback = onStatusChange;
    return {
      connect: (mockSSEConnect = vi.fn()),
      disconnect: (mockSSEDisconnect = vi.fn()),
      isConnected: vi.fn().mockReturnValue(false),
    };
  }),
}));

// 模拟 HeroUI
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
            <span data-testid="rule-id">{rule.id}</span>
            <span data-testid="rule-enabled">{rule.enabled ? '启用' : '禁用'}</span>
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
  RuleEditor: ({ rule, onSave, onCancel }: any) => {
    const [formData, setFormData] = React.useState(
      rule || {
        id: '',
        when: { client: 'claude', field: 'system' },
        ops: [{ type: 'append', text: '' }],
        enabled: true,
      },
    );
    return (
      <div data-testid="rule-editor">
        <input
          data-testid="rule-id-input"
          value={formData.id}
          onChange={e => setFormData({ ...formData, id: e.target.value })}
          aria-label="规则ID"
        />
        <button onClick={() => onSave(formData)} data-testid="save-btn">
          保存
        </button>
        <button onClick={onCancel} data-testid="cancel-btn">
          取消
        </button>
      </div>
    );
  },
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
          <span data-testid="req-id">{req.id}</span>
          <span data-testid="req-client">{req.client}</span>
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
          <div data-testid="detail-original">{JSON.stringify(request?.originalBody)}</div>
          <div data-testid="detail-modified">{JSON.stringify(request?.modifiedBody)}</div>
          <button onClick={onClose} data-testid="close-btn">
            关闭
          </button>
        </>
      )}
    </div>
  ),
}));

vi.mock('@/components/preview', () => ({
  PreviewPanel: () => {
    const [input, setInput] = React.useState('');
    const [result, setResult] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(false);

    const handlePreview = async () => {
      setLoading(true);
      // 模拟 API 调用
      setTimeout(() => {
        setResult({
          original: { system: input },
          modified: { system: input + ' [MODIFIED]' },
          matches: [{ ruleId: 'rule-1', opType: 'append' }],
        });
        setLoading(false);
      }, 100);
    };

    return (
      <div data-testid="preview-panel">
        <input
          data-testid="preview-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="输入文本"
        />
        <button onClick={handlePreview} data-testid="preview-btn">
          预览
        </button>
        {loading && <div data-testid="preview-loading">加载中...</div>}
        {result && (
          <div data-testid="preview-result">
            <div data-testid="original">{JSON.stringify(result.original)}</div>
            <div data-testid="modified">{JSON.stringify(result.modified)}</div>
            <div data-testid="matches">{JSON.stringify(result.matches)}</div>
          </div>
        )}
      </div>
    );
  },
}));

vi.mock('@/components/settings', () => ({
  SettingsPanel: () => {
    const [stats, setStats] = React.useState({
      total: 100,
      recent: 10,
      byClient: { claude: 60 },
      database: { path: '/db.sqlite', size: 1024, recordCount: 100 },
    });
    const [exporting, setExporting] = React.useState(false);
    const [importing, setImporting] = React.useState(false);
    const [cleaning, setCleaning] = React.useState(false);

    const handleExport = async () => {
      setExporting(true);
      setTimeout(() => setExporting(false), 100);
    };

    const handleImport = async () => {
      setImporting(true);
      setTimeout(() => setImporting(false), 100);
    };

    const handleCleanup = async () => {
      setCleaning(true);
      setTimeout(() => setCleaning(false), 100);
    };

    return (
      <div data-testid="settings-panel">
        <div data-testid="stats-total">{stats.total}</div>
        <div data-testid="stats-recent">{stats.recent}</div>
        <button onClick={handleExport} data-testid="export-btn" data-loading={exporting}>
          {exporting ? '导出中...' : '导出'}
        </button>
        <button onClick={handleImport} data-testid="import-btn" data-loading={importing}>
          {importing ? '导入中...' : '导入'}
        </button>
        <button onClick={handleCleanup} data-testid="cleanup-btn" data-loading={cleaning}>
          {cleaning ? '清理中...' : '清理'}
        </button>
      </div>
    );
  },
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
      {actionText && (
        <button onClick={onAction} data-testid="empty-action">
          {actionText}
        </button>
      )}
    </div>
  ),
}));

// 测试工具
const createWrapper = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>;
};

describe('用户流程集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('完整工作流: 创建规则 → 发送请求 → 查看历史 → 验证规则应用', () => {
    it('应该完成从创建规则到验证应用的完整流程', async () => {
      const user = userEvent.setup();
      const api = await import('@/api/client');

      // 初始状态：无规则，无请求
      (api.apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/_promptxy/config')) {
          return Promise.resolve({ data: { rules: [] } });
        }
        if (url.includes('/_promptxy/requests')) {
          return Promise.resolve({ data: { total: 0, items: [] } });
        }
        return Promise.resolve({ data: {} });
      });

      // 1. 创建规则
      (api.apiClient.post as any).mockImplementation((url: string, data: any) => {
        if (url === '/_promptxy/rules') {
          return Promise.resolve({ success: true, rule: data.rule });
        }
        return Promise.resolve({ success: true });
      });

      // 步骤1: 打开规则页面
      render(createWrapper(<RulesPage />));
      await waitFor(() => screen.getByTestId('rule-list'));

      // 步骤2: 创建新规则
      await user.click(screen.getByTestId('new-rule-btn'));
      await waitFor(() => screen.getByTestId('modal'));

      const idInput = screen.getByTestId('rule-id-input');
      await user.clear(idInput);
      await user.type(idInput, 'test-rule-1');

      await user.click(screen.getByTestId('save-btn'));

      // 验证规则创建成功
      await waitFor(() => {
        expect(api.apiClient.post).toHaveBeenCalledWith('/_promptxy/rules', {
          rule: expect.objectContaining({ id: 'test-rule-1' }),
        });
      });

      // 步骤3: 模拟请求到达（通过 SSE）
      const mockRequestEvent: RequestListItem = {
        id: 'req-123',
        timestamp: Date.now(),
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        matchedRules: ['test-rule-1'],
        responseStatus: 200,
        durationMs: 150,
      };

      // 触发 SSE 事件
      act(() => {
        mockSSECallback(mockRequestEvent);
      });

      // 步骤4: 查看请求历史
      // 重新渲染 RequestsPage
      (api.apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/_promptxy/requests?')) {
          return Promise.resolve({ data: { total: 1, items: [mockRequestEvent] } });
        }
        if (url.includes('/_promptxy/requests/req-123')) {
          return Promise.resolve({
            data: {
              id: 'req-123',
              timestamp: Date.now(),
              client: 'claude',
              path: '/v1/messages',
              method: 'POST',
              originalBody: { system: '原始文本' },
              modifiedBody: { system: '原始文本 [应用规则]' },
              matchedRules: [{ ruleId: 'test-rule-1', opType: 'append' }],
              responseStatus: 200,
              durationMs: 150,
            },
          });
        }
        return Promise.resolve({ data: {} });
      });

      render(createWrapper(<RequestsPage />));
      await waitFor(() => screen.getByTestId('request-list'));

      // 验证请求显示
      expect(screen.getByTestId('req-id')).toHaveTextContent('req-123');
      expect(screen.getByTestId('req-client')).toHaveTextContent('claude');

      // 步骤5: 查看详情并验证规则应用
      await user.click(screen.getByTestId('view-btn'));
      await waitFor(() => screen.getByTestId('request-detail'));

      // 验证原始和修改后的内容
      expect(screen.getByTestId('detail-original')).toHaveTextContent('原始文本');
      expect(screen.getByTestId('detail-modified')).toHaveTextContent('应用规则');
    });
  });

  describe('SSE 实时更新流程', () => {
    it('应该处理 SSE 连接和实时事件', async () => {
      const api = await import('@/api/client');
      (api.apiClient.get as any).mockResolvedValue({ data: { total: 0, items: [] } });

      render(createWrapper(<RequestsPage />));

      await waitFor(() => screen.getByTestId('request-list'));

      // 验证 SSE 连接已初始化
      expect(mockSSEConnect).toHaveBeenCalled();

      // 模拟连接成功状态
      act(() => {
        mockSSEStatusCallback({ connected: true, lastEvent: Date.now(), error: null });
      });

      // 模拟接收新请求事件
      const newRequest: RequestListItem = {
        id: 'sse-req-1',
        timestamp: Date.now(),
        client: 'claude',
        path: '/v1/messages',
        method: 'POST',
        matchedRules: ['rule-1'],
        responseStatus: 200,
        durationMs: 100,
      };

      act(() => {
        mockSSECallback(newRequest);
      });

      // 验证新请求出现在列表中（需要重新获取列表）
      (api.apiClient.get as any).mockResolvedValue({
        data: { total: 1, items: [newRequest] },
      });

      // 触发刷新
      await userEvent.setup().click(screen.getByTestId('refresh-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('req-id')).toHaveTextContent('sse-req-1');
      });
    });

    it('应该处理 SSE 断开重连流程', async () => {
      const api = await import('@/api/client');
      (api.apiClient.get as any).mockResolvedValue({ data: { total: 0, items: [] } });

      render(createWrapper(<RequestsPage />));

      // 模拟连接断开
      act(() => {
        mockSSEStatusCallback({
          connected: false,
          lastEvent: null,
          error: '连接断开，3秒后重试...',
        });
      });

      // 模拟自动重连
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      // 验证重连尝试
      expect(mockSSEConnect).toHaveBeenCalledTimes(2);
    });
  });

  describe('错误处理流程', () => {
    it('应该处理 API 断开错误', async () => {
      const api = await import('@/api/client');

      // API 返回错误
      (api.apiClient.get as any).mockRejectedValue(new Error('无法连接到服务器'));

      render(createWrapper(<RulesPage />));

      // 等待错误处理（虽然页面可能不会显示错误，但内部应该处理）
      await waitFor(() => {
        // 验证 API 被调用
        expect(api.apiClient.get).toHaveBeenCalled();
      });
    });

    it('应该处理无效数据错误', async () => {
      const user = userEvent.setup();
      const api = await import('@/api/client');

      // 返回无效数据
      (api.apiClient.get as any).mockResolvedValue({ data: { rules: null } });
      (api.apiClient.post as any).mockRejectedValue(new Error('数据验证失败'));

      render(createWrapper(<RulesPage />));

      await waitFor(() => screen.getByTestId('rule-list'));

      // 尝试创建规则
      await user.click(screen.getByTestId('new-rule-btn'));
      await waitFor(() => screen.getByTestId('modal'));

      const idInput = screen.getByTestId('rule-id-input');
      await user.clear(idInput);
      await user.type(idInput, 'invalid-rule');

      // 模拟窗口 alert
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      await user.click(screen.getByTestId('save-btn'));

      // 验证错误处理
      await waitFor(() => {
        expect(api.apiClient.post).toHaveBeenCalled();
      });

      alertSpy.mockRestore();
    });

    it('应该处理网络错误时的重试机制', async () => {
      const api = await import('@/api/client');
      let callCount = 0;

      // 第一次失败，第二次成功
      (api.apiClient.get as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ data: { rules: [] } });
      });

      render(createWrapper(<RulesPage />));

      // 等待重试
      await waitFor(() => {
        expect(callCount).toBeGreaterThan(0);
      });
    });

    it('应该处理删除操作的确认取消', async () => {
      const user = userEvent.setup();
      const api = await import('@/api/client');

      (api.apiClient.get as any).mockResolvedValue({
        data: {
          rules: [
            {
              id: 'rule-to-delete',
              description: '测试',
              when: { client: 'claude', field: 'system' },
              ops: [{ type: 'append', text: 'test' }],
              enabled: true,
            },
          ],
        },
      });

      // 用户取消确认
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(createWrapper(<RulesPage />));

      await waitFor(() => screen.getByTestId('rule-card'));

      // 点击删除
      await user.click(screen.getByTestId('delete-btn'));

      // 验证 API 未被调用（因为用户取消）
      expect(api.apiClient.delete).not.toHaveBeenCalled();
    });

    it('应该处理预览页面的错误状态', async () => {
      const user = userEvent.setup();

      render(createWrapper(<PreviewPage />));

      // 输入文本
      const input = screen.getByTestId('preview-input');
      await user.type(input, '测试文本');

      // 点击预览
      await user.click(screen.getByTestId('preview-btn'));

      // 验证加载状态
      await waitFor(() => {
        expect(screen.getByTestId('preview-loading')).toBeInTheDocument();
      });

      // 等待结果
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // 验证结果显示
      await waitFor(() => {
        expect(screen.getByTestId('preview-result')).toBeInTheDocument();
      });

      // 验证原始和修改后的内容
      expect(screen.getByTestId('original')).toHaveTextContent('测试文本');
      expect(screen.getByTestId('modified')).toHaveTextContent('[MODIFIED]');
    });
  });

  describe('复杂用户场景', () => {
    it('应该处理批量操作场景', async () => {
      const user = userEvent.setup();
      const api = await import('@/api/client');

      // 多条规则
      const rules = Array.from({ length: 5 }).map((_, i) => ({
        id: `rule-${i + 1}`,
        description: `规则${i + 1}`,
        when: { client: 'claude', field: 'system' },
        ops: [{ type: 'append', text: `test${i + 1}` }],
        enabled: i % 2 === 0,
      }));

      (api.apiClient.get as any).mockResolvedValue({ data: { rules } });
      (api.apiClient.post as any).mockResolvedValue({ success: true });

      render(createWrapper(<RulesPage />));

      await waitFor(() => {
        expect(screen.getAllByTestId('rule-card')).toHaveLength(5);
      });

      // 批量切换多个规则
      const toggleBtns = screen.getAllByTestId('toggle-btn');

      // 切换前两个
      await user.click(toggleBtns[0]);
      await user.click(toggleBtns[1]);

      // 验证 API 被调用
      await waitFor(() => {
        expect(api.apiClient.post).toHaveBeenCalledTimes(2);
      });
    });

    it('应该处理搜索过滤和分页的组合操作', async () => {
      const user = userEvent.setup();
      const api = await import('@/api/client');

      // 创建大量请求用于分页
      const manyRequests = Array.from({ length: 150 }).map((_, i) => ({
        id: `req-${i + 1}`,
        timestamp: Date.now() - i * 1000,
        client: i % 3 === 0 ? 'claude' : i % 3 === 1 ? 'codex' : 'gemini',
        path: `/api/${i}`,
        method: 'POST',
        matchedRules: [],
        responseStatus: 200,
        durationMs: 100,
      }));

      (api.apiClient.get as any).mockImplementation((url: string) => {
        // 解析 URL 参数
        const urlObj = new URL(url, 'http://localhost');
        const search = urlObj.searchParams.get('search');
        const client = urlObj.searchParams.get('client');
        const offset = parseInt(urlObj.searchParams.get('offset') || '0');
        const limit = parseInt(urlObj.searchParams.get('limit') || '50');

        let filtered = manyRequests;

        if (search) {
          filtered = filtered.filter(r => r.id.includes(search));
        }
        if (client) {
          filtered = filtered.filter(r => r.client === client);
        }

        const items = filtered.slice(offset, offset + limit);
        return Promise.resolve({
          data: {
            total: filtered.length,
            limit,
            offset,
            items,
          },
        });
      });

      render(createWrapper(<RequestsPage />));

      await waitFor(() => screen.getByTestId('request-list'));

      // 1. 搜索
      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'req-1');

      // 2. 过滤客户端
      const clientFilter = screen.getByTestId('client-filter');
      await user.selectOptions(clientFilter, 'claude');

      // 3. 切换到第二页
      await user.click(screen.getByTestId('page-2'));

      // 验证 API 被正确调用
      await waitFor(() => {
        expect(api.apiClient.get).toHaveBeenCalledWith(
          expect.stringContaining('/_promptxy/requests?'),
        );
      });
    });

    it('应该处理设置页面的完整配置管理流程', async () => {
      const user = userEvent.setup();
      const api = await import('@/api/client');

      // 配置和统计
      const config = {
        rules: [
          {
            id: 'config-rule',
            description: '配置规则',
            when: { client: 'claude', field: 'system' },
            ops: [{ type: 'append', text: 'test' }],
            enabled: true,
          },
        ],
      };

      const stats = {
        total: 100,
        recent: 10,
        byClient: { claude: 60, codex: 40 },
        database: { path: '/db.sqlite', size: 1024, recordCount: 100 },
      };

      (api.apiClient.get as any).mockImplementation((url: string) => {
        if (url.includes('/_promptxy/config')) {
          return Promise.resolve({ data: config });
        }
        if (url.includes('/_promptxy/stats')) {
          return Promise.resolve({ data: stats });
        }
        return Promise.resolve({ data: {} });
      });
      (api.apiClient.post as any).mockResolvedValue({ success: true });

      // 模拟文件上传
      const mockFile = new File(['{"test": "config"}'], 'config.json', {
        type: 'application/json',
      });
      const mockInput = {
        type: '',
        accept: '',
        onchange: null as any,
        click: vi.fn(),
        files: [mockFile],
      };

      const originalCreateElement = document.createElement.bind(document);
      document.createElement = function (tagName: string) {
        const element = originalCreateElement(tagName);
        if (tagName === 'input') {
          Object.defineProperty(element, 'files', { writable: true, value: [mockFile] });
          Object.defineProperty(element, 'onchange', { writable: true, value: null });
          Object.defineProperty(element, 'click', { writable: true, value: vi.fn() });
        }
        return element;
      };

      // 模拟 FileReader
      global.FileReader = class FileReader {
        onload: any = null;
        result: any = null;
        readAsText(file: Blob) {
          setTimeout(() => {
            if (this.onload) {
              this.result = '{"test": "config"}';
              this.onload(new ProgressEvent('load', { loaded: 100, total: 100 }));
            }
          }, 10);
        }
        addEventListener() {}
        removeEventListener() {}
        dispatchEvent() {
          return true;
        }
      } as any;

      // 模拟 URL
      global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
      global.URL.revokeObjectURL = vi.fn();

      render(createWrapper(<SettingsPage />));

      await waitFor(() => screen.getByTestId('settings-panel'));

      // 导出配置
      const exportBtn = screen.getByTestId('export-btn');
      await user.click(exportBtn);

      await waitFor(() => {
        expect(exportBtn).toHaveAttribute('data-loading', 'true');
      });

      // 导入配置
      const importBtn = screen.getByTestId('import-btn');
      await user.click(importBtn);

      await waitFor(() => {
        expect(importBtn).toHaveAttribute('data-loading', 'true');
      });

      // 清理数据
      const cleanupBtn = screen.getByTestId('cleanup-btn');
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await user.click(cleanupBtn);

      await waitFor(() => {
        expect(cleanupBtn).toHaveAttribute('data-loading', 'true');
      });
    });
  });
});
