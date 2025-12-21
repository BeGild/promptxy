import React, { useState } from 'react';
import { Input, Button, Spinner, Pagination, Chip, Select, SelectItem } from '@heroui/react';
import { RuleCard } from './RuleCard';
import { EmptyState } from '@/components/common';
import { PromptxyRule } from '@/types';

interface RuleListProps {
  rules: PromptxyRule[];
  isLoading: boolean;
  onEdit: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (rule: PromptxyRule) => void;
  onNewRule: () => void;
}

export const RuleList: React.FC<RuleListProps> = ({
  rules,
  isLoading,
  onEdit,
  onDelete,
  onToggle,
  onNewRule,
}) => {
  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // 过滤规则
  const filteredRules = rules.filter(rule => {
    const matchSearch =
      rule.id.toLowerCase().includes(search.toLowerCase()) ||
      (rule.description || '').toLowerCase().includes(search.toLowerCase());
    const matchClient = filterClient === 'all' || rule.when.client === filterClient;
    return matchSearch && matchClient;
  });

  // 分页
  const totalPages = Math.ceil(filteredRules.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const paginatedRules = filteredRules.slice(startIndex, startIndex + itemsPerPage);

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
          placeholder="🔍 搜索规则ID或描述..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1"
          radius="lg"
          classNames={{
            inputWrapper:
              'shadow-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
          }}
        />

        <Select
          selectedKeys={[filterClient]}
          onChange={e => setFilterClient(e.target.value)}
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
          <Button size="sm" variant="light" onPress={() => setSearch('')} className="h-6 px-2">
            清除搜索
          </Button>
        )}
      </div>

      {/* 规则卡片列表 */}
      <div className="space-y-3">
        {paginatedRules.map(rule => (
          <RuleCard
            key={rule.id}
            rule={rule}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggle={onToggle}
          />
        ))}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <Pagination
            total={totalPages}
            page={page}
            onChange={setPage}
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
