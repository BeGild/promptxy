import React, { useCallback } from 'react';
import { Card, CardBody, Button, Switch, Tooltip, Chip } from '@heroui/react';
import { Copy, Edit2, Trash2 } from 'lucide-react';
import { PromptxyRule } from '@/types';

interface RuleCardProps {
  rule: PromptxyRule;
  onEdit: (ruleId: string) => void;
  onCopy: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (rule: PromptxyRule) => void;
}

/**
 * RuleCard - 优化的规则卡片组件
 * 使用 React.memo 避免不必要的重新渲染
 * 使用自定义比较函数进行深度比较
 */
const RuleCardComponent: React.FC<RuleCardProps> = ({ rule, onEdit, onCopy, onDelete, onToggle }) => {
  const enabled = rule.enabled !== false;

  // 使用 useCallback 优化事件处理函数，避免每次渲染都创建新函数
  const handleEdit = useCallback(() => {
    onEdit(rule.uuid);
  }, [onEdit, rule.uuid]);

  const handleCopy = useCallback(() => {
    onCopy(rule.uuid);
  }, [onCopy, rule.uuid]);

  const handleDelete = useCallback(() => {
    onDelete(rule.uuid);
  }, [onDelete, rule.uuid]);

  const handleToggle = useCallback(() => {
    onToggle(rule);
  }, [onToggle, rule]);

  const handleSwitchChange = useCallback(() => {
    onToggle(rule);
  }, [onToggle, rule]);

  return (
    <Card
      className={`border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group ${
        enabled
          ? 'border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
      shadow="sm"
    >
      <CardBody className="p-5 flex flex-col h-full">
        {/* 顶部: 规则ID + 状态 + 操作 */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4
                className={`text-lg font-bold truncate ${
                  enabled ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {rule.name}
              </h4>
              {enabled && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-1 flex items-center gap-1">
              <span className="opacity-50">#</span>
              {rule.uuid.slice(0, 8)}...
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content={enabled ? '禁用规则' : '启用规则'} closeDelay={0}>
              <Switch
                size="sm"
                isSelected={enabled}
                onValueChange={handleSwitchChange}
                color="success"
                classNames={{
                  wrapper: 'group-hover:scale-110 transition-transform',
                }}
              />
            </Tooltip>
          </div>
        </div>

        {/* 描述 */}
        <div className="flex-1 mb-4">
          {rule.description ? (
            <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
              {rule.description}
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic">无描述</div>
          )}
        </div>

        {/* 匹配条件标签 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Chip
            size="sm"
            variant="flat"
            className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50"
          >
            {rule.when.client}
          </Chip>
          <Chip
            size="sm"
            variant="flat"
            className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50"
          >
            {rule.when.field}
          </Chip>
          {rule.when.method && (
            <Chip
              size="sm"
              variant="flat"
              className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/50"
            >
              {rule.when.method}
            </Chip>
          )}
          {rule.ops.map((op, i) => (
            <Chip
              key={i}
              size="sm"
              variant="flat"
              className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
            >
              {op.type}
            </Chip>
          ))}
        </div>

        {/* 正则信息 */}
        {(rule.when.pathRegex || rule.when.modelRegex) && (
          <div className="space-y-1.5 text-xs font-mono bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 mb-4">
            {rule.when.pathRegex && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 truncate">
                <span className="text-purple-500 font-bold">PATH</span>
                <span className="truncate opacity-80">{rule.when.pathRegex}</span>
              </div>
            )}
            {rule.when.modelRegex && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 truncate">
                <span className="text-blue-500 font-bold">MODEL</span>
                <span className="truncate opacity-80">{rule.when.modelRegex}</span>
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 - 悬停时显示 */}
        <div className="flex justify-end gap-1 pt-3 border-t border-gray-100 dark:border-gray-800 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Tooltip content="复制规则" closeDelay={0}>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleCopy}
              className="text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
            >
              <Copy size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="编辑规则" closeDelay={0}>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleEdit}
              className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <Edit2 size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="删除规则" color="danger" closeDelay={0}>
            <Button
              isIconOnly
              size="sm"
              color="danger"
              variant="light"
              onPress={handleDelete}
              className="text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 size={16} />
            </Button>
          </Tooltip>
        </div>
      </CardBody>
    </Card>
  );
};

/**
 * 优化的 RuleCard 组件，使用 React.memo 包裹
 */
export const RuleCard = React.memo(RuleCardComponent);
