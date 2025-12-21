/**
 * 布局组件测试
 * 包含 Header, Sidebar 组件测试
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header, Sidebar } from '@/components/layout';

// 模拟 store
const mockUseUIStore = vi.fn();
vi.mock('@/store', () => ({
  useUIStore: (selector: any) => mockUseUIStore(selector),
}));

// 模拟 StatusIndicator
vi.mock('@/components/common', () => ({
  StatusIndicator: ({ connected, error, showText }: any) => (
    <div
      data-testid="status-indicator"
      data-connected={connected}
      data-error={error}
      data-show-text={showText}
    >
      {connected ? '🟢' : '🔴'} {showText && (error || '状态')}
    </div>
  ),
}));

// 模拟 @heroui/react
vi.mock('@heroui/react', () => ({
  Navbar: ({ children, isBordered }: any) => (
    <nav data-testid="navbar" data-bordered={isBordered}>
      {children}
    </nav>
  ),
  NavbarBrand: ({ children }: any) => <div data-testid="navbar-brand">{children}</div>,
  NavbarContent: ({ children, justify }: any) => (
    <div data-testid="navbar-content" data-justify={justify}>
      {children}
    </div>
  ),
  NavbarItem: ({ children }: any) => <div data-testid="navbar-item">{children}</div>,
  Button: ({
    children,
    onPress,
    isIconOnly,
    variant,
    color,
    size,
    'aria-label': ariaLabel,
  }: any) => (
    <button
      onClick={onPress}
      data-testid="button"
      data-icon-only={isIconOnly}
      data-variant={variant}
      data-color={color}
      data-size={size}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  ),
  Chip: ({ children, color, variant, size }: any) => (
    <span data-testid="chip" data-color={color} data-variant={variant} data-size={size}>
      {children}
    </span>
  ),
  Spacer: ({ x, y }: any) => <div data-testid="spacer" data-x={x} data-y={y}></div>,
  Card: ({ children, isPressable, style, className }: any) => (
    <div data-testid="card" data-pressable={isPressable} style={style} className={className}>
      {children}
    </div>
  ),
  Badge: ({ children, color, variant, size }: any) => (
    <span data-testid="badge" data-color={color} data-variant={variant} data-size={size}>
      {children}
    </span>
  ),
  Divider: () => <hr data-testid="divider" />,
}));

describe('Header', () => {
  const mockOnToggleSidebar = vi.fn();

  beforeEach(() => {
    mockOnToggleSidebar.mockClear();
    mockUseUIStore.mockClear();
  });

  it('应该正确渲染导航栏', () => {
    mockUseUIStore.mockImplementation(selector => selector({ activeTab: 'rules' }));

    render(
      <Header onToggleSidebar={mockOnToggleSidebar} sseConnected={true} apiConnected={true} />,
    );

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('navbar-brand')).toBeInTheDocument();
  });

  it('应该显示应用名称和版本', () => {
    mockUseUIStore.mockImplementation(selector => selector({ activeTab: 'rules' }));

    render(
      <Header onToggleSidebar={mockOnToggleSidebar} sseConnected={true} apiConnected={true} />,
    );

    expect(screen.getByText('PromptXY')).toBeInTheDocument();
    expect(screen.getByText('v2.0')).toBeInTheDocument();
  });

  it('应该显示当前活动标签的翻译', () => {
    const testCases = [
      { tab: 'rules', expected: '📋 规则管理' },
      { tab: 'requests', expected: '📡 请求监控' },
      { tab: 'preview', expected: '🧪 预览测试' },
      { tab: 'settings', expected: '⚙️ 设置' },
    ];

    testCases.forEach(({ tab, expected }) => {
      mockUseUIStore.mockImplementation(selector => selector({ activeTab: tab }));

      render(
        <Header onToggleSidebar={mockOnToggleSidebar} sseConnected={true} apiConnected={true} />,
      );

      expect(screen.getByText(expected)).toBeInTheDocument();
    });
  });

  it('应该触发侧边栏切换按钮', async () => {
    const user = userEvent.setup();
    mockUseUIStore.mockImplementation(selector => selector({ activeTab: 'rules' }));

    render(
      <Header onToggleSidebar={mockOnToggleSidebar} sseConnected={true} apiConnected={true} />,
    );

    const menuButton = screen.getByRole('button', { name: '菜单' });
    await user.click(menuButton);

    expect(mockOnToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it('应该显示两个状态指示器', () => {
    mockUseUIStore.mockImplementation(selector => selector({ activeTab: 'rules' }));

    render(
      <Header onToggleSidebar={mockOnToggleSidebar} sseConnected={true} apiConnected={true} />,
    );

    const indicators = screen.getAllByTestId('status-indicator');
    expect(indicators).toHaveLength(2);
  });

  it('应该正确传递 API 连接状态', () => {
    mockUseUIStore.mockImplementation(selector => selector({ activeTab: 'rules' }));

    render(
      <Header onToggleSidebar={mockOnToggleSidebar} sseConnected={false} apiConnected={true} />,
    );

    const indicators = screen.getAllByTestId('status-indicator');
    // API 指示器应该显示已连接
    expect(indicators[0]).toHaveAttribute('data-connected', 'true');
    // SSE 指示器应该显示未连接
    expect(indicators[1]).toHaveAttribute('data-connected', 'false');
  });

  it('应该正确传递 SSE 连接状态', () => {
    mockUseUIStore.mockImplementation(selector => selector({ activeTab: 'preview' }));

    render(
      <Header onToggleSidebar={mockOnToggleSidebar} sseConnected={true} apiConnected={false} />,
    );

    const indicators = screen.getAllByTestId('status-indicator');
    // API 指示器应该显示未连接
    expect(indicators[0]).toHaveAttribute('data-connected', 'false');
    // SSE 指示器应该显示已连接
    expect(indicators[1]).toHaveAttribute('data-connected', 'true');
  });

  it('应该隐藏状态指示器文本', () => {
    mockUseUIStore.mockImplementation(selector => selector({ activeTab: 'rules' }));

    render(
      <Header onToggleSidebar={mockOnToggleSidebar} sseConnected={true} apiConnected={true} />,
    );

    const indicators = screen.getAllByTestId('status-indicator');
    indicators.forEach(indicator => {
      expect(indicator).toHaveAttribute('data-show-text', 'false');
    });
  });

  it('应该正确渲染导航栏内容', () => {
    mockUseUIStore.mockImplementation(selector => selector({ activeTab: 'requests' }));

    render(
      <Header onToggleSidebar={mockOnToggleSidebar} sseConnected={true} apiConnected={true} />,
    );

    // 检查导航栏内容
    const navbarContents = screen.getAllByTestId('navbar-content');
    expect(navbarContents.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Sidebar', () => {
  const mockOnClose = vi.fn();
  const mockSetActiveTab = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockSetActiveTab.mockClear();
    mockUseUIStore.mockClear();
  });

  describe('展开状态', () => {
    it('应该正确渲染展开的侧边栏', () => {
      mockUseUIStore.mockImplementation(selector => {
        if (selector.name === 'activeTab') return 'rules';
        if (selector.name === 'setActiveTab') return mockSetActiveTab;
        return selector({ activeTab: 'rules', setActiveTab: mockSetActiveTab });
      });

      render(<Sidebar collapsed={false} onClose={mockOnClose} />);

      expect(screen.getByText('导航菜单')).toBeInTheDocument();
      expect(screen.getByText('规则管理')).toBeInTheDocument();
      expect(screen.getByText('请求监控')).toBeInTheDocument();
      expect(screen.getByText('预览测试')).toBeInTheDocument();
      expect(screen.getByText('设置')).toBeInTheDocument();
    });

    it('应该显示所有菜单项', () => {
      mockUseUIStore.mockImplementation(selector => {
        if (selector.name === 'activeTab') return 'rules';
        if (selector.name === 'setActiveTab') return mockSetActiveTab;
        return selector({ activeTab: 'rules', setActiveTab: mockSetActiveTab });
      });

      render(<Sidebar collapsed={false} onClose={mockOnClose} />);

      const menuItems = [
        { icon: '📋', label: '规则管理', desc: '创建和管理修改规则' },
        { icon: '📡', label: '请求监控', desc: '查看实时请求历史' },
        { icon: '🧪', label: '预览测试', desc: '测试规则效果' },
        { icon: '⚙️', label: '设置', desc: '配置和数据管理' },
      ];

      menuItems.forEach(item => {
        expect(screen.getByText(item.icon)).toBeInTheDocument();
        expect(screen.getByText(item.label)).toBeInTheDocument();
        expect(screen.getByText(item.desc)).toBeInTheDocument();
      });
    });

    it('应该正确标记当前活动菜单项', () => {
      mockUseUIStore.mockImplementation(selector => {
        if (selector.name === 'activeTab') return 'requests';
        if (selector.name === 'setActiveTab') return mockSetActiveTab;
        return selector({ activeTab: 'requests', setActiveTab: mockSetActiveTab });
      });

      render(<Sidebar collapsed={false} onClose={mockOnClose} />);

      // 检查当前项的标记
      const badges = screen.getAllByTestId('badge');
      expect(badges.length).toBeGreaterThan(0);
      expect(badges.some(badge => badge.textContent === '当前')).toBe(true);
    });

    it('应该显示提示信息', () => {
      mockUseUIStore.mockImplementation(selector => {
        if (selector.name === 'activeTab') return 'rules';
        if (selector.name === 'setActiveTab') return mockSetActiveTab;
        return selector({ activeTab: 'rules', setActiveTab: mockSetActiveTab });
      });

      render(<Sidebar collapsed={false} onClose={mockOnClose} />);

      expect(screen.getByText(/提示: 请确保后端服务正在运行/)).toBeInTheDocument();
    });

    it('应该处理菜单项点击', async () => {
      const user = userEvent.setup();
      mockUseUIStore.mockImplementation(selector => {
        if (selector.name === 'activeTab') return 'rules';
        if (selector.name === 'setActiveTab') return mockSetActiveTab;
        return selector({ activeTab: 'rules', setActiveTab: mockSetActiveTab });
      });

      render(<Sidebar collapsed={false} onClose={mockOnClose} />);

      // 点击预览测试菜单项
      const previewCards = screen.getAllByTestId('card');
      const previewCard = previewCards.find(card => card.textContent?.includes('预览测试'));

      if (previewCard) {
        fireEvent.click(previewCard);
        expect(mockSetActiveTab).toHaveBeenCalledWith('preview');
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('折叠状态', () => {
    it('应该正确渲染折叠的侧边栏', () => {
      mockUseUIStore.mockImplementation(selector => {
        if (selector.name === 'activeTab') return 'rules';
        if (selector.name === 'setActiveTab') return mockSetActiveTab;
        return selector({ activeTab: 'rules', setActiveTab: mockSetActiveTab });
      });

      render(<Sidebar collapsed={true} onClose={mockOnClose} />);

      // 折叠状态下只显示图标按钮
      const iconButtons = screen.getAllByTestId('button');
      expect(iconButtons.length).toBe(4); // 4个菜单项
      expect(iconButtons.every(btn => btn.getAttribute('data-icon-only') === 'true')).toBe(true);
    });

    it('应该只显示图标，不显示文本', () => {
      mockUseUIStore.mockImplementation(selector => {
        if (selector.name === 'activeTab') return 'rules';
        if (selector.name === 'setActiveTab') return mockSetActiveTab;
        return selector({ activeTab: 'rules', setActiveTab: mockSetActiveTab });
      });

      render(<Sidebar collapsed={true} onClose={mockOnClose} />);

      // 折叠状态下不应该显示完整文本
      expect(screen.queryByText('规则管理')).not.toBeInTheDocument();
      expect(screen.queryByText('请求监控')).not.toBeInTheDocument();

      // 但应该显示图标
      expect(screen.getByText('📋')).toBeInTheDocument();
      expect(screen.getByText('📡')).toBeInTheDocument();
      expect(screen.getByText('🧪')).toBeInTheDocument();
      expect(screen.getByText('⚙️')).toBeInTheDocument();
    });

    it('应该处理折叠菜单项点击', async () => {
      const user = userEvent.setup();
      mockUseUIStore.mockImplementation(selector => {
        if (selector.name === 'activeTab') return 'rules';
        if (selector.name === 'setActiveTab') return mockSetActiveTab;
        return selector({ activeTab: 'rules', setActiveTab: mockSetActiveTab });
      });

      render(<Sidebar collapsed={true} onClose={mockOnClose} />);

      const buttons = screen.getAllByTestId('button');
      // 找到设置按钮（第4个）
      const settingsButton = buttons[3];

      fireEvent.click(settingsButton);
      expect(mockSetActiveTab).toHaveBeenCalledWith('settings');
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('应该正确标记折叠状态下的活动项', () => {
      mockUseUIStore.mockImplementation(selector => {
        if (selector.name === 'activeTab') return 'preview';
        if (selector.name === 'setActiveTab') return mockSetActiveTab;
        return selector({ activeTab: 'preview', setActiveTab: mockSetActiveTab });
      });

      render(<Sidebar collapsed={true} onClose={mockOnClose} />);

      const buttons = screen.getAllByTestId('button');
      // 预览是第3个按钮
      const previewButton = buttons[2];

      expect(previewButton).toHaveAttribute('data-variant', 'flat');
      expect(previewButton).toHaveAttribute('data-color', 'primary');
    });
  });

  describe('状态切换', () => {
    it('应该正确处理状态变化', () => {
      const { rerender } = render(<Sidebar collapsed={false} onClose={mockOnClose} />);

      mockUseUIStore.mockImplementation(selector => {
        if (selector.name === 'activeTab') return 'rules';
        if (selector.name === 'setActiveTab') return mockSetActiveTab;
        return selector({ activeTab: 'rules', setActiveTab: mockSetActiveTab });
      });

      // 切换到折叠状态
      rerender(<Sidebar collapsed={true} onClose={mockOnClose} />);

      // 应该显示图标按钮而不是卡片
      const buttons = screen.getAllByTestId('button');
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons[0]).toHaveAttribute('data-icon-only', 'true');
    });
  });

  describe('边缘情况', () => {
    it('应该处理未知的活动标签', () => {
      mockUseUIStore.mockImplementation(selector => {
        if (selector.name === 'activeTab') return 'unknown-tab';
        if (selector.name === 'setActiveTab') return mockSetActiveTab;
        return selector({ activeTab: 'unknown-tab', setActiveTab: mockSetActiveTab });
      });

      render(<Sidebar collapsed={false} onClose={mockOnClose} />);

      // 应该仍然渲染所有菜单项
      expect(screen.getByText('规则管理')).toBeInTheDocument();
    });

    it('应该处理空的活动标签', () => {
      mockUseUIStore.mockImplementation(selector => {
        if (selector.name === 'activeTab') return '';
        if (selector.name === 'setActiveTab') return mockSetActiveTab;
        return selector({ activeTab: '', setActiveTab: mockSetActiveTab });
      });

      render(<Sidebar collapsed={false} onClose={mockOnClose} />);

      // 应该渲染但没有活动标记
      expect(screen.getByText('导航菜单')).toBeInTheDocument();
    });
  });
});
