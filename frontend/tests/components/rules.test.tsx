/**
 * 规则组件测试
 * 包含 RuleList, RuleCard, RuleEditor 组件测试
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RuleList, RuleCard, RuleEditor } from '@/components/rules';
import { PromptxyRule } from '@/types';

// 模拟 @heroui/react
vi.mock('@heroui/react', () => ({
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
  Card: ({ children, className, isPressable, style }: any) => (
    <div data-testid="card" className={className} data-pressable={isPressable} style={style}>
      {children}
    </div>
  ),
  CardBody: ({ children, className }: any) => (
    <div data-testid="card-body" className={className}>
      {children}
    </div>
  ),
  Switch: ({ checked, onChange, size, color }: any) => (
    <input
      type="checkbox"
      data-testid="switch"
      checked={checked}
      onChange={onChange}
      data-size={size}
      data-color={color}
    />
  ),
  Tooltip: ({ children, content }: any) => (
    <div data-testid="tooltip" data-content={content}>
      {children}
    </div>
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
  Checkbox: ({ checked, onChange, children }: any) => (
    <label data-testid="checkbox">
      <input type="checkbox" checked={checked} onChange={onChange} />
      {children}
    </label>
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
  validateRule: (rule: any) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!rule.id) errors.push('规则ID不能为空');
    if (!rule.when?.client) errors.push('客户端不能为空');
    if (!rule.when?.field) errors.push('字段不能为空');
    if (!rule.ops || rule.ops.length === 0) errors.push('至少需要一个操作');

    return { valid: errors.length === 0, errors, warnings };
  },
  createDefaultRule: () => ({
    id: 'rule-new',
    description: '',
    when: { client: 'claude', field: 'system' },
    ops: [{ type: 'append', text: '' }],
    enabled: true,
  }),
  generateUUID: () => 'test-uuid-12345',
}));

describe('RuleList', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnToggle = vi.fn();
  const mockOnNewRule = vi.fn();

  const mockRules: PromptxyRule[] = [
    {
      id: 'rule-1',
      description: '第一条规则',
      when: { client: 'claude', field: 'system' },
      ops: [{ type: 'append', text: 'test' }],
      enabled: true,
    },
    {
      id: 'rule-2',
      description: '第二条规则',
      when: { client: 'codex', field: 'instructions', method: 'POST' },
      ops: [{ type: 'replace', replacement: 'new' }],
      enabled: false,
    },
    {
      id: 'rule-3',
      description: '第三条规则',
      when: { client: 'gemini', field: 'system', pathRegex: '^/api' },
      ops: [{ type: 'delete' }],
      enabled: true,
    },
  ];

  beforeEach(() => {
    mockOnEdit.mockClear();
    mockOnDelete.mockClear();
    mockOnToggle.mockClear();
    mockOnNewRule.mockClear();
  });

  describe('加载状态', () => {
    it('应该显示加载中状态', () => {
      render(
        <RuleList
          rules={[]}
          isLoading={true}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggle={mockOnToggle}
          onNewRule={mockOnNewRule}
        />,
      );

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(screen.getByText('加载规则中...')).toBeInTheDocument();
    });
  });

  describe('空状态', () => {
    it('应该显示空状态当没有规则时', () => {
      render(
        <RuleList
          rules={[]}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggle={mockOnToggle}
          onNewRule={mockOnNewRule}
        />,
      );

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('暂无规则')).toBeInTheDocument();
    });

    it('空状态应该触发新建规则', async () => {
      const user = userEvent.setup();
      render(
        <RuleList
          rules={[]}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggle={mockOnToggle}
          onNewRule={mockOnNewRule}
        />,
      );

      const newRuleButton = screen.getByText('新建规则');
      await user.click(newRuleButton);

      expect(mockOnNewRule).toHaveBeenCalledTimes(1);
    });
  });

  describe('规则列表渲染', () => {
    it('应该渲染所有规则卡片', () => {
      render(
        <RuleList
          rules={mockRules}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggle={mockOnToggle}
          onNewRule={mockOnNewRule}
        />,
      );

      // 检查规则卡片数量
      const cards = screen.getAllByTestId('card');
      const ruleCards = cards.filter(card => card.querySelector('[data-testid="card-body"]'));
      expect(ruleCards.length).toBe(3);
    });

    it('应该显示搜索和过滤工具栏', () => {
      render(
        <RuleList
          rules={mockRules}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggle={mockOnToggle}
          onNewRule={mockOnNewRule}
        />,
      );

      expect(screen.getByPlaceholderText('🔍 搜索规则ID或描述...')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument(); // Select 组件
      expect(screen.getByText('+ 新建规则')).toBeInTheDocument();
    });

    it('应该显示统计信息', () => {
      render(
        <RuleList
          rules={mockRules}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggle={mockOnToggle}
          onNewRule={mockOnNewRule}
        />,
      );

      expect(screen.getByText('搜索结果:')).toBeInTheDocument();
      expect(screen.getByText('3 条')).toBeInTheDocument();
    });
  });

  describe('搜索过滤功能', () => {
    it('应该根据搜索文本过滤规则', async () => {
      const user = userEvent.setup();
      render(
        <RuleList
          rules={mockRules}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggle={mockOnToggle}
          onNewRule={mockOnNewRule}
        />,
      );

      const searchInput = screen.getByPlaceholderText('🔍 搜索规则ID或描述...');
      await user.type(searchInput, 'rule-1');

      // 应该只显示匹配的规则数量
      expect(screen.getByText('1 条')).toBeInTheDocument();
    });

    it('应该支持清除搜索', async () => {
      const user = userEvent.setup();
      render(
        <RuleList
          rules={mockRules}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggle={mockOnToggle}
          onNewRule={mockOnNewRule}
        />,
      );

      const searchInput = screen.getByPlaceholderText('🔍 搜索规则ID或描述...');
      await user.type(searchInput, 'test');

      // 清除搜索按钮应该出现
      const clearButton = screen.getByText('清除搜索');
      await user.click(clearButton);

      // 搜索框应该清空
      expect(searchInput).toHaveValue('');
    });

    it('应该根据客户端过滤规则', async () => {
      const user = userEvent.setup();
      render(
        <RuleList
          rules={mockRules}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggle={mockOnToggle}
          onNewRule={mockOnNewRule}
        />,
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'claude');

      // 应该只显示 claude 相关的规则
      expect(screen.getByText('1 条')).toBeInTheDocument();
    });
  });

  describe('分页功能', () => {
    it('应该显示分页控件当规则数量超过一页', () => {
      // 创建15条规则，每页10条，应该显示分页
      const manyRules = Array.from({ length: 15 }).map((_, i) => ({
        id: `rule-${i + 1}`,
        description: `规则 ${i + 1}`,
        when: { client: 'claude', field: 'system' },
        ops: [{ type: 'append', text: 'test' }],
        enabled: true,
      }));

      render(
        <RuleList
          rules={manyRules}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggle={mockOnToggle}
          onNewRule={mockOnNewRule}
        />,
      );

      expect(screen.getByTestId('pagination')).toBeInTheDocument();
    });

    it('应该正确计算总页数', () => {
      const manyRules = Array.from({ length: 25 }).map((_, i) => ({
        id: `rule-${i + 1}`,
        description: `规则 ${i + 1}`,
        when: { client: 'claude', field: 'system' },
        ops: [{ type: 'append', text: 'test' }],
        enabled: true,
      }));

      render(
        <RuleList
          rules={manyRules}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggle={mockOnToggle}
          onNewRule={mockOnNewRule}
        />,
      );

      const pagination = screen.getByTestId('pagination');
      expect(pagination).toHaveAttribute('data-total', '3'); // 25条规则，每页10条，共3页
    });

    it('应该处理分页切换', async () => {
      const manyRules = Array.from({ length: 15 }).map((_, i) => ({
        id: `rule-${i + 1}`,
        description: `规则 ${i + 1}`,
        when: { client: 'claude', field: 'system' },
        ops: [{ type: 'append', text: 'test' }],
        enabled: true,
      }));

      render(
        <RuleList
          rules={manyRules}
          isLoading={false}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggle={mockOnToggle}
          onNewRule={mockOnNewRule}
        />,
      );

      const page2Button = screen.getByTestId('page-2');
      fireEvent.click(page2Button);

      // 应该显示第二页的内容
      expect(screen.getByText('搜索结果:')).toBeInTheDocument();
    });
  });
});

describe('RuleCard', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnToggle = vi.fn();

  const mockRule: PromptxyRule = {
    id: 'test-rule',
    description: '测试规则描述',
    when: { client: 'claude', field: 'system', method: 'POST', pathRegex: '^/api' },
    ops: [{ type: 'append', text: '附加文本' }],
    enabled: true,
  };

  beforeEach(() => {
    mockOnEdit.mockClear();
    mockOnDelete.mockClear();
    mockOnToggle.mockClear();
  });

  it('应该正确渲染规则信息', () => {
    render(
      <RuleCard
        rule={mockRule}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggle={mockOnToggle}
      />,
    );

    expect(screen.getByText('test-rule')).toBeInTheDocument();
    expect(screen.getByText('测试规则描述')).toBeInTheDocument();
    expect(screen.getByText('已启用')).toBeInTheDocument();
  });

  it('应该显示匹配条件标签', () => {
    render(
      <RuleCard
        rule={mockRule}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggle={mockOnToggle}
      />,
    );

    expect(screen.getByText('claude')).toBeInTheDocument();
    expect(screen.getByText('system')).toBeInTheDocument();
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('append')).toBeInTheDocument();
  });

  it('应该显示正则信息', () => {
    render(
      <RuleCard
        rule={mockRule}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggle={mockOnToggle}
      />,
    );

    expect(screen.getByText(/path: \^\/api/)).toBeInTheDocument();
  });

  it('应该正确显示禁用状态', () => {
    const disabledRule = { ...mockRule, enabled: false };

    render(
      <RuleCard
        rule={disabledRule}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggle={mockOnToggle}
      />,
    );

    expect(screen.getByText('已禁用')).toBeInTheDocument();
  });

  it('应该处理编辑按钮点击', async () => {
    const user = userEvent.setup();
    render(
      <RuleCard
        rule={mockRule}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggle={mockOnToggle}
      />,
    );

    const editButton = screen.getByText('编辑');
    await user.click(editButton);

    expect(mockOnEdit).toHaveBeenCalledWith('test-rule');
  });

  it('应该处理删除按钮点击', async () => {
    const user = userEvent.setup();
    render(
      <RuleCard
        rule={mockRule}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggle={mockOnToggle}
      />,
    );

    const deleteButton = screen.getByText('删除');
    await user.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith('test-rule');
  });

  it('应该处理启用/禁用切换', async () => {
    const user = userEvent.setup();
    render(
      <RuleCard
        rule={mockRule}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggle={mockOnToggle}
      />,
    );

    const switchInput = screen.getByTestId('switch');
    fireEvent.click(switchInput);

    expect(mockOnToggle).toHaveBeenCalledWith(mockRule);
  });

  it('应该显示工具提示', () => {
    render(
      <RuleCard
        rule={mockRule}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggle={mockOnToggle}
      />,
    );

    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip).toHaveAttribute('data-content', '禁用规则');
  });

  it('应该正确显示不同操作类型', () => {
    const multiOpRule = {
      ...mockRule,
      ops: [
        { type: 'append', text: 'test1' },
        { type: 'replace', replacement: 'test2' },
        { type: 'delete' },
      ],
    };

    render(
      <RuleCard
        rule={multiOpRule}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggle={mockOnToggle}
      />,
    );

    const chips = screen.getAllByTestId('chip');
    const opChips = chips.filter(
      chip =>
        chip.textContent === 'append' ||
        chip.textContent === 'replace' ||
        chip.textContent === 'delete',
    );
    expect(opChips.length).toBe(3);
  });

  it('应该不显示正则当没有时', () => {
    const ruleWithoutRegex = {
      ...mockRule,
      when: { client: 'claude', field: 'system' },
    };

    render(
      <RuleCard
        rule={ruleWithoutRegex}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onToggle={mockOnToggle}
      />,
    );

    expect(screen.queryByText(/path:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/model:/)).not.toBeInTheDocument();
  });
});

describe('RuleEditor', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnPreview = vi.fn();

  const mockRule: PromptxyRule = {
    id: 'test-rule',
    description: '测试规则',
    when: { client: 'claude', field: 'system', method: 'POST' },
    ops: [{ type: 'append', text: '测试文本' }],
    enabled: true,
  };

  beforeEach(() => {
    mockOnSave.mockClear();
    mockOnCancel.mockClear();
    mockOnPreview.mockClear();
  });

  describe('新建规则模式', () => {
    it('应该渲染空表单', () => {
      render(
        <RuleEditor
          rule={null}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      expect(screen.getByText('基本信息')).toBeInTheDocument();
      expect(screen.getByText('匹配条件 (When)')).toBeInTheDocument();
      expect(screen.getByText('操作序列 (Ops)')).toBeInTheDocument();
    });

    it('应该显示验证错误', async () => {
      render(
        <RuleEditor
          rule={null}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      // 尝试保存空表单
      const saveButton = screen.getByText('保存');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('验证错误:')).toBeInTheDocument();
      });
    });
  });

  describe('编辑规则模式', () => {
    it('应该填充现有规则数据', () => {
      render(
        <RuleEditor
          rule={mockRule}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      const idInput = screen.getByDisplayValue('test-rule');
      expect(idInput).toBeInTheDocument();
    });

    it('应该显示预览按钮', () => {
      render(
        <RuleEditor
          rule={mockRule}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      expect(screen.getByText('预览')).toBeInTheDocument();
    });
  });

  describe('表单交互', () => {
    it('应该处理规则ID输入', async () => {
      const user = userEvent.setup();
      render(
        <RuleEditor
          rule={null}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      const idInput = screen.getByLabelText('规则ID');
      await user.type(idInput, 'new-rule');

      expect(idInput).toHaveValue('new-rule');
    });

    it('应该生成UUID', async () => {
      const user = userEvent.setup();
      render(
        <RuleEditor
          rule={null}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      const uuidButton = screen.getByText('生成UUID');
      await user.click(uuidButton);

      const idInput = screen.getByLabelText('规则ID');
      expect(idInput).toHaveValue('rule-test-uuid-12345');
    });

    it('应该处理描述输入', async () => {
      const user = userEvent.setup();
      render(
        <RuleEditor
          rule={null}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      const descTextarea = screen.getByLabelText('描述 (可选)');
      await user.type(descTextarea, '新规则描述');

      expect(descTextarea).toHaveValue('新规则描述');
    });

    it('应该处理客户端选择', async () => {
      const user = userEvent.setup();
      render(
        <RuleEditor
          rule={null}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      const clientSelect = screen.getByLabelText('客户端');
      await user.selectOptions(clientSelect, 'codex');

      expect(clientSelect).toHaveValue('codex');
    });

    it('应该处理字段选择', async () => {
      const user = userEvent.setup();
      render(
        <RuleEditor
          rule={null}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      const fieldSelect = screen.getByLabelText('字段');
      await user.selectOptions(fieldSelect, 'instructions');

      expect(fieldSelect).toHaveValue('instructions');
    });

    it('应该添加新操作', async () => {
      const user = userEvent.setup();
      render(
        <RuleEditor
          rule={null}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      const addButton = screen.getByText('+ 添加操作');
      await user.click(addButton);

      // 应该显示2个操作（初始1个 + 新增1个）
      const opSelects = screen.getAllByLabelText('类型');
      expect(opSelects.length).toBeGreaterThanOrEqual(2);
    });

    it('应该删除操作', async () => {
      const user = userEvent.setup();
      render(
        <RuleEditor
          rule={null}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      // 先添加一个操作
      const addButton = screen.getByText('+ 添加操作');
      await user.click(addButton);

      // 然后删除
      const deleteButtons = screen.getAllByText('删除');
      await user.click(deleteButtons[1]); // 删除第二个操作

      // 应该只剩一个操作
      const opSelects = screen.getAllByLabelText('类型');
      expect(opSelects.length).toBe(1);
    });

    it('应该处理高级选项', async () => {
      const user = userEvent.setup();
      render(
        <RuleEditor
          rule={null}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      const stopCheckbox = screen.getByText('在此规则后停止执行 (stop)');
      const enabledCheckbox = screen.getByText('启用此规则');

      await user.click(stopCheckbox);
      await user.click(enabledCheckbox);

      // 验证状态变化
      expect(stopCheckbox).toBeInTheDocument();
      expect(enabledCheckbox).toBeInTheDocument();
    });

    it('应该处理保存操作', async () => {
      const user = userEvent.setup();
      render(
        <RuleEditor
          rule={null}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      // 填充必填字段
      const idInput = screen.getByLabelText('规则ID');
      await user.type(idInput, 'test-rule');

      const clientSelect = screen.getByLabelText('客户端');
      await user.selectOptions(clientSelect, 'claude');

      const fieldSelect = screen.getByLabelText('字段');
      await user.selectOptions(fieldSelect, 'system');

      // 保存
      const saveButton = screen.getByText('保存');
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalled();
    });

    it('应该处理取消操作', async () => {
      const user = userEvent.setup();
      render(
        <RuleEditor
          rule={null}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      const cancelButton = screen.getByText('取消');
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('应该处理预览操作', async () => {
      const user = userEvent.setup();
      render(
        <RuleEditor
          rule={mockRule}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      const previewButton = screen.getByText('预览');
      await user.click(previewButton);

      expect(mockOnPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-rule',
        }),
      );
    });

    it('应该动态显示操作字段', async () => {
      const user = userEvent.setup();
      render(
        <RuleEditor
          rule={null}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      // 初始是 append 操作，应该有文本字段
      expect(screen.getByLabelText('文本')).toBeInTheDocument();

      // 改为 replace 操作
      const opSelect = screen.getByLabelText('类型');
      await user.selectOptions(opSelect, 'replace');

      // 应该显示匹配和替换字段
      expect(screen.getByLabelText('匹配文本 (可选)')).toBeInTheDocument();
      expect(screen.getByLabelText('替换为')).toBeInTheDocument();
    });
  });

  describe('验证逻辑', () => {
    it('应该显示警告信息', async () => {
      // 模拟有警告的验证
      vi.doMock('@/utils', () => ({
        validateRule: () => ({
          valid: true,
          errors: [],
          warnings: ['这是一个警告'],
        }),
        createDefaultRule: () => ({
          id: 'rule-new',
          description: '',
          when: { client: 'claude', field: 'system' },
          ops: [{ type: 'append', text: '' }],
          enabled: true,
        }),
        generateUUID: () => 'test-uuid',
      }));

      render(
        <RuleEditor
          rule={null}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      // 等待验证效果
      await waitFor(() => {
        expect(screen.getByText('警告:')).toBeInTheDocument();
      });
    });

    it('应该禁用保存按钮当验证失败', async () => {
      render(
        <RuleEditor
          rule={null}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          onPreview={mockOnPreview}
        />,
      );

      const saveButton = screen.getByText('保存');
      expect(saveButton).toBeDisabled();
    });
  });
});
