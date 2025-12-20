import React, { useState, useEffect } from "react";
import {
  Input,
  Textarea,
  Select,
  SelectItem,
  Spacer,
  Button,
  Checkbox,
  Card,
  CardBody,
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

  const updateOp = (index: number, updates: any) => {
    setFormData((prev) => ({
      ...prev,
      ops: prev.ops.map((op, i) => (i === index ? ({ ...op, ...updates } as PromptxyOp) : op)),
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
          <Card>
            <CardBody style={{ padding: "12px", background: "var(--heroui-colors-danger-100)" }}>
              <div style={{ fontWeight: "bold", color: "var(--heroui-colors-danger)", marginBottom: "4px" }}>
                验证错误:
              </div>
              {validation.errors.map((err, i) => (
                <div key={i} style={{ color: "var(--heroui-colors-danger)", fontSize: "12px" }}>
                  • {err}
                </div>
              ))}
            </CardBody>
          </Card>
          <Spacer y={1} />
        </>
      )}

      {/* 警告显示 */}
      {validation.warnings.length > 0 && (
        <>
          <Card>
            <CardBody style={{ padding: "12px", background: "var(--heroui-colors-warning-100)" }}>
              <div style={{ fontWeight: "bold", color: "var(--heroui-colors-warning)", marginBottom: "4px" }}>
                警告:
              </div>
              {validation.warnings.map((warn, i) => (
                <div key={i} style={{ color: "var(--heroui-colors-warning)", fontSize: "12px" }}>
                  • {warn}
                </div>
              ))}
            </CardBody>
          </Card>
          <Spacer y={1} />
        </>
      )}

      {/* 基本信息 */}
      <h4 style={{ marginBottom: "8px" }}>基本信息</h4>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <div style={{ gridColumn: "span 2" }}>
          <Input
            label="规则ID"
            placeholder="rule-xxx"
            value={formData.id}
            onChange={(e) => updateField("id", e.target.value)}
            style={{ width: "100%" }}
            required
          />
        </div>
        <div style={{ gridColumn: "span 1" }}>
          <Button size="sm" variant="flat" onPress={generateNewId} style={{ width: "100%" }}>
            生成UUID
          </Button>
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <Textarea
            label="描述 (可选)"
            placeholder="描述这条规则的作用..."
            value={formData.description || ""}
            onChange={(e) => updateField("description", e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <Spacer y={2} />

      {/* 匹配条件 */}
      <h4 style={{ marginBottom: "8px" }}>匹配条件 (When)</h4>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <div>
          <Select
            label="客户端"
            selectedKeys={[formData.when.client]}
            onChange={(e) => updateField("when.client", e.target.value)}
            style={{ width: "100%" }}
          >
            {CLIENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </Select>
        </div>
        <div>
          <Select
            label="字段"
            selectedKeys={[formData.when.field]}
            onChange={(e) => updateField("when.field", e.target.value)}
            style={{ width: "100%" }}
          >
            {FIELD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </Select>
        </div>
        <div>
          <Input
            label="HTTP方法 (可选)"
            placeholder="GET, POST..."
            value={formData.when.method || ""}
            onChange={(e) => updateField("when.method", e.target.value || undefined)}
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <Input
            label="路径正则 (可选)"
            placeholder="^/v1/messages$"
            value={formData.when.pathRegex || ""}
            onChange={(e) => updateField("when.pathRegex", e.target.value || undefined)}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <Input
            label="模型正则 (可选)"
            placeholder="claude-3"
            value={formData.when.modelRegex || ""}
            onChange={(e) => updateField("when.modelRegex", e.target.value || undefined)}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <Spacer y={2} />

      {/* 操作序列 */}
      <h4 style={{ marginBottom: "8px" }}>操作序列 (Ops)</h4>
      <div style={{ fontSize: "12px", color: "var(--heroui-colors-text-secondary)", marginBottom: "12px" }}>
        按顺序执行操作，支持拖拽调整顺序（暂未实现）
      </div>

      {formData.ops.map((op, index) => (
        <Card key={index} style={{ padding: "16px", marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <Chip color="primary" size="sm">
              操作 {index + 1}
            </Chip>
            <Button size="sm" color="danger" variant="light" onPress={() => removeOp(index)}>
              删除
            </Button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              <div style={{ gridColumn: "span 1" }}>
                <Select
                  label="类型"
                  selectedKeys={[op.type]}
                  onChange={(e) => updateOp(index, { type: e.target.value as PromptxyOpType })}
                  style={{ width: "100%" }}
                >
                  {OP_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              {/* 动态字段 */}
              {(op.type === "set" || op.type === "append" || op.type === "prepend") && (
                <div style={{ gridColumn: "span 2" }}>
                  <Textarea
                    label="文本"
                    placeholder="输入文本内容..."
                    value={op.text || ""}
                    onChange={(e) => updateOp(index, { text: e.target.value })}
                    style={{ width: "100%" }}
                    minRows={1}
                  />
                </div>
              )}

              {(op.type === "replace" || op.type === "delete") && (
                <>
                  <div style={{ gridColumn: "span 1" }}>
                    <Input
                      label="匹配文本 (可选)"
                      placeholder="要匹配的文本"
                      value={op.match || ""}
                      onChange={(e) => updateOp(index, { match: e.target.value || undefined })}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div style={{ gridColumn: "span 1" }}>
                    <Input
                      label="正则表达式 (可选)"
                      placeholder="pattern"
                      value={op.regex || ""}
                      onChange={(e) => updateOp(index, { regex: e.target.value || undefined })}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div style={{ gridColumn: "span 1" }}>
                    <Input
                      label="正则标志 (可选)"
                      placeholder="gi"
                      value={op.flags || ""}
                      onChange={(e) => updateOp(index, { flags: e.target.value || undefined })}
                      style={{ width: "100%" }}
                    />
                  </div>
                  {op.type === "replace" && (
                    <div style={{ gridColumn: "span 3" }}>
                      <Input
                        label="替换为"
                        placeholder="替换后的文本"
                        value={op.replacement || ""}
                        onChange={(e) => updateOp(index, { replacement: e.target.value })}
                        style={{ width: "100%" }}
                      />
                    </div>
                  )}
                </>
              )}

              {(op.type === "insert_before" || op.type === "insert_after") && (
                <>
                  <div style={{ gridColumn: "span 2" }}>
                    <Input
                      label="正则表达式"
                      placeholder="pattern"
                      value={op.regex || ""}
                      onChange={(e) => updateOp(index, { regex: e.target.value })}
                      style={{ width: "100%" }}
                      required
                    />
                  </div>
                  <div style={{ gridColumn: "span 1" }}>
                    <Input
                      label="正则标志 (可选)"
                      placeholder="gi"
                      value={op.flags || ""}
                      onChange={(e) => updateOp(index, { flags: e.target.value || undefined })}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div style={{ gridColumn: "span 3" }}>
                    <Input
                      label="插入文本"
                      placeholder="要插入的文本"
                      value={op.text || ""}
                      onChange={(e) => updateOp(index, { text: e.target.value })}
                      style={{ width: "100%" }}
                      required
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      ))}

      <Button size="sm" variant="flat" onPress={addOp} style={{ width: "100%", marginBottom: "16px" }}>
        + 添加操作
      </Button>

      {/* 高级选项 */}
      <h4 style={{ marginBottom: "8px" }}>高级选项</h4>
      <Checkbox
        checked={formData.stop || false}
        onChange={(e) => updateField("stop", e.target.checked)}
      >
        在此规则后停止执行 (stop)
      </Checkbox>
      <Spacer y={1} />
      <Checkbox
        checked={formData.enabled !== false}
        onChange={(e) => updateField("enabled", e.target.checked)}
      >
        启用此规则
      </Checkbox>

      <Spacer y={3} />

      {/* 操作按钮 */}
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
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
      </div>
    </div>
  );
};
