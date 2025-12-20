import React from "react";
import { Card, CardBody, CardHeader, Badge, Button, Spacer, Switch, Tooltip } from "@heroui/react";
import { PromptxyRule } from "@/types";

interface RuleCardProps {
  rule: PromptxyRule;
  onEdit: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (rule: PromptxyRule) => void;
}

export const RuleCard: React.FC<RuleCardProps> = ({ rule, onEdit, onDelete, onToggle }) => {
  const enabled = rule.enabled !== false;

  return (
    <Card>
      <CardBody style={{ padding: "16px" }}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h4 style={{ margin: 0, fontSize: "18px" }}>{rule.id}</h4>
          <Badge color={enabled ? "success" : "default"} variant="flat">
            {enabled ? "启用" : "禁用"}
          </Badge>
        </div>

        {/* Description */}
        {rule.description && (
          <div style={{ color: "var(--heroui-colors-text-secondary)", fontSize: "14px", marginBottom: "8px" }}>
            {rule.description}
          </div>
        )}

        {/* Tags row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
          <Badge size="sm" color="primary" variant="flat">
            {rule.when.client}
          </Badge>
          <Badge size="sm" color="secondary" variant="flat">
            {rule.when.field}
          </Badge>
          {rule.when.method && (
            <Badge size="sm" color="warning" variant="flat">
              {rule.when.method}
            </Badge>
          )}
          {rule.ops.map((op, i) => (
            <Badge key={i} size="sm" color="default" variant="flat">
              {op.type}
            </Badge>
          ))}
        </div>

        {/* Regex info */}
        {rule.when.pathRegex && (
          <div style={{ fontSize: "12px", fontFamily: "monospace", marginBottom: "4px" }}>
            path: {rule.when.pathRegex}
          </div>
        )}
        {rule.when.modelRegex && (
          <div style={{ fontSize: "12px", fontFamily: "monospace", marginBottom: "8px" }}>
            model: {rule.when.modelRegex}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "4px", marginTop: "8px" }}>
          <Tooltip content={enabled ? "禁用规则" : "启用规则"}>
            <Switch
              size="sm"
              checked={enabled}
              onChange={() => onToggle(rule)}
            />
          </Tooltip>
          <Button size="sm" variant="light" onPress={() => onEdit(rule.id)}>
            编辑
          </Button>
          <Button size="sm" color="danger" variant="light" onPress={() => onDelete(rule.id)}>
            删除
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};
