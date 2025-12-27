/**
 * ⚠️ STYLESYSTEM COMPLIANCE ⚠️
 *
 * 禁止使用硬编码样式值！所有样式必须使用：
 * 1. Tailwind 语义类名（如 p-md, bg-elevated, text-primary）
 * 2. CSS 变量（如 var(--spacing-md), var(--color-bg-primary)）
 * 3. 语义化工具类（如 .card, .btn）
 *
 * ❌ FORBIDDEN:
 * - className="text-blue-700 dark:text-blue-300"
 * - className="border-blue-200/50 dark:border-blue-800/30"
 *
 * ✅ REQUIRED:
 * - className="text-brand-primary"
 * - className="border-brand-primary/30 dark:border-brand-primary/20"
 */

import React, { useState } from 'react';
import {
  useDisclosure,
  Card,
  CardBody,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
} from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import { RuleList, RuleEditor } from '@/components/rules';
import { useRules, useSaveRules, useDeleteRule } from '@/hooks';
import { PromptxyRule } from '@/types';
import { validateRule, createDefaultRule } from '@/utils';
import { generateUUID } from '@/utils/formatter';

export const RulesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { rules, isLoading, refetch } = useRules();
  const saveRulesMutation = useSaveRules();
  const deleteRuleMutation = useDeleteRule();

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editingRule, setEditingRule] = useState<PromptxyRule | null>(null);

  // 处理新建规则
  const handleNewRule = () => {
    const newRule = createDefaultRule();
    setEditingRule(newRule);
    onOpen();
  };

  // 处理编辑规则
  const handleEdit = (ruleUuid: string) => {
    const rule = rules.find(r => r.uuid === ruleUuid);
    if (rule) {
      setEditingRule({ ...rule });
      onOpen();
    }
  };

  // 处理复制规则
  const handleCopy = (ruleUuid: string) => {
    const rule = rules.find(r => r.uuid === ruleUuid);
    if (rule) {
      const timestamp = Date.now();
      const copiedRule: PromptxyRule = {
        ...rule,
        uuid: `rule-${generateUUID()}`,
        name: `${rule.name}_${timestamp}`,
        createdAt: undefined,
        updatedAt: undefined,
      };
      setEditingRule(copiedRule);
      onOpen();
    }
  };

  // 处理删除规则
  const handleDelete = async (ruleUuid: string) => {
    const rule = rules.find(r => r.uuid === ruleUuid);
    if (confirm(`确定要删除规则 ${rule?.name} 吗？`)) {
      try {
        await deleteRuleMutation.mutateAsync(ruleUuid);
        refetch();
      } catch (error: any) {
        alert(`删除失败: ${error?.message}`);
      }
    }
  };

  // 处理切换启用状态（使用乐观更新）
  const handleToggle = async (rule: PromptxyRule) => {
    // 立即更新缓存，UI 会立即响应
    const newEnabled = !rule.enabled;
    queryClient.setQueryData(['rules'], (oldRules: PromptxyRule[] | undefined) => {
      if (!oldRules) return [];
      return oldRules.map(r => (r.uuid === rule.uuid ? { ...r, enabled: newEnabled } : r));
    });

    // 然后调用 API
    const updatedRule = { ...rule, enabled: newEnabled };
    const updatedRules = rules.map(r => (r.uuid === rule.uuid ? updatedRule : r));
    try {
      await saveRulesMutation.mutateAsync(updatedRules);
    } catch (error: any) {
      // 如果失败，回滚状态
      queryClient.setQueryData(['rules'], (oldRules: PromptxyRule[] | undefined) => {
        if (!oldRules) return [];
        return oldRules.map(r => (r.uuid === rule.uuid ? { ...r, enabled: rule.enabled } : r));
      });
      alert(`更新失败: ${error?.message}`);
    }
  };

  // 保存规则
  const handleSave = async (rule: PromptxyRule) => {
    const validation = validateRule(rule);
    if (!validation.valid) {
      alert(`验证失败:\n${validation.errors.join('\n')}`);
      return;
    }

    // 检查是否已存在（通过 uuid 判断）
    const existingIndex = rules.findIndex(r => r.uuid === rule.uuid);
    let updatedRules: PromptxyRule[];

    if (existingIndex >= 0) {
      // 更新现有规则
      updatedRules = rules.map(r => (r.uuid === rule.uuid ? rule : r));
    } else {
      // 添加新规则
      updatedRules = [...rules, rule];
    }

    try {
      await saveRulesMutation.mutateAsync(updatedRules);
      onClose();
      setEditingRule(null);
      refetch();
    } catch (error: any) {
      alert(`保存失败: ${error?.message}`);
    }
  };

  const handleCancel = () => {
    onClose();
    setEditingRule(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-primary to-accent-purple bg-clip-text text-transparent">
            规则管理
          </h1>
          <p className="text-sm text-secondary mt-1">
            创建和管理请求修改规则，支持复杂的匹配和替换逻辑
          </p>
        </div>
        <div className="flex gap-2">
          <Chip color="primary" variant="flat" size="sm">
            {rules.length} 条规则
          </Chip>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
          <CardBody className="p-p4">
            <div className="text-sm text-brand-primary dark:text-brand-primary/80 font-medium">已启用</div>
            <div className="text-2xl font-bold text-brand-primary dark:text-brand-primary/90">
              {rules.filter(r => r.enabled !== false).length}
            </div>
          </CardBody>
        </Card>
        <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
          <CardBody className="p-p4">
            <div className="text-sm text-accent-purple dark:text-accent-purple/80 font-medium">已禁用</div>
            <div className="text-2xl font-bold text-accent-purple dark:text-accent-purple/90">
              {rules.filter(r => r.enabled === false).length}
            </div>
          </CardBody>
        </Card>
        <Card className="border border-brand-primary/30 dark:border-brand-primary/20 bg-gradient-to-br from-elevated to-brand-primary/10 dark:from-elevated dark:to-brand-primary/5">
          <CardBody className="p-p4">
            <div className="text-sm text-status-success dark:text-status-success/80 font-medium">总规则数</div>
            <div className="text-2xl font-bold text-status-success dark:text-status-success/90">
              {rules.length}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 规则列表组件 */}
      <RuleList
        rules={rules}
        isLoading={isLoading}
        onEdit={handleEdit}
        onCopy={handleCopy}
        onDelete={handleDelete}
        onToggle={handleToggle}
        onNewRule={handleNewRule}
      />

      {/* 规则编辑器模态框 */}
      <Modal
        isOpen={isOpen}
        onClose={handleCancel}
        placement="center"
        size="2xl"
        backdrop="blur"
        scrollBehavior="outside"
      >
        <ModalContent>
          <ModalHeader>{editingRule ? '编辑规则' : '新建规则'}</ModalHeader>
          <ModalBody>
            <RuleEditor rule={editingRule} onSave={handleSave} onCancel={handleCancel} />
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
};
