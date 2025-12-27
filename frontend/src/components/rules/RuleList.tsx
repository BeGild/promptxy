/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - 硬编码颜色值（如 #007acc, #ff0000）
 * - 硬编码尺寸值（如 16px, 8px）
 * - 旧 Tailwind 颜色类（如 gray-*, blue-*, slate-*）
 *
 * ✅ REQUIRED:
 * - 使用语义化变量和类名
 * - 参考 styles/tokens/colors.css 中的可用变量
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Input, Button, Pagination, Chip, Select, SelectItem } from '@heroui/react';
import { Search, Filter, Plus, X } from 'lucide-react';
import { RuleCard } from './RuleCard';
import { EmptyState } from '@/components/common';
import { PromptxyRule } from '@/types';
import { RuleListVirtual } from './RuleListVirtual';

interface RuleListProps {
  rules: PromptxyRule[];
  isLoading: boolean;
  onEdit: (ruleId: string) => void;
  onCopy: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (rule: PromptxyRule) => void;
  onNewRule: () => void;
  enableVirtualScroll?: boolean;
}

/**
 * RuleList - 优化的规则列表组件
 * 使用 React.memo 避免不必要的重新渲染
 * 使用 useMemo 优化计算密集型操作
 */
const RuleListComponent: React.FC<RuleListProps> = ({
  rules,
  isLoading,
  onEdit,
  onCopy,
  onDelete,
  onToggle,
  onNewRule,
  enableVirtualScroll = false,
}) => {
  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // 使用 useMemo 优化过滤逻辑，只有当 rules, search, filterClient 变化时才重新计算
  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      const matchSearch =
        rule.name.toLowerCase().includes(search.toLowerCase()) ||
        (rule.description || '').toLowerCase().includes(search.toLowerCase());
      const matchClient = filterClient === 'all' || rule.when.client === filterClient;
      return matchSearch && matchClient;
    });
  }, [rules, search, filterClient]);

  // 使用 useMemo 优化分页计算
  const totalPages = useMemo(() => {
    return Math.ceil(filteredRules.length / itemsPerPage);
  }, [filteredRules.length]);

  const startIndex = useMemo(() => {
    return (page - 1) * itemsPerPage;
  }, [page]);

  const paginatedRules = useMemo(() => {
    return filteredRules.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRules, startIndex]);

  // 使用 useCallback 优化事件处理函数
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    // 重置到第一页，避免搜索后停留在可能不存在的页码
    setPage(1);
  }, []);

  const handleClientChange = useCallback((value: string) => {
    setFilterClient(value);
    // 重置到第一页
    setPage(1);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearch('');
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  // 使用 useCallback 优化传递给 RuleCard 的回调函数
  const handleEdit = useCallback(
    (ruleId: string) => {
      onEdit(ruleId);
    },
    [onEdit],
  );

  const handleDelete = useCallback(
    (ruleId: string) => {
      onDelete(ruleId);
    },
    [onDelete],
  );

  const handleToggle = useCallback(
    (rule: PromptxyRule) => {
      onToggle(rule);
    },
    [onToggle],
  );

  const handleCopy = useCallback(
    (ruleId: string) => {
      onCopy(ruleId);
    },
    [onCopy],
  );

  // 如果启用虚拟滚动，使用虚拟滚动组件
  if (enableVirtualScroll) {
    return (
      <RuleListVirtual
        rules={rules}
        isLoading={isLoading}
        onEdit={onEdit}
        onCopy={onCopy}
        onDelete={onDelete}
        onToggle={onToggle}
        onNewRule={onNewRule}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            className="h-48 rounded-xl bg-canvas dark:bg-secondary animate-pulse border border-subtle"
          />
        ))}
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <EmptyState
        title="暂无规则"
        description="创建你的第一条规则来开始修改请求"
        actionText="新建规则"
        onAction={onNewRule}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 搜索和过滤工具栏 */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <Input
          placeholder="搜索规则名称或描述..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          className="flex-1"
          radius="lg"
          startContent={<Search size={18} className="text-tertiary" />}
          classNames={{
            inputWrapper:
              'shadow-sm bg-elevated dark:bg-elevated border border-subtle hover:border-border-default transition-colors',
          }}
        />

        <Select
          selectedKeys={[filterClient]}
          onChange={e => handleClientChange(e.target.value)}
          className="w-full md:w-48"
          radius="lg"
          startContent={<Filter size={18} className="text-tertiary" />}
          classNames={{
            trigger:
              'shadow-sm bg-elevated dark:bg-elevated border border-subtle hover:border-border-default transition-colors',
          }}
        >
          <SelectItem key="all">所有客户端</SelectItem>
          <SelectItem key="claude">Claude</SelectItem>
          <SelectItem key="codex">Codex</SelectItem>
          <SelectItem key="gemini">Gemini</SelectItem>
        </Select>

        <Button
          color="primary"
          onPress={onNewRule}
          className="shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
          radius="lg"
          startContent={<Plus size={20} />}
        >
          新建规则
        </Button>
      </div>

      {/* 统计信息 */}
      <div className="flex items-center gap-2 text-sm text-secondary px-1">
        <span>搜索结果:</span>
        <Chip color="primary" variant="flat" size="sm" className="h-5 text-xs">
          {filteredRules.length} 条
        </Chip>
        {search && (
          <Button
            size="sm"
            variant="light"
            onPress={handleClearSearch}
            className="h-6 px-2 text-secondary hover:text-primary dark:hover:text-primary"
            startContent={<X size={14} />}
          >
            清除搜索
          </Button>
        )}
      </div>

      {/* 规则卡片列表 - 响应式 Grid 布局 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
        {paginatedRules.map(rule => (
          <RuleCard
            key={rule.uuid}
            rule={rule}
            onEdit={handleEdit}
            onCopy={handleCopy}
            onDelete={handleDelete}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <Pagination
            total={totalPages}
            page={page}
            onChange={handlePageChange}
            color="primary"
            showShadow
            classNames={{
              wrapper: 'gap-2',
              item: 'w-9 h-9 rounded-lg bg-elevated shadow-sm border border-subtle',
              cursor: 'bg-primary text-white font-bold shadow-lg shadow-primary/30',
            }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * 优化的 RuleList 组件，使用 React.memo 包裹
 * 避免当父组件重新渲染但 props 未变化时的不必要渲染
 */
export const RuleList = React.memo(RuleListComponent);
