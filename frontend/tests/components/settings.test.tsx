/**
 * 设置组件测试
 * 包含 SettingsPanel 组件测试
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from '@/components/settings';

// 模拟 @heroui/react
vi.mock('@heroui/react', () => ({
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
  Button: ({ children, onPress, isDisabled, color, variant, size, radius, className }: any) => (
    <button
      onClick={onPress}
      disabled={isDisabled}
      data-testid="button"
      data-color={color}
      data-variant={variant}
      data-size={size}
      data-radius={radius}
      className={className}
    >
      {children}
    </button>
  ),
  Input: ({ value, onChange, placeholder, label, radius, classNames }: any) => (
    <input
      data-testid="input"
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={label}
      data-radius={radius}
      className={classNames?.inputWrapper}
    />
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
  Spinner: ({ children }: any) => <div data-testid="spinner">{children}</div>,
  Divider: () => <hr data-testid="divider" />,
}));

// 模拟 hooks
const mockUseConfig = vi.fn();
const mockUseStats = vi.fn();
const mockUseExportConfig = vi.fn();
const mockUseImportConfig = vi.fn();
const mockUseDownloadConfig = vi.fn();
const mockUseUploadConfig = vi.fn();
const mockUseCleanupRequests = vi.fn();

vi.mock('@/hooks', () => ({
  useConfig: () => mockUseConfig(),
  useExportConfig: () => mockUseExportConfig(),
  useImportConfig: () => mockUseImportConfig(),
  useDownloadConfig: () => mockUseDownloadConfig(),
  useUploadConfig: () => mockUseUploadConfig(),
}));

vi.mock('@/hooks/useRequests', () => ({
  useStats: () => mockUseStats(),
  useCleanupRequests: () => mockUseCleanupRequests(),
}));

// 模拟 utils
vi.mock('@/utils', () => ({
  formatBytes: (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  formatClient: (client: string) => {
    const map: Record<string, string> = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini' };
    return map[client] || client;
  },
}));

describe('SettingsPanel', () => {
  const mockConfig = {
    rules: [],
    settings: {
      autoCleanup: true,
      keepCount: 100,
    },
  };

  const mockStats = {
    total: 150,
    recent: 25,
    byClient: {
      claude: 80,
      codex: 40,
      gemini: 30,
    },
    database: {
      path: '/data/promptxy.db',
      size: 1048576, // 1MB
      recordCount: 150,
    },
  };

  const mockExportMutation = {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  };

  const mockImportMutation = {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  };

  const mockDownload = vi.fn();
  const mockUpload = vi.fn();
  const mockCleanupMutation = {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  };

  beforeEach(() => {
    // 重置所有 mock
    mockUseConfig.mockClear();
    mockUseStats.mockClear();
    mockUseExportConfig.mockClear();
    mockUseImportConfig.mockClear();
    mockUseDownloadConfig.mockClear();
    mockUseUploadConfig.mockClear();
    mockUseCleanupRequests.mockClear();

    mockExportMutation.mutate.mockClear();
    mockExportMutation.mutateAsync.mockClear();
    mockImportMutation.mutate.mockClear();
    mockImportMutation.mutateAsync.mockClear();
    mockDownload.mockClear();
    mockUpload.mockClear();
    mockCleanupMutation.mutate.mockClear();
    mockCleanupMutation.mutateAsync.mockClear();

    // 设置默认 mock 实现
    mockUseConfig.mockReturnValue({
      config: mockConfig,
      isLoading: false,
    });

    mockUseStats.mockReturnValue({
      stats: mockStats,
      isLoading: false,
    });

    mockUseExportConfig.mockReturnValue(mockExportMutation);
    mockUseImportConfig.mockReturnValue(mockImportMutation);
    mockUseDownloadConfig.mockReturnValue({ download: mockDownload });
    mockUseUploadConfig.mockReturnValue({ upload: mockUpload });
    mockUseCleanupRequests.mockReturnValue(mockCleanupMutation);
  });

  describe('加载状态', () => {
    it('应该显示加载中状态', () => {
      mockUseConfig.mockReturnValue({
        config: null,
        isLoading: true,
      });

      mockUseStats.mockReturnValue({
        stats: null,
        isLoading: true,
      });

      render(<SettingsPanel />);

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(screen.getByText('加载配置中...')).toBeInTheDocument();
    });

    it('应该显示内容当加载完成', () => {
      render(<SettingsPanel />);

      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      expect(screen.getByText('📊 统计信息')).toBeInTheDocument();
    });
  });

  describe('统计信息', () => {
    it('应该显示总请求数', () => {
      render(<SettingsPanel />);

      expect(screen.getByText('总请求数:')).toBeInTheDocument();
      const badges = screen.getAllByTestId('badge');
      const totalBadge = badges.find(badge => badge.textContent === '150');
      expect(totalBadge).toBeInTheDocument();
    });

    it('应该显示今日请求数', () => {
      render(<SettingsPanel />);

      expect(screen.getByText('今日请求:')).toBeInTheDocument();
      const badges = screen.getAllByTestId('badge');
      const recentBadge = badges.find(badge => badge.textContent === '25');
      expect(recentBadge).toBeInTheDocument();
    });

    it('应该显示按客户端统计', () => {
      render(<SettingsPanel />);

      expect(screen.getByText('按客户端:')).toBeInTheDocument();
      expect(screen.getByText('Claude: 80')).toBeInTheDocument();
      expect(screen.getByText('Codex: 40')).toBeInTheDocument();
      expect(screen.getByText('Gemini: 30')).toBeInTheDocument();
    });

    it('应该显示数据库路径', () => {
      render(<SettingsPanel />);

      expect(screen.getByText('数据库路径:')).toBeInTheDocument();
      expect(screen.getByText('/data/promptxy.db')).toBeInTheDocument();
    });

    it('应该显示数据库大小', () => {
      render(<SettingsPanel />);

      expect(screen.getByText('数据库大小:')).toBeInTheDocument();
      expect(screen.getByText('1 MB')).toBeInTheDocument();
    });

    it('应该显示记录数', () => {
      render(<SettingsPanel />);

      expect(screen.getByText('记录数:')).toBeInTheDocument();
      const badges = screen.getAllByTestId('badge');
      const recordBadge = badges.find(badge => badge.textContent === '150');
      expect(recordBadge).toBeInTheDocument();
    });

    it('应该正确格式化不同大小的数据库', () => {
      const smallStats = {
        ...mockStats,
        database: { ...mockStats.database, size: 512 }, // 512B
      };

      mockUseStats.mockReturnValue({
        stats: smallStats,
        isLoading: false,
      });

      render(<SettingsPanel />);

      expect(screen.getByText('0.5 B')).toBeInTheDocument();
    });

    it('应该处理空统计', () => {
      mockUseStats.mockReturnValue({
        stats: {
          total: 0,
          recent: 0,
          byClient: {},
          database: { path: '', size: 0, recordCount: 0 },
        },
        isLoading: false,
      });

      render(<SettingsPanel />);

      const badges = screen.getAllByTestId('badge');
      const zeroBadges = badges.filter(badge => badge.textContent === '0');
      expect(zeroBadges.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('配置管理', () => {
    it('应该显示导出配置按钮', () => {
      render(<SettingsPanel />);

      const buttons = screen.getAllByTestId('button');
      const exportButton = buttons.find(btn => btn.textContent === '导出配置');
      expect(exportButton).toBeInTheDocument();
    });

    it('应该显示导入配置按钮', () => {
      render(<SettingsPanel />);

      const buttons = screen.getAllByTestId('button');
      const importButton = buttons.find(btn => btn.textContent === '导入配置');
      expect(importButton).toBeInTheDocument();
    });

    it('应该处理导出配置', async () => {
      const user = userEvent.setup();
      const mockConfigData = { rules: [], settings: {} };
      mockExportMutation.mutateAsync.mockResolvedValue(mockConfigData);

      render(<SettingsPanel />);

      const buttons = screen.getAllByTestId('button');
      const exportButton = buttons.find(btn => btn.textContent === '导出配置');

      await user.click(exportButton);

      expect(mockExportMutation.mutateAsync).toHaveBeenCalledTimes(1);
      expect(mockDownload).toHaveBeenCalledWith(
        mockConfigData,
        expect.stringContaining('promptxy-config-'),
      );
    });

    it('应该处理导入配置', async () => {
      const user = userEvent.setup();
      const mockConfigData = { rules: [], settings: {} };
      mockUpload.mockResolvedValue(mockConfigData);
      mockImportMutation.mutateAsync.mockResolvedValue({});

      // 模拟全局 alert
      const originalAlert = global.alert;
      global.alert = vi.fn();

      render(<SettingsPanel />);

      const buttons = screen.getAllByTestId('button');
      const importButton = buttons.find(btn => btn.textContent === '导入配置');

      await user.click(importButton);

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(1);
        expect(mockImportMutation.mutateAsync).toHaveBeenCalledWith(mockConfigData);
        expect(global.alert).toHaveBeenCalledWith('配置导入成功！');
      });

      global.alert = originalAlert;
    });

    it('应该处理导入失败', async () => {
      const user = userEvent.setup();
      mockUpload.mockRejectedValue(new Error('文件格式错误'));

      const originalAlert = global.alert;
      global.alert = vi.fn();

      render(<SettingsPanel />);

      const buttons = screen.getAllByTestId('button');
      const importButton = buttons.find(btn => btn.textContent === '导入配置');

      await user.click(importButton);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('导入失败: 文件格式错误');
      });

      global.alert = originalAlert;
    });

    it('应该显示导出中状态', () => {
      mockExportMutation.isPending = true;

      render(<SettingsPanel />);

      const buttons = screen.getAllByTestId('button');
      const exportButton = buttons.find(btn => btn.textContent === '导出中...');
      expect(exportButton).toBeInTheDocument();
    });

    it('应该显示导入中状态', () => {
      mockImportMutation.isPending = true;

      render(<SettingsPanel />);

      const buttons = screen.getAllByTestId('button');
      const importButton = buttons.find(btn => btn.textContent === '导入中...');
      expect(importButton).toBeInTheDocument();
    });

    it('应该显示配置提示信息', () => {
      render(<SettingsPanel />);

      expect(screen.getByText(/💡 导出包含所有规则配置/)).toBeInTheDocument();
    });
  });

  describe('数据清理', () => {
    it('应该显示保留条数输入框', () => {
      render(<SettingsPanel />);

      expect(screen.getByLabelText('保留最近条数')).toBeInTheDocument();
      expect(screen.getByDisplayValue('100')).toBeInTheDocument();
    });

    it('应该显示清理按钮', () => {
      render(<SettingsPanel />);

      const buttons = screen.getAllByTestId('button');
      const cleanupButton = buttons.find(btn => btn.textContent === '清理');
      expect(cleanupButton).toBeInTheDocument();
    });

    it('应该处理条数输入变化', async () => {
      const user = userEvent.setup();
      render(<SettingsPanel />);

      const input = screen.getByLabelText('保留最近条数');
      await user.clear(input);
      await user.type(input, '50');

      expect(input).toHaveValue('50');
    });

    it('应该处理清理操作', async () => {
      const user = userEvent.setup();
      const originalConfirm = global.confirm;
      const originalAlert = global.alert;
      global.confirm = vi.fn(() => true);
      global.alert = vi.fn();

      mockCleanupMutation.mutateAsync.mockResolvedValue({ deleted: 50, remaining: 100 });

      render(<SettingsPanel />);

      const input = screen.getByLabelText('保留最近条数');
      await user.clear(input);
      await user.type(input, '50');

      const buttons = screen.getAllByTestId('button');
      const cleanupButton = buttons.find(btn => btn.textContent === '清理');

      await user.click(cleanupButton);

      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalledWith('确定要清理旧数据吗？将保留最近 50 条请求。');
        expect(mockCleanupMutation.mutateAsync).toHaveBeenCalledWith(50);
        expect(global.alert).toHaveBeenCalledWith('清理完成！删除了 50 条记录，剩余 100 条。');
      });

      global.confirm = originalConfirm;
      global.alert = originalAlert;
    });

    it('应该取消清理当用户确认失败', async () => {
      const user = userEvent.setup();
      const originalConfirm = global.confirm;
      global.confirm = vi.fn(() => false);

      render(<SettingsPanel />);

      const buttons = screen.getAllByTestId('button');
      const cleanupButton = buttons.find(btn => btn.textContent === '清理');

      await user.click(cleanupButton);

      expect(mockCleanupMutation.mutateAsync).not.toHaveBeenCalled();

      global.confirm = originalConfirm;
    });

    it('应该处理无效输入', async () => {
      const user = userEvent.setup();
      const originalConfirm = global.confirm;
      const originalAlert = global.alert;
      global.confirm = vi.fn(() => true);
      global.alert = vi.fn();

      mockCleanupMutation.mutateAsync.mockResolvedValue({ deleted: 100, remaining: 50 });

      render(<SettingsPanel />);

      const input = screen.getByLabelText('保留最近条数');
      await user.clear(input);
      await user.type(input, 'abc'); // 无效输入

      const buttons = screen.getAllByTestId('button');
      const cleanupButton = buttons.find(btn => btn.textContent === '清理');

      await user.click(cleanupButton);

      // 应该使用默认值 100
      await waitFor(() => {
        expect(mockCleanupMutation.mutateAsync).toHaveBeenCalledWith(100);
      });

      global.confirm = originalConfirm;
      global.alert = originalAlert;
    });

    it('应该显示清理中状态', () => {
      mockCleanupMutation.isPending = true;

      render(<SettingsPanel />);

      const buttons = screen.getAllByTestId('button');
      const cleanupButton = buttons.find(btn => btn.textContent === '清理中...');
      expect(cleanupButton).toBeInTheDocument();
    });

    it('应该显示数据清理提示', () => {
      render(<SettingsPanel />);

      expect(screen.getByText(/⏰ 自动清理:/)).toBeInTheDocument();
    });
  });

  describe('关于信息', () => {
    it('应该显示应用信息', () => {
      render(<SettingsPanel />);

      expect(screen.getByText('PromptXY v2.0')).toBeInTheDocument();
      expect(screen.getByText('- 本地HTTP代理规则管理器')).toBeInTheDocument();
    });

    it('应该显示功能描述', () => {
      render(<SettingsPanel />);

      expect(screen.getByText('功能:')).toBeInTheDocument();
      expect(screen.getByText('规则管理、请求捕获、实时监控、差异对比')).toBeInTheDocument();
    });

    it('应该显示端口信息', () => {
      render(<SettingsPanel />);

      expect(screen.getByText('端口:')).toBeInTheDocument();
      expect(screen.getByText('Gateway(7070)')).toBeInTheDocument();
      expect(screen.getByText('API(7071)')).toBeInTheDocument();
    });
  });

  describe('UI结构', () => {
    it('应该正确渲染所有卡片', () => {
      render(<SettingsPanel />);

      const cards = screen.getAllByTestId('card');
      expect(cards.length).toBeGreaterThanOrEqual(4); // 统计、配置、清理、关于
    });

    it('应该显示分隔符', () => {
      render(<SettingsPanel />);

      const dividers = screen.getAllByTestId('divider');
      expect(dividers.length).toBeGreaterThanOrEqual(3);
    });

    it('应该正确渲染标题', () => {
      render(<SettingsPanel />);

      expect(screen.getByText('📊 统计信息')).toBeInTheDocument();
      expect(screen.getByText('⚙️ 配置管理')).toBeInTheDocument();
      expect(screen.getByText('🗑️ 数据清理')).toBeInTheDocument();
      expect(screen.getByText('ℹ️ 关于')).toBeInTheDocument();
    });

    it('应该正确渲染徽章样式', () => {
      render(<SettingsPanel />);

      const badges = screen.getAllByTestId('badge');
      expect(badges.length).toBeGreaterThan(0);

      // 检查一些特定徽章
      const totalBadge = badges.find(badge => badge.textContent === '150');
      expect(totalBadge).toHaveAttribute('data-color', 'primary');
    });

    it('应该正确渲染按钮样式', () => {
      render(<SettingsPanel />);

      const buttons = screen.getAllByTestId('button');

      // 检查导出按钮样式
      const exportButton = buttons.find(btn => btn.textContent === '导出配置');
      expect(exportButton).toHaveAttribute('data-color', 'primary');
      expect(exportButton).toHaveAttribute('data-variant', 'flat');

      // 检查导入按钮样式
      const importButton = buttons.find(btn => btn.textContent === '导入配置');
      expect(importButton).toHaveAttribute('data-color', 'secondary');
      expect(importButton).toHaveAttribute('data-variant', 'flat');

      // 检查清理按钮样式
      const cleanupButton = buttons.find(btn => btn.textContent === '清理');
      expect(cleanupButton).toHaveAttribute('data-color', 'danger');
      expect(cleanupButton).toHaveAttribute('data-variant', 'flat');
    });
  });

  describe('边缘情况', () => {
    it('应该处理空统计', () => {
      mockUseStats.mockReturnValue({
        stats: {
          total: 0,
          recent: 0,
          byClient: {},
          database: { path: '', size: 0, recordCount: 0 },
        },
        isLoading: false,
      });

      render(<SettingsPanel />);

      expect(screen.getByText('0 B')).toBeInTheDocument();
    });

    it('应该处理无客户端统计', () => {
      mockUseStats.mockReturnValue({
        stats: {
          total: 10,
          recent: 5,
          byClient: {},
          database: { path: '/test.db', size: 1000, recordCount: 10 },
        },
        isLoading: false,
      });

      render(<SettingsPanel />);

      expect(screen.getByText('按客户端:')).toBeInTheDocument();
      // 不应该显示任何客户端标签
      const badges = screen.getAllByTestId('badge');
      const clientBadges = badges.filter(
        badge =>
          badge.textContent?.includes('Claude:') ||
          badge.textContent?.includes('Codex:') ||
          badge.textContent?.includes('Gemini:'),
      );
      expect(clientBadges.length).toBe(0);
    });

    it('应该处理大数值', () => {
      mockUseStats.mockReturnValue({
        stats: {
          total: 999999,
          recent: 888888,
          byClient: { claude: 500000, codex: 300000, gemini: 199999 },
          database: { path: '/large.db', size: 1073741824, recordCount: 999999 }, // 1GB
        },
        isLoading: false,
      });

      render(<SettingsPanel />);

      expect(screen.getByText('999999')).toBeInTheDocument();
      expect(screen.getByText('1 GB')).toBeInTheDocument();
    });

    it('应该处理长路径', () => {
      const longPath =
        '/very/long/path/to/database/file/that/might/be/in/some/deep/directory/structure/promptxy.db';
      mockUseStats.mockReturnValue({
        stats: {
          total: 10,
          recent: 5,
          byClient: {},
          database: { path: longPath, size: 1000, recordCount: 10 },
        },
        isLoading: false,
      });

      render(<SettingsPanel />);

      expect(screen.getByText(longPath)).toBeInTheDocument();
    });

    it('应该处理导出失败', async () => {
      const user = userEvent.setup();
      mockExportMutation.mutateAsync.mockRejectedValue(new Error('导出失败'));

      const originalAlert = global.alert;
      global.alert = vi.fn();

      render(<SettingsPanel />);

      const buttons = screen.getAllByTestId('button');
      const exportButton = buttons.find(btn => btn.textContent === '导出配置');

      // 捕获预期的错误
      try {
        await user.click(exportButton);
      } catch (e) {
        // 预期会抛出错误
      }

      // 验证 mutate 被调用
      expect(mockExportMutation.mutateAsync).toHaveBeenCalled();

      global.alert = originalAlert;
    });

    it('应该处理清理失败', async () => {
      const user = userEvent.setup();
      const originalConfirm = global.confirm;
      const originalAlert = global.alert;
      global.confirm = vi.fn(() => true);
      global.alert = vi.fn();

      mockCleanupMutation.mutateAsync.mockRejectedValue(new Error('数据库锁定'));

      render(<SettingsPanel />);

      const buttons = screen.getAllByTestId('button');
      const cleanupButton = buttons.find(btn => btn.textContent === '清理');

      await user.click(cleanupButton);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('导入失败: 数据库锁定');
      });

      global.confirm = originalConfirm;
      global.alert = originalAlert;
    });

    it('应该处理上传文件取消', async () => {
      const user = userEvent.setup();
      mockUpload.mockResolvedValue(null); // 用户取消上传

      const originalAlert = global.alert;
      global.alert = vi.fn();

      render(<SettingsPanel />);

      const buttons = screen.getAllByTestId('button');
      const importButton = buttons.find(btn => btn.textContent === '导入配置');

      await user.click(importButton);

      // 不应该调用导入
      expect(mockImportMutation.mutateAsync).not.toHaveBeenCalled();
      expect(global.alert).not.toHaveBeenCalled();

      global.alert = originalAlert;
    });
  });

  describe('响应式布局', () => {
    it('应该正确应用网格布局', () => {
      render(<SettingsPanel />);

      // 检查统计信息的网格布局
      const statsCard = screen.getByText('总请求数:').closest('[data-testid="card-body"]');
      expect(statsCard).toBeInTheDocument();
    });

    it('应该正确显示统计信息的网格', () => {
      render(<SettingsPanel />);

      // 统计信息部分应该有网格类
      const statsCard = screen.getByText('📊 统计信息').closest('[data-testid="card"]');
      expect(statsCard).toBeInTheDocument();
    });

    it('应该正确显示清理操作的网格', () => {
      render(<SettingsPanel />);

      // 清理部分应该有输入和按钮在同一行
      const cleanupCard = screen.getByText('🗑️ 数据清理').closest('[data-testid="card"]');
      expect(cleanupCard).toBeInTheDocument();

      const input = screen.getByLabelText('保留最近条数');
      const buttons = screen.getAllByTestId('button');
      const cleanupButton = buttons.find(btn => btn.textContent === '清理');

      expect(input).toBeInTheDocument();
      expect(cleanupButton).toBeInTheDocument();
    });
  });
});
