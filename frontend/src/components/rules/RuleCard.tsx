/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - className="border-gray-200 dark:border-gray-700"
 * - className="text-gray-900 dark:text-gray-100"
 *
 * ✅ REQUIRED:
 * - className="border-subtle"
 * - className="text-primary dark:text-primary"
 */

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
          ? 'border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5'
          : 'border-subtle bg-elevated'
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
                  enabled ? 'text-primary dark:text-primary' : 'text-secondary'
                }`}
              >
                {rule.name}
              </h4>
              {enabled && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-success"></span>
                </span>
              )}
            </div>
            <div className="text-xs text-tertiary font-mono mt-1 flex items-center gap-1">
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
            <div className="text-sm text-secondary line-clamp-2 leading-relaxed">
              {rule.description}
            </div>
          ) : (
            <div className="text-sm text-tertiary italic">无描述</div>
          )}
        </div>

        {/* 匹配条件标签 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Chip
            size="sm"
            variant="flat"
            className="bg-brand-primary/10 dark:bg-brand-primary/20 text-brand-primary dark:text-brand-primary/80 border border-brand-primary/30 dark:border-brand-primary/20"
          >
            {rule.when.client}
          </Chip>
          <Chip
            size="sm"
            variant="flat"
            className="bg-accent-purple/10 dark:bg-accent-purple/20 text-accent-purple dark:text-accent-purple/80 border border-accent-purple/30 dark:border-accent-purple/20"
          >
            {rule.when.field}
          </Chip>
          {rule.when.method && (
            <Chip
              size="sm"
              variant="flat"
              className="bg-accent-orange/10 dark:bg-accent-orange/20 text-accent-orange dark:text-accent-orange/80 border border-accent-orange/30 dark:border-accent-orange/20"
            >
              {rule.when.method}
            </Chip>
          )}
          {rule.ops.map((op, i) => (
            <Chip
              key={i}
              size="sm"
              variant="flat"
              className="bg-canvas dark:bg-secondary text-secondary dark:text-secondary border border-subtle"
            >
              {op.type}
            </Chip>
          ))}
        </div>

        {/* 正则信息 */}
        {(rule.when.pathRegex || rule.when.modelRegex) && (
          <div className="space-y-1.5 text-xs font-mono bg-canvas dark:bg-secondary/50 p-2.5 rounded-lg border border-subtle mb-4">
            {rule.when.pathRegex && (
              <div className="flex items-center gap-2 text-secondary truncate">
                <span className="text-accent-purple font-bold">PATH</span>
                <span className="truncate opacity-80">{rule.when.pathRegex}</span>
              </div>
            )}
            {rule.when.modelRegex && (
              <div className="flex items-center gap-2 text-secondary truncate">
                <span className="text-brand-primary font-bold">MODEL</span>
                <span className="truncate opacity-80">{rule.when.modelRegex}</span>
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 - 悬停时显示 */}
        <div className="flex justify-end gap-1 pt-3 border-t border-subtle opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Tooltip content="复制规则" closeDelay={0}>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={handleCopy}
              className="text-tertiary hover:text-accent-purple hover:bg-accent-purple/10 dark:hover:bg-accent-purple/20"
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
              className="text-tertiary hover:text-brand-primary hover:bg-brand-primary/10 dark:hover:bg-brand-primary/20"
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
              className="text-tertiary hover:text-status-error hover:bg-status-error/10 dark:hover:bg-status-error/20"
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
