import React, { useState, useEffect } from "react";
import {
  Input,
  Textarea,
  Select,
  SelectItem,
  Spacer,
  Button,
  Checkbox,
  Grid,
  Text,
  Card,
  Row,
  Chip,
} from "@heroui/react";
import { PromptxyRule, PromptxyOp, PromptxyClient, PromptxyField, PromptxyOpType } from "@/types";
import { validateRule, createDefaultRule, generateUUID } from "@/utils";

interface RuleEditorProps {
  rule?: PromptxyRule | null;
  onSave: (rule: PromptxyRule) => void;
  onCancel: () => void;
  onPreview?: (rule: PromptxyRule) => void;
}

const CLIENT_OPTIONS = [
  { value: "claude", label: "Claude" },
  { value: "codex", label: "Codex" },
  { value: "gemini", label: "Gemini" },
];

const FIELD_OPTIONS = [
  { value: "system", label: "System" },
  { value: "instructions", label: "Instructions" },
];

const OP_TYPE_OPTIONS = [
  { value: "set", label: "Set (设置)" },
  { value: "append", label: "Append (追加)" },
  { value: "prepend", label: "Prepend (前置)" },
  { value: "replace", label: "Replace (替换)" },
  { value: "delete", label: "Delete (删除)" },
  { value: "insert_before", label: "Insert Before (前插)" },
  { value: "insert_after", label: "Insert After (后插)" },
];

