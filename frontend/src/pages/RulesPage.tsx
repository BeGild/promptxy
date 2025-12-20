import React, { useState, useEffect } from "react";
import { Spacer, Button, useDisclosure } from "@heroui/react";
import { RuleList, RuleEditor } from "@/components/rules";
import { Modal } from "@/components/common";
import { useRules, useSaveRules, useDeleteRule } from "@/hooks";
import { useUIStore } from "@/store";
import { PromptxyRule } from "@/types";
import { validateRule } from "@/utils";

export const RulesPage: React.FC = () => {
  const { rules, isLoading, refetch } = useRules();
  const saveRulesMutation = useSaveRules();
  const deleteRuleMutation = useDeleteRule();

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editingRule, setEditingRule] = useState<PromptxyRule | null>(null);

  // 处理新建规则
  const handleNewRule = () => {
    const newRule: PromptxyRule = {
      id: `rule-${Date.now()}`,
      description: "",
      when: { client: "claude", field: "system" },
      ops: [{ type: "append", text: "\n\n" }],
      enabled: true,
    };
    setEditingRule(newRule);
    onOpen();
  };

  // 处理编辑规则
  const handleEdit = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (rule) {
      setEditingRule({ ...rule });
      onOpen();
    }
  };

  // 处理删除规则
  const handleDelete = async (ruleId: string) => {
    if (confirm(`确定要删除规则 ${ruleId} 吗？`)) {
      try {
        await deleteRuleMutation.mutateAsync(ruleId);
        refetch();
      } catch (error: any) {
        alert(`删除失败: ${error?.message}`);
      }
    }
  };

  // 处理切换启用状态
  const handleToggle = async (rule: PromptxyRule) => {
    const updatedRule = { ...rule, enabled: !rule.enabled };
    const updatedRules = rules.map((r) => (r.id === rule.id ? updatedRule : r));
    try {
      await saveRulesMutation.mutateAsync(updatedRules);
      refetch();
    } catch (error: any) {
      alert(`更新失败: ${error?.message}`);
    }
  };

  // 保存规则
  const handleSave = async (rule: PromptxyRule) => {
    const validation = validateRule(rule);
    if (!validation.valid) {
      alert(`验证失败:\n${validation.errors.join("\n")}`);
      return;
    }

    // 检查是否已存在
    const existingIndex = rules.findIndex((r) => r.id === rule.id);
    let updatedRules: PromptxyRule[];

    if (existingIndex >= 0) {
      // 更新现有规则
      updatedRules = rules.map((r) => (r.id === rule.id ? rule : r));
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
    <div style={{ padding: "16px" }}>
      <RuleList
        rules={rules}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggle={handleToggle}
        onNewRule={handleNewRule}
      />

      {/* 规则编辑器模态框 */}
      <Modal
        isOpen={isOpen}
        onClose={handleCancel}
        title={editingRule ? "编辑规则" : "新建规则"}
        size="2xl"
      >
        <RuleEditor
          rule={editingRule}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </Modal>
    </div>
  );
};
