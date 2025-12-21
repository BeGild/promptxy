/**
 * 请求组件测试
 * 包含 RequestList, RequestDetail, DiffViewer 组件测试
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequestList, RequestDetail, DiffViewer } from '@/components/requests';
import { RequestListItem, RequestRecord } from '@/types';

// 模拟 @heroui/react
vi.mock('@heroui/react', () => ({
  Table: ({ children, onRowAction, selectionMode, classNames }: any) => (
    <table
      data-testid="table"
      onClick={onRowAction}
      data-mode={selectionMode}
      className={classNames?.wrapper}
    >
      {children}
    </table>
  ),
  TableHeader: ({ children }: any) => <thead data-testid="table-header">{children}</thead>,
  TableColumn: ({ children }: any) => <th>{children}</th>,
  TableBody: ({ children, items, isLoading, emptyContent }: any) => (
    <tbody data-testid="table-body" data-loading={isLoading}>
      {items?.length > 0 ? children : emptyContent}
    </tbody>
  ),
  TableRow: ({ children, key, className }: any) => (
    <tr key={key} className={className} data-testid="table-row">
      {children}
    </tr>
  ),
  TableCell: ({ children, className }: any) => <td className={className}>{children}</td>,
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
  Button: ({ children, onPress, isDisabled, color, variant, size }: any) => (
    <button
      onClick={onPress}
      disabled={isDisabled}
      data-testid="button"
      data-color={color}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
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
  Chip: ({ children, color, variant, size, className }: any) => (
    <span
      data-testid="chip"
      data-color={color}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </span>
  ),
  Badge: ({ children, color, variant, size, className }: any) => (
    <span
      data-testid="badge"
      data-color={color}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </span>
  ),
  Select: ({ children, selectedKeys, onChange, label }: any) => (
    <select
      data-testid="select"
      value={selectedKeys?.[0] || ''}
      onChange={e => onChange({ target: { value: e.target.value } })}
      aria-label={label}
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
  CardBody: ({ children, className }: any) => (
    <div data-testid="card-body" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: any) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  Divider: () => <hr data-testid="divider" />,
}));

// 模拟 common 组件
vi.mock('@/components/common', () => ({
  EmptyState: ({ title, description, actionText, onAction }: any) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {actionText && <button onClick={onAction}>{actionText}</button>}
    </div>
  ),
}));

// 模拟 utils
vi.mock('@/utils', () => ({
  formatRelativeTime: (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    return `${Math.floor(diff / 3600000)}小时前`;
  },
  formatDuration: (ms: number) => `${ms}ms`,
  getStatusColor: (status: number) => {
    if (status >= 200 && status < 300) return 'success';
    if (status >= 400) return 'danger';
    return 'warning';
  },
  formatClient: (client: string) => {
    const map: Record<string, string> = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini' };
    return map[client] || client;
  },
  formatTime: (timestamp: number) => new Date(timestamp).toLocaleString(),
  generateJSONDiff: (original: any, modified: any) => {
    const diff: any[] = [];
    if (JSON.stringify(original) !== JSON.stringify(modified)) {
      diff.push({
        type: 'changed',
        left: JSON.stringify(original, null, 2),
        right: JSON.stringify(modified, null, 2),
      });
    } else {
      diff.push({
        type: 'same',
        left: JSON.stringify(original, null, 2),
        right: JSON.stringify(modified, null, 2),
      });
    }
    return diff;
  },
  highlightDiff: (diff: any[]) => {
    const left = diff.map(d => (d.type === 'same' ? d.left : `-${d.left}`));
    const right = diff.map(d => (d.type === 'same' ? d.right : `+${d.right}`));
    return { left, right };
  },
}));

describe('RequestList', () => {
  const mockOnFiltersChange = vi.fn();
  const mockOnPageChange = vi.fn();
  const mockOnRowClick = vi.fn();
  const mockOnRefresh = vi.fn();
  const mockOnDelete = vi.fn();

  const mockRequests: RequestListItem[] = [
    {
      id: 'req-1',
      timestamp: Date.now() - 10000,
      client: 'claude',
      path: '/v1/messages',
      method: 'POST',
      matchedRules: ['rule-1', 'rule-2'],
      responseStatus: 200,
      durationMs: 150,
    },
    {
      id: 'req-2',
      timestamp: Date.now() - 60000,
      client: 'codex',
      path: '/v1/completions',
      method: 'POST',
      matchedRules: ['rule-3'],
      responseStatus: 400,
      durationMs: 200,
    },
    {
      id: 'req-3',
      timestamp: Date.now() - 300000,
      client: 'gemini',
      path: '/v1/generate',
      method: 'GET',
      matchedRules: [],
      responseStatus: 500,
      durationMs: 300,
    },
  ];

  const mockFilters = {
    search: '',
    client: 'all',
  };

  beforeEach(() => {
    mockOnFiltersChange.mockClear();
    mockOnPageChange.mockClear();
    mockOnRowClick.mockClear();
    mockOnRefresh.mockClear();
    mockOnDelete.mockClear();
  });

  describe('加载状态', () => {
    it('应该显示加载中状态', () => {
      render(
        <RequestList
          requests={[]}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={true}
          total={0}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(screen.getByText('加载请求中...')).toBeInTheDocument();
    });
  });

  describe('空状态', () => {
    it('应该显示空状态', () => {
      render(
        <RequestList
          requests={[]}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={0}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('暂无请求')).toBeInTheDocument();
    });

    it('空状态应该触发刷新', async () => {
      const user = userEvent.setup();
      render(
        <RequestList
          requests={[]}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={0}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      const refreshButton = screen.getByText('刷新');
      await user.click(refreshButton);

      expect(mockOnRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('请求列表渲染', () => {
    it('应该渲染请求表格', () => {
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      expect(screen.getByTestId('table')).toBeInTheDocument();
      expect(screen.getByTestId('table-header')).toBeInTheDocument();
      expect(screen.getByTestId('table-body')).toBeInTheDocument();
    });

    it('应该显示所有请求行', () => {
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      const rows = screen.getAllByTestId('table-row');
      expect(rows.length).toBe(3);
    });

    it('应该显示工具栏', () => {
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      expect(screen.getByPlaceholderText('🔍 搜索ID或路径...')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText('刷新')).toBeInTheDocument();
    });

    it('应该显示统计信息', () => {
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      expect(screen.getByText('显示结果:')).toBeInTheDocument();
      expect(screen.getByText('3 / 3 条')).toBeInTheDocument();
    });

    it('应该显示操作按钮', () => {
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      expect(screen.getAllByText('查看')).toHaveLength(3);
      expect(screen.getAllByText('删除')).toHaveLength(3);
    });
  });

  describe('搜索和过滤功能', () => {
    it('应该处理搜索输入', async () => {
      const user = userEvent.setup();
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      const searchInput = screen.getByPlaceholderText('🔍 搜索ID或路径...');
      await user.type(searchInput, 'req-1');

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'req-1' }),
      );
    });

    it('应该处理客户端筛选', async () => {
      const user = userEvent.setup();
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'claude');

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ client: 'claude' }),
      );
    });

    it('应该清除搜索', async () => {
      const user = userEvent.setup();
      const filtersWithSearch = { ...mockFilters, search: 'test' };

      render(
        <RequestList
          requests={mockRequests}
          filters={filtersWithSearch}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      const clearButton = screen.getByText('清除搜索');
      await user.click(clearButton);

      expect(mockOnFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ search: undefined }),
      );
    });
  });

  describe('行操作', () => {
    it('应该处理行点击', async () => {
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      const rows = screen.getAllByTestId('table-row');
      fireEvent.click(rows[0]);

      expect(mockOnRowClick).toHaveBeenCalledWith('req-1');
    });

    it('应该处理查看按钮点击', async () => {
      const user = userEvent.setup();
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      const viewButtons = screen.getAllByText('查看');
      await user.click(viewButtons[0]);

      expect(mockOnRowClick).toHaveBeenCalledWith('req-1');
    });

    it('应该处理删除按钮点击', async () => {
      const user = userEvent.setup();
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      const deleteButtons = screen.getAllByText('删除');
      await user.click(deleteButtons[0]);

      expect(mockOnDelete).toHaveBeenCalledWith('req-1');
    });
  });

  describe('分页功能', () => {
    it('应该显示分页控件', () => {
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={150}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      expect(screen.getByTestId('pagination')).toBeInTheDocument();
    });

    it('应该正确计算总页数', () => {
      // 总数150，每页50条，应该有3页
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={150}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      const pagination = screen.getByTestId('pagination');
      expect(pagination).toHaveAttribute('data-total', '3');
    });

    it('应该处理分页切换', async () => {
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={150}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      const page2Button = screen.getByTestId('page-2');
      fireEvent.click(page2Button);

      expect(mockOnPageChange).toHaveBeenCalledWith(2);
    });
  });

  describe('表格内容格式化', () => {
    it('应该正确显示客户端标签', () => {
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      expect(screen.getByText('Claude')).toBeInTheDocument();
      expect(screen.getByText('Codex')).toBeInTheDocument();
      expect(screen.getByText('Gemini')).toBeInTheDocument();
    });

    it('应该正确显示匹配规则', () => {
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      // 第一个请求有2个规则，应该显示
      expect(screen.getByText('rule-1')).toBeInTheDocument();
      expect(screen.getByText('rule-2')).toBeInTheDocument();
    });

    it('应该正确显示状态', () => {
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      expect(screen.getByText('200')).toBeInTheDocument();
      expect(screen.getByText('400')).toBeInTheDocument();
      expect(screen.getByText('500')).toBeInTheDocument();
    });

    it('应该正确显示耗时', () => {
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      expect(screen.getByText('150ms')).toBeInTheDocument();
      expect(screen.getByText('200ms')).toBeInTheDocument();
      expect(screen.getByText('300ms')).toBeInTheDocument();
    });

    it('应该处理无匹配规则的情况', () => {
      render(
        <RequestList
          requests={mockRequests}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={3}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      // 第三个请求没有匹配规则，应该显示 "-"
      const rows = screen.getAllByTestId('table-row');
      const thirdRow = rows[2];
      expect(thirdRow).toHaveTextContent('-');
    });

    it('应该显示超过3个规则时的省略', () => {
      const requestWithManyRules: RequestListItem = {
        id: 'req-many',
        timestamp: Date.now(),
        client: 'claude',
        path: '/test',
        method: 'POST',
        matchedRules: ['rule-1', 'rule-2', 'rule-3', 'rule-4', 'rule-5'],
        responseStatus: 200,
        durationMs: 100,
      };

      render(
        <RequestList
          requests={[requestWithManyRules]}
          filters={mockFilters}
          onFiltersChange={mockOnFiltersChange}
          isLoading={false}
          total={1}
          page={1}
          onPageChange={mockOnPageChange}
          onRowClick={mockOnRowClick}
          onRefresh={mockOnRefresh}
          onDelete={mockOnDelete}
        />,
      );

      expect(screen.getByText('rule-1')).toBeInTheDocument();
      expect(screen.getByText('rule-2')).toBeInTheDocument();
      expect(screen.getByText('rule-3')).toBeInTheDocument();
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });
});

describe('RequestDetail', () => {
  const mockOnClose = vi.fn();
  const mockOnReplay = vi.fn();

  const mockRequest: RequestRecord = {
    id: 'req-1',
    timestamp: Date.now(),
    client: 'claude',
    path: '/v1/messages',
    method: 'POST',
    originalBody: { system: '原始系统提示', model: 'claude-3' },
    modifiedBody: { system: '修改后的系统提示', model: 'claude-3' },
    matchedRules: [
      { ruleId: 'rule-1', opType: 'append' },
      { ruleId: 'rule-2', opType: 'replace' },
    ],
    responseStatus: 200,
    durationMs: 150,
    responseHeaders: { 'content-type': 'application/json' },
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnReplay.mockClear();
  });

  describe('加载状态', () => {
    it('应该显示加载中状态', () => {
      render(
        <RequestDetail
          request={null}
          isLoading={true}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(screen.getByText('加载详情中...')).toBeInTheDocument();
    });
  });

  describe('空状态', () => {
    it('应该显示未找到请求详情', () => {
      render(
        <RequestDetail
          request={null}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      expect(screen.getByText('未找到请求详情')).toBeInTheDocument();
      expect(screen.getByText('关闭')).toBeInTheDocument();
    });

    it('关闭按钮应该触发关闭事件', async () => {
      const user = userEvent.setup();
      render(
        <RequestDetail
          request={null}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      const closeButton = screen.getByText('关闭');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('请求详情渲染', () => {
    it('应该渲染基本信息', () => {
      render(
        <RequestDetail
          request={mockRequest}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      expect(screen.getByText('基本信息')).toBeInTheDocument();
      expect(screen.getByText('ID:')).toBeInTheDocument();
      expect(screen.getByText('时间:')).toBeInTheDocument();
      expect(screen.getByText('客户端:')).toBeInTheDocument();
      expect(screen.getByText('方法:')).toBeInTheDocument();
      expect(screen.getByText('路径:')).toBeInTheDocument();
      expect(screen.getByText('状态:')).toBeInTheDocument();
      expect(screen.getByText('耗时:')).toBeInTheDocument();
    });

    it('应该显示请求详情数据', () => {
      render(
        <RequestDetail
          request={mockRequest}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      expect(screen.getByText('req-1')).toBeInTheDocument();
      expect(screen.getByText('POST')).toBeInTheDocument();
      expect(screen.getByText('/v1/messages')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
      expect(screen.getByText('150ms')).toBeInTheDocument();
    });

    it('应该显示匹配规则', () => {
      render(
        <RequestDetail
          request={mockRequest}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      expect(screen.getByText('匹配规则')).toBeInTheDocument();
      expect(screen.getByText('rule-1')).toBeInTheDocument();
      expect(screen.getByText('rule-2')).toBeInTheDocument();
      expect(screen.getByText('append')).toBeInTheDocument();
      expect(screen.getByText('replace')).toBeInTheDocument();
    });

    it('应该显示差异对比', () => {
      render(
        <RequestDetail
          request={mockRequest}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      expect(screen.getByText('请求差异')).toBeInTheDocument();
      expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    });

    it('应该显示响应头', () => {
      render(
        <RequestDetail
          request={mockRequest}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      expect(screen.getByText('响应头')).toBeInTheDocument();
      expect(screen.getByText(/content-type/)).toBeInTheDocument();
    });

    it('应该显示错误信息当存在时', () => {
      const requestWithError = { ...mockRequest, error: '连接超时' };

      render(
        <RequestDetail
          request={requestWithError}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      expect(screen.getByText('错误信息')).toBeInTheDocument();
      expect(screen.getByText('连接超时')).toBeInTheDocument();
    });

    it('应该不显示错误信息当不存在时', () => {
      render(
        <RequestDetail
          request={mockRequest}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      expect(screen.queryByText('错误信息')).not.toBeInTheDocument();
    });

    it('应该不显示响应头当不存在时', () => {
      const requestWithoutHeaders = { ...mockRequest, responseHeaders: undefined };

      render(
        <RequestDetail
          request={requestWithoutHeaders}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      expect(screen.queryByText('响应头')).not.toBeInTheDocument();
    });

    it('应该不显示匹配规则当不存在时', () => {
      const requestWithoutRules = { ...mockRequest, matchedRules: [] };

      render(
        <RequestDetail
          request={requestWithoutRules}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      expect(screen.queryByText('匹配规则')).not.toBeInTheDocument();
    });
  });

  describe('操作按钮', () => {
    it('应该显示重放按钮当提供 onReplay', () => {
      render(
        <RequestDetail
          request={mockRequest}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      expect(screen.getByText('重放请求')).toBeInTheDocument();
    });

    it('应该不显示重放按钮当没有提供 onReplay', () => {
      render(<RequestDetail request={mockRequest} isLoading={false} onClose={mockOnClose} />);

      expect(screen.queryByText('重放请求')).not.toBeInTheDocument();
    });

    it('应该触发重放事件', async () => {
      const user = userEvent.setup();
      render(
        <RequestDetail
          request={mockRequest}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      const replayButton = screen.getByText('重放请求');
      await user.click(replayButton);

      expect(mockOnReplay).toHaveBeenCalledTimes(1);
    });

    it('应该触发关闭事件', async () => {
      const user = userEvent.setup();
      render(
        <RequestDetail
          request={mockRequest}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      const closeButton = screen.getByText('关闭');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('边缘情况', () => {
    it('应该处理没有耗时的请求', () => {
      const requestWithoutDuration = { ...mockRequest, durationMs: undefined };

      render(
        <RequestDetail
          request={requestWithoutDuration}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('应该处理没有状态的请求', () => {
      const requestWithoutStatus = { ...mockRequest, responseStatus: undefined };

      render(
        <RequestDetail
          request={requestWithoutStatus}
          isLoading={false}
          onClose={mockOnClose}
          onReplay={mockOnReplay}
        />,
      );

      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });
});

describe('DiffViewer', () => {
  it('应该显示无变化状态', () => {
    const sameData = { test: 'data' };

    render(<DiffViewer original={sameData} modified={sameData} />);

    expect(screen.getByText('无修改 - 请求未被规则改变')).toBeInTheDocument();
  });

  it('应该显示对比视图', () => {
    const original = { system: '原始' };
    const modified = { system: '修改后' };

    render(<DiffViewer original={original} modified={modified} />);

    expect(screen.getByText('左右对比视图')).toBeInTheDocument();
    expect(screen.getByText('对比')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });

  it('应该切换到JSON视图', async () => {
    const user = userEvent.setup();
    const original = { system: '原始' };
    const modified = { system: '修改后' };

    render(<DiffViewer original={original} modified={modified} />);

    const jsonButton = screen.getByText('JSON');
    await user.click(jsonButton);

    expect(screen.getByText('JSON 格式化视图')).toBeInTheDocument();
  });

  it('应该显示原始和修改后的内容', () => {
    const original = { system: '原始系统' };
    const modified = { system: '修改系统' };

    render(<DiffViewer original={original} modified={modified} />);

    expect(screen.getByText('原始请求')).toBeInTheDocument();
    expect(screen.getByText('修改后请求')).toBeInTheDocument();
  });

  it('应该正确处理不同数据类型', () => {
    const original = { a: 1, b: 'test', c: true };
    const modified = { a: 2, b: 'test', c: false };

    render(<DiffViewer original={original} modified={modified} />);

    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('应该正确处理嵌套对象', () => {
    const original = { nested: { value: '原始' } };
    const modified = { nested: { value: '修改' } };

    render(<DiffViewer original={original} modified={modified} />);

    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('应该正确处理数组', () => {
    const original = { items: [1, 2, 3] };
    const modified = { items: [1, 2, 4] };

    render(<DiffViewer original={original} modified={modified} />);

    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('应该正确处理空值', () => {
    const original = { value: null };
    const modified = { value: 'something' };

    render(<DiffViewer original={original} modified={modified} />);

    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('应该正确处理复杂JSON结构', () => {
    const original = {
      system: '你是一个助手',
      model: 'claude-3',
      messages: [{ role: 'user', content: '你好' }],
    };

    const modified = {
      system: '你是一个专业助手',
      model: 'claude-3',
      messages: [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好！' },
      ],
    };

    render(<DiffViewer original={original} modified={modified} />);

    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });
});
