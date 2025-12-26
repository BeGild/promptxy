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
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            规则管理
          </h1>
          <p className="text-sm text-gray-500 mt-1">
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
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/10 border-none">
          <CardBody className="p-4">
            <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">已启用</div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {rules.filter(r => r.enabled !== false).length}
            </div>
          </CardBody>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/10 border-none">
          <CardBody className="p-4">
            <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">已禁用</div>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {rules.filter(r => r.enabled === false).length}
            </div>
          </CardBody>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/10 border-none">
          <CardBody className="p-4">
            <div className="text-sm text-green-700 dark:text-green-300 font-medium">总规则数</div>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
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
