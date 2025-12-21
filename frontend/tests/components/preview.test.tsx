/**
 * 预览组件测试
 * 包含 PreviewPanel 组件测试
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreviewPanel } from '@/components/preview';

// 模拟 @heroui/react
vi.mock('@heroui/react', () => ({
  Textarea: ({ value, onChange, placeholder, label, fullWidth, minRows }: any) => (
    <textarea
      data-testid="textarea"
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={label}
      data-full-width={fullWidth}
      data-min-rows={minRows}
    />
  ),
  Select: ({ children, selectedKeys, onChange, label, fullWidth }: any) => (
    <select
      data-testid="select"
      value={selectedKeys?.[0] || ''}
      onChange={e => onChange({ target: { value: e.target.value } })}
      aria-label={label}
      data-full-width={fullWidth}
    >
      {children}
    </select>
  ),
  SelectItem: ({ children, key: keyProp }: any) => <option value={keyProp}>{children}</option>,
  Input: ({ value, onChange, placeholder, label, fullWidth }: any) => (
    <input
      data-testid="input"
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={label}
      data-full-width={fullWidth}
    />
  ),
  Button: ({ children, onPress, isDisabled, isLoading, color }: any) => (
    <button
      onClick={onPress}
      disabled={isDisabled}
      data-testid="button"
      data-color={color}
      data-loading={isLoading}
    >
      {children}
    </button>
  ),
  Spacer: ({ y }: any) => <div data-testid="spacer" data-y={y}></div>,
  Card: ({ children, style }: any) => (
    <div data-testid="card" style={style}>
      {children}
    </div>
  ),
  Spinner: ({ children }: any) => <div data-testid="spinner">{children}</div>,
}));

// 模拟 hooks
const mockPreviewMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
  data: null,
};

vi.mock('@/hooks', () => ({
  usePreviewRule: () => mockPreviewMutation,
}));

describe('PreviewPanel', () => {
  beforeEach(() => {
    // 重置所有 mock
    mockPreviewMutation.mutate.mockClear();
    mockPreviewMutation.mutateAsync.mockClear();
    mockPreviewMutation.isPending = false;
    mockPreviewMutation.isError = false;
    mockPreviewMutation.error = null;
    mockPreviewMutation.data = null;
  });

  describe('初始渲染', () => {
    it('应该正确渲染输入区域', () => {
      render(<PreviewPanel />);

      // 检查输入字段
      expect(screen.getByLabelText('客户端')).toBeInTheDocument();
      expect(screen.getByLabelText('字段')).toBeInTheDocument();
      expect(screen.getByLabelText('模型 (可选)')).toBeInTheDocument();
      expect(screen.getByLabelText('路径')).toBeInTheDocument();
      expect(screen.getByLabelText('HTTP方法')).toBeInTheDocument();
      expect(screen.getByLabelText('输入文本')).toBeInTheDocument();
    });

    it('应该显示预览按钮', () => {
      render(<PreviewPanel />);

      const button = screen.getByText('预览效果');
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled(); // 初始状态应该禁用
    });

    it('应该正确设置默认值', () => {
      render(<PreviewPanel />);

      // 检查默认值
      const clientSelect = screen.getByLabelText('客户端');
      expect(clientSelect).toHaveValue('claude');

      const fieldSelect = screen.getByLabelText('字段');
      expect(fieldSelect).toHaveValue('system');

      const pathInput = screen.getByLabelText('路径');
      expect(pathInput).toHaveValue('/v1/messages');

      const methodInput = screen.getByLabelText('HTTP方法');
      expect(methodInput).toHaveValue('POST');
    });

    it('应该渲染输出区域', () => {
      render(<PreviewPanel />);

      expect(screen.getByText('预览结果')).toBeInTheDocument();
    });
  });

  describe('输入交互', () => {
    it('应该处理输入文本变化', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const textarea = screen.getByLabelText('输入文本');
      await user.type(textarea, '测试输入文本');

      expect(textarea).toHaveValue('测试输入文本');
    });

    it('应该处理客户端选择变化', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const clientSelect = screen.getByLabelText('客户端');
      await user.selectOptions(clientSelect, 'codex');

      expect(clientSelect).toHaveValue('codex');
    });

    it('应该处理字段选择变化', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const fieldSelect = screen.getByLabelText('字段');
      await user.selectOptions(fieldSelect, 'instructions');

      expect(fieldSelect).toHaveValue('instructions');
    });

    it('应该处理模型输入变化', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const modelInput = screen.getByLabelText('模型 (可选)');
      await user.type(modelInput, 'claude-3-sonnet-20240229');

      expect(modelInput).toHaveValue('claude-3-sonnet-20240229');
    });

    it('应该处理路径输入变化', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const pathInput = screen.getByLabelText('路径');
      await user.clear(pathInput);
      await user.type(pathInput, '/v1/completions');

      expect(pathInput).toHaveValue('/v1/completions');
    });

    it('应该处理HTTP方法变化', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const methodInput = screen.getByLabelText('HTTP方法');
      await user.clear(methodInput);
      await user.type(methodInput, 'GET');

      expect(methodInput).toHaveValue('GET');
    });

    it('应该启用预览按钮当有输入文本', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const textarea = screen.getByLabelText('输入文本');
      await user.type(textarea, '测试');

      const button = screen.getByText('预览效果');
      expect(button).not.toBeDisabled();
    });

    it('应该保持禁用状态当输入为空', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const textarea = screen.getByLabelText('输入文本');
      await user.type(textarea, '测试');
      await user.clear(textarea);

      const button = screen.getByText('预览效果');
      expect(button).toBeDisabled();
    });

    it('应该禁用按钮当输入只有空格', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const textarea = screen.getByLabelText('输入文本');
      await user.type(textarea, '   ');

      const button = screen.getByText('预览效果');
      expect(button).toBeDisabled();
    });
  });

  describe('预览操作', () => {
    it('应该调用预览API当点击按钮', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const textarea = screen.getByLabelText('输入文本');
      await user.type(textarea, '测试输入');

      const button = screen.getByText('预览效果');
      await user.click(button);

      expect(mockPreviewMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ system: '测试输入' }),
          client: 'claude',
          field: 'system',
          path: '/v1/messages',
          method: 'POST',
        }),
      );
    });

    it('应该正确构建请求体当字段是system', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const textarea = screen.getByLabelText('输入文本');
      await user.type(textarea, '系统提示');

      const button = screen.getByText('预览效果');
      await user.click(button);

      expect(mockPreviewMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { system: '系统提示' },
        }),
      );
    });

    it('应该正确构建请求体当字段是instructions', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const fieldSelect = screen.getByLabelText('字段');
      await user.selectOptions(fieldSelect, 'instructions');

      const textarea = screen.getByLabelText('输入文本');
      await user.type(textarea, '指令文本');

      const button = screen.getByText('预览效果');
      await user.click(button);

      expect(mockPreviewMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { instructions: '指令文本' },
        }),
      );
    });

    it('应该包含模型当提供时', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const textarea = screen.getByLabelText('输入文本');
      await user.type(textarea, '测试');

      const modelInput = screen.getByLabelText('模型 (可选)');
      await user.type(modelInput, 'claude-3-opus');

      const button = screen.getByText('预览效果');
      await user.click(button);

      expect(mockPreviewMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ model: 'claude-3-opus' }),
        }),
      );
    });

    it('应该使用所有输入参数', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      // 设置所有字段
      const clientSelect = screen.getByLabelText('客户端');
      await user.selectOptions(clientSelect, 'gemini');

      const fieldSelect = screen.getByLabelText('字段');
      await user.selectOptions(fieldSelect, 'instructions');

      const modelInput = screen.getByLabelText('模型 (可选)');
      await user.type(modelInput, 'gemini-pro');

      const pathInput = screen.getByLabelText('路径');
      await user.clear(pathInput);
      await user.type(pathInput, '/generate');

      const methodInput = screen.getByLabelText('HTTP方法');
      await user.clear(methodInput);
      await user.type(methodInput, 'PUT');

      const textarea = screen.getByLabelText('输入文本');
      await user.type(textarea, '完整测试');

      const button = screen.getByText('预览效果');
      await user.click(button);

      expect(mockPreviewMutation.mutate).toHaveBeenCalledWith({
        body: { instructions: '完整测试', model: 'gemini-pro' },
        client: 'gemini',
        field: 'instructions',
        model: 'gemini-pro',
        path: '/generate',
        method: 'PUT',
      });
    });

    it('应该处理异步预览操作', async () => {
      const user = userEvent.setup();
      mockPreviewMutation.mutateAsync.mockResolvedValue({
        original: '原始文本',
        modified: '修改文本',
        matches: [{ ruleId: 'rule-1', opType: 'append' }],
      });

      render(<PreviewPanel />);

      const textarea = screen.getByLabelText('输入文本');
      await user.type(textarea, '测试');

      const button = screen.getByText('预览效果');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('原始文本:')).toBeInTheDocument();
      });
    });
  });

  describe('加载状态', () => {
    it('应该显示加载状态', () => {
      mockPreviewMutation.isPending = true;

      render(<PreviewPanel />);

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(screen.getByText('处理中...')).toBeInTheDocument();
    });

    it('应该禁用按钮当加载中', () => {
      mockPreviewMutation.isPending = true;

      render(<PreviewPanel />);

      const button = screen.getByText('预览效果');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('data-loading', 'true');
    });
  });

  describe('错误处理', () => {
    it('应该显示错误信息', () => {
      mockPreviewMutation.isError = true;
      mockPreviewMutation.error = { message: '预览失败：连接超时' };

      render(<PreviewPanel />);

      expect(screen.getByText('预览失败：连接超时')).toBeInTheDocument();
    });

    it('应该显示默认错误信息', () => {
      mockPreviewMutation.isError = true;
      mockPreviewMutation.error = { message: null };

      render(<PreviewPanel />);

      expect(screen.getByText('预览失败')).toBeInTheDocument();
    });

    it('应该不显示错误当没有错误时', () => {
      render(<PreviewPanel />);

      expect(screen.queryByText(/错误|失败/)).not.toBeInTheDocument();
    });
  });

  describe('预览结果渲染', () => {
    it('应该显示原始和修改后文本', () => {
      mockPreviewMutation.data = {
        original: '原始系统提示',
        modified: '修改后系统提示',
        matches: [],
      };

      render(<PreviewPanel />);

      expect(screen.getByText('原始文本:')).toBeInTheDocument();
      expect(screen.getByText('原始系统提示')).toBeInTheDocument();
      expect(screen.getByText('修改后:')).toBeInTheDocument();
      expect(screen.getByText('修改后系统提示')).toBeInTheDocument();
    });

    it('应该显示匹配规则', () => {
      mockPreviewMutation.data = {
        original: '原始',
        modified: '修改',
        matches: [
          { ruleId: 'rule-1', opType: 'append' },
          { ruleId: 'rule-2', opType: 'replace' },
        ],
      };

      render(<PreviewPanel />);

      expect(screen.getByText('匹配规则:')).toBeInTheDocument();
      expect(screen.getByText('• rule-1 (append)')).toBeInTheDocument();
      expect(screen.getByText('• rule-2 (replace)')).toBeInTheDocument();
    });

    it('应该显示无规则匹配信息', () => {
      mockPreviewMutation.data = {
        original: '原始',
        modified: '修改',
        matches: [],
      };

      render(<PreviewPanel />);

      expect(screen.getByText('无规则匹配')).toBeInTheDocument();
    });

    it('应该正确处理对象类型的结果', () => {
      mockPreviewMutation.data = {
        original: { system: '原始', model: 'claude-3' },
        modified: { system: '修改', model: 'claude-3' },
        matches: [],
      };

      render(<PreviewPanel />);

      expect(screen.getByText(/"system":/)).toBeInTheDocument();
      expect(screen.getByText(/"model":/)).toBeInTheDocument();
    });

    it('应该正确处理字符串类型的结果', () => {
      mockPreviewMutation.data = {
        original: '原始文本',
        modified: '修改文本',
        matches: [],
      };

      render(<PreviewPanel />);

      expect(screen.getByText('原始文本')).toBeInTheDocument();
      expect(screen.getByText('修改文本')).toBeInTheDocument();
    });

    it('应该不显示结果区域当没有数据', () => {
      render(<PreviewPanel />);

      // 只应该显示标题，不应该显示具体内容
      expect(screen.getByText('预览结果')).toBeInTheDocument();
    });
  });

  describe('UI布局', () => {
    it('应该正确布局两个主要区域', () => {
      render(<PreviewPanel />);

      const cards = screen.getAllByTestId('card');
      expect(cards.length).toBeGreaterThanOrEqual(2); // 输入和输出区域

      // 检查是否有输入区域卡片
      const hasInputCard = cards.some(card => card.textContent?.includes('测试输入'));
      expect(hasInputCard).toBe(true);

      // 检查是否有输出区域卡片
      const hasOutputCard = cards.some(card => card.textContent?.includes('预览结果'));
      expect(hasOutputCard).toBe(true);
    });

    it('应该显示分隔符', () => {
      render(<PreviewPanel />);

      const spacers = screen.getAllByTestId('spacer');
      expect(spacers.length).toBeGreaterThan(0);
    });

    it('应该正确响应输入变化', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      // 改变所有输入字段
      const clientSelect = screen.getByLabelText('客户端');
      await user.selectOptions(clientSelect, 'codex');

      const fieldSelect = screen.getByLabelText('字段');
      await user.selectOptions(fieldSelect, 'instructions');

      const modelInput = screen.getByLabelText('模型 (可选)');
      await user.type(modelInput, 'test-model');

      const pathInput = screen.getByLabelText('路径');
      await user.clear(pathInput);
      await user.type(pathInput, '/test');

      const methodInput = screen.getByLabelText('HTTP方法');
      await user.clear(methodInput);
      await user.type(methodInput, 'GET');

      const textarea = screen.getByLabelText('输入文本');
      await user.type(textarea, '测试内容');

      // 验证所有输入都被更新
      expect(clientSelect).toHaveValue('codex');
      expect(fieldSelect).toHaveValue('instructions');
      expect(modelInput).toHaveValue('test-model');
      expect(pathInput).toHaveValue('/test');
      expect(methodInput).toHaveValue('GET');
      expect(textarea).toHaveValue('测试内容');
    });
  });

  describe('边缘情况', () => {
    it('应该处理空模型输入', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const textarea = screen.getByLabelText('输入文本');
      await user.type(textarea, '测试');

      const modelInput = screen.getByLabelText('模型 (可选)');
      // 不输入任何内容

      const button = screen.getByText('预览效果');
      await user.click(button);

      expect(mockPreviewMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.not.objectContaining({ model: expect.any(String) }),
        }),
      );
    });

    it('应该处理特殊字符输入', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const textarea = screen.getByLabelText('输入文本');
      await user.type(textarea, '特殊字符: <>&"\'\\');

      const button = screen.getByText('预览效果');
      await user.click(button);

      expect(mockPreviewMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ system: '特殊字符: <>&"\'\\' }),
        }),
      );
    });

    it('应该处理长文本输入', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const longText = 'a'.repeat(1000);
      const textarea = screen.getByLabelText('输入文本');
      await user.type(textarea, longText);

      const button = screen.getByText('预览效果');
      await user.click(button);

      expect(mockPreviewMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ system: longText }),
        }),
      );
    });

    it('应该处理JSON字符串输入', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const jsonText = '{"key": "value", "number": 123}';
      const textarea = screen.getByLabelText('输入文本');
      await user.type(textarea, jsonText);

      const button = screen.getByText('预览效果');
      await user.click(button);

      expect(mockPreviewMutation.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ system: jsonText }),
        }),
      );
    });

    it('应该正确处理多次预览请求', async () => {
      const user = userEvent.setup();
      render(<PreviewPanel />);

      const textarea = screen.getByLabelText('输入文本');
      const button = screen.getByText('预览效果');

      // 第一次预览
      await user.type(textarea, '第一次');
      await user.click(button);

      // 第二次预览
      await user.clear(textarea);
      await user.type(textarea, '第二次');
      await user.click(button);

      expect(mockPreviewMutation.mutate).toHaveBeenCalledTimes(2);
    });
  });
});
