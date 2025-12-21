import React from 'react';
import { Card, CardBody, Button, Switch, Tooltip, Chip } from '@heroui/react';
import { PromptxyRule } from '@/types';

interface RuleCardProps {
  rule: PromptxyRule;
  onEdit: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (rule: PromptxyRule) => void;
}

export const RuleCard: React.FC<RuleCardProps> = ({ rule, onEdit, onDelete, onToggle }) => {
  const enabled = rule.enabled !== false;

  return (
    <Card
      className={`border-2 transition-all duration-200 hover:shadow-lg ${
        enabled
          ? 'border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
      }`}
    >
      <CardBody className="p-4 space-y-3">
        {/* 顶部: 规则ID + 状态 + 操作 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                {rule.id}
              </h4>
              <Chip
                color={enabled ? 'success' : 'default'}
                variant={enabled ? 'flat' : 'bordered'}
                size="sm"
                className="font-medium"
              >
                {enabled ? '已启用' : '已禁用'}
              </Chip>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip content={enabled ? '禁用规则' : '启用规则'}>
              <Switch
                size="sm"
                checked={enabled}
                onChange={() => onToggle(rule)}
                color={enabled ? 'success' : 'default'}
              />
            </Tooltip>
          </div>
        </div>

        {/* 描述 */}
        {rule.description && (
          <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {rule.description}
          </div>
        )}

        {/* 匹配条件标签 */}
        <div className="flex flex-wrap gap-1.5">
          <Chip size="sm" color="primary" variant="flat" className="text-xs">
            {rule.when.client}
          </Chip>
          <Chip size="sm" color="secondary" variant="flat" className="text-xs">
            {rule.when.field}
          </Chip>
          {rule.when.method && (
            <Chip size="sm" color="warning" variant="flat" className="text-xs">
              {rule.when.method}
            </Chip>
          )}
          {rule.ops.map((op, i) => (
            <Chip key={i} size="sm" color="default" variant="flat" className="text-xs">
              {op.type}
            </Chip>
          ))}
        </div>

        {/* 正则信息 */}
        {(rule.when.pathRegex || rule.when.modelRegex) && (
          <div className="space-y-1 text-xs font-mono bg-gray-50 dark:bg-gray-900/50 p-2 rounded-md">
            {rule.when.pathRegex && (
              <div className="text-purple-700 dark:text-purple-400 truncate">
                path: {rule.when.pathRegex}
              </div>
            )}
            {rule.when.modelRegex && (
              <div className="text-blue-700 dark:text-blue-400 truncate">
                model: {rule.when.modelRegex}
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <Button
            size="sm"
            variant="light"
            onPress={() => onEdit(rule.id)}
            className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            编辑
          </Button>
          <Button
            size="sm"
            color="danger"
            variant="light"
            onPress={() => onDelete(rule.id)}
            className="hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            删除
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};