export const RuleEditor: React.FC<RuleEditorProps> = ({
  rule,
  onSave,
  onCancel,
  onPreview,
}) => {
  const [formData, setFormData] = useState<PromptxyRule>(rule || createDefaultRule());
  const [validation, setValidation] = useState({ valid: true, errors: [] as string[], warnings: [] as string[] });

  useEffect(() => {
    if (rule) {
      setFormData(rule);
    }
  }, [rule]);

  useEffect(() => {
    const result = validateRule(formData);
    setValidation(result);
  }, [formData]);

  const updateField = (path: string, value: any) => {
    setFormData((prev) => {
      const newData = { ...prev };
      const keys = path.split(".");
      let current: any = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const addOp = () => {
    const newOp: PromptxyOp = { type: "append", text: "" };
    setFormData((prev) => ({
      ...prev,
      ops: [...prev.ops, newOp],
    }));
  };

  const updateOp = (index: number, updates: Partial<PromptxyOp>) => {
    setFormData((prev) => ({
      ...prev,
      ops: prev.ops.map((op, i) => (i === index ? { ...op, ...updates } : op)),
    }));
  };

  const removeOp = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      ops: prev.ops.filter((_, i) => i !== index),
    }));
  };

  const handleSave = () => {
    if (validation.valid) {
      onSave(formData);
    }
  };

  const handlePreview = () => {
    if (onPreview && validation.valid) {
      onPreview(formData);
    }
  };

  const generateNewId = () => {
    setFormData((prev) => ({ ...prev, id: `rule-${generateUUID()}` }));
  };

  return (
    <div style={{ maxHeight: "70vh", overflowY: "auto", padding: "4px" }}>
      {/* 验证错误显示 */}
      {!validation.valid && (
        <>
          <Card variant="flat" color="danger" css={{ p: "$3", mb: "$4" }}>
            <Text color="danger" b>
              验证错误:
            </Text>
            {validation.errors.map((err, i) => (
              <Text key={i} color="danger" size="$sm">
                • {err}
              </Text>
            ))}
          </Card>
          <Spacer y={1} />
        </>
      )}

      {/* 警告显示 */}
      {validation.warnings.length > 0 && (
        <>
          <Card variant="flat" color="warning" css={{ p: "$3", mb: "$4" }}>
            <Text color="warning" b>
              警告:
            </Text>
            {validation.warnings.map((warn, i) => (
              <Text key={i} color="warning" size="$sm">
                • {warn}
              </Text>
            ))}
          </Card>
          <Spacer y={1} />
        </>
      )}

      {/* 基本信息 */}
      <Text h4>基本信息</Text>
      <Grid.Container gap={1}>
        <Grid xs={12} md={8}>
          <Input
            label="规则ID"
            placeholder="rule-xxx"
            value={formData.id}
            onChange={(e) => updateField("id", e.target.value)}
            fullWidth
            required
          />
        </Grid>
        <Grid xs={12} md={4} style={{ display: "flex", alignItems: "flex-end" }}>
          <Button size="sm" variant="flat" onPress={generateNewId} fullWidth>
            生成UUID
          </Button>
        </Grid>
        <Grid xs={12}>
          <Textarea
            label="描述 (可选)"
            placeholder="描述这条规则的作用..."
            value={formData.description || ""}
            onChange={(e) => updateField("description", e.target.value)}
            fullWidth
          />
        </Grid>
      </Grid.Container>

      <Spacer y={2} />

      {/* 匹配条件 */}
      <Text h4>匹配条件 (When)</Text>
      <Grid.Container gap={1}>
        <Grid xs={12} md={6}>
          <Select
            label="客户端"
            selectedKeys={[formData.when.client]}
            onChange={(e) => updateField("when.client", e.target.value)}
            fullWidth
          >
            {CLIENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </Select>
        </Grid>
        <Grid xs={12} md={6}>
          <Select
            label="字段"
            selectedKeys={[formData.when.field]}
            onChange={(e) => updateField("when.field", e.target.value)}
            fullWidth
          >
            {FIELD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </Select>
        </Grid>
        <Grid xs={12} md={6}>
          <Input
            label="HTTP方法 (可选)"
            placeholder="GET, POST..."
            value={formData.when.method || ""}
            onChange={(e) => updateField("when.method", e.target.value || undefined)}
            fullWidth
          />
        </Grid>
        <Grid xs={12} md={6}>
          <Input
            label="路径正则 (可选)"
            placeholder="^/v1/messages$"
            value={formData.when.pathRegex || ""}
            onChange={(e) => updateField("when.pathRegex", e.target.value || undefined)}
            fullWidth
          />
        </Grid>
        <Grid xs={12}>
          <Input
            label="模型正则 (可选)"
            placeholder="claude-3"
            value={formData.when.modelRegex || ""}
            onChange={(e) => updateField("when.modelRegex", e.target.value || undefined)}
            fullWidth
          />
        </Grid>
      </Grid.Container>

      <Spacer y={2} />

      {/* 操作序列 */}
      <Text h4>操作序列 (Ops)</Text>
      <Text size="$sm" color="$textSecondary" css={{ mb: "$3" }}>
        按顺序执行操作，支持拖拽调整顺序（暂未实现）
      </Text>

      {formData.ops.map((op, index) => (
        <Card key={index} variant="bordered" css={{ p: "$4", mb: "$3" }}>
          <Row justify="space-between" align="center" css={{ mb: "$2" }}>
            <Chip color="primary" size="sm">
              操作 {index + 1}
            </Chip>
            <Button size="sm" color="danger" variant="light" onPress={() => removeOp(index)}>
              删除
            </Button>
          </Row>

          <Grid.Container gap={1}>
            <Grid xs={12} md={4}>
              <Select
                label="类型"
                selectedKeys={[op.type]}
                onChange={(e) => updateOp(index, { type: e.target.value as PromptxyOpType })}
                fullWidth
              >
                {OP_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </Select>
            </Grid>

            {/* 动态字段 */}
            {(op.type === "set" || op.type === "append" || op.type === "prepend") && (
              <Grid xs={12} md={8}>
                <Textarea
                  label="文本"
                  placeholder="输入文本内容..."
                  value={op.text || ""}
                  onChange={(e) => updateOp(index, { text: e.target.value })}
                  fullWidth
                  minRows={1}
                />
              </Grid>
            )}

            {(op.type === "replace" || op.type === "delete") && (
              <>
                <Grid xs={12} md={4}>
                  <Input
                    label="匹配文本 (可选)"
                    placeholder="要匹配的文本"
                    value={op.match || ""}
                    onChange={(e) => updateOp(index, { match: e.target.value || undefined })}
                    fullWidth
                  />
                </Grid>
                <Grid xs={12} md={4}>
                  <Input
                    label="正则表达式 (可选)"
                    placeholder="pattern"
                    value={op.regex || ""}
                    onChange={(e) => updateOp(index, { regex: e.target.value || undefined })}
                    fullWidth
                  />
                </Grid>
                <Grid xs={12} md={4}>
                  <Input
                    label="正则标志 (可选)"
                    placeholder="gi"
                    value={op.flags || ""}
                    onChange={(e) => updateOp(index, { flags: e.target.value || undefined })}
                    fullWidth
                  />
                </Grid>
                {op.type === "replace" && (
                  <Grid xs={12}>
                    <Input
                      label="替换为"
                      placeholder="替换后的文本"
                      value={op.replacement || ""}
                      onChange={(e) => updateOp(index, { replacement: e.target.value })}
                      fullWidth
                    />
                  </Grid>
                )}
              </>
            )}

            {(op.type === "insert_before" || op.type === "insert_after") && (
              <>
                <Grid xs={12} md={6}>
                  <Input
                    label="正则表达式"
                    placeholder="pattern"
                    value={op.regex || ""}
                    onChange={(e) => updateOp(index, { regex: e.target.value })}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid xs={12} md={3}>
                  <Input
                    label="正则标志 (可选)"
                    placeholder="gi"
                    value={op.flags || ""}
                    onChange={(e) => updateOp(index, { flags: e.target.value || undefined })}
                    fullWidth
                  />
                </Grid>
                <Grid xs={12} md={3}>
                  <Input
                    label="插入文本"
                    placeholder="要插入的文本"
                    value={op.text || ""}
                    onChange={(e) => updateOp(index, { text: e.target.value })}
                    fullWidth
                    required
                  />
                </Grid>
              </>
            )}
          </Grid.Container>
        </Card>
      ))}

      <Button size="sm" variant="flat" onPress={addOp} css={{ width: "100%", mb: "$4" }}>
        + 添加操作
      </Button>

      {/* 高级选项 */}
      <Text h4>高级选项</Text>
      <Checkbox
        isSelected={formData.stop || false}
        onChange={(e) => updateField("stop", e.target.checked)}
      >
        在此规则后停止执行 (stop)
      </Checkbox>
      <Spacer y={1} />
      <Checkbox
        isSelected={formData.enabled !== false}
        onChange={(e) => updateField("enabled", e.target.checked)}
      >
        启用此规则
      </Checkbox>

      <Spacer y={3} />

      {/* 操作按钮 */}
      <Row gap={1} justify="flex-end">
        {onPreview && (
          <Button color="warning" variant="flat" onPress={handlePreview}>
            预览
          </Button>
        )}
        <Button variant="light" onPress={onCancel}>
          取消
        </Button>
        <Button color="primary" onPress={handleSave} isDisabled={!validation.valid}>
          保存
        </Button>
      </Row>
    </div>
  );
};
