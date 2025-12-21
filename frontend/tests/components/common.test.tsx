/**
 * 通用组件测试
 * 包含 StatusIndicator, Modal, EmptyState 组件测试
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusIndicator, Modal, EmptyState } from '@/components/common';

// 模拟 @heroui/react
vi.mock('@heroui/react', () => ({
  Chip: ({ children, color, size, variant }: any) => (
    <div data-testid="chip" data-color={color} data-size={size} data-variant={variant}>
      {children}
    </div>
  ),
  Modal: ({ isOpen, children, size, backdrop }: any) =>
    isOpen ? (
      <div data-testid="modal" data-size={size} data-backdrop={backdrop}>
        {children}
      </div>
    ) : null,
  ModalContent: ({ children }: any) => {
    // Handle render prop pattern used in actual Modal component
    if (typeof children === 'function') {
      return <div data-testid="modal-content">{children(() => {})}</div>;
    }
    return <div data-testid="modal-content">{children}</div>;
  },
  ModalHeader: ({ children }: any) => <div data-testid="modal-header">{children}</div>,
  ModalBody: ({ children }: any) => <div data-testid="modal-body">{children}</div>,
  ModalFooter: ({ children }: any) => <div data-testid="modal-footer">{children}</div>,
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
}));

describe('StatusIndicator', () => {
  it('应该正确显示已连接状态', () => {
    render(<StatusIndicator connected={true} lastEvent={Date.now()} showText={true} />);

    expect(screen.getByText('🟢')).toBeInTheDocument();
    expect(screen.getByText('已连接')).toBeInTheDocument();
    const chip = screen.getByTestId('chip');
    expect(chip).toHaveAttribute('data-color', 'success');
  });

  it('应该正确显示未连接状态', () => {
    render(<StatusIndicator connected={false} lastEvent={null} showText={true} />);

    expect(screen.getByText('🟡')).toBeInTheDocument();
    expect(screen.getByText('未连接')).toBeInTheDocument();
    const chip = screen.getByTestId('chip');
    expect(chip).toHaveAttribute('data-color', 'warning');
  });

  it('应该正确显示错误状态', () => {
    render(
      <StatusIndicator connected={false} lastEvent={null} error="API未连接" showText={true} />,
    );

    expect(screen.getByText('🔴')).toBeInTheDocument();
    expect(screen.getByText('错误')).toBeInTheDocument();
    expect(screen.getByText('API未连接')).toBeInTheDocument();
    const chip = screen.getByTestId('chip');
    expect(chip).toHaveAttribute('data-color', 'danger');
  });

  it('应该支持隐藏文本', () => {
    render(<StatusIndicator connected={true} lastEvent={Date.now()} showText={false} />);

    expect(screen.getByText('🟢')).toBeInTheDocument();
    expect(screen.queryByText('已连接')).not.toBeInTheDocument();
  });

  it('应该只显示错误信息当有错误时', () => {
    const { rerender } = render(
      <StatusIndicator connected={true} lastEvent={Date.now()} error={null} showText={true} />,
    );
    expect(screen.queryByText(/错误|未连接/)).not.toBeInTheDocument();

    rerender(
      <StatusIndicator connected={true} lastEvent={Date.now()} error="测试错误" showText={true} />,
    );
    expect(screen.getByText('测试错误')).toBeInTheDocument();
  });
});

describe('Modal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('应该正确渲染打开的模态框', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="测试标题">
        <div>测试内容</div>
      </Modal>,
    );

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-header')).toHaveTextContent('测试标题');
    expect(screen.getByTestId('modal-body')).toHaveTextContent('测试内容');
  });

  it('应该不渲染关闭的模态框', () => {
    render(
      <Modal isOpen={false} onClose={mockOnClose} title="测试标题">
        <div>测试内容</div>
      </Modal>,
    );

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('应该渲染自定义页脚', () => {
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="测试标题"
        footer={<button data-testid="custom-footer">自定义按钮</button>}
      >
        <div>测试内容</div>
      </Modal>,
    );

    expect(screen.getByTestId('modal-footer')).toBeInTheDocument();
    expect(screen.getByTestId('custom-footer')).toBeInTheDocument();
  });

  it('应该支持不同尺寸', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={mockOnClose} title="测试" size="sm">
        <div>内容</div>
      </Modal>,
    );
    // HeroUI Modal 组件会处理尺寸，我们验证 props 传递
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  it('应该支持不同背景', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={mockOnClose} title="测试" backdrop="blur">
        <div>内容</div>
      </Modal>,
    );
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  it('应该渲染多个子元素', () => {
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="测试">
        <div>第一部分</div>
        <div>第二部分</div>
        <span>第三部分</span>
      </Modal>,
    );

    const body = screen.getByTestId('modal-body');
    expect(body).toHaveTextContent('第一部分');
    expect(body).toHaveTextContent('第二部分');
    expect(body).toHaveTextContent('第三部分');
  });
});

describe('EmptyState', () => {
  const mockOnAction = vi.fn();

  beforeEach(() => {
    mockOnAction.mockClear();
  });

  it('应该正确渲染基本的空状态', () => {
    render(<EmptyState title="暂无数据" description="开始创建你的第一条规则" />);

    expect(screen.getByText('📭')).toBeInTheDocument();
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
    expect(screen.getByText('开始创建你的第一条规则')).toBeInTheDocument();
  });

  it('应该支持自定义图标', () => {
    render(<EmptyState icon="🚀" title="自定义图标" description="使用自定义图标" />);

    expect(screen.getByText('🚀')).toBeInTheDocument();
  });

  it('应该渲染操作按钮当提供 actionText 和 onAction', () => {
    render(
      <EmptyState
        title="暂无数据"
        description="开始创建"
        actionText="立即创建"
        onAction={mockOnAction}
      />,
    );

    const button = screen.getByRole('button', { name: '立即创建' });
    expect(button).toBeInTheDocument();
  });

  it('应该不渲染按钮当没有提供 actionText', () => {
    render(<EmptyState title="暂无数据" description="开始创建" onAction={mockOnAction} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('应该不渲染按钮当没有提供 onAction', () => {
    render(<EmptyState title="暂无数据" description="开始创建" actionText="立即创建" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('应该触发 onAction 点击事件', async () => {
    const user = userEvent.setup();

    render(
      <EmptyState
        title="暂无数据"
        description="开始创建"
        actionText="立即创建"
        onAction={mockOnAction}
      />,
    );

    const button = screen.getByRole('button', { name: '立即创建' });
    await user.click(button);

    expect(mockOnAction).toHaveBeenCalledTimes(1);
  });

  it('应该正确应用样式类名', () => {
    render(
      <EmptyState
        title="测试标题"
        description="测试描述"
        actionText="测试按钮"
        onAction={mockOnAction}
      />,
    );

    const card = screen.getByTestId('card');
    expect(card).toHaveClass('border-2');
    expect(card).toHaveClass('border-dashed');
  });

  it('应该支持长描述文本', () => {
    const longDescription =
      '这是一个非常长的描述文本，用于测试组件是否能够正确处理多行文本显示。它应该能够自动换行并保持良好的可读性。';

    render(<EmptyState title="长描述测试" description={longDescription} />);

    expect(screen.getByText(longDescription)).toBeInTheDocument();
  });

  it('应该正确渲染所有元素结构', () => {
    render(
      <EmptyState
        icon="🎯"
        title="完整测试"
        description="完整的组件结构测试"
        actionText="完整按钮"
        onAction={mockOnAction}
      />,
    );

    // 验证图标
    expect(screen.getByText('🎯')).toBeInTheDocument();

    // 验证标题
    expect(screen.getByText('完整测试')).toBeInTheDocument();

    // 验证描述
    expect(screen.getByText('完整的组件结构测试')).toBeInTheDocument();

    // 验证按钮
    const button = screen.getByRole('button', { name: '完整按钮' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('data-color', 'primary');
  });
});
