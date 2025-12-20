import React from "react";
import { Card, Text, Badge, Button, Spacer, Row, Switch, Tooltip } from "@heroui/react";
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
    <Card variant="bordered" css={{ p: "$4", mb: "$3" }}>
      <Row justify="space-between" align="center">
        <Text h4 css={{ m: 0 }}>
          {rule.id}
        </Text>
        <Badge color={enabled ? "success" : "default"} variant="flat">
          {enabled ? "启用" : "禁用"}
        </Badge>
      </Row>

      {rule.description && (
        <>
          <Spacer y={0.5} />
          <Text color="$textSecondary" size="$sm">
            {rule.description}
          </Text>
        </>
      )}

      <Spacer y={1} />

      <Row wrap="wrap" css={{ gap: "$2" }}>
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
      </Row>

      {rule.when.pathRegex && (
        <>
          <Spacer y={0.5} />
          <Text size="$sm" css={{ fontFamily: "monospace" }}>
            path: {rule.when.pathRegex}
          </Text>
        </>
      )}

      {rule.when.modelRegex && (
        <>
          <Spacer y={0.5} />
          <Text size="$sm" css={{ fontFamily: "monospace" }}>
            model: {rule.when.modelRegex}
          </Text>
        </>
      )}

      <Spacer y={1.5} />

      <Row justify="flex-end" gap={1}>
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
      </Row>
    </Card>
  );
};
