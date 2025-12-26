import React, { useState, useMemo, useCallback } from 'react';
import { Input, Button, Spinner, Pagination, Chip, Select, SelectItem } from '@heroui/react';
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
      <div className="flex justify-center items-center py-12">
        <Spinner color="primary">加载规则中...</Spinner>
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
    <div className="space-y-4">
      {/* 搜索和过滤工具栏 */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <Input
          placeholder="🔍 搜索规则名称或描述..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          className="flex-1"
          radius="lg"
          classNames={{
            inputWrapper:
              'shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
          }}
        />

        <Select
          selectedKeys={[filterClient]}
          onChange={e => handleClientChange(e.target.value)}
          className="w-full md:w-48"
          radius="lg"
          classNames={{
            trigger:
              'shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
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
          className="shadow-md hover:shadow-lg transition-shadow"
          radius="lg"
        >
          + 新建规则
        </Button>
      </div>

      {/* 统计信息 */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>搜索结果:</span>
        <Chip color="primary" variant="flat" size="sm">
          {filteredRules.length} 条
        </Chip>
        {search && (
          <Button size="sm" variant="light" onPress={handleClearSearch} className="h-6 px-2">
            清除搜索
          </Button>
        )}
      </div>

      {/* 规则卡片列表 */}
      <div className="space-y-3">
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
        <div className="flex justify-center mt-6">
          <Pagination
            total={totalPages}
            page={page}
            onChange={handlePageChange}
            color="primary"
            showShadow={true}
            classNames={{
              wrapper: 'gap-1',
              item: 'min-w-9 h-9',
              cursor: 'shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold',
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
